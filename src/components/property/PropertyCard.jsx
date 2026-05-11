import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMapPin, FiStar, FiHome, FiHeart } from 'react-icons/fi';
import { IoBedOutline } from 'react-icons/io5';
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { useToast } from '../shared/Toast';
import './PropertyCard.css';

const TARGET_GENDER_LABELS = {
  MALE: 'ذكور',
  FEMALE: 'إناث',
};

const CAMPUS_LABELS = {
  OLD: 'الحرم القديم',
  NEW: 'الحرم الجديد',
};

function PropertyCard({ property, initialFavorited = false, onFavoriteChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const isStudent = user?.role === 'STUDENT';
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    if (!isStudent || initialFavorited) return;
    api.favorites
      .check(property.id)
      .then((res) => setIsFavorited(!!res.isFavorited))
      .catch(() => {});
  }, [property.id, isStudent, initialFavorited]);

  const handleToggleFav = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isStudent || favBusy) return;

    setFavBusy(true);
    try {
      if (isFavorited) {
        await api.favorites.remove(property.id);
        setIsFavorited(false);
        toast?.success?.('تمت الإزالة من المفضلة.');
        onFavoriteChange?.(property.id, false);
      } else {
        await api.favorites.add(property.id);
        setIsFavorited(true);
        toast?.success?.('تمت الإضافة إلى المفضلة.');
        onFavoriteChange?.(property.id, true);
      }
    } catch (err) {
      toast?.error?.(err.message || 'تعذّر تحديث المفضلة.');
    } finally {
      setFavBusy(false);
    }
  };

  const cover = property.images?.[0];
  const avgRating = Number(property.avgRating || 0);
  const reviewCount = property._count?.reviews ?? 0;
  const campusLabel = CAMPUS_LABELS[property.campus];

  return (
    <Link to={`/property/${property.id}`} className="property-card">
      <div className="property-card-image">
        {cover ? (
          <img src={cover} alt={property.title} />
        ) : (
          <div className="property-card-placeholder">
            <FiHome />
          </div>
        )}

        {isStudent && (
          <button
            type="button"
            className={`property-card-fav ${isFavorited ? 'active' : ''}`}
            onClick={handleToggleFav}
            disabled={favBusy}
            aria-label={isFavorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          >
            <FiHeart />
          </button>
        )}

        <div className="property-card-badges">
          {property.targetGender && (
            <span className="property-badge">
              {TARGET_GENDER_LABELS[property.targetGender] || property.targetGender}
            </span>
          )}
        </div>

        {property.roomVariants?.length > 0 && (
          <span className="property-price">
            {Number(property.roomVariants[0].fullPrice).toLocaleString('en-US')} ₪/شهر
          </span>
        )}
      </div>

      <div className="property-card-body">
        <h3 className="property-card-title">{property.title}</h3>

        <div className="property-card-location">
          <FiMapPin />
          <span>
            {property.address ? `${property.address}، ` : ''}
            {property.city}
            {campusLabel && (
              <>
                {' • '}
                <span className="property-card-campus">{campusLabel}</span>
              </>
            )}
          </span>
        </div>

        <div className="property-card-specs">
          {property.roomVariants?.length > 0 && (
            <div className="spec">
              <IoBedOutline />
              <span>{property.roomVariants.filter((v) => !v.isOccupied).length} غرف متاحة</span>
            </div>
          )}
          <div className="spec">
            <LuBath />
            <span>{property.bathrooms} حمام</span>
          </div>
          {property.area != null && (
            <div className="spec">
              <BiArea />
              <span>{property.area} م²</span>
            </div>
          )}
        </div>

        <div className="property-card-footer">
          <div className="property-card-rating">
            <FiStar className="star-icon" />
            <span>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
            <span className="reviews-count">
              {reviewCount > 0 ? `(${reviewCount})` : 'بدون تقييم'}
            </span>
          </div>
          {property.owner?.name && (
            <div className="property-card-owner">
              <span>{property.owner.name}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default PropertyCard;
