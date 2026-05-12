import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  FiMapPin, FiStar, FiChevronLeft,
  FiChevronRight, FiCheck, FiArrowRight, FiHeart, FiUser, FiUsers, FiHome, FiInfo, FiFlag,
} from 'react-icons/fi';
import { IoBedOutline } from 'react-icons/io5';
import { LuBath } from 'react-icons/lu';
import { BiArea } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import Lightbox from '../components/shared/Lightbox';
import ReportModal from '../components/shared/ReportModal';
import { useToast } from '../components/shared/Toast';
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
];

function PropertyDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [property, setProperty] = useState(null);
  const [tenantMajors, setTenantMajors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState(null);

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
      .then((res) => { setProperty(res.property); setTenantMajors(res.tenantMajors || []); })
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

    const durationDays = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (durationDays < 30) {
      setBookingError('يجب أن تكون فترة الحجز 30 يوم على الأقل (شهر).');
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
        <div className="container pd-loading-container">
          جاري تحميل تفاصيل السكن...
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="page not-found-page">
        <div className="container pd-error-container">
          <h2>{error || 'العقار غير موجود'}</h2>
          <p>لم نتمكن من العثور على العقار المطلوب</p>
          <Link to="/search" className="btn btn-primary pd-error-back-btn">
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
  // Per-person price = halfPrice for DOUBLE, fullPrice for SINGLE
  const perPersonPrices = variants.map((v) => v.kind === 'DOUBLE'
    ? (v.halfPrice ? Number(v.halfPrice) : Number(v.fullPrice) / 2)
    : Number(v.fullPrice));
  const minPrice = perPersonPrices.length > 0 ? Math.min(...perPersonPrices) : 0;

  // Group variants by pattern (patternName + kind + price + services)
  const patternMap = new Map();
  variants.forEach((v) => {
    const key = `${v.patternName || v.name}|${v.kind}|${v.fullPrice}|${v.area || ''}|${(v.services || []).join(',')}`;
    if (!patternMap.has(key)) {
      patternMap.set(key, {
        key,
        name: v.patternName || v.name,
        color: v.patternColor || '#4f46e5',
        kind: v.kind,
        area: v.area ?? null,
        fullPrice: Number(v.fullPrice),
        halfPrice: v.halfPrice != null ? Number(v.halfPrice) : null,
        services: v.services || [],
        images: v.images || [],
        rooms: [],
      });
    }
    patternMap.get(key).rooms.push(v);
  });
  const patternList = Array.from(patternMap.values());

  function roomStatus(v) {
    if (v.isOccupied) return 'BOOKED';
    if (v.partiallyOccupied) return 'PARTIAL';
    return 'AVAILABLE';
  }

  function openBookingForRoom(variantId) {
    if (!user) {
      navigate('/login');
      return;
    }
    setBookingStep('policy');
    setAgreedPolicy(false);
    setSelectedVariantId(variantId);
    setBookingDates({ startDate: '', endDate: '' });
    setBookingError(null);
    setShowBookingModal(true);
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
          <div className="gallery-main">
            {property.images?.length > 0 ? (
              <img src={property.images[currentImage]} alt={property.title} onClick={() => setLightboxOpen(true)} className="pd-gallery-img-clickable" />
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
                <span>
                  {[property.address, property.city].filter(Boolean).join('، ')}
                  {property.campus && (
                    <span className="pd-campus-info">
                      • {property.campus === 'OLD' ? 'الحرم القديم' : 'الحرم الجديد'}
                      {property.distance ? ` (${property.distance} د. سيراً)` : ''}
                    </span>
                  )}
                </span>
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

            {/* Room Patterns + Individual rooms */}
            {patternList.length > 0 && property.kind !== 'STUDIO' && (
              <div className="property-description-section property-patterns-section">
                <h3>الغرف المتاحة للحجز</h3>
                <p className="pd-pattern-subtitle">
                  اختر الغرفة التي تناسبك. الغرف المحجوزة لا يمكن حجزها.
                </p>
                <div className="pd-pattern-list">
                  {patternList.map((pat) => {
                    const isDouble = pat.kind === 'DOUBLE';
                    const cap = isDouble ? 2 : 1;
                    const pricePerPerson = isDouble
                      ? (pat.halfPrice || Math.round(pat.fullPrice / 2))
                      : pat.fullPrice;
                    const freeBeds = pat.rooms.reduce((s, r) => {
                      const st = roomStatus(r);
                      if (st === 'AVAILABLE') return s + cap;
                      if (st === 'PARTIAL') return s + 1;
                      return s;
                    }, 0);
                    const totalBeds = pat.rooms.length * cap;
                    return (
                      <div
                        key={pat.key}
                        className="pd-pattern-card"
                        style={{ borderRight: `4px solid ${pat.color}` }}
                      >
                        <div className="pd-pattern-header">
                          <div>
                            <div className="pd-pattern-name">
                              {isDouble ? '🛏️🛏️' : '🛏️'} {pat.name}
                            </div>
                            <div className="pd-pattern-info">
                              {isDouble ? 'غرفة مزدوجة' : 'غرفة مفردة'}
                              {pat.area ? ` • ${pat.area} م²` : ''} •{' '}
                              {freeBeds === 0
                                ? <span className="pd-pattern-info-unavailable">لا يوجد متاح</span>
                                : isDouble
                                  ? <span className="pd-pattern-info-available">{freeBeds} سرير متاح من {totalBeds}</span>
                                  : <span className="pd-pattern-info-available">{freeBeds} غرفة متاحة من {pat.rooms.length}</span>
                              }
                            </div>
                          </div>
                          <div className="pd-pattern-price">
                            <div className="pd-pattern-price-value">
                              {pricePerPerson.toLocaleString('en-US')} ₪
                            </div>
                            <div className="pd-pattern-price-label">
                              /شهر للشخص{isDouble ? ` (${pat.fullPrice} للغرفة)` : ''}
                            </div>
                          </div>
                        </div>

                        {pat.services?.length > 0 && (
                          <div className="pd-pattern-services">
                            {pat.services.map((s) => (
                              <span key={s} className="pd-pattern-service-tag">{s}</span>
                            ))}
                          </div>
                        )}

                        <div className="pd-pattern-rooms-bar">
                          <span className="pd-pattern-rooms-label">
                            الغرف:
                          </span>
                          {pat.rooms.map((r) => {
                            const st = roomStatus(r);
                            const isAvail = st === 'AVAILABLE';
                            const isPartial = st === 'PARTIAL';
                            const isBooked = st === 'BOOKED';
                            const canBook = (isAvail || isPartial) && !isOwnProperty && property.available;
                            const tooltip = isPartial ? 'سرير واحد متاح' : '';
                            return (
                              <button
                                key={r.id}
                                type="button"
                                disabled={!canBook}
                                onClick={() => openBookingForRoom(r.id)}
                                title={tooltip}
                                className={`pd-room-btn ${isBooked ? 'pd-room-btn-booked' : isPartial ? 'pd-room-btn-partial' : 'pd-room-btn-available'}`}
                                style={isAvail ? { borderColor: pat.color, color: pat.color } : undefined}
                              >
                                {isBooked && '🔒 '}
                                {isAvail && '✓ '}
                                {isPartial && '½ '}
                                {r.name}
                                {isPartial && (
                                  <span className="pd-room-btn-partial-badge">
                                    سرير متاح
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Studio: simple price + book button */}
            {property.kind === 'STUDIO' && variants.length > 0 && (
              <div className="property-description-section">
                <h3>الاستوديو</h3>
                <div className="pd-studio-card">
                  <div className="pd-studio-header">
                    <strong className="pd-studio-title">🏠 وحدة استوديو مستقلة</strong>
                    <span className="pd-studio-price">
                      {Number(property.studioPrice || variants[0].fullPrice).toLocaleString('en-US')} ₪/شهر
                    </span>
                  </div>
                  <div className="pd-studio-status">
                    {variants[0].isOccupied ? '🔴 محجوز حالياً' : '🟢 متاح للحجز'}
                  </div>
                </div>
              </div>
            )}

            {/* Shared services on the property */}
            {property.sharedServices?.length > 0 && (
              <div className="property-amenities-section">
                <h3>الخدمات المشتركة</h3>
                <div className="amenities-grid">
                  {property.sharedServices.map((s) => (
                    <div key={s} className="amenity-item">
                      <FiCheck className="amenity-check" />
                      <span>{s}</span>
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

            {tenantMajors.length > 0 && (
              <div className="property-description-section">
                <h3 className="tenant-majors-heading">
                  <FiUsers />
                  تخصصات الطلاب الحاليين
                  <span
                    className="info-hint"
                    tabIndex={0}
                    role="button"
                    aria-label="معلومة عن تخصصات الساكنين"
                  >
                    <FiInfo />
                    <span className="info-hint__bubble">
                      هذه القائمة تعرض فقط تخصصات الطلاب الذين حجزوا عبر منصة سكنات.
                      قد يوجد ساكنون آخرون استأجروا مباشرة من المالك ولا تظهر بياناتهم هنا.
                    </span>
                  </span>
                </h3>
                <div className="pd-pattern-services pd-pattern-services--gap">
                  {tenantMajors.map((m) => (
                    <span key={m} className="pd-pattern-service-tag">{m}</span>
                  ))}
                </div>
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
                      {user && review.student?.id !== user?.id && (
                        <button
                          type="button"
                          className="pd-report-btn"
                          onClick={() => setReportingReviewId(review.id)}
                          aria-label="الإبلاغ عن هذا التقييم"
                        >
                          <FiFlag />
                          <span>إبلاغ</span>
                        </button>
                      )}
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
                  <span className="pd-price-label">ابتداءً من</span>
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
              ) : availableSpots === 0 ? (
                <div className="price-card-unavailable">جميع الغرف محجوزة حالياً</div>
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
                  <span>{property.city}</span>
                </div>

                {(() => {
                  const sel = variants.find((v) => v.id === selectedVariantId);
                  if (!sel) {
                    return (
                      <div className="booking-form-group">
                        <label>الغرفة</label>
                        <select
                          value={selectedVariantId}
                          onChange={(e) => setSelectedVariantId(e.target.value)}
                          required
                          className="pd-booking-select"
                        >
                          <option value="">اختر غرفة</option>
                          {variants.filter((v) => !v.isOccupied).map((v) => {
                            const pp = v.kind === 'DOUBLE'
                              ? (v.halfPrice ? Number(v.halfPrice) : Number(v.fullPrice) / 2)
                              : Number(v.fullPrice);
                            return (
                              <option key={v.id} value={v.id}>
                                {v.name} — {pp.toLocaleString('en-US')} ₪/شهر للشخص
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  }
                  const isDouble = sel.kind === 'DOUBLE';
                  const pp = isDouble
                    ? (sel.halfPrice ? Number(sel.halfPrice) : Number(sel.fullPrice) / 2)
                    : Number(sel.fullPrice);
                  return (
                    <div className="pd-booking-selected-room" style={{ borderRight: `4px solid ${sel.patternColor || 'var(--primary)'}` }}>
                      <div className="pd-booking-selected-name">
                        {isDouble ? '🛏️🛏️' : '🛏️'} {sel.name}
                      </div>
                      <div className="pd-booking-selected-type">
                        {sel.patternName || (isDouble ? 'غرفة مزدوجة' : 'غرفة مفردة')}
                      </div>
                      <div className="pd-booking-selected-price">
                        {pp.toLocaleString('en-US')} ₪/شهر للشخص
                        {isDouble && (
                          <span className="pd-booking-full-price-note">
                            ({Number(sel.fullPrice)} للغرفة كاملة)
                          </span>
                        )}
                      </div>
                      {sel.partiallyOccupied && (
                        <div className="pd-booking-shared-warning">
                          ⚠️ ستتشارك هذه الغرفة مع طالب آخر
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                  <label>تاريخ النهاية (الحد الأدنى شهر)</label>
                  <input
                    type="date"
                    value={bookingDates.endDate}
                    min={(() => {
                      const base = bookingDates.startDate || new Date().toISOString().split('T')[0];
                      const d = new Date(base);
                      d.setDate(d.getDate() + 30);
                      return d.toISOString().split('T')[0];
                    })()}
                    onChange={(e) => setBookingDates((prev) => ({ ...prev, endDate: e.target.value }))}
                    required
                  />
                  <small className="booking-form-hint">يجب أن تكون فترة الحجز 30 يوم على الأقل.</small>
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

      {lightboxOpen && property.images?.length > 0 && (
        <Lightbox
          images={property.images}
          currentIndex={currentImage}
          onClose={() => setLightboxOpen(false)}
          onNext={() => setCurrentImage((prev) => (prev + 1) % property.images.length)}
          onPrev={() => setCurrentImage((prev) => (prev - 1 + property.images.length) % property.images.length)}
        />
      )}

      <ReportModal
        open={!!reportingReviewId}
        targetType="REVIEW"
        targetId={reportingReviewId}
        onClose={() => setReportingReviewId(null)}
      />
    </div>
  );
}

export default PropertyDetailsPage;
