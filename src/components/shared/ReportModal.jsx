import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useToast } from './Toast';
import './ReportModal.css';

const REASONS = [
  { value: 'OFFENSIVE', label: 'لغة مسيئة' },
  { value: 'FALSE_INFO', label: 'معلومات خاطئة / كاذبة' },
  { value: 'HARASSMENT', label: 'تحرّش' },
  { value: 'POLICY_VIOLATION', label: 'انتهاك السياسات' },
];

/**
 * ReportModal — submit a report on a review or student rating.
 * Props:
 *  - open: boolean
 *  - targetType: 'REVIEW' | 'STUDENT_RATING'
 *  - targetId: string
 *  - onClose: () => void
 *  - onSubmitted?: () => void
 */
export default function ReportModal({ open, targetType = 'REVIEW', targetId, onClose, onSubmitted }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
      setSubmitting(false);
    }
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('يرجى اختيار سبب البلاغ.');
      return;
    }
    setSubmitting(true);
    try {
      await api.reports.create({
        type: targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success('تم إرسال البلاغ بنجاح. سيراجعه المسؤول قريباً.');
      onSubmitted?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'تعذر إرسال البلاغ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal__header">
          <div className="report-modal__title">
            <FiAlertTriangle />
            <span>الإبلاغ عن المحتوى</span>
          </div>
          <button
            type="button"
            className="report-modal__close"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="report-modal__form">
          <p className="report-modal__intro">
            ساعدنا في الحفاظ على بيئة آمنة. اختر سبب البلاغ وأضف تفاصيل اختيارية إن أردت.
          </p>

          <label className="report-modal__field">
            <span className="report-modal__label">
              سبب البلاغ <span className="report-modal__req">*</span>
            </span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="">اختر سبباً...</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="report-modal__field">
            <span className="report-modal__label">
              تفاصيل إضافية <span className="report-modal__optional">(اختياري)</span>
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="اشرح المشكلة بإيجاز..."
              disabled={submitting}
            />
            <span className="report-modal__counter">{details.length} / 500</span>
          </label>

          <div className="report-modal__actions">
            <button
              type="button"
              className="report-modal__btn report-modal__btn--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="report-modal__btn report-modal__btn--primary"
              disabled={submitting || !reason}
            >
              {submitting ? 'جارٍ الإرسال...' : 'إرسال البلاغ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
