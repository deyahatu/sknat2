import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './NotificationBell.css';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const allNotificationsPath = user?.role === 'OWNER' ? '/owner/notifications' : '/notifications';

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
    <div className="nb-wrap" ref={ref}>
      <button
        className="nb-btn"
        onClick={() => setOpen(!open)}
      >
        <FiBell />
        {count > 0 && (
          <span className="nb-badge">{count}</span>
        )}
      </button>
      {open && (
        <div className="nb-dropdown">
          <div className="nb-dropdown-header">
            <strong className="nb-dropdown-header-title">الإشعارات</strong>
            {count > 0 && (
              <button onClick={handleReadAll} className="nb-read-all-btn">
                قراءة الكل
              </button>
            )}
          </div>
          <div className="nb-list">
            {notifications.length === 0 && (
              <div className="nb-empty">لا يوجد إشعارات</div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`nb-item ${!n.isRead ? 'nb-item-unread' : ''}`}
              >
                <div className="nb-item-title">{n.title}</div>
                <div className="nb-item-body">{n.body}</div>
                <div className="nb-item-time">{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setOpen(false); navigate(allNotificationsPath); }}
            className="nb-view-all"
          >
            عرض الكل
          </button>
        </div>
      )}
    </div>
  );
}
