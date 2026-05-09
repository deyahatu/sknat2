import { useEffect, useCallback } from 'react';
import './Lightbox.css';

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
    <div onClick={onClose} className="lb-overlay">
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="lb-close">✕</button>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="lb-nav lb-nav-prev">›</button>
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="lb-nav lb-nav-next">‹</button>
        </>
      )}
      <img onClick={(e) => e.stopPropagation()} src={images[currentIndex]} alt="" className="lb-image" />
      <div className="lb-counter">{currentIndex + 1} / {images.length}</div>
    </div>
  );
}
