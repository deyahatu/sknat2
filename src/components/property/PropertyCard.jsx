import { Link } from 'react-router-dom';
import { FiMapPin, FiHome, FiStar } from 'react-icons/fi';
import { IoBedOutline } from 'react-icons/io5';
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import './PropertyCard.css';

function PropertyCard({ property }) {
  return (
    <Link to={`/property/${property.id}`} className="property-card">
      <div className="property-card-image">
        <img src={property.images[0]} alt={property.title} />
        {property.isFeatured && <span className="property-badge">مميز</span>}
        <span className="property-price">
          {property.price} {property.currency}/{property.period}
        </span>
      </div>

      <div className="property-card-body">
        <div className="property-card-type">
          <FiHome />
          <span>{property.type}</span>
        </div>

        <h3 className="property-card-title">{property.title}</h3>

        <div className="property-card-location">
          <FiMapPin />
          <span>{property.district}، {property.city}</span>
        </div>

        <div className="property-card-specs">
          <div className="spec">
            <IoBedOutline />
            <span>{property.bedrooms} غرف</span>
          </div>
          <div className="spec">
            <LuBath />
            <span>{property.bathrooms} حمام</span>
          </div>
          <div className="spec">
            <BiArea />
            <span>{property.area} م²</span>
          </div>
        </div>

        <div className="property-card-footer">
          <div className="property-card-rating">
            <FiStar className="star-icon" />
            <span>{property.rating}</span>
            <span className="reviews-count">({property.reviewsCount} تقييم)</span>
          </div>
          <div className="property-card-owner">
            <img src={property.owner.avatar} alt={property.owner.name} />
            <span>{property.owner.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PropertyCard;
