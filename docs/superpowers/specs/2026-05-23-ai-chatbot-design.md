# Sakanat AI Chatbot — Design Spec

**Date:** 2026-05-23
**Status:** Draft
**Author:** Mahdy + Claude

## Goal

Add an AI assistant chatbot to Sakanat that helps students, property owners, and visitors with anything related to the platform — and only the platform. It must refuse off-topic questions politely.

## Scope

The bot must handle four kinds of requests:

1. **How-to** — explain booking, payment, listing, withdrawal, account flows.
2. **Personal data** — the user's bookings, properties, wallet balance, notifications (authed users only).
3. **Property search in natural language** — e.g., "apartment near university X under 1500".
4. **FAQs / policies** — refund rules, fees, support contact.

Off-topic questions (math, jokes, world news, code help, anything not about Sakanat) must be refused with a short message redirecting back to platform topics.

## Non-Goals

- No voice input/output.
- No multilingual translation layer — the LLM handles Arabic + English natively.
- No RAG / vector DB. FAQ is a small static JSON; search is via tool calls into Prisma.
- No streaming responses in v1 (non-streaming completion). Streaming is a v2 enhancement.
- No proactive notifications from the bot.
- No admin-facing tools (admins use the dashboard).

## Architecture

```
React ChatWidget (floating button, popup chat)
  │  POST /api/chat/message  { sessionId?, content }
  ▼
Express route /api/chat/message
  │
  ├─ Rate-limit (express-rate-limit, separate bucket per user OR IP)
  ├─ Resolve user from JWT cookie (optional)
  ├─ Load or create ChatSession
  │     - authed → DB row keyed by sessionId + userId
  │     - guest → ephemeral; client sends full short history each call (capped)
  ├─ Append user message to message array
  ├─ Filter TOOL_DEFS by access (public / authed / owner)
  ├─ Call Anthropic Messages API
  │     model: claude-haiku-4-5-20251001
  │     system: scope-locking prompt + role context
  │     tools: filtered defs
  │     prompt caching: cache system prompt + tool defs
  ├─ While response.stop_reason === "tool_use":
  │     execute each tool_use block via TOOL_EXECUTORS
  │     append tool_result blocks
  │     re-call Anthropic (max 5 hops)
  ├─ Persist assistant turn + tool turns + token usage (authed only)
  └─ Return { sessionId, assistantText, structuredCards? }
```

## Data Model

```prisma
enum ChatRole {
  user
  assistant
  tool
}

model ChatSession {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  ChatMessage[]

  @@index([userId, updatedAt])
}

model ChatMessage {
  id         String      @id @default(cuid())
  sessionId  String
  session    ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role       ChatRole
  content    String
  toolName   String?
  toolInput  Json?
  toolOutput Json?
  tokensIn   Int?
  tokensOut  Int?
  createdAt  DateTime    @default(now())

  @@index([sessionId, createdAt])
}
```

Add `chatSessions ChatSession[]` relation on `User`.

Guest sessions are **not** persisted. The client holds the rolling message array in `localStorage` (capped at last 20 turns) and sends it with each request.

## Tool Definitions

Defined in `server/src/utils/chatTools.js`. Each tool has a JSON schema + an executor that runs with `{ userId, userRole, prisma }`.

| Tool | Access | Purpose |
|------|--------|---------|
| `search_properties` | public | Filter listings by city, price, type, university proximity, beds |
| `get_my_bookings` | authed (any role) | List the user's bookings, optional status filter |
| `get_my_properties` | authed + role=OWNER | List the owner's properties |
| `get_my_wallet` | authed | Balance + recent transactions |
| `get_faq` | public | Look up static FAQ entry by topic key |

**Access filter**: route resolves the user's role first, then passes only the allowed subset of `TOOL_DEFS` into the Anthropic call. The LLM never sees tools it cannot use.

**FAQ source**: `server/src/data/faq.json` — flat object keyed by topic. Editable without code changes. Topics: `refund`, `payment`, `withdrawal`, `booking_process`, `property_listing`, `account`, `support`, `fees`.

**Tool execution caps**: 5 tool hops per turn maximum; if exceeded, return the last assistant text with a "couldn't fully resolve" footer.

## System Prompt (Scope Lock)

```
You are Sakanat Assistant, an AI helper exclusively for the Sakanat student housing platform.

ALLOWED:
- Explaining Sakanat features (booking, payments, listing, withdrawals, wallet, reviews).
- Answering with the user's own data via tools (bookings, properties, balance).
- Searching property listings via the search_properties tool.
- Pointing users to relevant pages or support.

NOT ALLOWED — REFUSE politely:
- General knowledge questions (math, history, news, weather).
- Code help, programming questions.
- Personal advice unrelated to housing.
- Anything not about Sakanat.

When refusing, say briefly: "أنا مساعد منصة سكنات. أقدر أساعدك بأي شي يخص الحجز، العقارات، الدفع، أو حسابك. تقدر تسألني عن واحد منهم؟" (or English equivalent if user wrote in English).

Match the user's language (Arabic ⇄ English). Be concise. Use tool calls instead of guessing facts about user data or listings.

User context: { role: STUDENT | OWNER | GUEST, name?, id? }
```

