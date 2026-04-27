import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FiStar, FiArrowRight } from 'react-icons/fi';
import { api } from '../../utils/api';
import './RateAccommodation.css';

function RateAccommodation() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.bookings
      .get(bookingId)
      .then((data) => {
        if (!['PAID', 'COMPLETED'].includes(data.booking.status)) {
          setError('يمكن تقييم السكن بعد الدفع وانتهاء الإقامة فقط.');
          return;
        }
        setBooking(data.booking);
      })
      .catch((err) => setError(err.message || 'تعذر تحميل الحجز'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (rating < 1) {
      setSubmitError('يرجى اختيار التقييم.');
      return;
    }

    setSubmitting(true);
    try {
      await api.reviews.create({
        bookingId,
        rating,
        comment: comment.trim() || undefined,
      });
      navigate('/bookings');
    } catch (err) {
      setSubmitError(err.message || 'تعذر حفظ التقييم');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page rate-page">
        <div className="container rate-loading">جاري التحميل...</div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="page rate-page">
        <div className="container">
          <div className="rate-error-box">
            <h2>تعذر تحميل صفحة التقييم</h2>
            <p>{error}</p>
            <Link to="/bookings" className="btn btn-primary">العودة إلى حجوزاتي</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page rate-page">
      <div className="container rate-container">
        <Link to="/bookings" className="back-link">
          <FiArrowRight />
          العودة إلى حجوزاتي
        </Link>

        <div className="rate-card">
          <div className="rate-header">
            <h1>تقييم السكن</h1>
            <p>شاركنا تجربتك في "{booking.property.title}"</p>
          </div>

          <form className="rate-form" onSubmit={handleSubmit}>
            <div className="rate-stars-group">
              <label>تقييمك</label>
              <div className="rate-stars">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = (hoverRating || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`rate-star ${filled ? 'filled' : ''}`}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      aria-label={`${n} نجوم`}
                    >
                      <FiStar />
                    </button>
                  );
                })}
              </div>
              <span className="rate-stars-label">
                {rating > 0 ? `${rating} من 5` : 'اضغط على النجوم لاختيار التقييم'}
              </span>
            </div>

            <div className="rate-form-group">
              <label>تعليقك (اختياري)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                placeholder="اكتب تجربتك مع السكن لمساعدة الطلاب الآخرين..."
                maxLength={500}
              />
              <span className="rate-form-hint">{comment.length} / 500</span>
            </div>

            {submitError && <div className="rate-error">{submitError}</div>}

            <div className="rate-actions">
              <Link to="/bookings" className="btn btn-secondary">إلغاء</Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || rating < 1}
              >
                {submitting ? 'جاري الحفظ...' : 'إرسال التقييم'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RateAccommodation;
