import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiSearch, FiLogIn, FiUserPlus, FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';
import './Navbar.css';

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'الرئيسية', icon: <FiHome /> },
    { path: '/search', label: 'البحث عن سكن', icon: <FiSearch /> },
    { path: '/login', label: 'تسجيل الدخول', icon: <FiLogIn /> },
    { path: '/register', label: 'إنشاء حساب', icon: <FiUserPlus /> },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
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
