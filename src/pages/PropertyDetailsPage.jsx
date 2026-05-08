import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  FiMapPin, FiPhone, FiMail, FiStar, FiChevronLeft,
  FiChevronRight, FiCheck, FiArrowRight,
} from 'react-icons/fi';
import { IoBedOutline } from 'react-icons/io5';
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import { properties } from '../data/properties';
import Lightbox from '../components/shared/Lightbox';
import './PropertyDetailsPage.css';

// TODO: connect API — fetch property by ID
// TODO: implement booking system
function PropertyDetailsPage() {
  const { id } = useParams();
  const property = properties.find((p) => p.id === Number(id));
  const [currentImage, setCurrentImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!property) {
    return (
      <div className="page not-found-page">
        <div className="container" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <h2>العقار غير موجود</h2>
          <p>لم نتمكن من العثور على العقار المطلوب</p>
          <Link to="/search" className="btn btn-primary" style={{ marginTop: '20px' }}>
            العودة للبحث
          </Link>
        </div>
      </div>
    );
  }

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % property.images.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + property.images.length) % property.images.length);
  };

  return (
    <div className="page property-details-page">
      <div className="container">
        <Link to="/search" className="back-link">
          <FiArrowRight />
          العودة لنتائج البحث
        </Link>

        <div className="property-gallery">
          <div className="gallery-main" onClick={() => setLightboxOpen(true)} style={{ cursor: 'pointer' }}>
            <img src={property.images[currentImage]} alt={property.title} />
            {property.images.length > 1 && (
              <>
                <button className="gallery-nav gallery-prev" onClick={prevImage}>
                  <FiChevronRight />
                </button>
                <button className="gallery-nav gallery-next" onClick={nextImage}>
                  <FiChevronLeft />
                </button>
              </>
            )}
            <div className="gallery-counter">
              {currentImage + 1} / {property.images.length}
            </div>
          </div>
          {property.images.length > 1 && (
            <div className="gallery-thumbnails">
              {property.images.map((img, index) => (
                <button
                  key={index}
                  className={`gallery-thumb ${index === currentImage ? 'active' : ''}`}
                  onClick={() => setCurrentImage(index)}
                >
                  <img src={img} alt={`صورة ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="property-details-layout">
          <div className="property-main-info">
            <div className="property-title-section">
              <div className="property-type-badge">{property.type}</div>
              <h1 className="property-title">{property.title}</h1>
              <div className="property-location">
                <FiMapPin />
                <span>{property.address}، {property.district}، {property.city}</span>
              </div>
              <div className="property-rating-line">
                <FiStar className="star-filled" />
                <span className="rating-value">{property.rating}</span>
                <span className="rating-count">({property.reviewsCount} تقييم)</span>
              </div>
            </div>

            <div className="property-specs-section">
              <h3>مواصفات العقار</h3>
              <div className="property-specs-grid">
                <div className="spec-item">
                  <IoBedOutline />
                  <div>
                    <span className="spec-value">{property.bedrooms}</span>
                    <span className="spec-label">غرف نوم</span>
                  </div>
                </div>
                <div className="spec-item">
                  <LuBath />
                  <div>
                    <span className="spec-value">{property.bathrooms}</span>
                    <span className="spec-label">حمامات</span>
                  </div>
                </div>
                <div className="spec-item">
                  <BiArea />
                  <div>
                    <span className="spec-value">{property.area} م²</span>
                    <span className="spec-label">المساحة</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="property-description-section">
              <h3>وصف العقار</h3>
              <p>{property.description}</p>
            </div>

            <div className="property-amenities-section">
              <h3>المرافق والخدمات</h3>
              <div className="amenities-grid">
                {property.amenities.map((amenity) => (
                  <div key={amenity} className="amenity-item">
                    <FiCheck className="amenity-check" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="property-reviews-placeholder">
              <h3>التقييمات والمراجعات</h3>
              <p className="placeholder-text">
                سيتم إضافة قسم التقييمات قريباً
              </p>
              {/* TODO: implement review system — Abdullah's task */}
            </div>
          </div>

          <div className="property-sidebar">
            <div className="price-card">
              <div className="price-amount">
                <span className="price-value">{property.price}</span>
                <span className="price-currency">{property.currency}</span>
                <span className="price-period">/ {property.period}</span>
              </div>

              <button className="btn btn-primary btn-lg booking-btn">
                طلب حجز
              </button>
              {/* TODO: implement booking system — Abdullah's task */}

              <div className="owner-info">
                <img src={property.owner.avatar} alt={property.owner.name} className="owner-avatar" />
                <div className="owner-details">
                  <span className="owner-name">{property.owner.name}</span>
                  <span className="owner-label">مالك العقار</span>
                </div>
              </div>

              <div className="owner-contact">
                <a href={`tel:${property.owner.phone}`} className="btn btn-secondary contact-btn">
                  <FiPhone />
                  اتصال
                </a>
                <a href={`mailto:info@sakanat.com`} className="btn btn-secondary contact-btn">
                  <FiMail />
                  رسالة
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      {lightboxOpen && property.images?.length > 0 && (
        <Lightbox
          images={property.images}
          currentIndex={currentImage}
          onClose={() => setLightboxOpen(false)}
          onNext={() => setCurrentImage((prev) => (prev + 1) % property.images.length)}
          onPrev={() => setCurrentImage((prev) => (prev - 1 + property.images.length) % property.images.length)}
        />
      )}
    </div>
  );
}

export default PropertyDetailsPage;
