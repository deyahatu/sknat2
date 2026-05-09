import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FiGrid, FiHome, FiPlus, FiCalendar, FiStar, FiUser,
  FiCreditCard, FiDollarSign, FiMessageSquare,
  FiSettings, FiLogOut, FiX,
} from "react-icons/fi";

const NAV_ITEMS = [
  { to: "/owner", label: "لوحة التحكم", icon: <FiGrid />, end: true },
  { section: "العقارات" },
  { to: "/owner/properties", label: "عقاراتي", icon: <FiHome /> },
  { to: "/owner/properties/add", label: "إضافة عقار", icon: <FiPlus /> },
  { section: "الحجوزات" },
  { to: "/owner/bookings", label: "الحجوزات", icon: <FiCalendar /> },
  { section: "التقييمات" },
  { to: "/owner/ratings", label: "تقييمات العقارات", icon: <FiStar /> },
  { to: "/owner/rate-students", label: "تقييم الطلاب", icon: <FiUser /> },
  { section: "المالية" },
  { to: "/owner/bank-account", label: "الحساب البنكي", icon: <FiCreditCard /> },
  { to: "/owner/withdrawals", label: "طلبات السحب", icon: <FiDollarSign /> },
  { section: "التواصل" },
  { to: "/owner/messages", label: "الرسائل", icon: <FiMessageSquare /> },
  { section: "الحساب" },
  { to: "/owner/manage-profile", label: "الملف الشخصي", icon: <FiSettings /> },
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
          <span className="owner-sidebar-title">سكنات</span>
          <button className="owner-sidebar-close" onClick={onClose}>
            <FiX />
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
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="owner-sidebar-footer">
          <button className="owner-sidebar-logout" onClick={handleLogout}>
            <FiLogOut />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
