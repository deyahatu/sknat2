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
  // Per-person price = halfPrice for DOUBLE, fullPrice for SINGLE
  const perPersonPrices = variants.map((v) => v.kind === 'DOUBLE'
    ? (v.halfPrice ? Number(v.halfPrice) : Number(v.fullPrice) / 2)
    : Number(v.fullPrice));
  const minPrice = perPersonPrices.length > 0 ? Math.min(...perPersonPrices) : 0;

  // Group variants by pattern (patternName + kind + price + services)
  const patternMap = new Map();
  variants.forEach((v) => {
    const key = `${v.patternName || v.name}|${v.kind}|${v.fullPrice}|${(v.services || []).join(',')}`;
    if (!patternMap.has(key)) {
      patternMap.set(key, {
        key,
        name: v.patternName || v.name,
        color: v.patternColor || '#4f46e5',
        kind: v.kind,
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
                <span>
                  {[property.address, property.city].filter(Boolean).join('، ')}
                  {property.campus && (
                    <span style={{ marginRight: 8, color: '#888' }}>
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
                <p style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>
                  اختر الغرفة التي تناسبك. الغرف المحجوزة لا يمكن حجزها.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                        style={{
                          padding: 16,
                          border: '1px solid #e0e0e0',
                          borderRight: `4px solid ${pat.color}`,
                          borderRadius: 10,
                          background: '#fff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 17, fontWeight: 700 }}>
                              {isDouble ? '🛏️🛏️' : '🛏️'} {pat.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                              {isDouble ? 'غرفة مزدوجة' : 'غرفة مفردة'} •{' '}
                              {freeBeds === 0
                                ? <span style={{ color: '#dc2626', fontWeight: 600 }}>لا يوجد متاح</span>
                                : isDouble
                                  ? <span style={{ color: '#059669', fontWeight: 600 }}>{freeBeds} سرير متاح من {totalBeds}</span>
                                  : <span style={{ color: '#059669', fontWeight: 600 }}>{freeBeds} غرفة متاحة من {pat.rooms.length}</span>
                              }
                            </div>
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>
                              {pricePerPerson.toLocaleString('en-US')} ₪
                            </div>
                            <div style={{ fontSize: 11, color: '#888' }}>
                              /شهر للشخص{isDouble ? ` (${pat.fullPrice} للغرفة)` : ''}
                            </div>
                          </div>
                        </div>

                        {pat.services?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {pat.services.map((s) => (
                              <span key={s} style={{ padding: '3px 10px', background: '#f3f4f6', borderRadius: 12, fontSize: 12, color: '#374151' }}>{s}</span>
                            ))}
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
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
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '6px 12px',
                                  borderRadius: 16,
                                  border: `1.5px solid ${isAvail ? pat.color : isPartial ? '#d97706' : '#e5e7eb'}`,
                                  background: isBooked ? '#f9fafb' : '#fff',
                                  color: isAvail ? pat.color : isPartial ? '#d97706' : '#9ca3af',
                                  cursor: canBook ? 'pointer' : 'not-allowed',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  fontFamily: 'inherit',
                                  textDecoration: isBooked ? 'line-through' : 'none',
                                }}
                              >
                                {isBooked && '🔒 '}
                                {isAvail && '✓ '}
                                {isPartial && '½ '}
                                {r.name}
                                {isPartial && (
                                  <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, marginRight: 4 }}>
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
                <div style={{ padding: 16, border: '1px solid #e0e0e0', borderRadius: 10, background: '#fafbfc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 17 }}>🏠 وحدة استوديو مستقلة</strong>
                    <span style={{ color: '#059669', fontWeight: 700, fontSize: 18 }}>
                      {Number(property.studioPrice || variants[0].fullPrice).toLocaleString('en-US')} ₪/شهر
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#666' }}>
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
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: '4px 8px' }}
                          onClick={async () => {
                            const reasons = { '1': 'OFFENSIVE', '2': 'INCORRECT', '3': 'SPAM' };
                            const input = prompt('سبب البلاغ:\n1. محتوى مسيء\n2. معلومات خاطئة\n3. سبام\n\nاكتب الرقم:');
                            const reason = reasons[input];
                            if (!reason) return;
                            try {
                              await api.reports.create({ type: 'REVIEW', targetId: review.id, reason });
                              alert('تم إرسال البلاغ بنجاح.');
                            } catch (err) { alert(err.message); }
                          }}
                          title="الإبلاغ عن هذا التقييم"
                        >🚩</button>
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
                          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
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
                    <div style={{ padding: 12, background: '#f8f9fb', borderRadius: 10, marginBottom: 14, borderRight: `4px solid ${sel.patternColor || '#4f46e5'}` }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                        {isDouble ? '🛏️🛏️' : '🛏️'} {sel.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                        {sel.patternName || (isDouble ? 'غرفة مزدوجة' : 'غرفة مفردة')}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#059669' }}>
                        {pp.toLocaleString('en-US')} ₪/شهر للشخص
                        {isDouble && (
                          <span style={{ color: '#888', fontWeight: 400, fontSize: 12, marginRight: 6 }}>
                            ({Number(sel.fullPrice)} للغرفة كاملة)
                          </span>
                        )}
                      </div>
                      {sel.partiallyOccupied && (
                        <div style={{ marginTop: 6, fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>
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
