import { useEffect, useCallback } from 'react';

export default function Lightbox({ images, currentIndex, onClose, onNext, onPrev }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onNext();
    if (e.key === 'ArrowRight') onPrev();
  }, [onClose, onNext, onPrev]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; };
  }, [handleKey]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', zIndex: 2 }}>✕</button>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, padding: '12px 16px', borderRadius: 8, cursor: 'pointer' }}>›</button>
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, padding: '12px 16px', borderRadius: 8, cursor: 'pointer' }}>‹</button>
        </>
      )}
      <img onClick={(e) => e.stopPropagation()} src={images[currentIndex]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
      <div style={{ position: 'absolute', bottom: 16, color: '#fff', fontSize: 14 }}>{currentIndex + 1} / {images.length}</div>
    </div>
  );
}
