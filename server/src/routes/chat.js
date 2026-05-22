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

function buildSystemPrompt({ user }) {
  const userBlock = user
    ? `User context: { name: "${user.name}", role: ${user.role}, id: "${user.id}" }`
    : 'User context: { role: GUEST }';

  return `You are Sakanat Assistant, an AI helper exclusively for the Sakanat student housing platform.

ALLOWED:
- Explaining Sakanat features (booking, payments, listing, withdrawals, wallet, reviews).
- Answering with the user's own data via the available tools.
- Searching property listings via the search_properties tool.
- Pointing users to relevant pages or support.

NOT ALLOWED — REFUSE politely and briefly:
- General knowledge questions (math, history, news, weather).
- Code help, programming questions.
- Personal advice unrelated to housing.
- Anything not about Sakanat.

When refusing, say briefly: "أنا مساعد منصة سكنات. أقدر أساعدك بأي شي يخص الحجز، العقارات، الدفع، أو حسابك. تقدر تسألني عن واحد منهم؟" (or the English equivalent if the user wrote in English).

Match the user's language (Arabic ⇄ English). Be concise. Use tool calls instead of guessing facts about user data or listings. When property listings are returned, present them clearly with title, city, price, and the URL provided.

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
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));
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
