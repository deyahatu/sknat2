import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart, FiAlertCircle } from 'react-icons/fi';
import PropertyCard from '../../components/property/PropertyCard';
import { api } from '../../utils/api';
import './Favorites.css';

function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.favorites
      .list()
      .then((data) => setFavorites(data.favorites || []))
      .catch((err) => setError(err.message || 'تعذر تحميل المفضلة'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page favorites-page">
      <div className="container">
        <div className="favorites-header">
          <div>
            <h1>المفضلة</h1>
            <p>السكنات التي حفظتها للرجوع إليها لاحقاً</p>
          </div>
          <span className="favorites-count">
            <FiHeart /> {favorites.length}
          </span>
        </div>

        {loading ? (
          <div className="favorites-empty">جاري تحميل المفضلة...</div>
        ) : error ? (
          <div className="favorites-empty error">
            <FiAlertCircle />
            <p>{error}</p>
          </div>
        ) : favorites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FiHeart size={36} color="#d1d5db" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>ما ضفت شي للمفضلة</h3>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>اضغط على أيقونة القلب في صفحة السكن لإضافته إلى المفضلة</p>
            <Link to="/search" style={{ display: 'inline-block', padding: '10px 24px', background: '#4f46e5', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>تصفح العقارات</Link>
          </div>
        ) : (
          <div className="favorites-grid">
            {favorites.map((fav) => (
              <PropertyCard key={fav.id} property={fav.property} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Favorites;
