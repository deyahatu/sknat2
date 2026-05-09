import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiRefreshCw, FiMessageSquare } from 'react-icons/fi';
import { api } from '../../utils/api';
import Skeleton, { SkeletonCard } from '../../components/shared/Skeleton';

const STATUS_FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'PENDING', label: 'قيد الانتظار' },
  { value: 'APPROVED', label: 'مقبول' },
  { value: 'REJECTED', label: 'مرفوض' },
  { value: 'PAID', label: 'مدفوع' },
  { value: 'COMPLETED', label: 'مكتمل' },
  { value: 'CANCELLED', label: 'ملغي' },
];

const STATUS_MAP = {
  PENDING: { label: 'قيد الانتظار', cls: 'pending' },
  APPROVED: { label: 'مقبول', cls: 'approved' },
  REJECTED: { label: 'مرفوض', cls: 'rejected' },
  PAID: { label: 'مدفوع', cls: 'paid' },
  COMPLETED: { label: 'مكتمل', cls: 'completed' },
  CANCELLED: { label: 'ملغي', cls: 'cancelled' },
};

function formatDate(d) {
  return new Date(d).toLocaleDateString('ar-SA');
}

export default function OwnerBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  async function load(status) {
    setLoading(true);
    try {
      const res = await api.bookings.ownerList(status);
      setBookings(res.bookings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(filter); }, [filter]);

  async function handleAccept(id) {
    setActionLoading(id + '_accept');
    try {
      await api.bookings.accept(id);
      await load(filter);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id) {
    setActionLoading(id + '_reject');
    try {
      await api.bookings.reject(id);
      await load(filter);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <div className="owner-section-hero">
        <h1 className="owner-page-title owner-section-hero-title">
          <FiCalendar /> الحجوزات
        </h1>
      </div>

      {error && <div className="owner-form-error">{error}</div>}

      <div className="owner-filter-bar">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`owner-filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="owner-card">
        <div className="owner-table-wrap">
          {loading ? (
            <div className="owner-skeleton-wrap"><Skeleton height={40} /><div className="owner-skeleton-spacer" /><Skeleton height={20} count={5} /></div>
          ) : bookings.length === 0 ? (
            <div className="owner-empty-body">
              <div className="owner-empty-icon">
                <FiCalendar size={36} color="#d1d5db" />
              </div>
              <h3 className="owner-empty-title">لا توجد حجوزات</h3>
              <p className="owner-empty-desc">ستظهر حجوزات عقاراتك هنا</p>
            </div>
          ) : (
            <table className="owner-table">
              <thead>
                <tr>
                  <th>العقار</th>
                  <th>الطالب</th>
                  <th>من</th>
                  <th>إلى</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const st = STATUS_MAP[b.status] || { label: b.status, cls: 'pending' };
                  const isRenewal = !!b.parentBookingId;
                  return (
                    <tr key={b.id} className={isRenewal ? 'owner-row-renewal' : ''}>
                      <td>
                        {b.property?.title || '—'}
                        {isRenewal && (
                          <span className="owner-renewal-badge" title="طلب تجديد لحجز سابق">
                            <FiRefreshCw /> تجديد
                          </span>
                        )}
                      </td>
                      <td>{b.student?.name || '—'}</td>
                      <td dir="ltr">
                        {formatDate(b.startDate)}
                        {isRenewal && b.parentBooking && (
                          <div className="owner-renewal-meta">
                            بعد الحجز السابق:<br />
                            <span dir="ltr">{formatDate(b.parentBooking.startDate)} → {formatDate(b.parentBooking.endDate)}</span>
                          </div>
                        )}
                      </td>
                      <td dir="ltr">{formatDate(b.endDate)}</td>
                      <td><span className={`owner-badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        {b.status === 'PENDING' && (
                          <div className="owner-pending-actions">
                            <button
                              className="owner-btn owner-btn-success owner-btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => handleAccept(b.id)}
                            >
                              {actionLoading === b.id + '_accept' ? '...' : 'قبول'}
                            </button>
                            <button
                              className="owner-btn owner-btn-danger owner-btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => handleReject(b.id)}
                            >
                              {actionLoading === b.id + '_reject' ? '...' : 'رفض'}
                            </button>
                          </div>
                        )}
                        {(b.status === 'APPROVED' || b.status === 'PAID') && b.student?.id && (
                          <button
                            className="owner-btn owner-btn-outline owner-btn-sm"
                            onClick={() => navigate(`/owner/messages?with=${b.student.id}`)}
                          >
                            <FiMessageSquare /> تواصل
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
