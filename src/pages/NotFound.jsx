import { Link } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="page not-found-page">
      <div>
        <div className="not-found-icon">
          <FiAlertCircle size={40} color="#9ca3af" />
        </div>
        <h1 className="not-found-title">الصفحة غير موجودة</h1>
        <p className="not-found-desc">الرابط الذي اتبعته غير صحيح أو أن الصفحة قد حُذفت</p>
        <Link to="/" className="not-found-cta">العودة للرئيسية</Link>
      </div>
    </div>
  );
}
