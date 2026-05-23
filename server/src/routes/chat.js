import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import OpenAI from 'openai';
import prisma from '../utils/prisma.js';
import { verifyToken } from '../utils/jwt.js';
import { filterToolsByAccess, executeTool } from '../utils/chatTools.js';

const router = Router();

const PROVIDER = process.env.CHATBOT_PROVIDER || 'deepseek';
const MODEL = process.env.CHATBOT_MODEL || 'deepseek-chat';
const MAX_TOKENS = Number(process.env.CHATBOT_MAX_TOKENS || 1024);
const MAX_TOOL_HOPS = 5;
const GUEST_HISTORY_CAP = 20;
// Soft token budget for prior chat history fed back into the model.
// 1 token ≈ 3-4 characters for Arabic, so 12k chars ≈ ~3k tokens.
const HISTORY_CHAR_BUDGET = 12000;

function trimHistoryByBudget(messages, budget = HISTORY_CHAR_BUDGET) {
  // Keep the most recent turns until we fill the budget.
  let used = 0;
  const out = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const len = typeof m.content === 'string' ? m.content.length : 200;
    if (used + len > budget && out.length > 0) break;
    out.unshift(m);
    used += len;
  }
  return out;
}

const PROVIDER_CONFIG = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
};

const cfg = PROVIDER_CONFIG[PROVIDER] || PROVIDER_CONFIG.deepseek;
const apiKey = process.env[cfg.apiKeyEnv];
const client = apiKey
  ? new OpenAI({ apiKey, baseURL: cfg.baseURL })
  : null;

async function softAuth(req, _res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (user && user.isActive !== false) {
        req.user = user;
      }
    }
  } catch {
    // treat as guest
  }
  next();
}

function authedMessageLimiter() {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => `chat-authed-${req.user.id}`,
    handler: (_req, res) =>
      res.status(429).json({
        error: 'تجاوزت الحد المسموح من الرسائل. حاول مجدداً بعد قليل.',
      }),
  });
}

function guestMessageLimiter() {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    keyGenerator: (req, res) => `chat-guest-${ipKeyGenerator(req, res)}`,
    handler: (_req, res) =>
      res.status(429).json({
        error: 'تجاوزت الحد المسموح للزوار. سجّل الدخول للاستفادة الكاملة.',
      }),
  });
}

const authedLimiter = authedMessageLimiter();
const guestLimiter = guestMessageLimiter();

// Heuristic: catches the most common jailbreak phrases. Not airtight, just
// raises the bar so a casual user can't trivially escape the scope by typing
// "ignore previous instructions". Real defense is the limited tool surface.
const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?(instructions|rules|prompt)/i,
  /disregard (all |previous |above )?(instructions|rules|prompt)/i,
  /forget (all |previous |above )?(instructions|rules|prompt)/i,
  /system prompt/i,
  /you are now/i,
  /pretend (to be|you are)/i,
  /\bjailbreak\b/i,
  /تجاهل (التعليمات|السابق|كل)/,
  /انس (التعليمات|كل)/,
  /(تظاهر|تخيل) (انك|أنك)/,
];

