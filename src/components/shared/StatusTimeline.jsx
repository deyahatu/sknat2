const STEPS = [
  { key: 'PENDING', label: 'معلق' },
  { key: 'APPROVED', label: 'مقبول' },
  { key: 'PAID', label: 'مدفوع' },
  { key: 'COMPLETED', label: 'مكتمل' },
];
const STATUS_INDEX = { PENDING: 0, APPROVED: 1, PAID: 2, COMPLETED: 3 };

export default function StatusTimeline({ status }) {
  const isCancelled = status === 'CANCELLED';
  const isRejected = status === 'REJECTED';
  const currentIdx = STATUS_INDEX[status] ?? -1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '12px 0' }}>
      {STEPS.map((step, i) => {
        const isDone = currentIdx > i;
        const isCurrent = currentIdx === i;
        const isError = (isCancelled && i === currentIdx) || (isRejected && i === 1);
        let bg = '#e5e7eb', color = '#9ca3af', label = step.label;
        if (isDone) { bg = '#10b981'; color = '#fff'; }
        if (isCurrent && !isError) { bg = '#4f46e5'; color = '#fff'; }
        if (isError) { bg = '#dc2626'; color = '#fff'; label = isCancelled ? 'ملغى' : 'مرفوض'; }
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                {isDone ? '✓' : isError ? '✕' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: isDone || isCurrent ? '#1a1a1a' : '#9ca3af', fontWeight: isCurrent ? 700 : 400 }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 40, height: 2, background: isDone ? '#10b981' : '#e5e7eb', margin: '0 4px', marginBottom: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
