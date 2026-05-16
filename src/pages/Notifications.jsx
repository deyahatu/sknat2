import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { api } from '../utils/api';
import Skeleton from '../components/shared/Skeleton';
import './Notifications.css';

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
    <div className="page notif-page">
      <div className="notif-inner">
        <div className="notif-header">
          <h1 className="notif-title"><FiBell /> الإشعارات</h1>
          {unreadCount > 0 && (
            <button className="notif-read-all-btn" onClick={handleReadAll}>
              قراءة الكل
            </button>
          )}
        </div>

        {loading && (
          <div className="notif-loading">
            <Skeleton height={40} />
            <div className="notif-loading-gap" />
            <Skeleton height={20} count={5} />
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <FiBell size={36} color="#d1d5db" />
            </div>
            <h3 className="notif-empty-title">لا يوجد إشعارات</h3>
            <p className="notif-empty-subtitle">ستظهر إشعاراتك هنا عند وصولها</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="notif-list">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item${n.isRead ? '' : ' notif-item-unread'}`}
                data-clickable={n.url ? 'true' : 'false'}
                onClick={() => handleClick(n)}
                onMouseEnter={(e) => { if (n.url) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = n.isRead ? '#fff' : '#eef2ff'; }}
              >
                <div className="notif-item-content">
                  <div className={`notif-item-title ${n.isRead ? 'read' : 'unread'}`}>
                    {n.title}
                  </div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && <div className="notif-item-dot" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
