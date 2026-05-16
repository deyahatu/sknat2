import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiStar, FiHome, FiMapPin, FiInbox } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useToast } from '../../components/shared/Toast';
import Skeleton from '../../components/shared/Skeleton';
import './MyRatings.css';

function StarRow({ value }) {
  return (
    <span className="my-ratings__stars" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <FiStar key={i} className={i <= value ? 'my-ratings__star-on' : 'my-ratings__star-off'} />
      ))}
    </span>
  );
}

export default function MyRatings() {
  const toast = useToast();
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.reviews.studentList()
      .then((data) => setMyReviews(data.reviews || []))
      .catch((err) => toast.error(err.message || 'تعذر تحميل التقييمات.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="my-ratings page">
        <div className="container">
          <Skeleton height={48} />
          <div className="sk-card__spacer-md" />
          <Skeleton height={140} count={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="my-ratings page">
      <div className="container">
        <header className="my-ratings__hero">
          <div className="my-ratings__hero-text">
            <h1>
              <FiStar /> تقييماتي
            </h1>
            <p>التقييمات التي كتبتها للسكنات بعد انتهاء إقامتك.</p>
          </div>
          <div className="my-ratings__hero-count">
            <strong>{myReviews.length}</strong>
            <span>تقييم</span>
          </div>
        </header>

        {myReviews.length === 0 ? (
            <div className="my-ratings__empty">
              <FiInbox size={48} />
              <h3>لم تقم بتقييم أي سكن بعد</h3>
              <p>بعد انتهاء فترة إقامتك في السكن، يمكنك تقييمه من صفحة "حجوزاتي".</p>
            </div>
          ) : (
            <div className="my-ratings__list">
              {myReviews.map((rev) => (
                <article key={rev.id} className="my-ratings__card">
                  <div className="my-ratings__card-head">
                    <div>
                      <h3>
                        <FiHome />{' '}
                        {rev.property?.id ? (
                          <Link to={`/property/${rev.property.id}`}>{rev.property.title}</Link>
                        ) : (
                          rev.property?.title || 'سكن'
                        )}
                      </h3>
                      {rev.property?.city && (
                        <p className="my-ratings__meta">
                          <FiMapPin /> {rev.property.city}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="my-ratings__dims">
                    <div className="my-ratings__dim">
                      <span className="my-ratings__dim-label">تقييمك</span>
                      <StarRow value={rev.rating || 0} />
                    </div>
                  </div>
                  {rev.comment && (
                    <p className="my-ratings__comment">"{rev.comment}"</p>
                  )}
                  <p className="my-ratings__date" dir="ltr">
                    {new Date(rev.createdAt).toLocaleDateString('ar-EG')}
                  </p>
                </article>
              ))}
            </div>
        )}
      </div>
    </div>
  );
}
