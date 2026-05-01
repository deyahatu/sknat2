import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  FiMapPin, FiStar, FiChevronLeft,
  FiChevronRight, FiCheck, FiArrowRight, FiHeart, FiUser, FiUsers, FiHome,
} from 'react-icons/fi';
import { IoBedOutline } from 'react-icons/io5';
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { ROOM_TYPE_ICONS } from '../constants/property';
import './PropertyDetailsPage.css';

const TARGET_GENDER_LABELS = {
  MALE: 'ذكور',
  FEMALE: 'إناث',
};

const CANCELLATION_RULES = [
  { condition: 'تم القبول دون دفع', refund: '100%' },
  { condition: 'تم الدفع خلال 3 أيام', refund: '100%' },
  { condition: 'تم الدفع خلال 4-7 أيام', refund: '50%' },
  { condition: 'تم الدفع بعد 7 أيام', refund: '0%' },
  { condition: 'تم تسجيل الدخول للسكن', refund: '0%' },
];

function PropertyDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState('policy'); // 'policy' | 'form'
  const [agreedPolicy, setAgreedPolicy] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [bookingDates, setBookingDates] = useState({ startDate: '', endDate: '' });
  const [bookingError, setBookingError] = useState(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const isStudent = user?.role === 'STUDENT';
  const isOwnProperty = user?.id === property?.owner?.id;

  useEffect(() => {
    setLoading(true);
    api.properties.get(id)
      .then((res) => setProperty(res.property))
      .catch((err) => setError(err.message || 'تعذر تحميل تفاصيل السكن'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!isStudent || !id) return;
    api.favorites.check(id)
      .then((res) => setIsFavorited(res.isFavorited))
      .catch(() => {});
  }, [id, isStudent]);

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isStudent) return;

    setFavLoading(true);
    try {
      if (isFavorited) {
        await api.favorites.remove(id);
        setIsFavorited(false);
      } else {
        await api.favorites.add(id);
        setIsFavorited(true);
      }
    } catch {
      // ignore
    } finally {
      setFavLoading(false);
    }
  };

  const openBookingModal = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setBookingStep('policy');
    setAgreedPolicy(false);
    setSelectedVariantId('');
    setBookingDates({ startDate: '', endDate: '' });
    setBookingError(null);
    setShowBookingModal(true);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError(null);

    const { startDate, endDate } = bookingDates;
    if (!startDate || !endDate) {
      setBookingError('يرجى تحديد تاريخ البداية والنهاية.');
      return;
    }

    setBookingSubmitting(true);
    try {
      if (!selectedVariantId) {
        setBookingError('يرجى اختيار نوع الغرفة.');
        setBookingSubmitting(false);
        return;
      }
      await api.bookings.create({
        propertyId: id,
        roomVariantId: selectedVariantId,
        startDate,
        endDate,
      });
      setShowBookingModal(false);
      navigate('/bookings');
    } catch (err) {
      setBookingError(err.message || 'تعذر إرسال طلب الحجز');
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page property-details-page">
        <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
          جاري تحميل تفاصيل السكن...
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="page not-found-page">
        <div className="container" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <h2>{error || 'العقار غير موجود'}</h2>
          <p>لم نتمكن من العثور على العقار المطلوب</p>
          <Link to="/search" className="btn btn-primary" style={{ marginTop: '20px' }}>
            العودة للبحث
          </Link>
        </div>
      </div>
    );
  }

  const reviewCount = property._count?.reviews ?? property.reviews?.length ?? 0;
  const avgRating = reviewCount > 0
    ? (property.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
    : null;

  const variants = property.roomVariants || [];
  const totalRooms = variants.length;
  const availableSpots = variants.filter((v) => !v.isOccupied).length;
  const minPrice = variants.length > 0 ? Math.min(...variants.map((v) => Number(v.fullPrice))) : 0;

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
          <div className="gallery-main">
            {property.images?.length > 0 ? (
              <img src={property.images[currentImage]} alt={property.title} />
            ) : (
              <div className="gallery-placeholder">
                <FiHome />
              </div>
            )}
            {property.images?.length > 1 && (
              <>
                <button className="gallery-nav gallery-prev" onClick={prevImage}>
                  <FiChevronRight />
                </button>
                <button className="gallery-nav gallery-next" onClick={nextImage}>
                  <FiChevronLeft />
                </button>
                <div className="gallery-counter">
                  {currentImage + 1} / {property.images.length}
                </div>
              </>
            )}
          </div>
          {property.images?.length > 1 && (
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
              {property.targetGender && (
                <div className="property-type-badge">
                  {TARGET_GENDER_LABELS[property.targetGender] || property.targetGender}
                </div>
              )}
              <h1 className="property-title">{property.title}</h1>
              <div className="property-location">
                <FiMapPin />
                <span>{property.address}، {property.city}</span>
              </div>
              {avgRating && (
                <div className="property-rating-line">
                  <FiStar className="star-filled" />
                  <span className="rating-value">{avgRating}</span>
                  <span className="rating-count">({reviewCount} تقييم)</span>
                </div>
              )}
            </div>

            <div className="property-specs-section">
              <h3>مواصفات السكن</h3>
              <div className="property-specs-grid">
                <div className="spec-item">
                  <IoBedOutline />
                  <div>
                    <span className="spec-value">{variants.length}</span>
                    <span className="spec-label">أنواع غرف</span>
                  </div>
                </div>
                <div className="spec-item">
                  <FiUsers />
                  <div>
                    <span className="spec-value">{totalRooms}</span>
                    <span className="spec-label">غرف</span>
                  </div>
                </div>
                <div className="spec-item">
                  <FiUser />
                  <div>
                    <span className="spec-value">{availableSpots}</span>
                    <span className="spec-label">أماكن متاحة</span>
                  </div>
                </div>
                <div className="spec-item">
                  <LuBath />
                  <div>
                    <span className="spec-value">{property.bathrooms}</span>
                    <span className="spec-label">حمامات</span>
                  </div>
                </div>
                {property.area != null && (
                  <div className="spec-item">
                    <BiArea />
                    <div>
                      <span className="spec-value">{property.area} م²</span>
                      <span className="spec-label">المساحة</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Room Variants */}
            {variants.length > 0 && (
              <div className="property-description-section">
                <h3>أنواع الغرف</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...variants].sort((a, b) => Number(a.fullPrice) - Number(b.fullPrice)).map((v) => (
                    <div key={v.id} style={{ padding: 16, border: '1px solid #e0e0e0', borderRadius: 10, background: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <strong style={{ fontSize: 16 }}>{ROOM_TYPE_ICONS[v.name] || '🏠'} {v.name}{v.roomNumber ? ` (${v.roomNumber})` : ''}</strong>
                        <span style={{ color: '#4f46e5', fontWeight: 600 }}>
                          {Number(v.fullPrice).toLocaleString('en-US')} ₪/شهر
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#555', flexWrap: 'wrap' }}>
                        <span>السعة: {v.capacity} أشخاص</span>
                        <span>{v.isOccupied ? '🔴 محجوزة' : '🟢 متاحة'}</span>
                        {v.halfPrice && <span>للطالب الواحد: {Number(v.halfPrice).toLocaleString('en-US')} ₪</span>}
                      </div>
                      {v.services?.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {v.services.map((s) => (
                            <span key={s} style={{ padding: '2px 10px', background: '#e8e6ff', borderRadius: 12, fontSize: 13 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {v.images?.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, overflowX: 'auto' }}>
                          {v.images.map((img, i) => (
                            <img key={i} src={img} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {property.description && (
              <div className="property-description-section">
                <h3>وصف السكن</h3>
                <p>{property.description}</p>
              </div>
            )}

            {property.otherServices && (
              <div className="property-amenities-section">
                <h3>خدمات إضافية</h3>
                <div className="amenities-grid">
                  <div className="amenity-item">
                    <FiCheck className="amenity-check" />
                    <span>{property.otherServices}</span>
                  </div>
                </div>
              </div>
            )}

            {property.policy && (
              <div className="property-description-section">
                <h3>سياسة السكن</h3>
                <p>{property.policy}</p>
              </div>
            )}

            <div className="property-reviews-section">
              <h3>التقييمات والمراجعات ({reviewCount})</h3>
              {reviewCount === 0 ? (
                <p className="placeholder-text">لا توجد تقييمات بعد</p>
              ) : (
                <div className="reviews-list">
                  {property.reviews.map((review) => (
                    <div key={review.id} className="review-item">
                      <div className="review-header">
                        <span className="review-author">{review.student.name}</span>
                        <div className="review-stars">
                          {Array.from({ length: 5 }, (_, i) => (
                            <FiStar
                              key={i}
                              className={i < review.rating ? 'star-filled' : 'star-empty'}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && <p className="review-comment">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="property-sidebar">
            <div className="price-card">
              {variants.length > 0 && (
                <div className="price-amount">
                  <span style={{ fontSize: 13, color: '#888' }}>ابتداءً من</span>
                  <div>
                    <span className="price-value">
                      {minPrice.toLocaleString('en-US')}
                    </span>
                    <span className="price-currency">₪</span>
                    <span className="price-period">/ شهر</span>
                  </div>
                </div>
              )}

              {!property.available ? (
                <div className="price-card-unavailable">السكن غير متاح حالياً</div>
              ) : isOwnProperty ? (
                <div className="price-card-unavailable">هذا سكنك الخاص</div>
              ) : (
                <>
                  <button
                    className="btn btn-primary btn-lg booking-btn"
                    onClick={openBookingModal}
                  >
                    طلب حجز
                  </button>

                  {(!user || isStudent) && (
                    <button
                      className={`btn favorite-btn ${isFavorited ? 'favorited' : ''}`}
                      onClick={handleToggleFavorite}
                      disabled={favLoading}
                    >
                      <FiHeart />
                      {isFavorited ? 'في المفضلة' : 'إضافة للمفضلة'}
                    </button>
                  )}
                </>
              )}

              {property.owner && (
                <>
                  <div className="owner-info">
                    <div className="owner-avatar-fallback">
                      {property.owner.name?.charAt(0).toUpperCase() || '؟'}
                    </div>
                    <div className="owner-details">
                      <span className="owner-name">{property.owner.name}</span>
                      <span className="owner-label">مالك السكن</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBookingModal && (
        <div className="booking-modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-header">
              <h2>{bookingStep === 'policy' ? 'سياسة الإلغاء' : 'إرسال طلب حجز'}</h2>
              <button
                type="button"
                className="booking-modal-close"
                onClick={() => setShowBookingModal(false)}
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            {bookingStep === 'policy' ? (
              <div className="booking-modal-body">
                <p className="policy-intro">
                  يرجى الاطلاع على سياسة الإلغاء قبل تأكيد الحجز:
                </p>
                <ul className="policy-rules">
                  {CANCELLATION_RULES.map((rule) => (
                    <li key={rule.condition}>
                      <span className="policy-condition">{rule.condition}</span>
                      <span className="policy-refund">استرداد {rule.refund}</span>
                    </li>
                  ))}
                </ul>

                <label className="policy-agree">
                  <input
                    type="checkbox"
                    checked={agreedPolicy}
                    onChange={(e) => setAgreedPolicy(e.target.checked)}
                  />
                  <span>أوافق على سياسة الإلغاء</span>
                </label>

                <div className="booking-modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowBookingModal(false)}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!agreedPolicy}
                    onClick={() => setBookingStep('form')}
                  >
                    متابعة
                  </button>
                </div>
              </div>
            ) : (
              <form className="booking-modal-body" onSubmit={handleBookingSubmit}>
                <div className="booking-summary">
                  <strong>{property.title}</strong>
                  <span>{property.address}، {property.city}</span>
                </div>

                <div className="booking-form-group">
                  <label>نوع الغرفة</label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    required
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
                  >
                    <option value="">اختر نوع الغرفة</option>
                    {variants.filter((v) => !v.isOccupied).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.roomNumber ? ` (${v.roomNumber})` : ''} — {Number(v.fullPrice).toLocaleString('en-US')} ₪/شهر
                      </option>
                    ))}
                  </select>
                </div>

                <div className="booking-form-group">
                  <label>تاريخ البداية</label>
                  <input
                    type="date"
                    value={bookingDates.startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setBookingDates((prev) => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>

                <div className="booking-form-group">
                  <label>تاريخ النهاية</label>
                  <input
                    type="date"
                    value={bookingDates.endDate}
                    min={bookingDates.startDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setBookingDates((prev) => ({ ...prev, endDate: e.target.value }))}
                    required
                  />
                </div>

                {bookingError && <div className="booking-error">{bookingError}</div>}

                <div className="booking-modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setBookingStep('policy')}
                  >
                    رجوع
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={bookingSubmitting}
                  >
                    {bookingSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PropertyDetailsPage;
