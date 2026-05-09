import './Skeleton.css';

export default function Skeleton({ width = '100%', height = 16, circle = false, count = 1, className = '' }) {
  const dim = {
    width: circle ? height : width,
    height,
  };
  const cls = `sk ${circle ? 'sk--circle' : 'sk--rect'} ${count > 1 ? 'sk--gap' : ''} ${className}`.trim();
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cls} style={dim} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="sk-card">
      <Skeleton height={180} />
      <div className="sk-card__body">
        <Skeleton height={20} width="60%" />
        <div className="sk-card__spacer-sm" />
        <Skeleton height={14} count={2} />
        <div className="sk-card__spacer-md" />
        <Skeleton height={14} width="40%" />
      </div>
    </div>
  );
}
