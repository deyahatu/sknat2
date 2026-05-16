import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiX, FiTrash2 } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './Toast';
import './DeleteAccountSection.css';

// Lets the signed-in user voluntarily delete their account. Mirrors the rules
// the server enforces (active bookings, wallet balance, pending refunds /
// withdrawals) — those are the cases where the request will get a 400 back.
export default function DeleteAccountSection() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isOwner = user?.role === 'OWNER';

  // Role-specific wording: an owner's data is properties/bookings/wallet, while
  // a student's is bookings/favorites/refunds — the deletion blockers differ
  // too, so we list only what's relevant.
  const dataExamples = isOwner
    ? 'العقارات، الحجوزات، الرسائل، تقييمات الطلاب، المحفظة وسجل السحوبات…'
    : 'الحجوزات، الرسائل، التقييمات، المفضلة، طلبات الاسترداد…';

  const blockers = isOwner
    ? 'لو كان عندك حجوزات نشطة على عقاراتك، رصيد في المحفظة، أو طلب سحب قيد المراجعة'
    : 'لو كان عندك حجز نشط أو طلب استرداد قيد المراجعة';

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function closeModal() {
    if (submitting) return;
    setOpen(false);
    setPassword('');
    setError(null);
  }

  async function handleDelete(e) {
    e.preventDefault();
    if (submitting) return;
    if (!password) {
      setError('يرجى إدخال كلمة المرور.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.users.deleteMe(password);
      // Sync client state with the server: the cookie is already cleared, but
      // AuthContext still holds the user object. logout() drops that and any
      // socket connections.
      await logout();
      toast.success(res.message || 'تم جدولة حذف حسابك.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'تعذر حذف الحساب.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="delete-account-card">
        <div className="delete-account-head">
          <FiAlertTriangle className="delete-account-icon" />
          <div>
            <h3>منطقة الخطر</h3>
            <p>
              حذف الحساب يُعطّله فوراً ويبدأ عدّ تنازلي <strong>30 يوماً</strong>{' '}
              قبل الحذف النهائي. خلال هذه المدة يمكنك العودة بتسجيل الدخول لإلغاء
              الطلب واستعادة حسابك. بعد 30 يوماً، تُحذف كل بياناتك نهائياً (
              {dataExamples}).
              {isOwner && (
                <>
                  <br />
                  <br />
                  <strong>ملاحظة:</strong> سيتم إخفاء عقاراتك من نتائج البحث
                  فوراً حتى لو راجعت عن قرار الحذف خلال فترة السماح.
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="delete-account-trigger"
          onClick={() => setOpen(true)}
        >
          <FiTrash2 /> حذف الحساب
        </button>
      </div>

      {open && (
        <div className="delete-account-modal-overlay" onClick={closeModal}>
          <div
            className="delete-account-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="delete-account-modal-close"
              onClick={closeModal}
              aria-label="إغلاق"
            >
              <FiX />
            </button>

            <div className="delete-account-modal-head">
              <FiAlertTriangle className="delete-account-icon" />
              <h3>تأكيد حذف الحساب</h3>
            </div>

            <p className="delete-account-modal-body">
              سيُعطَّل حسابك فوراً وتبدأ فترة سماح 30 يوماً قبل الحذف النهائي.
              يمكنك التراجع في أي وقت خلال هذه المدة بتسجيل الدخول.
              <br />
              <br />
              ملاحظة: {blockers} — لن نسمح بالحذف حتى تتم تسوية هذه الأمور.
              <br />
              <br />
              للتأكيد، أدخل كلمة المرور.
            </p>

            <form onSubmit={handleDelete} className="delete-account-form">
              <label htmlFor="delete-pw">كلمة المرور</label>
              <input
                id="delete-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                autoFocus
                required
              />

              {error && <div className="delete-account-error">{error}</div>}

              <div className="delete-account-actions">
                <button
                  type="button"
                  className="delete-account-cancel"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="delete-account-confirm"
                  disabled={submitting}
                >
                  {submitting ? 'جارٍ الحذف…' : 'حذف الحساب نهائياً'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
