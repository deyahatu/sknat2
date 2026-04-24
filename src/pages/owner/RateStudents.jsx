import { useEffect, useState } from "react";
import { api } from "../../utils/api";

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
            initRatings[b.id] = givenMap[b.id].rating;
            initComments[b.id] = givenMap[b.id].comment || "";
          } else {
            initRatings[b.id] = 0;
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

  async function handleSave(bookingId, studentId) {
    const rating = ratings[bookingId];
    if (!rating || rating < 1) {
      setError("يرجى اختيار تقييم");
      return;
    }
    setSaving(bookingId);
    setError(null);
    setSuccess(null);
    try {
      await api.studentRatings.rate({
        bookingId,
        studentId,
        rating,
        comment: comments[bookingId] || "",
      });
      setGiven((prev) => ({
        ...prev,
        [bookingId]: { rating, comment: comments[bookingId] },
      }));
      setSuccess("تم حفظ التقييم بنجاح");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="owner-loading">جاري التحميل...</div>;

  return (
    <>
      <div className="owner-section-hero">
        <h1 className="owner-page-title owner-section-hero-title">
          تقييم الطلاب
        </h1>
      </div>{" "}
      {error && <div className="owner-form-error">{error}</div>}
      {success && <div className="owner-form-success">{success}</div>}
      {bookings.length === 0 ? (
        <div className="owner-card">
          <div className="owner-empty">لا توجد حجوزات مكتملة</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {bookings.map((b) => {
            const isRated = !!given[b.id];
            return (
              <div key={b.id} className="owner-card">
                <div className="owner-card-header">
                  <div>
                    <h3 className="owner-card-title">
                      {b.student?.name || "—"}
                    </h3>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "0.82rem",
                        color: "var(--owner-text-muted)",
                      }}
                    >
                      {b.property?.title} ·{" "}
                      {new Date(b.startDate).toLocaleDateString("ar-SA")} –{" "}
                      {new Date(b.endDate).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                  {isRated && (
                    <span className="owner-badge approved">تم التقييم</span>
                  )}
                </div>
                <div style={{ padding: "16px 20px" }}>
                  <div className="owner-form-group">
                    <label className="owner-form-label">التقييم</label>
                    <StarInput
                      value={ratings[b.id] || 0}
                      onChange={(v) =>
                        setRatings((prev) => ({ ...prev, [b.id]: v }))
                      }
                    />
                  </div>
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
