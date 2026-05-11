import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiStar, FiHome, FiMapPin, FiUser, FiFlag, FiInbox } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useToast } from '../../components/shared/Toast';
import ReportModal from '../../components/shared/ReportModal';
import Skeleton from '../../components/shared/Skeleton';
import './MyRatings.css';

const DIMENSIONS = [
  { key: 'behaviorRating',      label: 'السلوك' },
  { key: 'cleanlinessRating',   label: 'النظافة' },
  { key: 'communicationRating', label: 'التواصل' },
  { key: 'overallRating',       label: 'التجربة الإجمالية' },
];

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
  const [ratings, setRatings] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('received'); // 'received' | 'given'
  const [reportingRatingId, setReportingRatingId] = useState(null);

  useEffect(() => {
    Promise.all([
      api.studentRatings.received().catch(() => ({ ratings: [] })),
      api.reviews.studentList().catch(() => ({ reviews: [] })),
    ])
      .then(([recv, given]) => {
        setRatings(recv.ratings || []);
        setMyReviews(given.reviews || []);
      })
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
            <p>{tab === 'received'
              ? 'تقييمات قدّمها أصحاب العقارات بعد إقامتك. إذا شعرت بأن تقييماً غير عادل، يمكنك الإبلاغ عنه.'
              : 'التقييمات التي كتبتها للسكنات بعد انتهاء إقامتك.'}</p>
          </div>
          <div className="my-ratings__hero-count">
            <strong>{tab === 'received' ? ratings.length : myReviews.length}</strong>
            <span>تقييم</span>
          </div>
        </header>

        <div className="my-ratings__tabs">
          <button
            type="button"
            className={`my-ratings__tab ${tab === 'received' ? 'active' : ''}`}
            onClick={() => setTab('received')}
          >
            تقييمات استلمتها ({ratings.length})
          </button>
          <button
            type="button"
            className={`my-ratings__tab ${tab === 'given' ? 'active' : ''}`}
            onClick={() => setTab('given')}
          >
            تقييماتي للسكنات ({myReviews.length})
          </button>
        </div>

        {tab === 'given' ? (
          myReviews.length === 0 ? (
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
          )
        ) : ratings.length === 0 ? (
          <div className="my-ratings__empty">
            <FiInbox size={48} />
            <h3>لا يوجد تقييمات بعد</h3>
            <p>عند إكمال أول حجز لك، ستظهر تقييمات أصحاب العقارات هنا.</p>
          </div>
        ) : (
          <div className="my-ratings__list">
            {ratings.map((r) => (
              <article key={r.id} className="my-ratings__card">
                <div className="my-ratings__card-head">
                  <div>
                    <h3>
                      <FiHome /> {r.booking?.property?.title || 'سكن'}
                    </h3>
                    {r.booking?.property?.city && (
                      <p className="my-ratings__meta">
                        <FiMapPin /> {r.booking.property.city}
                      </p>
                    )}
                    <p className="my-ratings__meta">
                      <FiUser /> من <strong>{r.owner?.name || 'مالك السكن'}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="my-ratings__report-btn"
                    onClick={() => setReportingRatingId(r.id)}
                    aria-label="الإبلاغ عن هذا التقييم"
                  >
                    <FiFlag />
                    <span>إبلاغ</span>
                  </button>
                </div>

                <div className="my-ratings__dims">
                  {DIMENSIONS.map((d) => (
                    <div key={d.key} className="my-ratings__dim">
                      <span className="my-ratings__dim-label">{d.label}</span>
                      <StarRow value={r[d.key] || 0} />
                    </div>
                  ))}
                </div>

                {r.comment && (
                  <p className="my-ratings__comment">"{r.comment}"</p>
                )}

                <p className="my-ratings__date" dir="ltr">
                  {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      <ReportModal
        open={!!reportingRatingId}
        targetType="STUDENT_RATING"
        targetId={reportingRatingId}
        onClose={() => setReportingRatingId(null)}
      />
    </div>
  );
}
