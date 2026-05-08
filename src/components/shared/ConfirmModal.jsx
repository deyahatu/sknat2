import { useState, useEffect } from 'react';

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

  const colors = {
    danger: { bg: '#dc2626', hover: '#b91c1c', icon: '⚠️' },
    warning: { bg: '#d97706', hover: '#b45309', icon: '⚠️' },
    info: { bg: '#4f46e5', hover: '#4338ca', icon: 'ℹ️' },
  };
  const c = colors[variant] || colors.danger;

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 28, maxWidth: 420, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', direction: 'rtl',
      }}>
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>{c.icon}</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#1a1a1a' }}>
          {title}
        </h3>
        {message && (
          <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
            {message}
          </p>
        )}
        {inputMode && (
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder || 'اكتب هنا...'}
            rows={3}
            style={{
              width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8,
              fontFamily: 'inherit', fontSize: 14, marginBottom: 16, resize: 'vertical',
            }}
            autoFocus
          />
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => onConfirm(inputMode ? inputValue : undefined)}
            disabled={inputMode && !inputValue.trim()}
            style={{
              padding: '10px 24px', background: c.bg, color: '#fff', border: 'none',
              borderRadius: 8, fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              cursor: inputMode && !inputValue.trim() ? 'not-allowed' : 'pointer',
              opacity: inputMode && !inputValue.trim() ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = c.hover}
            onMouseLeave={(e) => e.currentTarget.style.background = c.bg}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px', background: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
