import { FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-section">
          <h3 className="footer-title">
            <span>🏠</span> سكنات
          </h3>
          <p className="footer-desc">
            منصة سكنات تربط الطلاب بأصحاب العقارات لتوفير أفضل خيارات السكن الطلابي بأسعار مناسبة.
          </p>
        </div>

        <div className="footer-section">
          <h4 className="footer-section-title">روابط سريعة</h4>
          <ul className="footer-links">
            <li><Link to="/">الرئيسية</Link></li>
            <li><Link to="/search">البحث عن سكن</Link></li>
            <li><Link to="/login">تسجيل الدخول</Link></li>
            <li><Link to="/register">إنشاء حساب</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-section-title">تواصل معنا</h4>
          <ul className="footer-contact">
            <li>
              <FiMail />
              <span>info@sakanat.com</span>
            </li>
            <li>
              <FiPhone />
              <span>920012345</span>
            </li>
            <li>
              <FiMapPin />
              <span>رام الله، فلسطين</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <p>© 2026 سكنات. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
