import { Link } from 'react-router-dom';
import { FiMapPin, FiStar, FiHome } from 'react-icons/fi';
import { IoBedOutline } from 'react-icons/io5';
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import './PropertyCard.css';

const TARGET_GENDER_LABELS = {
  MALE: 'ذكور',
  FEMALE: 'إناث',
};

function PropertyCard({ property }) {
  const reviewCount = property._count?.reviews ?? 0;
  const cover = property.images?.[0];

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
        {property.targetGender && (
          <span className="property-badge">
            {TARGET_GENDER_LABELS[property.targetGender] || property.targetGender}
          </span>
        )}
        <span className="property-price">
          {Number(property.price).toLocaleString('en-US')} ₪/شهر
        </span>
      </div>

      <div className="property-card-body">
        <h3 className="property-card-title">{property.title}</h3>

        <div className="property-card-location">
          <FiMapPin />
          <span>
            {property.address ? `${property.address}، ` : ''}
            {property.city}
          </span>
        </div>

        <div className="property-card-specs">
          <div className="spec">
            <IoBedOutline />
            <span>{property.rooms} غرف</span>
          </div>
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
            <span>{reviewCount}</span>
            <span className="reviews-count">تقييم</span>
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
