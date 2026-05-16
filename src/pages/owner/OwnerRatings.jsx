import { useEffect, useState } from 'react';
import { FiStar, FiFlag } from 'react-icons/fi';
import { api } from '../../utils/api';
import Skeleton from '../../components/shared/Skeleton';
import ReportModal from '../../components/shared/ReportModal';

function Stars({ rating }) {
  return (
    <span className="owner-stars">
      {[1,2,3,4,5].map((s) => (
        <span key={s} className={s <= rating ? 'owner-star-filled' : 'owner-star-empty'}>★</span>
      ))}
    </span>
  );
}

export default function OwnerRatings() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportingReviewId, setReportingReviewId] = useState(null);

  useEffect(() => {
    api.properties.myRatings()
      .then((res) => setRatings(res.ratings || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="owner-skeleton-wrap"><Skeleton height={40} /><div className="owner-skeleton-spacer" /><Skeleton height={20} count={5} /></div>;

  return (
    <>
      <div className="owner-section-hero">
        <h1 className="owner-page-title owner-section-hero-title">
          <FiStar /> تقييمات العقارات
        </h1>
      </div>
      {error && <div className="owner-form-error">{error}</div>}

      <div className="owner-card">
        <div className="owner-table-wrap">
          {ratings.length === 0 ? (
            <div className="owner-empty-body">
              <div className="owner-empty-icon">
                <FiStar size={36} color="#d1d5db" />
              </div>
              <h3 className="owner-empty-title">لا توجد تقييمات بعد</h3>
              <p className="owner-empty-desc">ستظهر تقييمات الطلاب لعقاراتك هنا</p>
            </div>
          ) : (
            <table className="owner-table">
              <thead>
                <tr>
                  <th>العقار</th>
                  <th>التقييم</th>
                  <th>التعليق</th>
                  <th>التاريخ</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {ratings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.property?.title || '—'}</td>
                    <td><Stars rating={r.rating} /></td>
                    <td className="owner-comment-cell">
                      {r.comment || '—'}
                    </td>
                    <td dir="ltr">{new Date(r.createdAt).toLocaleDateString('ar-SA')}</td>
                    <td>
                      <button
                        type="button"
                        className="owner-report-btn"
                        onClick={() => setReportingReviewId(r.id)}
                        aria-label="الإبلاغ عن هذا التقييم"
                      >
                        <FiFlag />
                        <span>إبلاغ</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ReportModal
        open={!!reportingReviewId}
        targetType="REVIEW"
        targetId={reportingReviewId}
        onClose={() => setReportingReviewId(null)}
      />
    </>
  );
}
