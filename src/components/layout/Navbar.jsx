import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiSearch, FiLogIn, FiUserPlus, FiMenu, FiX, FiUser, FiLogOut, FiSettings, FiCalendar, FiHeart, FiMessageSquare, FiStar } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../shared/NotificationBell';
import './Navbar.css';

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const { user, logout } = useAuth();

  const navLinks = [
    { path: '/', label: 'الرئيسية', icon: <FiHome /> },
  ];

  if (!user || user?.role !== 'ADMIN') {
    navLinks.push({ path: '/search', label: 'البحث عن سكن', icon: <FiSearch /> });
  }

  if (!user) {
    navLinks.push({ path: '/login', label: 'تسجيل الدخول', icon: <FiLogIn /> });
    navLinks.push({ path: '/register', label: 'إنشاء حساب', icon: <FiUserPlus /> });
  } else {
    if (user?.role === 'STUDENT') {
      navLinks.push({ path: '/bookings', label: 'حجوزاتي', icon: <FiCalendar /> });
      navLinks.push({ path: '/messages', label: 'الرسائل', icon: <FiMessageSquare /> });
      navLinks.push({ path: '/favorites', label: 'المفضلة', icon: <FiHeart /> });
      navLinks.push({ path: '/my-ratings', label: 'تقييماتي', icon: <FiStar /> });
      navLinks.push({ path: '/profile', label: 'الملف الشخصي', icon: <FiUser /> });
    }
    if (user?.role === 'ADMIN') {
      navLinks.push({ path: '/admin', label: 'لوحة التحكم', icon: <FiSettings /> });
    }
  }

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="container navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">🏠</span>
          <span className="logo-text">سكنات</span>
        </Link>

        <ul className={`navbar-links ${mobileMenuOpen ? 'active' : ''}`}>
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`navbar-link ${isActive(link.path) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            </li>
          ))}
          {user && (
            <li>
              <NotificationBell />
            </li>
          )}
          {user && (
            <li>
              <button
                className="navbar-link navbar-logout-btn"
                onClick={handleLogout}
              >
                <FiLogOut />
                <span>تسجيل الخروج</span>
              </button>
            </li>
          )}
        </ul>

        <button
          className="navbar-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="القائمة"
        >
          {mobileMenuOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