function looksLikeInjection(text) {
  if (!text) return false;
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

function roleHint(role) {
  switch (role) {
    case 'OWNER':
      return `Audience: PROPERTY OWNER. Prioritise topics relevant to owners — listing properties, owner dashboard, wallet & withdrawals, bookings on their listings, ratings they received. They cannot book as a student.`;
    case 'STUDENT':
      return `Audience: STUDENT. Prioritise topics relevant to students — searching listings, booking flow, payment, refunds, their bookings, favorites, complaints.`;
    case 'ADMIN':
      return `Audience: ADMIN. Politely note that admin operations are done from the admin dashboard, not this chat.`;
    default:
      return `Audience: GUEST (not logged in). Encourage search and explain features; mention that bookings, wallet, and personal data require sign-in.`;
  }
}

function buildSystemPrompt({ user }) {
  const userBlock = user
    ? `User context: { name: "${user.name}", role: ${user.role} }\n${roleHint(user.role)}`
    : `User context: { role: GUEST }\n${roleHint(null)}`;

  return `You are Sakanat Assistant, an AI helper exclusively for the Sakanat student housing platform.

ABOUT SAKANAT (ground truth — do not contradict this):
- Sakanat is a PALESTINIAN student housing platform serving NABLUS (نابلس) only.
- Audience: students of An-Najah National University (جامعة النجاح الوطنية) in Nablus.
- NOT Saudi, NOT Gulf, NOT other Palestinian cities. Only Nablus.
- Currency: Israeli Shekel (₪ / ILS). NEVER say SAR or ريال سعودي.
- An-Najah has two campuses: OLD (الحرم القديم) and NEW (الحرم الجديد). Listings are tagged with one of these.
- The neighborhood field stores Nablus sub-areas (رفيديا، المساكن، خلة العامود, etc.), NOT the word "نابلس". When calling search_properties, do not pass "نابلس" as the neighborhood — leave it blank unless the user names a specific sub-area.
- If a user asks about a city other than Nablus, politely explain that Sakanat currently serves Nablus / An-Najah students only, and offer to help with Nablus listings.

SEARCH BEHAVIOR:
- Be proactive. When a user mentions any housing intent ("بدي شقة", "ابحثلي", "شو متوفر"), call search_properties immediately with whatever filters they gave (campus, gender, budget, kind).
- If they don't give filters, call it with no filters to surface top listings.
- Always present results clearly: each property has a title, neighborhood, campus, monthly price in ₪, and a url. Suggest they tap the property to see details.
- When zero results, suggest relaxing one filter at a time (raise budget, switch campus, etc.) and offer to re-search.

ALLOWED:
- Explaining Sakanat features (booking, payments, listing, withdrawals, wallet, reviews).
- Answering with the user's own data via the available tools.
- Searching Nablus property listings via the search_properties tool. The tool may return zero results — say so honestly.
- Pointing users to relevant pages or support.
- Calling get_faq with topic "about" if the user asks what Sakanat is.

NOT ALLOWED — REFUSE politely and briefly:
- General knowledge (math, history, news, weather, jokes).
- Code help, programming questions.
- Personal advice unrelated to housing.
- Anything not about Sakanat.

When refusing, say briefly: "أنا مساعد منصة سكنات. أقدر أساعدك بأي شي يخص الحجز، العقارات، الدفع، أو حسابك. تقدر تسألني عن واحد منهم؟" (or the English equivalent if the user wrote in English).

Match the user's language (Arabic ⇄ English). When answering in Arabic, use Palestinian/Levantine dialect (e.g., "بدك" not "تبغى", "هلأ" not "الحين", "كيفك" not "كيف حالك", "شو" not "وش"). Reply ONLY in Arabic or English — never mix in Chinese or other scripts.

Be concise. Use tool calls instead of guessing facts about user data or listings. When property listings are returned, present them clearly with title, city, price in ₪, and the URL provided by the tool.

URL rules: NEVER invent or guess a URL. Only use URLs returned by tool outputs (e.g., the "url" field in search_properties results). Do not link to "sakanat.io" or any external domain. If you want to direct the user to a section of the site, use a relative path like /property/:id or /bookings.

FORMATTING (very important — the chat UI renders plain text only, NOT Markdown):
- Do NOT use Markdown syntax: no **bold**, no __underline__, no [text](url) links, no ### headings, no triple backticks.
- Use plain Arabic/English text with line breaks for structure.
- After search_properties returns results, give a short one-line intro ("لقيتلك X خيارات:") and STOP. The UI renders each property as a clickable card automatically — do not list them again in text and do not include their URLs in the text body. Listing them in text duplicates the cards.

When the tool returns zero results, say so honestly and suggest broader filters.

${userBlock}`;
}

// Convert internal Anthropic-style tool defs to OpenAI function-calling format.
function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema || { type: 'object', properties: {} },
    },
  }));
}

