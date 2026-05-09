import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [reportingRatingId, setReportingRatingId] = useState(null);

  useEffect(() => {
    api.studentRatings.received()
      .then((data) => setRatings(data.ratings || []))
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
            <p>تقييمات قدّمها أصحاب العقارات بعد إقامتك. إذا شعرت بأن تقييماً غير عادل، يمكنك الإبلاغ عنه.</p>
          </div>
          <div className="my-ratings__hero-count">
            <strong>{ratings.length}</strong>
            <span>تقييم</span>
          </div>
        </header>

        {ratings.length === 0 ? (
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
