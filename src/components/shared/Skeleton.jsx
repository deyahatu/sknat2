export default function Skeleton({ width = '100%', height = 16, circle = false, count = 1, className = '' }) {
  const style = {
    width: circle ? height : width, height,
    borderRadius: circle ? '50%' : 8,
    background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  };
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={className} style={{ ...style, marginBottom: count > 1 ? 8 : 0 }} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <Skeleton height={180} />
      <div style={{ padding: 16 }}>
        <Skeleton height={20} width="60%" />
        <div style={{ height: 8 }} />
        <Skeleton height={14} count={2} />
        <div style={{ height: 12 }} />
        <Skeleton height={14} width="40%" />
      </div>
    </div>
  );
}
