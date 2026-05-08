import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { api } from '../../utils/api';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.notifications.unreadCount().then((d) => setCount(d.count)).catch(() => {});
    const interval = setInterval(() => {
      api.notifications.unreadCount().then((d) => setCount(d.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    api.notifications.list().then((d) => setNotifications((d.notifications || []).slice(0, 10))).catch(() => {});
  }, [open]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return 'الآن';
    if (diff < 60) return `منذ ${diff} د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)} س`;
    return `منذ ${Math.floor(diff / 1440)} يوم`;
  }

  async function handleClick(n) {
    if (!n.isRead) {
      await api.notifications.read(n.id).catch(() => {});
      setCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    }
    setOpen(false);
    if (n.url) navigate(n.url);
  }

  async function handleReadAll() {
    await api.notifications.readAll().catch(() => {});
    setCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="notif-bell-wrap" ref={ref} style={{ position: 'relative' }}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', fontSize: 20, color: '#374151', padding: 8 }}
      >
        <FiBell />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, background: '#dc2626', color: '#fff',
            fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center',
          }}>{count}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, width: 320, background: '#fff',
          borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
          zIndex: 1000, direction: 'rtl', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <strong style={{ fontSize: 15 }}>الإشعارات</strong>
            {count > 0 && (
              <button onClick={handleReadAll} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                قراءة الكل
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>لا يوجد إشعارات</div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f9fafb',
                  background: n.isRead ? '#fff' : '#f0f4ff',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = n.isRead ? '#fff' : '#f0f4ff'}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{n.body}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/notifications'); }}
            style={{
              width: '100%', padding: 12, background: '#f9fafb', border: 'none', borderTop: '1px solid #e5e7eb',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4f46e5', fontFamily: 'inherit',
            }}
          >
            عرض الكل
          </button>
        </div>
      )}
    </div>
  );
}
