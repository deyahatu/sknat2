import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';

const STATUS_MAP = {
  PENDING:   { label: 'قيد الانتظار', cls: 'pending' },
  APPROVED:  { label: 'موافق عليه',  cls: 'approved' },
  REJECTED:  { label: 'مرفوض',       cls: 'rejected' },
  COMPLETED: { label: 'مكتمل',       cls: 'completed' },
};

const STATUS_FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'PENDING', label: 'قيد الانتظار' },
  { value: 'APPROVED', label: 'موافق عليه' },
  { value: 'REJECTED', label: 'مرفوض' },
  { value: 'COMPLETED', label: 'مكتمل' },
];

export default function Withdrawals() {
  const [balance, setBalance] = useState(0);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasBankAccount, setHasBankAccount] = useState(true);

  async function load(status) {
    setLoading(true);
    try {
      const [histRes, bankRes] = await Promise.all([
        api.withdrawals.history(status),
        api.withdrawals.getBankAccount(),
      ]);
      setBalance(Number(histRes.wallet?.balance || 0));
      setRequests(histRes.requests || []);
      const ba = bankRes.bankAccount;
      setHasBankAccount(!!(ba?.bankName));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(filter); }, [filter]);

  async function handleRequest(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.withdrawals.request(Number(amount));
      setAmount('');
      setSuccess('تم تقديم طلب السحب بنجاح. بانتظار موافقة الإدارة.');
      await load(filter);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="owner-page-title">طلبات السحب</h1>

      {/* Wallet Banner */}
      <div className="owner-wallet-banner">
        <div>
          <p className="owner-wallet-balance-label">الرصيد المتاح</p>
          <p className="owner-wallet-balance-value">{balance.toFixed(2)} ريال</p>
        </div>
      </div>

      {!hasBankAccount && (
        <div className="owner-form-error" style={{ marginBottom: 20 }}>
          يجب إضافة حساب بنكي أولاً قبل طلب السحب.{' '}
          <Link to="/owner/bank-account" style={{ color: 'inherit', fontWeight: 600 }}>إضافة الآن</Link>
        </div>
      )}

      {/* Request Form */}
      <div className="owner-card" style={{ maxWidth: 420, marginBottom: 24 }}>
        <div className="owner-card-header">
          <h2 className="owner-card-title">طلب سحب جديد</h2>
        </div>
        <div style={{ padding: '20px' }}>
          {error && <div className="owner-form-error">{error}</div>}
          {success && <div className="owner-form-success">{success}</div>}
          <form onSubmit={handleRequest}>
            <div className="owner-form-group">
              <label className="owner-form-label">المبلغ (ريال)</label>
              <input
                className="owner-form-input"
                type="number"
                min="10"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="أدخل المبلغ (الحد الأدنى 10)"
                required
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              className="owner-btn owner-btn-primary"
              style={{ width: '100%' }}
              disabled={submitting || !hasBankAccount}
            >
              {submitting ? 'جاري الإرسال...' : 'تقديم طلب السحب'}
            </button>
          </form>
        </div>
      </div>

      {/* History */}
      <h2 className="owner-page-title" style={{ fontSize: '1.1rem' }}>سجل الطلبات</h2>
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
          ) : requests.length === 0 ? (
            <div className="owner-empty">لا توجد طلبات سحب</div>
          ) : (
            <table className="owner-table">
              <thead>
                <tr>
                  <th>المبلغ</th>
                  <th>البنك</th>
                  <th>رقم الحساب</th>
                  <th>الحالة</th>
                  <th>سبب الرفض</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const st = STATUS_MAP[r.status] || { label: r.status, cls: 'pending' };
                  return (
                    <tr key={r.id}>
                      <td>{Number(r.amount).toFixed(2)} ريال</td>
                      <td>{r.bankName || '—'}</td>
                      <td dir="ltr">{r.bankAccountNumber || '—'}</td>
                      <td><span className={`owner-badge ${st.cls}`}>{st.label}</span></td>
                      <td>{r.rejectionReason || '—'}</td>
                      <td dir="ltr">{new Date(r.createdAt).toLocaleDateString('ar-SA')}</td>
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
