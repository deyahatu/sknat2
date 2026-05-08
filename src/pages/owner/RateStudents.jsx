import { useEffect, useState } from "react";
import { FiUsers } from "react-icons/fi";
import { api } from "../../utils/api";
import Skeleton from "../../components/shared/Skeleton";

const DIMENSIONS = [
  { key: "behaviorRating", label: "سلوك الطالب" },
  { key: "cleanlinessRating", label: "النظافة" },
  { key: "communicationRating", label: "التواصل" },
  { key: "overallRating", label: "التجربة الإجمالية" },
];

function emptyRatings() {
  return DIMENSIONS.reduce((acc, d) => ({ ...acc, [d.key]: 0 }), {});
}

function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="owner-star-input">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={s <= display ? "filled" : "empty"}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function RateStudents() {
  const [bookings, setBookings] = useState([]);
  const [given, setGiven] = useState({});
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [bookingsRes, givenRes] = await Promise.all([
          api.bookings.ownerList("COMPLETED"),
          api.studentRatings.given(),
        ]);
        const completed = bookingsRes.bookings || [];
        setBookings(completed);

        const givenMap = {};
        for (const r of givenRes.ratings || []) {
          givenMap[r.bookingId] = r;
        }
        setGiven(givenMap);

        const initRatings = {};
        const initComments = {};
        for (const b of completed) {
          if (givenMap[b.id]) {
            initRatings[b.id] = DIMENSIONS.reduce(
              (acc, d) => ({ ...acc, [d.key]: givenMap[b.id][d.key] || 0 }),
              {},
            );
            initComments[b.id] = givenMap[b.id].comment || "";
          } else {
            initRatings[b.id] = emptyRatings();
            initComments[b.id] = "";
          }
        }
        setRatings(initRatings);
        setComments(initComments);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function setDimension(bookingId, key, value) {
    setRatings((prev) => ({
      ...prev,
      [bookingId]: { ...(prev[bookingId] || emptyRatings()), [key]: value },
    }));
  }

  async function handleSave(bookingId, studentId) {
    const current = ratings[bookingId] || emptyRatings();
    const missing = DIMENSIONS.find((d) => !current[d.key] || current[d.key] < 1);
    if (missing) {
      setError(`يرجى اختيار تقييم "${missing.label}".`);
      return;
    }
    setSaving(bookingId);
    setError(null);
    setSuccess(null);
    try {
      await api.studentRatings.rate({
        bookingId,
        studentId,
        ...current,
        comment: comments[bookingId] || "",
      });
      setGiven((prev) => ({
        ...prev,
        [bookingId]: { ...current, comment: comments[bookingId] },
      }));
      setSuccess("تم حفظ التقييم بنجاح");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="owner-skeleton-wrap"><Skeleton height={40} /><div className="owner-skeleton-spacer" /><Skeleton height={20} count={5} /></div>;

  return (
    <>
      <div className="owner-section-hero">
        <h1 className="owner-page-title owner-section-hero-title">
          <FiUsers /> تقييم الطلاب
        </h1>
      </div>
      {error && <div className="owner-form-error">{error}</div>}
      {success && <div className="owner-form-success">{success}</div>}
      {bookings.length === 0 ? (
        <div className="owner-card">
          <div className="owner-empty-body">
            <div className="owner-empty-icon">
              <FiUsers size={36} color="#d1d5db" />
            </div>
            <h3 className="owner-empty-title">لا توجد حجوزات مكتملة</h3>
            <p className="owner-empty-desc">عند اكتمال حجز ما، يمكنك تقييم الطالب من هنا</p>
          </div>
        </div>
      ) : (
        <div className="owner-rate-list">
          {bookings.map((b) => {
            const isRated = !!given[b.id];
            const current = ratings[b.id] || emptyRatings();
            return (
              <div key={b.id} className="owner-card">
                <div className="owner-card-header">
                  <div>
                    <h3 className="owner-card-title">
                      {b.student?.name || "—"}
                    </h3>
                    <p className="owner-rate-student-sub">
                      {b.property?.title} ·{" "}
                      {new Date(b.startDate).toLocaleDateString("ar-SA")} –{" "}
                      {new Date(b.endDate).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                  {isRated && (
                    <span className="owner-badge approved">تم التقييم</span>
                  )}
                </div>
                <div className="owner-card-body">
                  {DIMENSIONS.map((d) => (
                    <div key={d.key} className="owner-form-group">
                      <label className="owner-form-label">{d.label}</label>
                      <StarInput
                        value={current[d.key] || 0}
                        onChange={(v) => setDimension(b.id, d.key, v)}
                      />
                    </div>
                  ))}
                  <div className="owner-form-group">
                    <label className="owner-form-label">تعليق (اختياري)</label>
                    <textarea
                      className="owner-form-textarea"
                      value={comments[b.id] || ""}
                      onChange={(e) =>
                        setComments((prev) => ({
                          ...prev,
                          [b.id]: e.target.value,
                        }))
                      }
                      rows={2}
                    />
                  </div>
                  <button
                    className="owner-btn owner-btn-primary"
                    disabled={saving === b.id}
                    onClick={() => handleSave(b.id, b.student?.id)}
                  >
                    {saving === b.id
                      ? "جاري الحفظ..."
                      : isRated
                        ? "تحديث التقييم"
                        : "حفظ التقييم"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
