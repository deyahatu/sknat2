import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiHome, FiMapPin, FiAlertCircle } from 'react-icons/fi';
import { api } from '../../utils/api';
import './MyBookings.css';

const STATUS_LABELS = {
  PENDING: 'قيد الانتظار',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغى',
  PAID: 'مدفوع',
  COMPLETED: 'مكتمل',
};

const STATUS_FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'PENDING', label: STATUS_LABELS.PENDING },
  { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { value: 'PAID', label: STATUS_LABELS.PAID },
  { value: 'COMPLETED', label: STATUS_LABELS.COMPLETED },
  { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
  { value: 'CANCELLED', label: STATUS_LABELS.CANCELLED },
];

const CANCELLATION_RULES = [
  { condition: 'تم القبول دون دفع', refund: '100%' },
  { condition: 'تم الدفع خلال 3 أيام', refund: '100%' },
  { condition: 'تم الدفع خلال 4-7 أيام', refund: '50%' },
  { condition: 'تم الدفع بعد 7 أيام', refund: '0%' },
];

// Map a (status, refundPercentage) pair to the matching rule row above
// so we can highlight "← حالتك" next to it. Order must mirror CANCELLATION_RULES.
function matchRuleIndex(refundPercentage, status) {
  if (status === 'APPROVED') return 0;
  if (status === 'PAID') {
    if (refundPercentage === 100) return 1;
    if (refundPercentage === 50) return 2;
    if (refundPercentage === 0) return 3;
  }
  return -1;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelPolicy, setCancelPolicy] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.bookings
      .studentList()
      .then((data) => setBookings(data.bookings || []))
      .catch((err) => setError(err.message || 'تعذر تحميل الحجوزات'))
      .finally(() => setLoading(false));
  };

  // Fetch the per-booking cancellation summary (refund %, refund amount,
  // matched policy rule) the moment the cancel modal opens. UC-11 step 7
  // requires this so the student sees their actual numbers before confirming.
  useEffect(() => {
    if (!cancelTarget) {
      setCancelPolicy(null);
      return;
    }
    let cancelled = false;
    setPolicyLoading(true);
    api.bookings
      .cancellationPolicy(cancelTarget.id)
      .then((res) => {
        if (!cancelled) setCancelPolicy(res.policy);
      })
      .catch(() => {
        if (!cancelled) setCancelPolicy(null);
      })
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cancelTarget]);

  useEffect(() => {
    load();
  }, []);

  const visibleBookings = useMemo(() => {
    if (!filter) return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      const res = await api.bookings.cancel(cancelTarget.id);
      setCancelTarget(null);
      setActionMessage(
        res.refund?.requestCreated
          ? `تم إلغاء الحجز. أُنشئ طلب استرداد بمبلغ ${res.refund.amount} ₪ بانتظار موافقة الإدارة.`
          : 'تم إلغاء الحجز بنجاح.',
      );
      load();
    } catch (err) {
      setCancelError(err.message || 'تعذر إلغاء الحجز');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="page my-bookings-page">
      <div className="container">
        <div className="my-bookings-header">
          <h1>حجوزاتي</h1>
          <p>تتبّع حالة طلبات الحجز والمدفوعات</p>
        </div>

        {actionMessage && (
          <div className="my-bookings-alert success">
            {actionMessage}
            <button type="button" onClick={() => setActionMessage(null)}>✕</button>
          </div>
        )}

        <div className="my-bookings-filters">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value || 'all'}
              type="button"
              className={`my-bookings-filter ${filter === s.value ? 'active' : ''}`}
              onClick={() => setFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="my-bookings-empty">جاري تحميل الحجوزات...</div>
        ) : error ? (
          <div className="my-bookings-empty error">
            <FiAlertCircle />
            <p>{error}</p>
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="my-bookings-empty">
            <FiCalendar />
            <h3>لا توجد حجوزات</h3>
            <p>ابحث عن سكن وأرسل طلب حجز للبدء</p>
            <Link to="/search" className="btn btn-primary">
              ابحث عن سكن
            </Link>
          </div>
        ) : (
          <div className="my-bookings-list">
            {visibleBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={() => setCancelTarget(booking)}
                onPay={() => navigate(`/payment/${booking.id}`)}
                onRate={() => navigate(`/rate/${booking.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {cancelTarget && (
        <div className="cancel-modal-overlay" onClick={() => !cancelLoading && setCancelTarget(null)}>
          <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
            <h2>إلغاء الحجز</h2>
            <p>هل أنت متأكد من إلغاء هذا الحجز؟</p>

            <div className="cancel-modal-summary">
              <div className="cancel-modal-summary-title">ملخص الإلغاء</div>
              <div className="cancel-modal-summary-row">
                <span>رقم الحجز</span>
                <strong dir="ltr">#{cancelTarget.id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div className="cancel-modal-summary-row">
                <span>السكن</span>
                <strong>{cancelTarget.property.title}</strong>
              </div>
              {cancelTarget.status === 'PAID' && cancelTarget.payment && (
                <>
                  <div className="cancel-modal-summary-row">
                    <span>المبلغ المدفوع</span>
                    <strong>
                      {Number(cancelTarget.payment.amount).toLocaleString('en-US')} ₪
                    </strong>
                  </div>
                  <div className="cancel-modal-summary-row refund">
                    <span>مبلغ الاسترداد</span>
                    <strong>
                      {policyLoading ? (
                        '...'
                      ) : cancelPolicy?.currentBooking ? (
                        <>
                          {Number(
                            cancelPolicy.currentBooking.refundAmount,
                          ).toLocaleString('en-US')}{' '}
                          ₪{' '}
                          <span className="refund-pct">
                            ({cancelPolicy.currentBooking.refundPercentage}%)
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </strong>
                  </div>
                </>
              )}
              {cancelTarget.status === 'APPROVED' && (
                <div className="cancel-modal-summary-row refund">
                  <span>مبلغ الاسترداد</span>
                  <strong>لا يوجد دفع — لا حاجة لاسترداد</strong>
                </div>
              )}
            </div>

            {cancelTarget.status === 'PAID' && (
              <>
                <p className="cancel-modal-policy-intro">سياسة الاسترداد:</p>
                <ul className="cancel-modal-rules">
                  {CANCELLATION_RULES.map((rule, idx) => {
                    const matchedIdx = cancelPolicy?.currentBooking
                      ? matchRuleIndex(
                          cancelPolicy.currentBooking.refundPercentage,
                          cancelTarget.status,
                        )
                      : -1;
                    const isMatched = matchedIdx === idx;
                    return (
                      <li
                        key={rule.condition}
                        className={isMatched ? 'matched' : ''}
                      >
                        <span>{rule.condition}</span>
                        <strong>{rule.refund}</strong>
                        {isMatched && <span className="rule-flag">← حالتك</span>}
                      </li>
                    );
                  })}
                </ul>
                {cancelPolicy?.currentBooking?.refundAmount > 0 ? (
                  <p className="cancel-modal-note">
                    سيتم إنشاء طلب استرداد بمبلغ{' '}
                    <strong>
                      {Number(
                        cancelPolicy.currentBooking.refundAmount,
                      ).toLocaleString('en-US')}{' '}
                      ₪
                    </strong>{' '}
                    بانتظار موافقة الإدارة.
                  </p>
                ) : (
                  <p className="cancel-modal-note">
                    لن يتم استرداد أي مبلغ بناءً على سياسة الإلغاء.
                  </p>
                )}
              </>
            )}

            {cancelError && <div className="cancel-modal-error">{cancelError}</div>}

            <div className="cancel-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelTarget(null)}
                disabled={cancelLoading}
              >
                رجوع
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={cancelLoading || policyLoading}
              >
                {cancelLoading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, onCancel, onPay, onRate }) {
  const property = booking.property;
  const cover = property?.images?.[0];

  const canCancel = ['PENDING', 'APPROVED', 'PAID'].includes(booking.status);
  const canPay = booking.status === 'APPROVED';
  const canRate = booking.status === 'COMPLETED';

  return (
    <div className="booking-card">
      <div className="booking-card-image">
        {cover ? (
          <img src={cover} alt={property.title} />
        ) : (
          <div className="booking-card-placeholder">
            <FiHome />
          </div>
        )}
      </div>

      <div className="booking-card-body">
        <div className="booking-card-top">
          <Link to={`/property/${property.id}`} className="booking-card-title">
            {property.title}
          </Link>
          <span className={`booking-status status-${booking.status}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>

        <div className="booking-card-meta">
          <span className="booking-meta-item">
            <FiMapPin />
            {property.address}، {property.city}
          </span>
          <span className="booking-meta-item">
            <FiCalendar />
            {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
          </span>
        </div>

        {booking.payment && (
          <div className="booking-card-payment">
            المبلغ المدفوع: <strong>{Number(booking.payment.amount).toLocaleString('en-US')} ₪</strong>
          </div>
        )}

        <div className="booking-card-actions">
          {canPay && (
            <button type="button" className="btn btn-primary" onClick={onPay}>
              ادفع الآن
            </button>
          )}
          {canRate && (
            <button type="button" className="btn btn-outline" onClick={onRate}>
              قيّم السكن
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-danger-outline" onClick={onCancel}>
              إلغاء الحجز
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyBookings;