A second-pass classifier is **not** used. Scope enforcement is system-prompt only; we accept that a determined user can occasionally slip the bot, and we treat that as a low-severity issue (the bot is a help feature, not a security boundary).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/message` | optional | Main message endpoint. Body: `{ sessionId?, content, guestHistory? }`. Returns `{ sessionId, message, usage }`. |
| GET | `/api/chat/sessions` | required | List authed user's sessions (id, title, updatedAt). |
| GET | `/api/chat/sessions/:id` | required | Full message history for a session (owner-only). |
| DELETE | `/api/chat/sessions/:id` | required | Delete a session and its messages. |

Rate limits (in addition to global):

- Authed: 30 messages / 5 minutes per user.
- Guest: 10 messages / 5 minutes per IP.

Exceeding returns 429 with a user-facing Arabic + English message.

## Frontend

**Component:** `src/components/ChatWidget.jsx`

- Floating circular button bottom-right (z-index above app, below modals).
- Click → expands popup panel (~360×520px on desktop, full-sheet on mobile).
- Header: title + close + "new chat" button.
- Body: message list (user right, assistant left), property cards inline when tool returns listings, FAQ snippets styled as info boxes.
- Footer: textarea + send button + Enter-to-send. Shows typing indicator while waiting.

**State:** lifted via `src/context/ChatContext.jsx`. Stores: sessionId, messages, isLoading, isOpen.

**Persistence:**
- Authed: sessionId persisted in `localStorage`; sidebar shows past sessions (lazy-loaded from `/api/chat/sessions`).
- Guest: full message array in `localStorage` (capped 20 turns), cleared on logout/reset.

**Mount:** `src/App.jsx` — render `<ChatWidget />` once at root inside `<AuthProvider>` and `<ChatProvider>`.

**Styling:** Tailwind utility classes, matches existing app theme (primary color, rounded corners, soft shadow). RTL-aware via `dir="auto"` on message text.

## Error Handling

- Anthropic API failure → 502 with `{ error: "AI_UNAVAILABLE" }`; widget shows "تعذّر الاتصال بالمساعد. حاول لاحقاً."
- Tool executor throws → tool_result block contains `{ error: "...". }`; LLM gets it and responds gracefully.
- Validation error on input → 400 with field info.
- Rate limit → 429 with retry-after seconds.
- Unauthed accessing authed tool → never happens (filtered before LLM call), but defense-in-depth: each executor re-checks userId/role and throws if missing.

## Configuration

New env vars in `server/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
CHATBOT_MODEL=claude-haiku-4-5-20251001
CHATBOT_MAX_TOKENS=1024
CHATBOT_GUEST_DAILY_LIMIT=20
```

Add `@anthropic-ai/sdk` to `server/package.json`.

## Cost / Usage Controls

- `max_tokens` capped at 1024 per response.
- Prompt caching on system prompt + tool defs (saves on repeated calls).
- Per-user rate limits (above) prevent abuse.
- Token usage stored on each authed assistant message → admin dashboard can later aggregate cost per user/day.

## Testing

Manual test plan (no automated test framework currently set up in the project — to be added later as the project grows):

1. **Scope refusal**: ask "what's 2+2", "tell me a joke", "write Python code" → all refused politely in user's language.
2. **How-to (guest)**: "how do I book a property?" → uses `get_faq` tool, returns clear answer.
3. **Search (guest)**: "apartment in Riyadh under 1500" → uses `search_properties`, returns ≤5 cards.
4. **My bookings (student, authed)**: "show my bookings" → tool result, listed.
5. **My properties (owner, authed)**: "what listings do I have?" → tool returns owner's list.
6. **Owner trying student data**: an owner asking "show my bookings as renter" still gets their own bookings if any (any authed user can use `get_my_bookings`).
7. **Student trying `get_my_properties`**: tool is filtered out for non-owners, so LLM cannot call it.
8. **Rate limit**: send 11 messages as guest from same IP within 5 min → 429 on the 11th.
9. **Session persistence**: authed user closes browser, returns → previous session visible in sidebar.
10. **Language switching**: alternate between Arabic and English messages — bot follows.

Verification handled per `superpowers:verification-before-completion` before marking the feature complete.

## Open Questions (resolved during brainstorming)

- Provider: Anthropic Claude Haiku 4.5 ✓
- UI: Floating widget ✓
- Access: All users including guests, with role-based tool gating ✓
- History: Persisted for authed only ✓
- Scope: All four categories ✓

## Out of Scope (v2 candidates)

- Streaming responses
- Voice input
- Admin-facing tools
- Multilingual UI labels (currently Arabic-primary; widget chrome will be bilingual)
- Vector RAG over property descriptions for richer semantic search
- Proactive notifications ("your booking expires soon — want me to help renew?")
