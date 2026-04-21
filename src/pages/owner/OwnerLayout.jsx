import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import OwnerSidebar from "../../components/owner/OwnerSidebar";
import "./Owner.css";

export default function OwnerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const initial = user?.name?.charAt(0)?.toUpperCase() || "م";

  return (
    <div className="owner-layout">
      <header className="owner-header">
        <div className="owner-header-right">
          <Link to="/owner" className="owner-header-logo">
            سكنات 🏠
          </Link>
        </div>
        <button
          className="owner-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="فتح القائمة"
        >
          ☰
        </button>
      </header>

      <OwnerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="owner-content">
        <Outlet />
      </main>
    </div>
  );
}
