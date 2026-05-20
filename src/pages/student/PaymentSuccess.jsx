import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { api } from '../../utils/api';
import './PaymentPage.css';

// Stripe redirects here on success. We can't trust the URL — webhook is the
// authoritative confirmation. Poll a few times until status flips to COMPLETED.
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 10;

function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');

  const [status, setStatus] = useState('pending'); // pending | completed | failed | not_found
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus('not_found');
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const { payment } = await api.payments.verifySession(sessionId);
        if (cancelled) return;
        setPayment(payment);
        if (payment.status === 'COMPLETED') {
          setStatus('completed');
          return;
        }
        if (payment.status === 'FAILED') {
          setStatus('failed');
          return;
        }
        if (attempts < MAX_POLLS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setStatus('completed'); // assume success on timeout; webhook will reconcile
        }
      } catch {
        if (attempts < MAX_POLLS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setStatus('not_found');
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="page payment-page">
      <div className="container" style={{ maxWidth: 560, padding: '3rem 1rem' }}>
        <div className="payment-form-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          {status === 'pending' && (
            <>
              <FiClock size={56} color="#0ea5e9" style={{ marginBottom: '1rem' }} />
              <h2>جاري تأكيد الدفعة...</h2>
              <p style={{ color: '#475569' }}>قد يستغرق هذا بضع ثوانٍ.</p>
            </>
          )}
          {status === 'completed' && (
            <>
              <FiCheckCircle size={56} color="#10b981" style={{ marginBottom: '1rem' }} />
              <h2>تم الدفع بنجاح</h2>
              {payment && (
                <p style={{ color: '#475569' }}>
                  {payment.booking.property.title} · {Number(payment.amount).toLocaleString('en-US')} ₪
                </p>
              )}
              <Link to="/bookings" className="btn btn-primary btn-lg" style={{ marginTop: '1.5rem' }}>
                عرض حجوزاتي
              </Link>
            </>
          )}
          {status === 'failed' && (
            <>
              <FiAlertTriangle size={56} color="#ef4444" style={{ marginBottom: '1rem' }} />
              <h2>فشلت عملية الدفع</h2>
              <p style={{ color: '#475569' }}>يرجى المحاولة مرة أخرى.</p>
              <Link to="/bookings" className="btn btn-primary btn-lg" style={{ marginTop: '1.5rem' }}>
                العودة إلى حجوزاتي
              </Link>
            </>
          )}
          {status === 'not_found' && (
            <>
              <FiAlertTriangle size={56} color="#f59e0b" style={{ marginBottom: '1rem' }} />
              <h2>تعذر التحقق من الدفعة</h2>
              <p style={{ color: '#475569' }}>إذا تم خصم المبلغ، تواصل مع الدعم.</p>
              <Link to="/bookings" className="btn btn-primary btn-lg" style={{ marginTop: '1.5rem' }}>
                العودة إلى حجوزاتي
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;
