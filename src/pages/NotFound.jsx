import { Link } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 160px)', textAlign: 'center', padding: 40 }}>
      <div>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <FiAlertCircle size={40} color="#9ca3af" />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>الصفحة غير موجودة</h1>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>الرابط الذي اتبعته غير صحيح أو أن الصفحة قد حُذفت</p>
        <Link to="/" style={{ display: 'inline-block', padding: '12px 28px', background: '#4f46e5', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>العودة للرئيسية</Link>
      </div>
    </div>
  );
}
