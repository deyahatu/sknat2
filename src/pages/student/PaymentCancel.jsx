import { Link, useSearchParams } from 'react-router-dom';
import { FiXCircle } from 'react-icons/fi';
import './PaymentPage.css';

function PaymentCancel() {
  const [params] = useSearchParams();
  const bookingId = params.get('booking_id');

  return (
    <div className="page payment-page">
      <div className="container" style={{ maxWidth: 560, padding: '3rem 1rem' }}>
        <div className="payment-form-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <FiXCircle size={56} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h2>تم إلغاء عملية الدفع</h2>
          <p style={{ color: '#475569' }}>لم يتم خصم أي مبلغ. يمكنك المحاولة لاحقاً.</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            {bookingId && (
              <Link to={`/payment/${bookingId}`} className="btn btn-primary btn-lg">
                المحاولة مجدداً
              </Link>
            )}
            <Link to="/bookings" className="btn btn-secondary btn-lg">
              حجوزاتي
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentCancel;
