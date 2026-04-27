import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FiCreditCard, FiLock, FiArrowRight } from 'react-icons/fi';
import { api } from '../../utils/api';
import './PaymentPage.css';

function calculateTotal(booking) {
  if (!booking) return 0;
  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const months = Math.max(1, Math.ceil(days / 30));
  return Number(booking.property.price) * months;
}

function PaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [card, setCard] = useState({
    name: '',
    number: '',
    expiry: '',
    cvv: '',
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!card.name.trim() || !card.number.trim() || !card.expiry.trim() || !card.cvv.trim()) {
      setError('يرجى تعبئة جميع بيانات البطاقة.');
      return;
    }

    if (!/^\d{16}$/.test(card.number.replace(/\s/g, ''))) {
      setError('رقم البطاقة يجب أن يتكوّن من 16 رقماً.');
      return;
    }

    if (!/^\d{3,4}$/.test(card.cvv)) {
      setError('رمز CVV يجب أن يتكوّن من 3 أو 4 أرقام.');
      return;
    }

    setSubmitting(true);
    try {
      await api.payments.pay(bookingId);
      navigate('/bookings');
    } catch (err) {
      setError(err.message || 'تعذر إتمام الدفع');
    } finally {
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

            <form className="payment-form" onSubmit={handleSubmit}>
              <div className="payment-form-group">
                <label>الاسم على البطاقة</label>
                <input
                  type="text"
                  value={card.name}
                  onChange={(e) => setCard({ ...card, name: e.target.value })}
                  placeholder="مثلاً: AHMAD ALI"
                  required
                />
              </div>

              <div className="payment-form-group">
                <label>رقم البطاقة</label>
                <input
                  type="text"
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                  dir="ltr"
                  required
                />
              </div>

              <div className="payment-form-row">
                <div className="payment-form-group">
                  <label>تاريخ الانتهاء</label>
                  <input
                    type="text"
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                    placeholder="MM/YY"
                    dir="ltr"
                    required
                  />
                </div>
                <div className="payment-form-group">
                  <label>CVV</label>
                  <input
                    type="text"
                    value={card.cvv}
                    onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="123"
                    dir="ltr"
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>

              {error && <div className="payment-error">{error}</div>}

              <button
                type="submit"
                className="btn btn-primary btn-lg payment-submit"
                disabled={submitting}
              >
                <FiLock />
                {submitting ? 'جاري المعالجة...' : `ادفع ${total.toLocaleString('en-US')} ₪`}
              </button>

              <p className="payment-secure-note">
                <FiLock />
                جميع المعاملات مشفّرة ومؤمّنة
              </p>
            </form>
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
              <span>السعر الشهري</span>
              <span>{Number(booking.property.price).toLocaleString('en-US')} ₪</span>
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
