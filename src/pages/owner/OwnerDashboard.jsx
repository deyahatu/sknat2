import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiHome, FiClock, FiCheckCircle, FiDollarSign, FiMapPin, FiCalendar, FiTrendingUp, FiStar } from "react-icons/fi";
import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import AnimatedCounter from "../../components/shared/AnimatedCounter";
import Skeleton from "../../components/shared/Skeleton";

function Stars({ rating }) {
  return (
    <span className="owner-stars">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={s <= rating ? "owner-star-filled" : "owner-star-empty"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

const BOOKING_STATUS_MAP = {
  PENDING: { label: "قيد الانتظار", cls: "pending" },
  APPROVED: { label: "مقبول", cls: "approved" },
  REJECTED: { label: "مرفوض", cls: "rejected" },
  PAID: { label: "مدفوع", cls: "paid" },
  COMPLETED: { label: "مكتمل", cls: "completed" },
  CANCELLED: { label: "ملغي", cls: "cancelled" },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "صباح الخير";
  if (hour < 18) return "مساء الخير";
  return "مساء الخير";
}

function getTodayStr() {
  try {
    return new Date().toLocaleDateString("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return new Date().toDateString();
  }
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    properties: 0,
    pending: 0,
    approved: 0,
    balance: 0,
  });
  const [recentRatings, setRecentRatings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [topProperty, setTopProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [propsRes, bookingsRes, earningsRes, ratingsRes] =
          await Promise.all([
            api.properties.mine(),
            api.bookings.ownerList(),
            api.payments.ownerEarnings(),
            api.properties.myRatings(),
          ]);

        const allBookings = bookingsRes.bookings || [];
        const allProperties = propsRes.properties || [];

        setStats({
          properties: allProperties.length,
          pending: allBookings.filter((b) => b.status === "PENDING").length,
          approved: allBookings.filter((b) => b.status === "APPROVED").length,
          balance: Number(earningsRes.wallet?.balance || 0),
        });

        const sorted = [...(ratingsRes.ratings || [])].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
        setRecentRatings(sorted.slice(0, 5));
        setPendingBookings(
          allBookings.filter((b) => b.status === "PENDING").slice(0, 5),
        );

        // Compute the most-booked property (ignoring cancelled/rejected).
        const counts = {};
        allBookings.forEach((b) => {
          if (b.status === "CANCELLED" || b.status === "REJECTED") return;
          const pid = b.property?.id ?? b.propertyId;
          if (pid == null) return;
          counts[pid] = (counts[pid] || 0) + 1;
        });
        const topId = Object.keys(counts).sort(
          (a, b) => counts[b] - counts[a],
        )[0];
        if (topId != null) {
          const prop = allProperties.find(
            (p) => String(p.id) === String(topId),
          );
          if (prop) {
            setTopProperty({ ...prop, bookingCount: counts[topId] });
          }
        }
      } catch {
        // silently fail — partial data is fine for dashboard
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="owner-skeleton-wrap"><Skeleton height={40} /><div className="owner-skeleton-spacer" /><Skeleton height={20} count={5} /></div>;
  }

  const firstName = user?.name?.split(" ")[0] || "";
  const topImage = Array.isArray(topProperty?.images)
    ? topProperty.images[0]
    : null;

  return (
    <>
      {/* Welcome Banner */}
      <div className="owner-welcome">
        <div className="owner-welcome-text">
          <h1 className="owner-welcome-greeting">
            {getGreeting()}، {firstName}
          </h1>
        </div>
        <div className="owner-welcome-date">
          <span className="owner-welcome-date-icon"><FiCalendar /></span>
          <span>{getTodayStr()}</span>
        </div>
      </div>

      <h2 className="owner-page-title">لوحة التحكم</h2>

      {/* Stat Cards */}
      <div className="owner-stats-grid">
        <div className="owner-stat-card blue">
          <div className="owner-stat-icon blue"><FiHome /></div>
          <div className="owner-stat-info">
            <p className="owner-stat-value"><AnimatedCounter end={stats.properties} /></p>
            <p className="owner-stat-label">عقاراتي</p>
          </div>
        </div>
        <div className="owner-stat-card orange">
          <div className="owner-stat-icon orange"><FiClock /></div>
          <div className="owner-stat-info">
            <p className="owner-stat-value"><AnimatedCounter end={stats.pending} /></p>
            <p className="owner-stat-label">طلبات قيد الانتظار</p>
          </div>
        </div>
        <div className="owner-stat-card green">
          <div className="owner-stat-icon green"><FiCheckCircle /></div>
          <div className="owner-stat-info">
            <p className="owner-stat-value"><AnimatedCounter end={stats.approved} /></p>
            <p className="owner-stat-label">طلبات مقبولة</p>
          </div>
        </div>
        <div className="owner-stat-card purple">
          <div className="owner-stat-icon purple"><FiDollarSign /></div>
          <div className="owner-stat-info">
            <p className="owner-stat-value"><AnimatedCounter end={stats.balance} /></p>
            <p className="owner-stat-label">الرصيد المالي</p>
          </div>
        </div>
      </div>

      {/* Top Booked Property — shown only when there are real bookings */}
      {topProperty && topProperty.bookingCount > 0 && (
        <div className="owner-top-property">
          <div className="owner-top-property-header">
            <h2 className="owner-top-property-heading">العقار الأكثر حجزاً</h2>
          </div>
          <div className="owner-top-property-body">
            <div className="owner-top-property-img">
              {topImage ? (
                <img src={topImage} alt={topProperty.title} />
              ) : (
                <span className="owner-top-property-img-placeholder"><FiHome size={32} /></span>
              )}
              <span className="owner-top-property-badge"><FiTrendingUp className="icon-ml" /> الأكثر حجزاً</span>
            </div>
            <div className="owner-top-property-info">
              <h3 className="owner-top-property-title">{topProperty.title}</h3>
              {topProperty.address && (
                <p className="owner-top-property-address">
                  <FiMapPin className="icon-shrink-0" /> {topProperty.address}
                </p>
              )}
              <div className="owner-top-property-stats">
                <span className="owner-top-property-stat primary">
                  <FiCalendar /> {topProperty.bookingCount} حجز
                </span>
                {topProperty.roomVariants?.length > 0 && (
                  <span className="owner-top-property-stat success">
                    <FiDollarSign /> {Number(topProperty.roomVariants[0].fullPrice).toLocaleString('en-US')} ₪
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-column content */}
      <div className="owner-dashboard-grid">
        {/* Recent Ratings */}
        <div className="owner-card">
          <div className="owner-card-header">
            <h2 className="owner-card-title">التقييمات الأخيرة</h2>
            <Link to="/owner/ratings" className="owner-card-link">
              عرض الكل
            </Link>
          </div>
          <div className="owner-card-body">
            {recentRatings.length === 0 ? (
              <div className="owner-empty">لا توجد تقييمات بعد</div>
            ) : (
              recentRatings.map((r) => (
                <div key={r.id} className="owner-list-item">
                  <div className="owner-list-avatar">
                    <FiStar />
                  </div>
                  <div className="owner-list-item-info">
                    <p className="owner-list-item-title">
                      {r.property?.title || "—"}
                    </p>
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
            <Link to="/owner/bookings" className="owner-card-link">
              عرض الكل
            </Link>
          </div>
          <div className="owner-card-body">
            {pendingBookings.length === 0 ? (
              <div className="owner-empty">لا توجد حجوزات معلقة</div>
            ) : (
              pendingBookings.map((b) => {
                const st = BOOKING_STATUS_MAP[b.status] || {
                  label: b.status,
                  cls: "pending",
                };
                return (
                  <div key={b.id} className="owner-list-item">
                    <div className="owner-list-avatar orange">
                      {(b.student?.name || "؟").trim().charAt(0)}
                    </div>
                    <div className="owner-list-item-info">
                      <p className="owner-list-item-title">
                        {b.property?.title || "—"}
                      </p>
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
