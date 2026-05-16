import { useState, useEffect } from 'react';
import './ConfirmModal.css';

const VARIANT_COLORS = {
  danger: { bg: '#dc2626', hover: '#b91c1c', icon: '⚠️' },
  warning: { bg: '#d97706', hover: '#b45309', icon: '⚠️' },
  info: { bg: '#4f46e5', hover: '#4338ca', icon: 'ℹ️' },
};

export default function ConfirmModal({
  open, title, message, confirmText = 'تأكيد', cancelText = 'إلغاء',
  onConfirm, onCancel, variant = 'danger', inputMode = false, inputPlaceholder = '',
}) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (open) setInputValue('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !inputMode) { e.preventDefault(); onConfirm(inputValue); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel, onConfirm, inputMode, inputValue]);

  if (!open) return null;

  const c = VARIANT_COLORS[variant] || VARIANT_COLORS.danger;
  const confirmDisabled = inputMode && !inputValue.trim();

  return (
    <div onClick={onCancel} className="cm-overlay">
      <div onClick={(e) => e.stopPropagation()} className="cm-box">
        <div className="cm-icon">{c.icon}</div>
        <h3 className="cm-title">{title}</h3>
        {message && <p className="cm-message">{message}</p>}
        {inputMode && (
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder || 'اكتب هنا...'}
            rows={3}
            className="cm-textarea"
            autoFocus
          />
        )}
        <div className="cm-actions">
          <button
            onClick={() => onConfirm(inputMode ? inputValue : undefined)}
            disabled={confirmDisabled}
            className="cm-btn cm-btn-confirm"
            style={{ background: c.bg }}
            onMouseEnter={(e) => { if (!confirmDisabled) e.currentTarget.style.background = c.hover; }}
            onMouseLeave={(e) => { if (!confirmDisabled) e.currentTarget.style.background = c.bg; }}
          >
            {confirmText}
          </button>
          <button onClick={onCancel} className="cm-btn cm-btn-cancel">
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
