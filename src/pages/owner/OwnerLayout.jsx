import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import OwnerSidebar from "../../components/owner/OwnerSidebar";
import NotificationBell from "../../components/shared/NotificationBell";
import "./Owner.css";

export default function OwnerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const initial = user?.name?.charAt(0)?.toUpperCase() || "م";

  return (
    <div className="owner-layout">
      <OwnerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="owner-layout-body">
        <header className="owner-header">
          <div className="owner-header-right">
            <Link to="/owner" className="owner-header-logo">
              <span className="owner-header-logo-icon">🏠</span>
              <span>سكنات</span>
            </Link>
          </div>
          <div className="owner-header-actions">
            {user && <NotificationBell />}
            <button
              className="owner-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="فتح القائمة"
            >
              ☰
            </button>
          </div>
        </header>

        <main className="owner-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