async function runConversation({ user, history, userMessage }) {
  if (!client) {
    const err = new Error('AI_UNAVAILABLE');
    err.status = 503;
    throw err;
  }

  const tools = filterToolsByAccess({
    userId: user?.id,
    userRole: user?.role,
  });
  const system = buildSystemPrompt({ user });

  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const toolCallTrace = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let finalText = '';

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages,
      tools: toOpenAITools(tools),
    });

    totalTokensIn += response.usage?.prompt_tokens || 0;
    totalTokensOut += response.usage?.completion_tokens || 0;

    const choice = response.choices?.[0];
    const msg = choice?.message;
    if (!msg) break;

    // Push assistant message as-is so tool_call_ids stay aligned for follow-ups.
    messages.push(msg);

    const toolCalls = msg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      finalText = (msg.content || '').trim();
      break;
    }

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args = {};
      try {
        args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }
      try {
        const result = await executeTool(
          name,
          { userId: user?.id, userRole: user?.role },
          args,
        );
        toolCallTrace.push({ name, input: args, output: result });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      } catch (e) {
        toolCallTrace.push({ name, input: args, output: { error: e.message } });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: e.message }),
        });
      }
    }
  }

  if (!finalText) {
    finalText =
      'تعذّر إكمال الرد. حاول إعادة صياغة السؤال أو تواصل مع الدعم لو استمرت المشكلة.';
  }

  return {
    text: finalText,
    toolCalls: toolCallTrace,
    usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut },
  };
}

// POST /api/chat/message
router.post(
  '/message',
  softAuth,
  (req, res, next) =>
    req.user ? authedLimiter(req, res, next) : guestLimiter(req, res, next),
  async (req, res, next) => {
    try {
      const { sessionId, content, guestHistory } = req.body || {};
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'الرسالة مطلوبة.' });
      }
      if (content.length > 2000) {
        return res
          .status(400)
          .json({ error: 'الرسالة طويلة جداً. الحد الأقصى 2000 حرف.' });
      }

      // Cheap heuristic guard against the most common jailbreak phrasings.
      if (looksLikeInjection(content)) {
        return res.json({
          sessionId: null,
          message:
            'أنا مساعد منصة سكنات وما بقدر أتجاهل تعليماتي الأساسية. تقدر تسألني عن العقارات، الحجز، الدفع، أو حسابك؟',
          toolCalls: [],
          usage: { tokensIn: 0, tokensOut: 0 },
        });
      }

      let session = null;
      let history = [];
      if (req.user) {
        if (sessionId) {
          session = await prisma.chatSession.findFirst({
            where: { id: sessionId, userId: req.user.id },
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 40,
              },
            },
          });
        }
        if (!session) {
          session = await prisma.chatSession.create({
            data: {
              userId: req.user.id,
              title: content.slice(0, 60),
            },
            include: { messages: true },
          });
        }

        history = session.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content }));
      } else if (Array.isArray(guestHistory)) {
        history = guestHistory
          .slice(-GUEST_HISTORY_CAP)
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string',
          );
      }
      history = trimHistoryByBudget(history);

      const result = await runConversation({
        user: req.user || null,
        history,
        userMessage: content,
      });

      if (session) {
        await prisma.chatMessage.create({
          data: { sessionId: session.id, role: 'user', content },
        });
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: result.text,
            tokensIn: result.usage.tokensIn,
            tokensOut: result.usage.tokensOut,
          },
        });
        await prisma.chatSession.update({
          where: { id: session.id },
          data: { updatedAt: new Date() },
        });
      }

      // Lightweight usage log so the operator can spot cost outliers.
      console.log(
        `[chat] user=${req.user?.id || 'guest'} role=${req.user?.role || 'GUEST'} ` +
          `tokensIn=${result.usage.tokensIn} tokensOut=${result.usage.tokensOut} ` +
          `tools=${result.toolCalls.map((t) => t.name).join(',') || '-'}`,
      );

      res.json({
        sessionId: session?.id || null,
        message: result.text,
        toolCalls: result.toolCalls,
        usage: result.usage,
      });
    } catch (err) {
      if (err.message === 'AI_UNAVAILABLE' || err?.status === 401 || err?.status === 402) {
        return res.status(503).json({
          error: 'خدمة المساعد غير متاحة حالياً. حاول لاحقاً.',
        });
      }
      if (err?.status === 429) {
        return res.status(429).json({
          error: 'الخدمة مزدحمة. حاول مجدداً بعد لحظات.',
        });
      }
      if (err?.status >= 400 && err?.status < 500) {
        console.error('[chat] upstream error:', err.message);
        return res.status(502).json({
          error: 'تعذّر معالجة طلبك حالياً.',
        });
      }
      next(err);
    }
  },
);

router.get('/sessions', softAuth, async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/:id', softAuth, async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/:id', softAuth, async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    await prisma.chatSession.delete({ where: { id: session.id } });
    res.json({ message: 'تم حذف المحادثة.' });
  } catch (err) {
    next(err);
  }
});

export default router;
