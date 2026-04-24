import { useEffect, useState } from 'react';
import { api } from '../../utils/api';

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
        <h1 className="owner-page-title owner-section-hero-title">الحجوزات</h1>
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
            <div className="owner-loading">جاري التحميل...</div>
          ) : bookings.length === 0 ? (
            <div className="owner-empty">لا توجد حجوزات</div>
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
                  return (
                    <tr key={b.id}>
                      <td>{b.property?.title || '—'}</td>
                      <td>{b.student?.name || '—'}</td>
                      <td dir="ltr">{formatDate(b.startDate)}</td>
                      <td dir="ltr">{formatDate(b.endDate)}</td>
                      <td><span className={`owner-badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        {b.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 6 }}>
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
