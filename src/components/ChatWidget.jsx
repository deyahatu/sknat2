import { useState, useRef, useEffect, useCallback } from 'react';
import { FiMessageCircle, FiX, FiSend, FiRefreshCw } from 'react-icons/fi';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './ChatWidget.css';

const GUEST_STORAGE_KEY = 'sakanat_chat_guest_history';
const SESSION_STORAGE_KEY = 'sakanat_chat_session_id';
const GUEST_CAP = 20;

const SUGGESTIONS = [
  'كيف أحجز عقار؟',
  'بدي شقة قريبة من جامعة النجاح',
  'سياسة الاسترداد؟',
  'كيف أسحب أرباحي؟',
];

function extractPropertyCards(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  const last = [...toolCalls].reverse().find((c) => c.name === 'search_properties');
  if (!last) return [];
  return last.output?.properties || [];
}

function Message({ msg }) {
  if (msg.role === 'error') {
    return <div className="cw-msg cw-msg-error">{msg.content}</div>;
  }
  const cls = msg.role === 'user' ? 'cw-msg-user' : 'cw-msg-assistant';
  return (
    <div>
      <div className={`cw-msg ${cls}`} dir="auto">
        {msg.content}
      </div>
      {msg.cards && msg.cards.length > 0 && (
        <div className="cw-cards">
          {msg.cards.map((c) => (
            <a key={c.id} href={c.url} className="cw-card">
              {c.image && <img src={c.image} alt={c.title} className="cw-card-img" />}
              <div className="cw-card-body">
                <div className="cw-card-title" dir="auto">{c.title}</div>
                <div className="cw-card-meta" dir="auto">
                  {c.city}{c.campus ? ` · ${c.campus}` : ''}
                </div>
                {c.minPrice != null && (
                  <div className="cw-card-price">{c.minPrice} ₪ / شهر</div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  // Load persisted state on mount and when auth changes.
  useEffect(() => {
    if (user) {
      const savedId = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedId) {
        setSessionId(savedId);
        api.chat
          .getSession(savedId)
          .then((data) => {
            const restored = (data.session?.messages || [])
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m) => ({ role: m.role, content: m.content }));
            setMessages(restored);
          })
          .catch(() => {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            setSessionId(null);
          });
      }
    } else {
      const raw = localStorage.getItem(GUEST_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setMessages(parsed);
        } catch {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
      }
    }
  }, [user]);

  // Persist guest history.
  useEffect(() => {
    if (user) return;
    const trimmed = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-GUEST_CAP);
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(trimmed));
  }, [messages, user]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus input when opened.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const reset = useCallback(() => {
    if (user && sessionId) {
      api.chat.deleteSession(sessionId).catch(() => {});
    }
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(GUEST_STORAGE_KEY);
  }, [user, sessionId]);

  const send = useCallback(
    async (text) => {
      const content = (text ?? input).trim();
      if (!content || sending) return;
      setInput('');
      const userMsg = { role: 'user', content };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const body = { content };
        if (user) {
          if (sessionId) body.sessionId = sessionId;
        } else {
          body.guestHistory = [...messages, userMsg]
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-GUEST_CAP);
        }
        const res = await api.chat.sendMessage(body);
        if (user && res.sessionId && res.sessionId !== sessionId) {
          setSessionId(res.sessionId);
          localStorage.setItem(SESSION_STORAGE_KEY, res.sessionId);
        }
        const cards = extractPropertyCards(res.toolCalls);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.message, cards },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'error', content: err.message || 'تعذّر إرسال الرسالة' },
        ]);
      } finally {
        setSending(false);
      }
    },
    [input, sending, user, sessionId, messages],
  );

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        className="cw-fab"
        data-open={open}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'إغلاق المساعد' : 'فتح المساعد'}
      >
        {open ? <FiX /> : <FiMessageCircle />}
      </button>

      {open && (
        <div className="cw-panel" role="dialog" aria-label="مساعد سكنات">
          <div className="cw-header">
            <div>
              <div className="cw-header-title">مساعد سكنات</div>
              <div className="cw-header-sub">
                {user ? `مرحباً، ${user.name}` : 'مساعدك للحجز والاستفسارات'}
              </div>
            </div>
            <div className="cw-header-actions">
              {messages.length > 0 && (
                <button className="cw-icon-btn" onClick={reset} aria-label="محادثة جديدة" title="محادثة جديدة">
                  <FiRefreshCw />
                </button>
              )}
              <button className="cw-icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق">
                <FiX />
              </button>
            </div>
          </div>

          <div className="cw-body" ref={bodyRef}>
            {messages.length === 0 ? (
              <div className="cw-empty">
                <h4>مرحباً بك في مساعد سكنات</h4>
                <p>أقدر أساعدك بالحجز، البحث عن عقار، الدفع، وأسئلتك عن المنصة.</p>
                <div className="cw-suggest">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Message key={i} msg={m} />)
            )}
            {sending && (
              <div className="cw-typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <div className="cw-footer">
            <textarea
              ref={inputRef}
              className="cw-input"
              rows={1}
              value={input}
              placeholder="اكتب رسالتك..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={sending}
              dir="auto"
            />
            <button
              className="cw-send"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              aria-label="إرسال"
            >
              <FiSend />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
