import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../../components/shared/ConfirmModal";
import {
  PROPERTY_KINDS,
  ROOM_KINDS,
  CAMPUSES,
  PROPERTY_LEVEL_SERVICES,
  ROOM_LEVEL_FEATURES,
} from "../../constants/property";
import { api } from "../../utils/api";

const ROOM_STATUSES = [
  { id: "AVAILABLE", label: "متاحة", color: "#10b981", bg: "#d1fae5" },
  {
    id: "PARTIAL",
    label: "نصف محجوزة",
    color: "#d97706",
    bg: "#fed7aa",
    doubleOnly: true,
  },
  { id: "BOOKED", label: "محجوزة", color: "#dc2626", bg: "#fee2e2" },
];

const MAX_ROOMS = 5;

let _roomIdCounter = 1;
const newRoomId = () => `room_${_roomIdCounter++}`;

function makeRoom(index = 0) {
  return {
    id: newRoomId(),
    label: `الغرفة ${index + 1}`,
    kind: "SINGLE",
    price: "",
    area: "",
    features: [],
    status: "AVAILABLE",
  };
}

// ── Number input helpers (English digits only, no negatives) ──
const NUMBER_KEYS_ALLOWED = [
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
];

function blockNonEnglishDigits(e) {
  if (NUMBER_KEYS_ALLOWED.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  // Allow only English digits 0-9
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}

function sanitizeNumberPaste(e) {
  const pasted = (e.clipboardData || window.clipboardData).getData("text");
  if (!/^\d+$/.test(pasted)) e.preventDefault();
}

// Strip everything that's not an English digit (covers Arabic-Indic digits ٠-٩ etc.)
function toEnglishDigits(value) {
  if (!value) return "";
  return String(value).replace(/[^0-9]/g, "");
}

export default function AddEditProperty() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  // In edit mode, skip the "property kind" step — type can't be changed.
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  // Track variants that existed on load so we can compute deletes on save
  const [originalVariantIds, setOriginalVariantIds] = useState([]);
  // When editing a property that currently has APPROVED/PAID bookings, the
  // backend refuses changes to (gender / address / city / kind). We mirror
  // that here by disabling those fields and showing a banner.
  const [hasActiveBookings, setHasActiveBookings] = useState(false);

  // Step 1
  const [kind, setKind] = useState(null);

  // Step 2 - property level
  const [propertyData, setPropertyData] = useState({
    title: "",
    neighborhood: "",
    campus: "",
    distance: "",
    targetGender: "MALE",
    description: "",
    services: [],
    rules: "",
    images: [],
    studioPrice: "",
  });

  // Step 3 - rooms (apartment only). Flat list — each room owns its kind/
  // price/area/features. No abstract "patterns" any more. Locked rooms (those
  // with an in-app booking) are read-only.
  const [rooms, setRooms] = useState(() => [makeRoom(0)]);
  const [lockedRoomIds, setLockedRoomIds] = useState(() => new Set());

  const propertyImageRef = useRef(null);

  const selectedKind = PROPERTY_KINDS.find((k) => k.id === kind);
  const totalSteps = selectedKind?.needsRooms ? 4 : 3;

  // ── Load existing property in edit mode ──
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    api.properties
      .get(editId)
      .then((res) => {
        if (cancelled) return;
        const p = res.property;
        setHasActiveBookings(!!res.hasActiveBookings);
        setKind(p.kind || "APARTMENT");
        setPropertyData({
          title: p.title || "",
          neighborhood: p.city || "",
          campus: p.campus || "",
          distance: p.distance != null ? String(p.distance) : "",
          targetGender: p.targetGender || "MALE",
          description: p.description || "",
          services: p.sharedServices || [],
          rules: p.policy || "",
          images: p.images || [],
          studioPrice: p.studioPrice != null ? String(p.studioPrice) : "",
        });

        const variants = p.roomVariants || [];
        setOriginalVariantIds(variants.map((v) => v.id));
        setLockedRoomIds(new Set(res.lockedRoomIds || []));

        if (p.kind === "APARTMENT" && variants.length > 0) {
          // Each variant becomes one independent room. No pattern grouping —
          // the flat shape matches what the owner actually edits.
          const newRooms = variants.map((v, i) => {
            const status = v.isOccupied
              ? "BOOKED"
              : v.partiallyOccupied
                ? "PARTIAL"
                : "AVAILABLE";
            return {
              id: newRoomId(),
              dbId: v.id,
              label: v.name || `الغرفة ${i + 1}`,
              kind: v.kind || "SINGLE",
              price: v.fullPrice != null ? String(v.fullPrice) : "",
              area: v.area != null ? String(v.area) : "",
              features: v.services || [],
              status,
              // Snapshot so we can detect manual status flips on save.
              originalStatus: status,
            };
          });
          setRooms(newRooms);
        }
      })
      .catch((err) => setSubmitError(err.message || "تعذر تحميل العقار"))
      .finally(() => {
        if (!cancelled) setLoadingEdit(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEdit]);

  // ── Rooms handlers ──
  function isRoomLocked(room) {
    return isEdit && !!room.dbId && lockedRoomIds.has(room.dbId);
  }

  function addRoom() {
    setRooms((prev) => {
      if (prev.length >= MAX_ROOMS) return prev;
      return [...prev, makeRoom(prev.length)];
    });
  }

  function removeRoom(id) {
    setRooms((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target && isRoomLocked(target)) return prev; // can't delete booked rooms
      return prev.filter((r) => r.id !== id);
    });
  }

  function updateRoom(id, patch) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (isRoomLocked(r)) return r;
        const merged = { ...r, ...patch };
        // SINGLE rooms can't be PARTIAL — fold to BOOKED if user shrinks the kind.
        if (merged.kind === "SINGLE" && merged.status === "PARTIAL") {
          merged.status = "BOOKED";
        }
        return merged;
      }),
    );
  }

  function toggleRoomFeature(id, f) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id || isRoomLocked(r)) return r;
        return {
          ...r,
          features: r.features.includes(f)
            ? r.features.filter((x) => x !== f)
            : [...r.features, f],
        };
      }),
    );
  }

  // ── Stats ──
  const roomsSummary = useMemo(() => {
    const total = rooms.length;
    const available = rooms.filter((r) => r.status === "AVAILABLE").length;
    const booked = rooms.filter((r) => r.status === "BOOKED").length;
    const partial = rooms.filter((r) => r.status === "PARTIAL").length;
    return { total, available, booked, partial };
  }, [rooms]);

  function handlePropertyImageFiles(e) {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPropertyData((prev) => ({
          ...prev,
          images: [...prev.images, ev.target.result],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function togglePropertyService(s) {
    setPropertyData((prev) => ({
      ...prev,
      services: prev.services.includes(s)
        ? prev.services.filter((x) => x !== s)
        : [...prev.services, s],
    }));
  }

  // ── Stepper ──
  function renderStepper() {
    const allSteps = selectedKind?.needsRooms
      ? ["نوع العقار", "بيانات الشقة", "توزيع الغرف", "المراجعة"]
      : ["نوع العقار", "بيانات الاستوديو", "المراجعة"];
    // In edit mode, hide step 1 (property kind) — but keep its index so step numbers stay consistent
    const steps = isEdit ? allSteps.slice(1) : allSteps;
    const startIndex = isEdit ? 2 : 1;
    return (
      <div className="wiz-stepper">
        {steps.map((label, i) => {
          const num = startIndex + i;
          const isActive = step === num;
          const isDone = step > num;
          return (
            <div key={label} className="wiz-step-wrap">
              <div
                className={`wiz-step-circle ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
              >
                {isDone ? "✓" : num}
              </div>
              <div className={`wiz-step-label ${isActive ? "active" : ""}`}>
                {label}
              </div>
              {i < steps.length - 1 && (
                <div className={`wiz-step-line ${isDone ? "done" : ""}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Step 1 ──
  function renderStep1() {
    return (
      <div>
        <h2 className="wiz-h2">ما نوع العقار؟</h2>
        <p className="wiz-sub">اختر نوع العقار وسنخصص الخطوات حسبه.</p>
        <div className="wiz-kinds-grid">
          {PROPERTY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`wiz-kind-card ${kind === k.id ? "selected" : ""}`}
              onClick={() => setKind(k.id)}
            >
              <div className="wiz-kind-icon">{k.icon}</div>
              <div className="wiz-kind-title">{k.title}</div>
              <div className="wiz-kind-desc">{k.desc}</div>
              {kind === k.id && <div className="wiz-kind-check">✓</div>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2 ──
  function renderStep2() {
    const isStudio = !selectedKind?.needsRooms;
    return (
      <div>
        <h2 className="wiz-h2">
          {isStudio ? "بيانات الاستوديو" : "بيانات الشقة"}
        </h2>
        <p className="wiz-sub">
          {isStudio
            ? "أدخل بيانات الاستوديو والخدمات المتوفرة فيه."
            : "هذه البيانات تخص الشقة كاملةً (تظهر للطلاب لجميع الغرف)."}
        </p>

        <div className="wiz-card">
          <div className="wiz-card-title">المعلومات الأساسية</div>
          <div className="wiz-form-group">
            <label>اسم السكن</label>
            <input
              className="wiz-input"
              value={propertyData.title}
              onChange={(e) =>
                setPropertyData({ ...propertyData, title: e.target.value })
              }
              placeholder="مثلاً: شقة النخبة"
            />
          </div>
          {hasActiveBookings && (
            <div className="wiz-locked-notice">
              ⚠️ بعض الحقول (الحي، الحرم، الجنس المستهدف) مقفلة لأن السكن عليه حجوزات نشطة.
              يمكن تعديلها بعد انتهاء أو إلغاء كل الحجوزات.
            </div>
          )}

          <div className="wiz-form-row">
            <div className="wiz-form-group">
              <label>الحي</label>
              <input
                className="wiz-input"
                value={propertyData.neighborhood}
                disabled={hasActiveBookings}
                onChange={(e) =>
                  setPropertyData({
                    ...propertyData,
                    neighborhood: e.target.value,
                  })
                }
                placeholder="مثلاً: رفيديا"
              />
            </div>
            <div className="wiz-form-group">
              <label>المسافة عن الحرم (دقائق سيراً)</label>
              <input
                className="wiz-input"
                type="number"
                min="0"
                value={propertyData.distance}
                onChange={(e) =>
                  setPropertyData({
                    ...propertyData,
                    distance: toEnglishDigits(e.target.value),
                  })
                }
                onKeyDown={blockNonEnglishDigits}
                onPaste={sanitizeNumberPaste}
                inputMode="numeric"
                placeholder="5"
              />
            </div>
          </div>

          <div className="wiz-form-group">
            <label>الحرم الأقرب</label>
            <div className="wiz-choice-row">
              {CAMPUSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={hasActiveBookings}
                  className={`wiz-choice-btn ${propertyData.campus === c.id ? "active" : ""}`}
                  onClick={() =>
                    setPropertyData({ ...propertyData, campus: c.id })
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="wiz-form-group">
            <label>السكن مخصص لـ</label>
            <div className="wiz-choice-row">
              <button
                type="button"
                disabled={hasActiveBookings}
                className={`wiz-choice-btn ${propertyData.targetGender === "MALE" ? "active" : ""}`}
                onClick={() =>
                  setPropertyData({ ...propertyData, targetGender: "MALE" })
                }
              >
                ذكور
              </button>
              <button
                type="button"
                disabled={hasActiveBookings}
                className={`wiz-choice-btn ${propertyData.targetGender === "FEMALE" ? "active" : ""}`}
                onClick={() =>
                  setPropertyData({ ...propertyData, targetGender: "FEMALE" })
                }
              >
                إناث
              </button>
            </div>
          </div>

          <div className="wiz-form-group">
            <label>
              الوصف <span className="wiz-optional">(اختياري)</span>
            </label>
            <textarea
              className="wiz-input wiz-textarea"
              rows={3}
              value={propertyData.description}
              onChange={(e) =>
                setPropertyData({
                  ...propertyData,
                  description: e.target.value,
                })
              }
              placeholder="إذا أردت إبراز شي مميز عن السكن، اكتبه هنا..."
            />
          </div>
        </div>

        <div className="wiz-card">
          <div className="wiz-card-title">
            {isStudio ? "الخدمات المتوفرة" : "الخدمات المشتركة في الشقة"}
          </div>
          <div className="wiz-card-hint">
            {isStudio
              ? "اختر كل ما يتوفر في الاستوديو."
              : "خدمات يستفيد منها كل سكان الشقة (واي فاي، مصعد...). خدمات الغرف الخاصة تُحدد لاحقاً."}
          </div>
          <div className="wiz-chips-grid">
            {PROPERTY_LEVEL_SERVICES.map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  className={`wiz-chip ${propertyData.services.includes(s) ? "active" : ""}`}
                  onClick={() => togglePropertyService(s)}
                >
                  {propertyData.services.includes(s) ? "✓ " : ""}
                  {s}
                </button>
              ),
            )}
          </div>
        </div>

        {isStudio && (
          <div className="wiz-card">
            <div className="wiz-card-title">السعر</div>
            <div className="wiz-form-group" style={{ maxWidth: 280 }}>
              <label>السعر الشهري (₪)</label>
              <input
                className="wiz-input"
                type="number"
                min="1"
                value={propertyData.studioPrice}
                onChange={(e) =>
                  setPropertyData({
                    ...propertyData,
                    studioPrice: toEnglishDigits(e.target.value),
                  })
                }
                onKeyDown={blockNonEnglishDigits}
                onPaste={sanitizeNumberPaste}
                inputMode="numeric"
              />
            </div>
          </div>
        )}

        <div className="wiz-card">
          <div className="wiz-card-title">قوانين السكن</div>
          <textarea
            className="wiz-input wiz-textarea"
            rows={3}
            value={propertyData.rules}
            onChange={(e) =>
              setPropertyData({ ...propertyData, rules: e.target.value })
            }
            placeholder="مثلاً: ساعة العودة 11 مساءً، ممنوع التدخين..."
          />
        </div>

        <div className="wiz-card">
          <div className="wiz-card-title">
            الصور <span style={{ color: "#dc2626", fontWeight: 700 }}>*</span>
          </div>
          <div className="wiz-card-hint">
            مطلوب رفع صورة واحدة على الأقل للسكن.
          </div>
          <button
            type="button"
            className="wiz-btn-outline"
            onClick={() => propertyImageRef.current?.click()}
          >
            + رفع صور
          </button>
          <input
            ref={propertyImageRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handlePropertyImageFiles}
          />
          {propertyData.images.length === 0 && (
            <div className="wiz-images-empty">
              ⚠️ لم تقم برفع أي صورة بعد. يجب رفع صورة واحدة على الأقل للمتابعة.
            </div>
          )}
          {propertyData.images.length > 0 && (
            <div className="wiz-images-grid">
              {propertyData.images.map((img, i) => (
                <div key={i} className="wiz-image-preview">
                  <img src={img} alt="" />
                  <button
                    type="button"
                    className="wiz-img-remove"
                    onClick={() =>
                      setPropertyData({
                        ...propertyData,
                        images: propertyData.images.filter(
                          (_, idx) => idx !== i,
                        ),
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Step 3: Rooms (flat, no patterns) ──
  function renderStep3() {
    const hasLockedRooms = rooms.some((r) => isRoomLocked(r));
    return (
      <div>
        <h2 className="wiz-h2">غرف العقار</h2>
        <p className="wiz-sub">
          أضف غرفة، عدّل بياناتها، أو انسخ غرفة موجودة بسرعة.
        </p>

        {/* ── Toolbar: count + add ── */}
        <div className="wiz-rooms-toolbar">
          <div className="wiz-rooms-count">
            <span className="wiz-rooms-count-num">{rooms.length}</span>
            <span className="wiz-rooms-count-label">غرفة</span>
            {rooms.length > 0 && (
              <span className="wiz-rooms-count-sub">
                ({roomsSummary.available} متاحة، {roomsSummary.partial} نصف،{" "}
                {roomsSummary.booked} محجوزة)
              </span>
            )}
          </div>
          <button
            type="button"
            className="wiz-btn-primary"
            onClick={addRoom}
            disabled={rooms.length >= MAX_ROOMS}
          >
            + إضافة غرفة
          </button>
        </div>

        {hasLockedRooms && (
          <div className="wiz-locked-notice">
            🔒 الغرف المقفلة فيها حجوزات نشطة من التطبيق — يمكن تعديلها بعد انتهاء أو إلغاء الحجوزات.
          </div>
        )}

        {/* ── Rooms list ── */}
        <div className="wiz-flat-rooms-list">
          {rooms.map((r, i) => {
            const locked = isRoomLocked(r);
            const isDouble = r.kind === "DOUBLE";
            return (
              <div
                key={r.id}
                className={`wiz-flat-room ${locked ? "locked" : ""}`}
              >
                <div className="wiz-flat-room-head">
                  <div className="wiz-flat-room-num">
                    <span className="wiz-flat-room-badge">#{i + 1}</span>
                    <span className="wiz-flat-room-name-fixed">
                      الغرفة {i + 1}
                    </span>
                  </div>
                  <div className="wiz-flat-room-actions">
                    {locked && (
                      <span className="wiz-flat-room-lock">🔒 محجوزة</span>
                    )}
                    {!locked && rooms.length > 1 && (
                      <button
                        type="button"
                        className="wiz-text-btn danger"
                        onClick={() => removeRoom(r.id)}
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>

                <div className="wiz-form-row">
                  <div className="wiz-form-group">
                    <label>نوع الغرفة</label>
                    <div className="wiz-mini-segmented">
                      {ROOM_KINDS.map((rk) => (
                        <button
                          key={rk.id}
                          type="button"
                          disabled={locked}
                          className={`wiz-seg-btn ${r.kind === rk.id ? "active" : ""}`}
                          onClick={() => updateRoom(r.id, { kind: rk.id })}
                        >
                          <span>{rk.icon}</span> {rk.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="wiz-form-group">
                    <label>السعر الشهري (₪)</label>
                    <input
                      className="wiz-input"
                      type="number"
                      min="1"
                      value={r.price}
                      disabled={locked}
                      onChange={(e) =>
                        updateRoom(r.id, {
                          price: toEnglishDigits(e.target.value),
                        })
                      }
                      onKeyDown={blockNonEnglishDigits}
                      onPaste={sanitizeNumberPaste}
                      inputMode="numeric"
                      placeholder="500"
                    />
                    {isDouble && r.price && (
                      <div className="wiz-tip-small">
                        للسرير الواحد: <strong>{Math.round(Number(r.price) / 2)} ₪</strong>
                      </div>
                    )}
                  </div>
                  <div className="wiz-form-group">
                    <label>المساحة (م²)</label>
                    <input
                      className="wiz-input"
                      type="number"
                      min="1"
                      value={r.area}
                      disabled={locked}
                      onChange={(e) =>
                        updateRoom(r.id, {
                          area: toEnglishDigits(e.target.value),
                        })
                      }
                      onKeyDown={blockNonEnglishDigits}
                      onPaste={sanitizeNumberPaste}
                      inputMode="numeric"
                      placeholder="12"
                    />
                  </div>
                </div>

                <div className="wiz-form-group">
                  <label>المميزات</label>
                  <div className="wiz-chips-grid">
                    {ROOM_LEVEL_FEATURES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        disabled={locked}
                        className={`wiz-chip ${r.features.includes(f) ? "active" : ""}`}
                        onClick={() => toggleRoomFeature(r.id, f)}
                      >
                        {r.features.includes(f) ? "✓ " : ""}
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wiz-form-group">
                  <label>الحالة</label>
                  <div className="wiz-room-status">
                    {ROOM_STATUSES.filter(
                      (s) => !s.doubleOnly || isDouble,
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={locked}
                        className={`wiz-status-btn ${r.status === s.id ? "active" : ""}`}
                        style={
                          r.status === s.id
                            ? {
                                background: s.bg,
                                color: s.color,
                                borderColor: s.color,
                              }
                            : {}
                        }
                        onClick={() => updateRoom(r.id, { status: s.id })}
                        title={
                          s.id === "PARTIAL"
                            ? "سرير واحد محجوز، الثاني متاح"
                            : ""
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 4: Review ──
  function renderReview() {
    const isStudio = !selectedKind?.needsRooms;
    return (
      <div>
        <h2 className="wiz-h2">المراجعة النهائية</h2>
        <p className="wiz-sub">راجع البيانات قبل النشر.</p>

        <div className="wiz-card">
          <div className="wiz-card-title">
            {selectedKind?.icon} {selectedKind?.title}
          </div>
          <div className="wiz-review-row">
            <span>الاسم:</span>
            <strong>{propertyData.title || "—"}</strong>
          </div>
          <div className="wiz-review-row">
            <span>الحي:</span>
            <strong>{propertyData.neighborhood || "—"}</strong>
          </div>
          <div className="wiz-review-row">
            <span>الحرم:</span>
            <strong>
              {CAMPUSES.find((c) => c.id === propertyData.campus)?.label || "—"}
            </strong>
          </div>
          <div className="wiz-review-row">
            <span>مخصص لـ:</span>
            <strong>
              {propertyData.targetGender === "FEMALE" ? "إناث" : "ذكور"}
            </strong>
          </div>
          <div className="wiz-review-row">
            <span>المسافة:</span>
            <strong>
              {propertyData.distance ? `${propertyData.distance} د.` : "—"}
            </strong>
          </div>
          <div className="wiz-review-row">
            <span>الخدمات:</span>
            <strong>{propertyData.services.join("، ") || "—"}</strong>
          </div>
        </div>

        {!isStudio && (
          <div className="wiz-card">
            <div className="wiz-card-title">الغرف ({rooms.length})</div>
            <div className="wiz-review-rooms-grid">
              {rooms.map((r, i) => {
                const status = ROOM_STATUSES.find((s) => s.id === r.status);
                const kindLabel = ROOM_KINDS.find((k) => k.id === r.kind)?.title;
                return (
                  <div key={r.id} className="wiz-review-room">
                    <div className="wiz-review-room-label">الغرفة {i + 1}</div>
                    <div className="wiz-review-room-meta">
                      <span className="wiz-review-badge">{kindLabel}</span>
                      <span className="wiz-review-badge">{r.price || "—"} ₪</span>
                      {r.area && (
                        <span className="wiz-review-badge">{r.area} م²</span>
                      )}
                    </div>
                    {r.features.length > 0 && (
                      <div className="wiz-review-features">
                        {r.features.join("، ")}
                      </div>
                    )}
                    {status && (
                      <div
                        className="wiz-review-room-status"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {status.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isStudio && (
          <div className="wiz-card">
            <div className="wiz-card-title">السعر</div>
            <div className="wiz-review-row">
              <span>الإيجار الشهري:</span>
              <strong>{propertyData.studioPrice || "—"} ₪</strong>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Submit ──
  function buildVariantPayloadFromRoom(r, index) {
    const isDouble = r.kind === "DOUBLE";
    const fullPrice = Number(r.price || 0);
    const halfPrice = isDouble ? Math.round(fullPrice / 2) : null;
    const area = r.area && Number(r.area) > 0 ? Number(r.area) : null;
    return {
      // Room labels are derived from position — owners can't rename them.
      name: `الغرفة ${index + 1}`,
      kind: r.kind || "SINGLE",
      capacity: isDouble ? 2 : 1,
      area,
      fullPrice,
      halfPrice,
      services: r.features || [],
    };
  }

  async function handleSubmit() {
    if (saving) return;
    setSubmitError(null);
    setSaving(true);
    try {
      const isApartment = selectedKind?.needsRooms;

      const propertyPayload = {
        title: propertyData.title.trim(),
        kind,
        city: propertyData.neighborhood.trim(),
        campus: propertyData.campus || null,
        distance: propertyData.distance ? Number(propertyData.distance) : null,
        description: propertyData.description?.trim() || null,
        policy: propertyData.rules?.trim() || null,
        sharedServices: propertyData.services,
        images: propertyData.images,
        targetGender: propertyData.targetGender || "MALE",
        ...(isApartment
          ? {}
          : { studioPrice: Number(propertyData.studioPrice) }),
      };

      let propertyId;
      if (isEdit) {
        const res = await api.properties.update(editId, propertyPayload);
        propertyId = res.property.id;
      } else {
        const res = await api.properties.create(propertyPayload);
        propertyId = res.property.id;
      }

      if (!isApartment) {
        // Studio: single auto-variant
        const studioVariantPayload = {
          name: "الاستوديو",
          kind: "SINGLE",
          capacity: 1,
          fullPrice: Number(propertyData.studioPrice),
          services: propertyData.services,
        };
        if (isEdit && originalVariantIds[0]) {
          await api.properties.updateVariant(
            propertyId,
            originalVariantIds[0],
            studioVariantPayload,
          );
        } else {
          await api.properties.createVariant(propertyId, {
            ...studioVariantPayload,
            isOccupied: false,
            partiallyOccupied: false,
          });
        }
      } else if (rooms.length > 0) {
        // Apartment: handle each room
        if (isEdit) {
          const stillExistingDbIds = new Set();
          const manualStatusErrors = [];
          for (let i = 0; i < rooms.length; i++) {
            const r = rooms[i];
            const payload = buildVariantPayloadFromRoom(r, i);
            if (r.dbId) {
              await api.properties.updateVariant(propertyId, r.dbId, payload);
              stillExistingDbIds.add(r.dbId);
              // Manual occupancy must go through its own endpoint (security guard
              // against double-booking). Only call if the owner actually flipped it.
              if (r.originalStatus && r.status !== r.originalStatus) {
                const apiStatus =
                  r.status === "BOOKED"
                    ? "OCCUPIED"
                    : r.status === "PARTIAL"
                      ? "PARTIAL"
                      : "AVAILABLE";
                try {
                  await api.properties.setRoomManualStatus(propertyId, r.dbId, apiStatus);
                } catch (statusErr) {
                  manualStatusErrors.push(`${r.label}: ${statusErr.message}`);
                }
              }
            } else {
              const created = await api.properties.createVariant(
                propertyId,
                payload,
              );
              if (created?.variant?.id)
                stillExistingDbIds.add(created.variant.id);
            }
          }
          // Delete variants that were removed in the UI
          for (const oldId of originalVariantIds) {
            if (!stillExistingDbIds.has(oldId)) {
              try {
                await api.properties.deleteVariant(propertyId, oldId);
              } catch {
                /* ignore — may have active bookings */
              }
            }
          }
          // Surface any manual-status failures (e.g. room already booked in-app)
          // without rolling back the rest of the save — the data updates went through.
          if (manualStatusErrors.length > 0) {
            setSubmitError(
              `تم حفظ العقار، لكن لم يتم تحديث حالة بعض الغرف: ${manualStatusErrors.join("، ")}`,
            );
            setSaving(false);
            return;
          }
        } else {
          await api.properties.bulkCreateVariants(
            propertyId,
            rooms.map((r, i) => buildVariantPayloadFromRoom(r, i)),
          );
        }
      }

      navigate("/owner/properties");
    } catch (err) {
      setSubmitError(err.message || "حدث خطأ أثناء حفظ العقار");
      setSaving(false);
    }
  }

  function canGoNext() {
    if (step === 1) return !!kind;
    if (step === 2) {
      const baseOk =
        propertyData.title.trim() &&
        propertyData.neighborhood.trim() &&
        propertyData.images.length > 0;
      if (!selectedKind?.needsRooms) {
        return baseOk && Number(propertyData.studioPrice) > 0;
      }
      return baseOk;
    }
    if (step === 3 && selectedKind?.needsRooms) {
      return (
        rooms.length > 0 && rooms.every((r) => Number(r.price) > 0)
      );
    }
    return true;
  }

  if (loadingEdit) {
    return (
      <>
        <style>{wizardStyles}</style>
        <div className="wiz-container">
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            جاري تحميل بيانات العقار...
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{wizardStyles}</style>
      <div className="wiz-container">
        <div className="wiz-header">
          <h1 className="wiz-title">
            {isEdit ? "تعديل العقار" : "إضافة عقار جديد"}
          </h1>
          <button
            className="wiz-btn-ghost"
            onClick={() => navigate("/owner/properties")}
          >
            ← رجوع
          </button>
        </div>

        {renderStepper()}

        <div className="wiz-content">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && selectedKind?.needsRooms && renderStep3()}
          {step === 3 && !selectedKind?.needsRooms && renderReview()}
          {step === 4 && renderReview()}
          {submitError && (
            <div className="wiz-submit-error">⚠️ {submitError}</div>
          )}
        </div>

        <div className="wiz-actions">
          {step > 1 && !(isEdit && step === 2) && (
            <button
              className="wiz-btn-outline"
              onClick={() => setStep(step - 1)}
            >
              ← السابق
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < totalSteps && (
            <button
              className="wiz-btn-primary"
              disabled={!canGoNext()}
              onClick={() => setStep(step + 1)}
            >
              التالي ←
            </button>
          )}
          {step === totalSteps && (
            <button
              className="wiz-btn-primary"
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving
                ? "جاري الحفظ..."
                : isEdit
                  ? "حفظ التغييرات"
                  : "نشر العقار"}
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={() => { confirmState.action?.(); }}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </>
  );
}

const wizardStyles = `
.wiz-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  font-family: inherit;
  direction: rtl;
}
.wiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.wiz-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}
.wiz-stepper {
  display: flex;
  align-items: center;
  margin-bottom: 32px;
  padding: 16px;
  background: #f8f9fb;
  border-radius: 12px;
}
.wiz-step-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  position: relative;
}
.wiz-step-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 0.2s;
}
.wiz-step-circle.active {
  background: #4f46e5;
  color: #fff;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15);
}
.wiz-step-circle.done {
  background: #10b981;
  color: #fff;
}
.wiz-step-label {
  margin-right: 10px;
  font-size: 14px;
  color: #6b7280;
  white-space: nowrap;
}
.wiz-step-label.active {
  color: #1a1a1a;
  font-weight: 600;
}
.wiz-step-line {
  flex: 1;
  height: 2px;
  background: #e5e7eb;
  margin: 0 12px;
  min-width: 30px;
}
.wiz-step-line.done {
  background: #10b981;
}
.wiz-content {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  border: 1px solid #e5e7eb;
  margin-bottom: 20px;
}
.wiz-submit-error {
  margin-top: 18px;
  padding: 12px 16px;
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 14px;
}
.wiz-h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #1a1a1a;
}
.wiz-sub {
  color: #6b7280;
  font-size: 14px;
  margin: 0 0 24px;
  line-height: 1.7;
}
.wiz-kinds-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 24px;
}
.wiz-kind-card {
  position: relative;
  padding: 28px 20px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  font-family: inherit;
}
.wiz-kind-card:hover {
  border-color: #a5b4fc;
  transform: translateY(-2px);
}
.wiz-kind-card.selected {
  border-color: #4f46e5;
  background: #f5f3ff;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}
.wiz-kind-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.wiz-kind-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #1a1a1a;
}
.wiz-kind-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
.wiz-kind-check {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 26px;
  height: 26px;
  background: #4f46e5;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}
.wiz-card {
  background: #fafbfc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}
.wiz-card-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 10px;
}
.wiz-section-num {
  width: 26px;
  height: 26px;
  background: #4f46e5;
  color: #fff;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}
.wiz-card-hint {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 14px;
  line-height: 1.6;
}
.wiz-form-group {
  margin-bottom: 14px;
}
.wiz-form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #374151;
}
.wiz-form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  align-items: end;
}
.wiz-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  background: #fff;
  transition: border-color 0.15s;
}
.wiz-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
.wiz-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}
.wiz-textarea {
  resize: vertical;
}
.wiz-choice-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wiz-choice-btn {
  padding: 16px 20px;
  border: 1.5px solid #d1d5db;
  background: #fff;
  border-radius: 10px;
  font-family: inherit;
  font-size: 15px;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}
.wiz-choice-btn:hover {
  border-color: #a5b4fc;
  background: #fafaff;
}
.wiz-choice-btn.active {
  border-color: #4f46e5;
  background: #f5f3ff;
  color: #4f46e5;
  font-weight: 600;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}
.wiz-optional {
  color: #9ca3af;
  font-weight: 400;
  font-size: 12px;
}
.wiz-tip {
  font-size: 13px;
  color: #6b7280;
  padding: 10px 0;
}
.wiz-tip-small {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.wiz-link {
  background: none;
  border: none;
  color: #4f46e5;
  text-decoration: underline;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  padding: 0;
}
.wiz-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.wiz-chip {
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 20px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.wiz-chip:hover {
  border-color: #a5b4fc;
}
.wiz-chip.active {
  background: #4f46e5;
  color: #fff;
  border-color: #4f46e5;
}

/* Pattern blocks */
.wiz-pattern-block {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-right: 4px solid #4f46e5;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}
.wiz-pattern-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}
.wiz-pattern-name-readonly {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}
.wiz-pattern-color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}
.wiz-pattern-assign {
  margin-top: 12px;
  padding: 10px;
  background: #fef3c7;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #92400e;
}
.wiz-mini-segmented {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 8px;
}
.wiz-seg-btn {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.wiz-seg-btn.active {
  background: #fff;
  color: #4f46e5;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.wiz-add-variant-btn {
  width: 100%;
  padding: 14px;
  border: 2px dashed #d1d5db;
  background: #fff;
  border-radius: 10px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}
.wiz-add-variant-btn:hover {
  border-color: #4f46e5;
  color: #4f46e5;
  background: #f5f3ff;
}
.wiz-quick-actions {
  margin-top: 12px;
  text-align: center;
}
.wiz-confirm-row {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #e5e7eb;
  text-align: center;
}

/* Progress bar */
.wiz-progress-bar {
  position: relative;
  height: 30px;
  background: #f3f4f6;
  border-radius: 15px;
  margin-bottom: 16px;
  overflow: hidden;
}
.wiz-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  transition: width 0.3s;
}
.wiz-progress-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

/* Rooms list */
.wiz-rooms-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wiz-room-row {
  display: grid;
  grid-template-columns: 140px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: all 0.2s;
}
.wiz-room-num {
  display: flex;
  flex-direction: column;
}
.wiz-room-label-input {
  border: 1px solid transparent;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 6px;
  border-radius: 4px;
  width: 100%;
  outline: none;
}
.wiz-room-label-input:hover, .wiz-room-label-input:focus {
  border-color: #d1d5db;
  background: #fff;
}
.wiz-room-pattern {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wiz-room-pattern-select {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.wiz-room-pattern-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1.5px solid;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.15s;
  background: transparent;
  width: fit-content;
}
.wiz-room-pattern-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}
.wiz-room-pattern-static {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  width: fit-content;
}
.wiz-room-pattern-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.wiz-room-pattern-arrows {
  font-size: 12px;
  opacity: 0.6;
  margin-right: 2px;
}
.wiz-room-price-hint {
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
  padding-right: 4px;
}
.wiz-room-status {
  display: flex;
  gap: 4px;
}
.wiz-status-btn {
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s;
}
.wiz-status-btn:hover {
  border-color: #6b7280;
}
.wiz-status-btn.active {
  font-weight: 600;
}

/* Legend */
.wiz-legend {
  margin-top: 16px;
  padding: 14px;
  background: #f9fafb;
  border-radius: 8px;
}
.wiz-legend-title {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 8px;
}
.wiz-legend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  font-size: 13px;
}
.wiz-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.wiz-legend-name {
  font-weight: 600;
  color: #1a1a1a;
}
.wiz-legend-meta {
  color: #6b7280;
  font-size: 12px;
}

/* Actions */
.wiz-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.wiz-btn-primary {
  padding: 12px 28px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.wiz-btn-primary:hover:not(:disabled) {
  background: #4338ca;
}
.wiz-btn-primary:disabled {
  background: #c7c9d1;
  cursor: not-allowed;
}
.wiz-btn-outline {
  padding: 12px 24px;
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.wiz-btn-outline:hover {
  background: #f9fafb;
}
.wiz-btn-outline-sm {
  padding: 8px 16px;
  background: #fff;
  color: #4f46e5;
  border: 1px solid #4f46e5;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.wiz-btn-outline-sm:hover {
  background: #f5f3ff;
}
.wiz-btn-ghost {
  padding: 6px 12px;
  background: transparent;
  color: #6b7280;
  border: none;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.wiz-btn-ghost:hover {
  background: #f3f4f6;
  color: #1a1a1a;
}
.wiz-btn-ghost.danger {
  color: #dc2626;
}
.wiz-btn-ghost.danger:hover {
  background: #fef2f2;
}
.wiz-images-empty {
  margin-top: 12px;
  padding: 12px 14px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.6;
}
.wiz-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.wiz-image-preview {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}
.wiz-image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.wiz-img-remove {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
}

/* Review */
.wiz-review-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}
.wiz-review-row:last-child {
  border-bottom: none;
}
.wiz-review-row span {
  color: #6b7280;
}
.wiz-review-pattern {
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-right: 4px solid;
  border-radius: 8px;
  margin-bottom: 8px;
}
.wiz-review-pattern-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.wiz-review-badge {
  background: #ede9fe;
  color: #4f46e5;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}
.wiz-review-badge.available {
  background: #d1fae5;
  color: #065f46;
}
.wiz-review-price {
  margin-right: auto;
  font-weight: 600;
  color: #059669;
}
.wiz-review-features {
  margin-top: 6px;
  font-size: 13px;
  color: #6b7280;
}
.wiz-review-rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.wiz-review-room {
  padding: 12px;
  background: #fff;
  border: 2px solid;
  border-radius: 8px;
  text-align: center;
}
.wiz-review-room-label {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 4px;
}
.wiz-review-room-pattern {
  font-size: 12px;
  margin-bottom: 6px;
  font-weight: 600;
}
.wiz-review-room-status {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

@media (max-width: 720px) {
  .wiz-room-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .wiz-mini-segmented {
    flex-direction: column;
  }
}
`;
