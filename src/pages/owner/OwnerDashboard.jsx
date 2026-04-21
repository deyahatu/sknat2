import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';

function Stars({ rating }) {
  return (
    <span className="owner-stars">
      {[1,2,3,4,5].map((s) => (
        <span key={s} className={s <= rating ? 'owner-star-filled' : 'owner-star-empty'}>★</span>
      ))}
    </span>
  );
}

const BOOKING_STATUS_MAP = {
  PENDING: { label: 'قيد الانتظار', cls: 'pending' },
  APPROVED: { label: 'مقبول', cls: 'approved' },
  REJECTED: { label: 'مرفوض', cls: 'rejected' },
  PAID: { label: 'مدفوع', cls: 'paid' },
  COMPLETED: { label: 'مكتمل', cls: 'completed' },
  CANCELLED: { label: 'ملغي', cls: 'cancelled' },
};

export default function OwnerDashboard() {
  const [stats, setStats] = useState({ properties: 0, pending: 0, approved: 0, balance: 0 });
  const [recentRatings, setRecentRatings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [propsRes, bookingsRes, earningsRes, ratingsRes] = await Promise.all([
          api.properties.mine(),
          api.bookings.ownerList(),
          api.payments.ownerEarnings(),
          api.properties.myRatings(),
        ]);

        const allBookings = bookingsRes.bookings || [];
        setStats({
          properties: propsRes.properties?.length || 0,
          pending: allBookings.filter((b) => b.status === 'PENDING').length,
          approved: allBookings.filter((b) => b.status === 'APPROVED').length,
          balance: Number(earningsRes.wallet?.balance || 0),
        });

        const sorted = [...(ratingsRes.ratings || [])].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecentRatings(sorted.slice(0, 5));
        setPendingBookings(allBookings.filter((b) => b.status === 'PENDING').slice(0, 5));
      } catch {
        // silently fail — partial data is fine for dashboard
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="owner-loading">جاري التحميل...</div>;
  }

  return (
    <>
      <h1 className="owner-page-title">لوحة التحكم</h1>

      {/* Stat Cards */}
      <div className="owner-stats-grid">
        <div className="owner-stat-card">
          <div className="owner-stat-icon blue">🏠</div>
          <div className="owner-stat-info">
            <p className="owner-stat-value">{stats.properties}</p>
            <p className="owner-stat-label">عقاراتي</p>
          </div>
        </div>
        <div className="owner-stat-card">
          <div className="owner-stat-icon orange">⏳</div>
          <div className="owner-stat-info">
            <p className="owner-stat-value">{stats.pending}</p>
            <p className="owner-stat-label">طلبات قيد الانتظار</p>
          </div>
        </div>
        <div className="owner-stat-card">
          <div className="owner-stat-icon green">✅</div>
          <div className="owner-stat-info">
            <p className="owner-stat-value">{stats.approved}</p>
            <p className="owner-stat-label">طلبات مقبولة</p>
          </div>
        </div>
        <div className="owner-stat-card">
          <div className="owner-stat-icon purple">💰</div>
          <div className="owner-stat-info">
            <p className="owner-stat-value">{stats.balance.toFixed(2)}</p>
            <p className="owner-stat-label">الرصيد المالي</p>
          </div>
        </div>
      </div>

      {/* Two-column content */}
      <div className="owner-dashboard-grid">
        {/* Recent Ratings */}
        <div className="owner-card">
          <div className="owner-card-header">
            <h2 className="owner-card-title">التقييمات الأخيرة</h2>
            <Link to="/owner/ratings" className="owner-card-link">عرض الكل</Link>
          </div>
          <div className="owner-card-body">
            {recentRatings.length === 0 ? (
              <div className="owner-empty">لا توجد تقييمات بعد</div>
            ) : (
              recentRatings.map((r) => (
                <div key={r.id} className="owner-list-item">
                  <div className="owner-list-item-info">
                    <p className="owner-list-item-title">{r.property?.title || '—'}</p>
                    <p className="owner-list-item-sub">{r.student?.name}</p>
                  </div>
                  <Stars rating={r.rating} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Bookings */}
        <div className="owner-card">
          <div className="owner-card-header">
            <h2 className="owner-card-title">الحجوزات قيد الانتظار</h2>
            <Link to="/owner/bookings" className="owner-card-link">عرض الكل</Link>
          </div>
          <div className="owner-card-body">
            {pendingBookings.length === 0 ? (
              <div className="owner-empty">لا توجد حجوزات معلقة</div>
            ) : (
              pendingBookings.map((b) => {
                const st = BOOKING_STATUS_MAP[b.status] || { label: b.status, cls: 'pending' };
                return (
                  <div key={b.id} className="owner-list-item">
                    <div className="owner-list-item-info">
                      <p className="owner-list-item-title">{b.property?.title || '—'}</p>
                      <p className="owner-list-item-sub">{b.student?.name}</p>
                    </div>
                    <span className={`owner-badge ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
