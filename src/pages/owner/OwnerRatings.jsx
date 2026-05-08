import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import Skeleton from '../../components/shared/Skeleton';

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

  useEffect(() => {
    api.properties.myRatings()
      .then((res) => setRatings(res.ratings || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20 }}><Skeleton height={40} /><div style={{ height: 16 }} /><Skeleton height={20} count={5} /></div>;

  return (
    <>
      <div className="owner-section-hero">
        <h1 className="owner-page-title owner-section-hero-title">تقييمات العقارات</h1>
      </div>
      {error && <div className="owner-form-error">{error}</div>}

      <div className="owner-card">
        <div className="owner-table-wrap">
          {ratings.length === 0 ? (
            <div className="owner-empty">لا توجد تقييمات بعد</div>
          ) : (
            <table className="owner-table">
              <thead>
                <tr>
                  <th>العقار</th>
                  <th>الطالب</th>
                  <th>التقييم</th>
                  <th>التعليق</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {ratings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.property?.title || '—'}</td>
                    <td>{r.student?.name || '—'}</td>
                    <td><Stars rating={r.rating} /></td>
                    <td style={{ maxWidth: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {r.comment || '—'}
                    </td>
                    <td dir="ltr">{new Date(r.createdAt).toLocaleDateString('ar-SA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
