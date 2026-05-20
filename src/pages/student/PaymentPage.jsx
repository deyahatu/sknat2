import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FiCreditCard, FiLock, FiArrowRight, FiShield } from 'react-icons/fi';
import { api } from '../../utils/api';
import './PaymentPage.css';

function getMonthlyPrice(roomVariant) {
  if (!roomVariant) return 0;
  const isDouble = roomVariant.kind === "DOUBLE";
  if (isDouble) {
    return Number(
      roomVariant.halfPrice ?? Number(roomVariant.fullPrice) / 2,
    );
  }
  return Number(roomVariant.fullPrice || 0);
}

function calculateTotal(booking) {
  if (!booking) return 0;
  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const months = Math.max(1, days / 30);
  const price = getMonthlyPrice(booking.roomVariant);
  return Math.round(price * months * 100) / 100;
}

function PaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.bookings
      .get(bookingId)
      .then((data) => {
        if (data.booking.status !== 'APPROVED') {
          setError('يمكن الدفع للحجوزات المقبولة فقط.');
          return;
        }
        setBooking(data.booking);
      })
      .catch((err) => setError(err.message || 'تعذر تحميل الحجز'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const handleCheckout = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { url } = await api.payments.checkout(bookingId);
      if (!url) throw new Error('تعذر الحصول على رابط الدفع.');
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'تعذر بدء عملية الدفع');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page payment-page">
        <div className="container payment-loading">جاري تحميل الحجز...</div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="page payment-page">
        <div className="container">
          <div className="payment-error-box">
            <h2>تعذر متابعة الدفع</h2>
            <p>{error}</p>
            <Link to="/bookings" className="btn btn-primary">العودة إلى حجوزاتي</Link>
          </div>
        </div>
      </div>
    );
  }

  const total = calculateTotal(booking);

  return (
    <div className="page payment-page">
      <div className="container payment-container">
        <Link to="/bookings" className="back-link">
          <FiArrowRight />
          العودة إلى حجوزاتي
        </Link>

        <div className="payment-layout">
          <div className="payment-form-card">
            <div className="payment-form-header">
              <FiCreditCard />
              <h1>إتمام الدفع</h1>
            </div>

            <p style={{ color: '#475569', lineHeight: 1.8, marginBottom: '1.5rem' }}>
              سيتم تحويلك إلى بوابة الدفع الآمنة Stripe لإكمال العملية.
              بطاقات الاختبار: <strong dir="ltr" style={{ direction: 'ltr' }}>4242 4242 4242 4242</strong>
            </p>

            {error && <div className="payment-error">{error}</div>}

            <div className="payment-actions">
              <button
                type="button"
                className="btn btn-secondary btn-lg payment-cancel"
                onClick={() => navigate('/bookings')}
                disabled={submitting}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg payment-submit"
                onClick={handleCheckout}
                disabled={submitting}
              >
                <FiLock />
                {submitting ? 'جاري التحويل...' : `ادفع ${total.toLocaleString('en-US')} ₪ عبر Stripe`}
              </button>
            </div>

            <p className="payment-secure-note">
              <FiShield />
              <FiLock />
              مدعوم من Stripe — جميع المعاملات مشفّرة
            </p>
          </div>

          <div className="payment-summary-card">
            <h2>ملخص الحجز</h2>
            <div className="payment-summary-row">
              <span>السكن</span>
              <strong>{booking.property.title}</strong>
            </div>
            <div className="payment-summary-row">
              <span>المدينة</span>
              <span>{booking.property.city}</span>
            </div>
            <div className="payment-summary-row">
              <span>تاريخ البداية</span>
              <span>{new Date(booking.startDate).toLocaleDateString('ar-EG')}</span>
            </div>
            <div className="payment-summary-row">
              <span>تاريخ النهاية</span>
              <span>{new Date(booking.endDate).toLocaleDateString('ar-EG')}</span>
            </div>
            <div className="payment-summary-row">
              <span>السعر الشهري ({booking.roomVariant?.name})</span>
              <span>{getMonthlyPrice(booking.roomVariant).toLocaleString('en-US')} ₪</span>
            </div>
            <div className="payment-summary-divider"></div>
            <div className="payment-summary-total">
              <span>الإجمالي</span>
              <strong>{total.toLocaleString('en-US')} ₪</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentPage;
