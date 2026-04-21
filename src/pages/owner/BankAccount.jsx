import { useEffect, useState } from 'react';
import { api } from '../../utils/api';

export default function BankAccount() {
  const [form, setForm] = useState({
    bankName: '',
    bankAccountHolder: '',
    bankAccountNumber: '',
    confirmAccountNumber: '',
  });
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.withdrawals.getBankAccount()
      .then((res) => {
        const ba = res.bankAccount;
        if (ba?.bankName) {
          setHasBankAccount(true);
          setForm({
            bankName: ba.bankName || '',
            bankAccountHolder: ba.bankAccountHolder || '',
            bankAccountNumber: ba.bankAccountNumber || '',
            confirmAccountNumber: ba.bankAccountNumber || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.withdrawals.saveBankAccount(form);
      setHasBankAccount(true);
      setSuccess('تم حفظ بيانات الحساب البنكي بنجاح');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('هل أنت متأكد من حذف الحساب البنكي؟')) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.withdrawals.deleteBankAccount();
      setHasBankAccount(false);
      setForm({ bankName: '', bankAccountHolder: '', bankAccountNumber: '', confirmAccountNumber: '' });
      setSuccess('تم حذف الحساب البنكي بنجاح');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="owner-loading">جاري التحميل...</div>;

  return (
    <>
      <div className="owner-page-header">
        <h1 className="owner-page-title">الحساب البنكي</h1>
        {hasBankAccount && (
          <button
            className="owner-btn owner-btn-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'جاري الحذف...' : 'حذف الحساب'}
          </button>
        )}
      </div>

      <div className="owner-card" style={{ maxWidth: 520 }}>
        <div className="owner-card-header">
          <h2 className="owner-card-title">{hasBankAccount ? 'تعديل بيانات الحساب' : 'إضافة حساب بنكي'}</h2>
        </div>
        <div style={{ padding: '20px' }}>
          {error && <div className="owner-form-error">{error}</div>}
          {success && <div className="owner-form-success">{success}</div>}

          <form onSubmit={handleSave}>
            <div className="owner-form-group">
              <label className="owner-form-label">اسم البنك</label>
              <input
                className="owner-form-input"
                name="bankName"
                value={form.bankName}
                onChange={handleChange}
                placeholder="مثال: البنك الأهلي"
                required
              />
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">اسم صاحب الحساب</label>
              <input
                className="owner-form-input"
                name="bankAccountHolder"
                value={form.bankAccountHolder}
                onChange={handleChange}
                placeholder="الاسم كما هو في البطاقة"
                required
              />
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">رقم الحساب</label>
              <input
                className="owner-form-input"
                name="bankAccountNumber"
                value={form.bankAccountNumber}
                onChange={handleChange}
                placeholder="أدخل رقم الحساب"
                dir="ltr"
                required
              />
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">تأكيد رقم الحساب</label>
              <input
                className="owner-form-input"
                name="confirmAccountNumber"
                value={form.confirmAccountNumber}
                onChange={handleChange}
                placeholder="أعد إدخال رقم الحساب"
                dir="ltr"
                required
              />
            </div>
            <button
              type="submit"
              className="owner-btn owner-btn-primary"
              style={{ width: '100%' }}
              disabled={saving}
            >
              {saving ? 'جاري الحفظ...' : 'حفظ البيانات'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
