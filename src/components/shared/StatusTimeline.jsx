import './StatusTimeline.css';

const STEPS = [
  { key: 'PENDING', label: 'معلق' },
  { key: 'APPROVED', label: 'مقبول' },
  { key: 'PAID', label: 'مدفوع' },
  { key: 'COMPLETED', label: 'انتهى الحجز' },
];
const STATUS_INDEX = { PENDING: 0, APPROVED: 1, PAID: 2, COMPLETED: 3 };

export default function StatusTimeline({ status }) {
  const isCancelled = status === 'CANCELLED';
  const isRejected = status === 'REJECTED';
  const currentIdx = STATUS_INDEX[status] ?? -1;

  return (
    <div className="st-row">
      {STEPS.map((step, i) => {
        const isDone = currentIdx > i;
        const isCurrent = currentIdx === i;
        const isError = (isCancelled && i === currentIdx) || (isRejected && i === 1);
        let circleClass = 'st-circle';
        let label = step.label;
        if (isDone) circleClass += ' st-circle--done';
        else if (isCurrent && !isError) circleClass += ' st-circle--current';
        else if (isError) {
          circleClass += ' st-circle--error';
          label = isCancelled ? 'ملغى' : 'مرفوض';
        }

        let labelClass = 'st-label';
        if (isDone || isCurrent) labelClass += ' st-label--active';
        if (isCurrent) labelClass += ' st-label--current';

        return (
          <div key={step.key} className="st-step">
            <div className="st-step-col">
              <div className={circleClass}>
                {isDone ? '✓' : isError ? '✕' : i + 1}
              </div>
              <span className={labelClass}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`st-bar${isDone ? ' st-bar--done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
