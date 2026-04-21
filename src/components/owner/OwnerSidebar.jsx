import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/owner", label: "لوحة التحكم", icon: "⊞", end: true },
  { section: "العقارات" },
  { to: "/owner/properties", label: "عقاراتي", icon: "🏠" },
  { to: "/owner/properties/add", label: "إضافة عقار", icon: "+" },
  { section: "الحجوزات" },
  { to: "/owner/bookings", label: "الحجوزات", icon: "📋" },
  { section: "التقييمات" },
  { to: "/owner/ratings", label: "تقييمات العقارات", icon: "⭐" },
  { to: "/owner/rate-students", label: "تقييم الطلاب", icon: "👤" },
  { section: "المالية" },
  { to: "/owner/bank-account", label: "الحساب البنكي", icon: "🏦" },
  { to: "/owner/withdrawals", label: "طلبات السحب", icon: "💰" },
];

export default function OwnerSidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || "م";

  return (
    <>
      <div
        className={`owner-sidebar-overlay${open ? " open" : ""}`}
        onClick={onClose}
      />
      <aside className={`owner-sidebar${open ? " open" : ""}`}>
        <div className="owner-sidebar-header">
          <span className="owner-sidebar-title">سكنات 🏠</span>
          <button className="owner-sidebar-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="owner-sidebar-user">
          <div className="owner-sidebar-avatar">{initial}</div>
          <div>
            <p className="owner-sidebar-user-name">{user?.name}</p>
            <p className="owner-sidebar-user-role">مالك عقار</p>
          </div>
        </div>

        <nav className="owner-sidebar-nav">
          {NAV_ITEMS.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="owner-sidebar-section">
                  {item.section}
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `owner-sidebar-link${isActive ? " active" : ""}`
                }
                onClick={onClose}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="owner-sidebar-footer">
          <button className="owner-sidebar-logout" onClick={handleLogout}>
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
