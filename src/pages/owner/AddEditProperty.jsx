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

let _patternIdCounter = 1;
let _roomIdCounter = 1;
const newPatternId = () => `pat_${_patternIdCounter++}`;
const newRoomId = () => `room_${_roomIdCounter++}`;

const PATTERN_COLORS = [
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
];
let _colorCounter = 0;
function pickColor() {
  return PATTERN_COLORS[_colorCounter++ % PATTERN_COLORS.length];
}

function makePattern() {
  return {
    id: newPatternId(),
    name: "",
    kind: "SINGLE",
    price: "",
    features: [],
    color: pickColor(),
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

  // Step 3 - rooms (apartment only)
  const [totalRooms, setTotalRooms] = useState(4);
  const [patterns, setPatterns] = useState(() => [
    { ...makePattern(), name: "الغرفة 1", kind: "SINGLE" },
  ]);
  const [rooms, setRooms] = useState([]);
  const [roomsGenerated, setRoomsGenerated] = useState(false);
  const [setupConfirmed, setSetupConfirmed] = useState(false);

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

        if (p.kind === "APARTMENT" && variants.length > 0) {
          // Group variants into patterns by patternName + kind + fullPrice + services
          const patternMap = new Map();
          const newRooms = [];
          variants.forEach((v) => {
            const key = `${v.patternName || ""}|${v.kind}|${v.fullPrice}|${(v.services || []).join(",")}`;
            if (!patternMap.has(key)) {
              patternMap.set(key, {
                id: newPatternId(),
                name: `الغرفة ${patternMap.size + 1}`,
                kind: v.kind || "SINGLE",
                price: String(v.fullPrice),
                features: v.services || [],
                color: v.patternColor || pickColor(),
              });
            }
            const pat = patternMap.get(key);
            const status = v.isOccupied
              ? "BOOKED"
              : v.partiallyOccupied
                ? "PARTIAL"
                : "AVAILABLE";
            newRooms.push({
              id: newRoomId(),
              dbId: v.id,
              label: v.name,
              patternId: pat.id,
              status,
            });
          });
          setPatterns(Array.from(patternMap.values()));
          setRooms(newRooms);
          setTotalRooms(newRooms.length);
          setRoomsGenerated(true);
          setSetupConfirmed(true);
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

  // ── Pattern handlers ──
  function addPattern() {
    setPatterns((prev) => {
      const newPattern = { ...makePattern(), name: `الغرفة ${prev.length + 1}` };
      const next = [...prev, newPattern];
      const newIndex = next.length - 1;
      // Auto-link the room at the matching index to the new pattern
      // (1-to-1 by order: room[0] → pattern[0], room[1] → pattern[1], ...)
      setRooms((rs) =>
        rs.map((r, i) =>
          i === newIndex ? { ...r, patternId: newPattern.id } : r,
        ),
      );
      return next;
    });
  }
  function updatePattern(id, patch) {
    setPatterns((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }
  function removePattern(id) {
    setPatterns((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      // Re-label sequentially: الغرفة 1, الغرفة 2, ...
      const next = filtered.map((p, i) => ({ ...p, name: `الغرفة ${i + 1}` }));
      const fallbackId = next[0]?.id || null;
      setRooms((rs) =>
        rs.map((r) =>
          r.patternId === id ? { ...r, patternId: fallbackId } : r,
        ),
      );
      return next;
    });
  }
  function togglePatternFeature(id, f) {
    setPatterns((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              features: p.features.includes(f)
                ? p.features.filter((x) => x !== f)
                : [...p.features, f],
            }
          : p,
      ),
    );
  }

  // ── Rooms handlers ──
  function generateRooms() {
    const total = Number(totalRooms) || 0;
    if (total < 1) return;
    const defaultPatternId = patterns[0]?.id || null;
    const newRooms = Array.from({ length: total }, (_, i) => ({
      id: newRoomId(),
      label: `الغرفة ${i + 1}`,
      patternId: defaultPatternId,
      status: "AVAILABLE",
    }));
    setRooms(newRooms);
    setRoomsGenerated(true);
  }

  function updateRoom(id, patch) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const merged = { ...r, ...patch };
        if (patch.patternId !== undefined) {
          const newPat = patterns.find((p) => p.id === patch.patternId);
          if (newPat?.kind === "SINGLE" && merged.status === "PARTIAL") {
            merged.status = "BOOKED";
          }
        }
        return merged;
      }),
    );
  }

  // ── Stats ──
  const patternStats = useMemo(() => {
    return patterns.map((p) => {
      const matching = rooms.filter((r) => r.patternId === p.id);
      const cap = ROOM_KINDS.find((k) => k.id === p.kind)?.capacity || 1;
      const freeBeds = matching.reduce((sum, r) => {
        if (r.status === "AVAILABLE") return sum + cap;
        if (r.status === "PARTIAL") return sum + 1;
        return sum;
      }, 0);
      const totalBeds = matching.length * cap;
      const fullyAvailableRooms = matching.filter(
        (r) => r.status === "AVAILABLE",
      ).length;
      return {
        pattern: p,
        total: matching.length,
        available: fullyAvailableRooms,
        freeBeds,
        totalBeds,
      };
    });
  }, [patterns, rooms]);

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
          <div className="wiz-form-row">
            <div className="wiz-form-group">
              <label>الحي</label>
              <input
                className="wiz-input"
                value={propertyData.neighborhood}
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
                className={`wiz-choice-btn ${propertyData.targetGender === "MALE" ? "active" : ""}`}
                onClick={() =>
                  setPropertyData({ ...propertyData, targetGender: "MALE" })
                }
              >
                ذكور
              </button>
              <button
                type="button"
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

  // ── Step 3: Rooms & Patterns (the big one) ──
  function renderStep3() {
    return (
      <div>
        <h2 className="wiz-h2">توزيع الغرف</h2>
        <p className="wiz-sub">حدّد عدد الغرف (نوع + سعر + مميزات).</p>

        {/* ── Section A: Total rooms ── */}
        <div className="wiz-card">
          <div className="wiz-card-title">
            <span className="wiz-section-num">1</span>
            عدد الغرف في الشقة
          </div>
          <div className="wiz-card-hint">
            كم عدد الغرف القابلة للتأجير في الشقة؟ (الحد الأقصى {MAX_ROOMS} غرف)
          </div>
          <div className="wiz-form-row">
            <div className="wiz-form-group" style={{ maxWidth: 200 }}>
              <input
                className="wiz-input"
                type="number"
                min="1"
                max={MAX_ROOMS}
                value={totalRooms}
                onChange={(e) => {
                  const cleaned = toEnglishDigits(e.target.value);
                  const v =
                    cleaned === ""
                      ? ""
                      : Math.min(Math.max(Number(cleaned), 1), MAX_ROOMS);
                  setTotalRooms(v);
                }}
                onKeyDown={blockNonEnglishDigits}
                onPaste={sanitizeNumberPaste}
                inputMode="numeric"
                disabled={roomsGenerated}
              />
            </div>
            {!roomsGenerated && (
              <button
                type="button"
                className="wiz-btn-primary"
                onClick={generateRooms}
              >
                توليد الغرف
              </button>
            )}
            {roomsGenerated && (
              <div className="wiz-tip">
                ✓ تم توليد {rooms.length} غرفة.{" "}
                <button
                  type="button"
                  className="wiz-link"
                  onClick={() => {
                    setConfirmState({
                      open: true,
                      title: 'تأكيد',
                      message: 'هذا سيمسح كل الغرف الحالية. متابعة؟',
                      action: () => {
                        setRooms([]);
                        setRoomsGenerated(false);
                        setSetupConfirmed(false);
                        setPatterns([
                          { ...makePattern(), name: "الغرفة 1", kind: "SINGLE" },
                        ]);
                        setTotalRooms(4);
                        setConfirmState((s) => ({ ...s, open: false }));
                      },
                    });
                  }}
                >
                  إعادة التوليد
                </button>
              </div>
            )}
          </div>
        </div>

        {roomsGenerated && (
          <>
            {/* ── Section B: Patterns ── */}
            <div className="wiz-card">
              <div className="wiz-card-title">
                <span className="wiz-section-num">2</span>
                تعريف الغرف
              </div>

              {patterns.map((p) => (
                <div
                  key={p.id}
                  className="wiz-pattern-block"
                  style={{ borderRightColor: p.color }}
                >
                  <div className="wiz-pattern-head">
                    <strong className="wiz-pattern-name-readonly">
                      {p.name}
                    </strong>
                    <span
                      className="wiz-pattern-color-dot"
                      style={{ background: p.color }}
                      title="اللون المميز"
                    />
                    <div style={{ flex: 1 }} />
                    {patterns.length > 1 && (
                      <button
                        type="button"
                        className="wiz-btn-ghost danger"
                        onClick={() => removePattern(p.id)}
                      >
                        حذف
                      </button>
                    )}
                  </div>

                  <div className="wiz-form-row">
                    <div className="wiz-form-group">
                      <label>نوع الغرفة</label>
                      <div className="wiz-mini-segmented">
                        {ROOM_KINDS.map((rk) => (
                          <button
                            key={rk.id}
                            type="button"
                            className={`wiz-seg-btn ${p.kind === rk.id ? "active" : ""}`}
                            onClick={() => updatePattern(p.id, { kind: rk.id })}
                          >
                            <span>{rk.icon}</span> {rk.title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="wiz-form-group">
                      <label>السعر الشهري للغرفة (₪)</label>
                      <input
                        className="wiz-input"
                        type="number"
                        min="1"
                        value={p.price}
                        onChange={(e) =>
                          updatePattern(p.id, {
                            price: toEnglishDigits(e.target.value),
                          })
                        }
                        onKeyDown={blockNonEnglishDigits}
                        onPaste={sanitizeNumberPaste}
                        inputMode="numeric"
                        placeholder="500"
                      />
                      {p.kind !== "SINGLE" && p.price && (
                        <div className="wiz-tip-small">
                          للشخص الواحد:{" "}
                          <strong>
                            {Math.round(
                              Number(p.price) /
                                (ROOM_KINDS.find((k) => k.id === p.kind)
                                  ?.capacity || 1),
                            )}{" "}
                            ₪
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="wiz-form-group">
                    <label>مميزات الغرفة</label>
                    <div className="wiz-chips-grid">
                      {ROOM_LEVEL_FEATURES.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`wiz-chip ${p.features.includes(f) ? "active" : ""}`}
                          onClick={() => togglePatternFeature(p.id, f)}
                        >
                          {p.features.includes(f) ? "✓ " : ""}
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {patterns.length < rooms.length ? (
                <button
                  type="button"
                  className="wiz-add-variant-btn"
                  onClick={addPattern}
                >
                  + إضافة نوع غرفة آخر
                </button>
              ) : (
                <div className="wiz-tip" style={{ textAlign: "center" }}>
                  وصلت للحد الأقصى من الأنواع ({rooms.length}).
                </div>
              )}

              {/* Confirm button — reveals section C below */}
              {!setupConfirmed && (
                <div className="wiz-confirm-row">
                  <div
                    className="wiz-tip-small"
                    style={{ marginBottom: 8, color: "#6b7280" }}
                  >
                    يمكنك تعريف نوع واحد لجميع الغرف، أو أنواع مختلفة لكل غرفة.
                  </div>
                  <button
                    type="button"
                    className="wiz-btn-primary"
                    disabled={
                      patterns.length === 0 ||
                      !patterns.every(
                        (p) => p.name?.trim() && Number(p.price) > 0,
                      )
                    }
                    onClick={() => setSetupConfirmed(true)}
                  >
                    ✓ تم — تابع لمطابقة الغرف
                  </button>
                </div>
              )}
            </div>

            {/* ── Section C: Rooms matching (visible only after confirm) ── */}
            {setupConfirmed && (
              <div className="wiz-card">
                <div className="wiz-card-title">
                  <span className="wiz-section-num">3</span>
                  مطابقة الغرف
                  <button
                    type="button"
                    className="wiz-btn-ghost"
                    style={{ marginRight: "auto", fontSize: 12 }}
                    onClick={() => setSetupConfirmed(false)}
                  >
                    ← تعديل الغرف
                  </button>
                </div>

                <div className="wiz-rooms-list">
                  {rooms.map((r) => {
                    const pat = patterns.find((p) => p.id === r.patternId);
                    return (
                      <div
                        key={r.id}
                        className="wiz-room-row"
                        style={{
                          borderRightColor: pat?.color || "#e5e7eb",
                          borderRightWidth: 4,
                        }}
                      >
                        <div className="wiz-room-num">
                          <input
                            className="wiz-room-label-input"
                            value={r.label}
                            onChange={(e) =>
                              updateRoom(r.id, { label: e.target.value })
                            }
                          />
                          {pat?.price && (
                            <div className="wiz-room-price-hint">
                              {pat.price} ₪/شهر
                            </div>
                          )}
                        </div>

                        <div className="wiz-room-status">
                          {ROOM_STATUSES.filter(
                            (s) => !s.doubleOnly || pat?.kind === "DOUBLE",
                          ).map((s) => (
                            <button
                              key={s.id}
                              type="button"
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
                    );
                  })}
                </div>

                <div className="wiz-legend">
                  <div className="wiz-legend-title">الملخص:</div>
                  {patternStats.map(
                    ({ pattern: p, total, freeBeds, totalBeds }) => (
                      <div key={p.id} className="wiz-legend-row">
                        <span
                          className="wiz-legend-dot"
                          style={{ background: p.color }}
                        />
                        <span className="wiz-legend-name">
                          {p.name || "بلا اسم"}
                        </span>
                        <span className="wiz-legend-meta">
                          {total} غرفة •{" "}
                          {p.kind === "DOUBLE"
                            ? `${freeBeds} سرير متاح من ${totalBeds}`
                            : `${freeBeds} متاحة`}{" "}
                          • {p.price ? `${p.price} ₪` : "بدون سعر"}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </>
        )}
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
          <>
            <div className="wiz-card">
              <div className="wiz-card-title">
                أنواع الغرف ({patterns.length})
              </div>
              {patternStats.map(
                ({ pattern: p, total, freeBeds, totalBeds }) => (
                  <div
                    key={p.id}
                    className="wiz-review-pattern"
                    style={{ borderRightColor: p.color }}
                  >
                    <div className="wiz-review-pattern-head">
                      <strong>{p.name}</strong>
                      <span className="wiz-review-badge">
                        {ROOM_KINDS.find((k) => k.id === p.kind)?.title}
                      </span>
                      <span className="wiz-review-badge">{total} غرف</span>
                      <span className="wiz-review-badge available">
                        {p.kind === "DOUBLE"
                          ? `${freeBeds} سرير متاح من ${totalBeds}`
                          : `${freeBeds} متاحة`}
                      </span>
                      <span className="wiz-review-price">
                        {p.price || "—"} ₪
                      </span>
                    </div>
                    {p.features.length > 0 && (
                      <div className="wiz-review-features">
                        {p.features.join("، ")}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>

            <div className="wiz-card">
              <div className="wiz-card-title">قائمة الغرف ({rooms.length})</div>
              <div className="wiz-review-rooms-grid">
                {rooms.map((r) => {
                  const pat = patterns.find((p) => p.id === r.patternId);
                  const status = ROOM_STATUSES.find((s) => s.id === r.status);
                  return (
                    <div
                      key={r.id}
                      className="wiz-review-room"
                      style={{ borderColor: pat?.color || "#d1d5db" }}
                    >
                      <div className="wiz-review-room-label">{r.label}</div>
                      <div
                        className="wiz-review-room-pattern"
                        style={{ color: pat?.color || "#999" }}
                      >
                        {pat?.name || "—"}
                      </div>
                      <div
                        className="wiz-review-room-status"
                        style={{ background: status?.bg, color: status?.color }}
                      >
                        {status?.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
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
  function buildVariantPayloadFromRoom(r) {
    const pat = patterns.find((p) => p.id === r.patternId);
    const isDouble = pat?.kind === "DOUBLE";
    const fullPrice = Number(pat?.price || 0);
    const halfPrice = isDouble ? Math.round(fullPrice / 2) : null;
    return {
      name: r.label,
      kind: pat?.kind || "SINGLE",
      capacity: isDouble ? 2 : 1,
      fullPrice,
      halfPrice,
      services: pat?.features || [],
      patternName: pat?.name || null,
      patternColor: pat?.color || null,
      isOccupied: r.status === "BOOKED",
      partiallyOccupied: r.status === "PARTIAL",
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
          for (const r of rooms) {
            const payload = buildVariantPayloadFromRoom(r);
            if (r.dbId) {
              await api.properties.updateVariant(propertyId, r.dbId, payload);
              stillExistingDbIds.add(r.dbId);
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
        } else {
          await api.properties.bulkCreateVariants(
            propertyId,
            rooms.map(buildVariantPayloadFromRoom),
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
        roomsGenerated &&
        setupConfirmed &&
        patterns.length > 0 &&
        rooms.every((r) => r.patternId !== null) &&
        patterns.every((p) => p.name?.trim() && Number(p.price) > 0)
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
