import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return 'الآن';
  if (diff < 60) return `منذ ${diff} د`;
  if (diff < 1440) return `منذ ${Math.floor(diff / 60)} س`;
  return `منذ ${Math.floor(diff / 1440)} يوم`;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.notifications.list()
      .then((d) => setNotifications(d.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleClick(n) {
    if (!n.isRead) {
      await api.notifications.read(n.id).catch(() => {});
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    }
    if (n.url) navigate(n.url);
  }

  async function handleReadAll() {
    await api.notifications.readAll().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', direction: 'rtl', padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>الإشعارات</h1>
          {unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              style={{
                background: 'none', border: '1px solid #4f46e5', color: '#4f46e5',
                borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              قراءة الكل
            </button>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 15 }}>جاري التحميل...</div>
        )}

        {!loading && notifications.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 15,
          }}>
            لا يوجد إشعارات
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {notifications.map((n, idx) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '14px 20px',
                  borderBottom: idx < notifications.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: n.isRead ? '#fff' : '#eef2ff',
                  cursor: n.url ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
                onMouseEnter={(e) => { if (n.url) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = n.isRead ? '#fff' : '#eef2ff'; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: n.isRead ? 500 : 700, color: '#111827', marginBottom: 3 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#4f46e5',
                    flexShrink: 0, marginTop: 6,
                  }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
