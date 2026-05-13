import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { useToast } from './Toast';
import './BlockedBanner.css';

// Shown across the app whenever the logged-in user has been blocked from
// activities. Surfaces the admin's reason and lets them submit a one-time
// appeal. Reads its own appeal state so we don't poll from every page.
export default function BlockedBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [appeal, setAppeal] = useState(null);
  const [loadingAppeal, setLoadingAppeal] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const blocked = user?.isActive === false;

  useEffect(() => {
    if (!blocked) {
      setAppeal(null);
      setLoadingAppeal(false);
      return;
    }
    let cancelled = false;
    setLoadingAppeal(true);
    api.blockAppeals
      .mine()
      .then((data) => {
        if (cancelled) return;
        // We only treat an appeal as "current" if it was filed after the
        // current block started.
        const blockedAt = user?.blockedAt ? new Date(user.blockedAt) : null;
        if (data.appeal && blockedAt) {
          const created = new Date(data.appeal.createdAt);
          if (created >= blockedAt) {
            setAppeal(data.appeal);
            return;
          }
        }
        setAppeal(null);
      })
      .catch(() => setAppeal(null))
      .finally(() => {
        if (!cancelled) setLoadingAppeal(false);
      });
    return () => { cancelled = true; };
  }, [blocked, user?.blockedAt]);

  if (!blocked) return null;

  const submit = async () => {
    const text = message.trim();
    if (text.length < 10 || text.length > 500) {
      toast.error('يجب إدخال نص الاعتراض (10 إلى 500 حرف).');
      return;
    }
    setSaving(true);
    try {
      const res = await api.blockAppeals.submit(text);
      setAppeal(res.appeal);
      toast.success('تم تقديم اعتراضك بنجاح.');
      setModalOpen(false);
      setMessage('');
    } catch (err) {
      toast.error(err.message || 'فشل إرسال الاعتراض');
    } finally {
      setSaving(false);
    }
  };

  const appealStatus = appeal?.status;

  return (
    <>
      <div className="blocked-banner">
        <div className="blocked-banner-icon">
          <FiAlertTriangle />
        </div>
        <div className="blocked-banner-content">
          <div className="blocked-banner-title">حسابك محظور من تنفيذ الأنشطة</div>
          {user?.blockReason && (
            <div className="blocked-banner-reason">
              <strong>السبب: </strong>{user.blockReason}
            </div>
          )}
          <div className="blocked-banner-note">
            يمكنك تصفح حسابك بشكل عادي، لكن لن تتمكن من إنشاء حجوزات / رسائل / تعديلات.
          </div>
        </div>
        <div className="blocked-banner-actions">
          {loadingAppeal ? null : !appeal ? (
            <button
              type="button"
              className="blocked-banner-btn"
              onClick={() => setModalOpen(true)}
            >
              اعتراض على الحظر
            </button>
          ) : (
            <span className={`blocked-banner-status status-${appealStatus?.toLowerCase()}`}>
              {appealStatus === 'PENDING' && '⏳ اعتراضك قيد المراجعة'}
              {appealStatus === 'ACCEPTED' && '✓ تم قبول اعتراضك'}
              {appealStatus === 'REJECTED' && '✗ تم رفض اعتراضك'}
            </span>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="bb-modal-overlay" onClick={() => !saving && setModalOpen(false)}>
          <div className="bb-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="bb-modal-header">
              <h3>تقديم اعتراض</h3>
              <button
                type="button"
                className="bb-modal-close"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                <FiX />
              </button>
            </div>
            <p className="bb-modal-sub">
              يحق لك تقديم اعتراض واحد فقط على هذا الحظر. اشرح وجهة نظرك بوضوح.
            </p>
            <textarea
              className="bb-modal-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={6}
              placeholder="اكتب ردك على سبب الحظر..."
            />
            <div className="bb-modal-counter">{message.length} / 500</div>
            <div className="bb-modal-actions">
              <button
                type="button"
                className="bb-modal-btn ghost"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="bb-modal-btn primary"
                onClick={submit}
                disabled={saving || message.trim().length < 10}
              >
                {saving ? 'جاري الإرسال...' : 'إرسال الاعتراض'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
