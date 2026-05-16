import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiEdit2, FiHome, FiMapPin, FiShield, FiTrash2 } from "react-icons/fi";
import { api } from "../../utils/api";
import ConfirmModal from "../../components/shared/ConfirmModal";
import Skeleton, { SkeletonCard } from "../../components/shared/Skeleton";

function formatDate(value) {
  if (!value) return "غير محدد";
  try {
    return new Date(value).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function getTargetGenderLabel(targetGender) {
  if (targetGender === "FEMALE") return "مخصص للإناث";
  if (targetGender === "MALE") return "مخصص للذكور";
  return "غير محدد";
}

function getPropertySummary(property) {
  const text =
    property.address?.trim() ||
    property.description?.trim() ||
    "تفاصيل العقار جاهزة للتحديث والإدارة من هنا.";
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

export default function OwnerProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const res = await api.properties.mine();
      setProperties(res.properties || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleDelete(id, title) {
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف "${title}"؟`,
      action: async () => {
        setDeleting(id);
        try {
          await api.properties.delete(id);
          await load();
        } catch (err) {
          setError(err.message);
        } finally {
          setDeleting(null);
          setConfirmState((s) => ({ ...s, open: false }));
        }
      },
    });
  }

  return (
    <>
      <div className="owner-properties-hero">
        <div className="owner-properties-copy">
          <span className="owner-properties-eyebrow">إدارة العقارات</span>
          <h1 className="owner-page-title owner-properties-title">عقاراتي</h1>
        </div>
        <Link
          to="/owner/properties/add"
          className="owner-btn owner-btn-primary owner-properties-hero-add-btn"
        >
          + إضافة عقار
        </Link>
      </div>

      {error && <div className="owner-form-error">{error}</div>}

      {loading ? (
        <div className="owner-skeleton-grid">{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}</div>
      ) : properties.length === 0 ? (
        <div className="owner-card">
          <div className="owner-empty-body">
            <div className="owner-empty-icon">
              <FiHome size={36} color="#d1d5db" />
            </div>
            <h3 className="owner-empty-title">لا توجد عقارات</h3>
            <p className="owner-empty-desc">أضف عقارك الأول وابدأ باستقبال الحجوزات</p>
            <Link to="/owner/properties/add" className="owner-empty-cta">أضف عقارك الأول</Link>
          </div>
        </div>
      ) : (
        <div className="owner-properties-grid">
          {properties.map((p, index) => {
            return (
              <article key={p.id} className="owner-property-panel">
                <div className="owner-property-panel-head">
                  <span
                    className={`owner-property-status ${p.available ? "available" : "offline"}`}
                  >
                    {p.available ? "متاح للحجز" : "متوقف حالياً"}
                  </span>
                  <span className="owner-property-order">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                {p.disabledByAdmin && (
                  <div className="owner-property-admin-block">
                    تم تعطيل هذا السكن من قبل الإدارة. لا يمكنك حذفه أو إعادة تفعيله. تواصل مع الدعم.
                  </div>
                )}

                <div className="owner-property-tag-row">
                  <span className="owner-property-tag">
                    <FiMapPin />
                    <span>{p.city || "بدون مدينة"}</span>
                  </span>
                  <span className="owner-property-tag">
                    <FiShield />
                    <span>{getTargetGenderLabel(p.targetGender)}</span>
                  </span>
                </div>

                <h2 className="owner-property-card-title">{p.title}</h2>
                <p className="owner-property-card-summary">
                  {getPropertySummary(p)}
                </p>
                {p.roomVariants && p.roomVariants.length > 0 && (
                  <div className="owner-property-room-info">
                    الغرف: {p.roomVariants.length} | متاح:{" "}
                    {p.roomVariants.filter((v) => !v.isOccupied).length} | محجوز:{" "}
                    {p.roomVariants.filter((v) => v.isOccupied).length}
                  </div>
                )}

                <div className="owner-property-footer">
                  <p className="owner-property-updated">
                    آخر تحديث: {formatDate(p.updatedAt)}
                  </p>

                  <div className="owner-property-tools">
                    <button
                      className="owner-property-tool owner-property-tool-primary"
                      onClick={() => navigate(`/owner/properties/${p.id}/edit`)}
                    >
                      <FiEdit2 />
                      <span>تعديل</span>
                    </button>
                    {!p.disabledByAdmin && (
                      <button
                        className="owner-property-tool owner-property-tool-danger"
                        disabled={deleting === p.id}
                        onClick={() => handleDelete(p.id, p.title)}
                      >
                        <FiTrash2 />
                        <span>{deleting === p.id ? "جاري الحذف..." : "حذف"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); }}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
