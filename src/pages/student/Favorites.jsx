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
          <div className="fav-empty-body">
            <div className="fav-empty-icon">
              <FiHeart size={36} color="#d1d5db" />
            </div>
            <h3 className="fav-empty-title">ما ضفت شي للمفضلة</h3>
            <p className="fav-empty-desc">اضغط على أيقونة القلب في صفحة السكن لإضافته إلى المفضلة</p>
            <Link to="/search" className="fav-empty-cta">تصفح العقارات</Link>
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
