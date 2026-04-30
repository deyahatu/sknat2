import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../utils/api";
import { AVAILABLE_SERVICES, ROOM_TYPES, ROOM_TYPE_ICONS } from "../../constants/property";

const NUMBER_KEY_ALLOWLIST = [
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

function blockNonDigits(e, { allowDecimal = false } = {}) {
  if (NUMBER_KEY_ALLOWLIST.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (allowDecimal && e.key === "." && !e.currentTarget.value.includes(".")) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}

function sanitizePaste(e, { allowDecimal = false } = {}) {
  const pasted = (e.clipboardData || window.clipboardData).getData("text");
  const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d+$/;
  if (!pattern.test(pasted)) e.preventDefault();
}

const EMPTY_FORM = {
  title: "",
  city: "",
  address: "",
  description: "",
  policy: "",
  bathrooms: "",
  area: "",
  targetGender: "MALE",
  otherServices: "",
  images: [],
  available: true,
};

const EMPTY_VARIANT = {
  name: "",
  roomNumber: "",
  capacity: "",
  fullPrice: "",
  halfPrice: "",
  images: [],
  services: [],
};

export default function AddEditProperty() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Variant editing state
  const [editingVariant, setEditingVariant] = useState(null); // null or index or 'new'
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT);
  const [variantCustomServices, setVariantCustomServices] = useState([]);
  const [variantCustomInput, setVariantCustomInput] = useState("");
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariant, setDeletingVariant] = useState(null);
  const variantFileInputRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    api.properties
      .get(id)
      .then((res) => {
        const p = res.property;
        setForm({
          title: p.title || "",
          city: p.city || "",
          address: p.address || "",
          description: p.description || "",
          policy: p.policy || "",
          bathrooms: String(p.bathrooms || ""),
          area: p.area != null ? String(p.area) : "",
          targetGender: p.targetGender || "MALE",
          otherServices: p.otherServices || "",
          images: p.images || [],
          available: p.available ?? true,
        });
        setVariants(p.roomVariants || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleImageFiles(e) {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, ev.target.result],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeImage(idx) {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        area: form.area ? Number(form.area) : null,
      };
      if (isEdit) {
        await api.properties.update(id, payload);
      } else {
        const res = await api.properties.create(payload);
        const newId = res.property.id;
        // Create all local variants for the new property
        for (const v of variants) {
          if (!v.id) {
            await api.properties.createVariant(newId, {
              name: v.name,
              capacity: Number(v.capacity),
              fullPrice: Number(v.fullPrice),
              halfPrice: v.halfPrice ? Number(v.halfPrice) : null,
              images: v.images || [],
              services: v.services || [],
            });
          }
        }
      }
      navigate("/owner/properties");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Variant handlers ──

  function openVariantEditor(index) {
    if (index === "new") {
      setVariantForm(EMPTY_VARIANT);
      setVariantCustomServices([]);
    } else {
      const v = variants[index];
      const customsFromServices = (v.services || []).filter(
        (s) => !AVAILABLE_SERVICES.includes(s),
      );
      setVariantCustomServices(customsFromServices);
      setVariantForm({
        name: v.name || "",
        roomNumber: v.roomNumber || "",
        capacity: String(v.capacity || ""),
        fullPrice: String(v.fullPrice || ""),
        halfPrice: v.halfPrice != null ? String(v.halfPrice) : "",
        images: v.images || [],
        services: v.services || [],
      });
    }
    setEditingVariant(index);
  }

  function handleVariantChange(e) {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox" && name === "services") {
      setVariantForm((prev) => ({
        ...prev,
        services: checked
          ? [...prev.services, value]
          : prev.services.filter((s) => s !== value),
      }));
    } else if (name === "name") {
      // Auto-set capacity based on room type
      const autoCapacity =
        value === "غرفة مفردة" ? "1" :
        value === "استوديو" ? "1" :
        value === "شقة كاملة" ? "" :
        ""; // غرفة مشتركة - user enters
      setVariantForm((prev) => ({ ...prev, name: value, capacity: autoCapacity }));
    } else {
      setVariantForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  function handleVariantImageFiles(e) {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setVariantForm((prev) => ({
          ...prev,
          images: [...prev.images, ev.target.result],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeVariantImage(idx) {
    setVariantForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  }

  function handleVariantCustomServiceKey(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = variantCustomInput.trim();
    if (!val) return;
    if (!AVAILABLE_SERVICES.includes(val) && !variantCustomServices.includes(val)) {
      setVariantCustomServices((prev) => [...prev, val]);
    }
    if (!variantForm.services.includes(val)) {
      setVariantForm((prev) => ({ ...prev, services: [...prev.services, val] }));
    }
    setVariantCustomInput("");
  }

  function removeVariantCustomService(name) {
    setVariantCustomServices((prev) => prev.filter((s) => s !== name));
    setVariantForm((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s !== name),
    }));
  }

  async function handleSaveVariant() {
    setSavingVariant(true);
    setError(null);
    try {
      if (!variantForm.name) throw new Error("يرجى اختيار نوع الغرفة.");
      const capacity = variantForm.name === "غرفة مفردة" || variantForm.name === "استوديو"
        ? 1
        : Number(variantForm.capacity);
      if (!capacity || capacity < 1) throw new Error("يرجى تحديد القدرة الاستيعابية.");
      if (variantForm.name === "غرفة مشتركة" && capacity > 5) throw new Error("الحد الأقصى للغرفة المشتركة 5 أشخاص.");

      const payload = {
        name: variantForm.name,
        roomNumber: variantForm.roomNumber || null,
        capacity,
        fullPrice: Number(variantForm.fullPrice),
        halfPrice: variantForm.halfPrice ? Number(variantForm.halfPrice) : null,
        images: variantForm.images,
        services: variantForm.services,
      };

      if (editingVariant === "new") {
        if (isEdit) {
          const res = await api.properties.createVariant(id, payload);
          setVariants((prev) => [...prev, res.variant]);
        } else {
          // Add mode: save locally
          setVariants((prev) => [...prev, { ...payload, _local: true }]);
        }
      } else {
        const v = variants[editingVariant];
        if (isEdit && v.id) {
          const res = await api.properties.updateVariant(id, v.id, payload);
          setVariants((prev) =>
            prev.map((item, i) => (i === editingVariant ? res.variant : item)),
          );
        } else {
          // Add mode: update locally
          setVariants((prev) =>
            prev.map((item, i) => (i === editingVariant ? { ...payload, _local: true } : item)),
          );
        }
      }
      setEditingVariant(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVariant(false);
    }
  }

  async function handleDuplicateVariant(index) {
    const v = variants[index];
    const dupPayload = {
      name: v.name,
      roomNumber: "",
      capacity: v.capacity,
      fullPrice: v.fullPrice,
      halfPrice: v.halfPrice,
      images: v.images || [],
      services: v.services || [],
    };
    if (isEdit) {
      try {
        const res = await api.properties.createVariant(id, dupPayload);
        setVariants((prev) => [...prev, res.variant]);
      } catch (err) {
        setError(err.message);
      }
    } else {
      setVariants((prev) => [...prev, { ...dupPayload, _local: true }]);
    }
  }

  async function handleDeleteVariant(index) {
    const v = variants[index];
    if (!window.confirm(`هل أنت متأكد من حذف "${v.name}"؟`)) return;
    setDeletingVariant(index);
    try {
      if (v.id) {
        await api.properties.deleteVariant(id, v.id);
      }
      setVariants((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingVariant(null);
    }
  }

  if (loading) return <div className="owner-loading">جاري التحميل...</div>;

  return (
    <>
      <div className="owner-properties-hero">
        <h1 className="owner-page-title owner-properties-title">
          {isEdit ? "تعديل العقار" : "إضافة عقار جديد"}
        </h1>
        <button
          className="owner-btn owner-btn-ghost owner-hero-back-btn"
          onClick={() => navigate("/owner/properties")}
        >
          رجوع
        </button>
      </div>

      {error && <div className="owner-form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="owner-card owner-form-panel" style={{ marginBottom: 20 }}>
          <div className="owner-card-header owner-form-panel-header">
            <h2 className="owner-card-title owner-form-panel-title">المعلومات الأساسية</h2>
          </div>
          <div className="owner-form-panel-body">
            <div className="owner-form-group">
              <label className="owner-form-label">اسم العقار </label>
              <input
                className="owner-form-input"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="owner-form-row">
              <div className="owner-form-group">
                <label className="owner-form-label">الحي/المنطقة </label>
                <input
                  className="owner-form-input"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="owner-form-group">
                <label className="owner-form-label">العنوان </label>
                <input
                  className="owner-form-input"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">الوصف </label>
              <textarea
                className="owner-form-textarea"
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                rows={3}
              />
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">سياسة السكن </label>
              <textarea
                className="owner-form-textarea"
                name="policy"
                value={form.policy}
                onChange={handleChange}
                required
                rows={2}
              />
            </div>
            <div className="owner-form-row">
              <div className="owner-form-group">
                <label className="owner-form-label">الجنس </label>
                <select
                  className="owner-form-select"
                  name="targetGender"
                  value={form.targetGender}
                  onChange={handleChange}
                >
                  <option value="MALE">ذكور</option>
                  <option value="FEMALE">إناث</option>
                </select>
              </div>
              <div className="owner-form-group">
                <label className="owner-form-label">عدد الحمامات</label>
                <input
                  className="owner-form-input"
                  name="bathrooms"
                  type="number"
                  min="1"
                  max="10"
                  value={form.bathrooms}
                  onChange={handleChange}
                  onKeyDown={blockNonDigits}
                  onPaste={sanitizePaste}
                  inputMode="numeric"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="owner-form-row">
              <div className="owner-form-group">
                <label className="owner-form-label">المساحة (م²)</label>
                <input
                  className="owner-form-input"
                  name="area"
                  type="number"
                  min="1"
                  value={form.area}
                  onChange={handleChange}
                  onKeyDown={blockNonDigits}
                  onPaste={sanitizePaste}
                  inputMode="numeric"
                  dir="rtl"
                />
              </div>
              <div className="owner-form-group">
                <label className="owner-form-label">الحالة</label>
                <select
                  className="owner-form-select"
                  name="available"
                  value={String(form.available)}
                  onChange={(e) =>
                    setForm({ ...form, available: e.target.value === "true" })
                  }
                >
                  <option value="true">متاح</option>
                  <option value="false">غير متاح</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="owner-card owner-form-panel" style={{ marginBottom: 24 }}>
          <div className="owner-card-header owner-form-panel-header">
            <h2 className="owner-card-title owner-form-panel-title">صور العقار </h2>
          </div>
          <div className="owner-form-panel-body">
            <button
              type="button"
              className="owner-btn owner-btn-outline"
              onClick={() => fileInputRef.current?.click()}
            >
              + رفع صور
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={handleImageFiles}
            />
            {form.images.length > 0 && (
              <div className="owner-images-grid" style={{ marginTop: 16 }}>
                {form.images.map((img, i) => (
                  <div key={i} className="owner-image-preview">
                    <img src={img} alt="" />
                    <button
                      type="button"
                      className="owner-image-remove"
                      onClick={() => removeImage(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="owner-form-actions-row">
          <button
            type="submit"
            className="owner-btn owner-form-submit-btn"
            disabled={saving}
          >
            {saving
              ? "جاري الحفظ..."
              : isEdit
                ? "حفظ التغييرات"
                : "إضافة العقار"}
          </button>
          <button
            type="button"
            className="owner-btn owner-form-cancel-btn"
            onClick={() => navigate("/owner/properties")}
          >
            إلغاء
          </button>
        </div>
      </form>

      {/* ── Room Variants Section ── */}
      <div className="owner-card owner-form-panel" style={{ marginTop: 30 }}>
          <div className="owner-card-header owner-form-panel-header">
            <h2 className="owner-card-title owner-form-panel-title">أنواع الغرف</h2>
            <button
              type="button"
              className="owner-btn owner-btn-primary"
              style={{ fontSize: 14, padding: "6px 16px" }}
              onClick={() => openVariantEditor("new")}
            >
              + إضافة نوع غرفة
            </button>
          </div>
          <div className="owner-form-panel-body">
            {variants.length === 0 && editingVariant === null && (
              <div className="owner-empty">لا توجد أنواع غرف. أضف النوع الأول!</div>
            )}

            {variants.map((v, index) => (
              <div
                key={v.id}
                className="owner-card"
                style={{
                  marginBottom: 12,
                  padding: 16,
                  border: "1px solid #e0e0e0",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{ROOM_TYPE_ICONS[v.name] || '🏠'} {v.name}{v.roomNumber ? ` (${v.roomNumber})` : ''}</strong>
                    <span style={{ margin: "0 12px", color: "#666" }}>|</span>
                    <span>السعة: {v.capacity}</span>
                    <span style={{ margin: "0 12px", color: "#666" }}>|</span>
                    <span>{v.isOccupied ? "محجوزة" : "متاحة"}</span>
                    <span style={{ margin: "0 12px", color: "#666" }}>|</span>
                    <span>السعر: {v.fullPrice} ر.س</span>
                    {v.halfPrice && (
                      <>
                        <span style={{ margin: "0 12px", color: "#666" }}>|</span>
                        <span>للطالب: {v.halfPrice} ر.س</span>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="owner-btn owner-btn-outline"
                      style={{ fontSize: 13, padding: "4px 12px" }}
                      onClick={() => openVariantEditor(index)}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="owner-btn owner-btn-outline"
                      style={{ fontSize: 13, padding: "4px 12px" }}
                      onClick={() => handleDuplicateVariant(index)}
                    >
                      نسخ
                    </button>
                    <button
                      type="button"
                      className="owner-btn owner-form-cancel-btn"
                      style={{ fontSize: 13, padding: "4px 12px" }}
                      disabled={deletingVariant === index}
                      onClick={() => handleDeleteVariant(index)}
                    >
                      {deletingVariant === index ? "جاري الحذف..." : "حذف"}
                    </button>
                  </div>
                </div>
                {v.services?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
                    الخدمات: {v.services.join("، ")}
                  </div>
                )}
                {v.images?.length > 0 && (
                  <div className="owner-images-grid" style={{ marginTop: 8 }}>
                    {v.images.map((img, i) => (
                      <div key={i} className="owner-image-preview" style={{ width: 60, height: 60 }}>
                        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* ── Variant Editor ── */}
            {editingVariant !== null && (
              <div
                className="owner-card"
                style={{
                  marginTop: 16,
                  padding: 20,
                  border: "2px solid #4f46e5",
                  borderRadius: 10,
                  background: "#fafaff",
                }}
              >
                <h3 style={{ marginBottom: 16 }}>
                  {editingVariant === "new" ? "إضافة نوع غرفة" : "تعديل نوع الغرفة"}
                </h3>

                <div className="owner-form-group">
                  <label className="owner-form-label">نوع الغرفة</label>
                  <select
                    className="owner-form-select"
                    name="name"
                    value={variantForm.name}
                    onChange={handleVariantChange}
                    required
                  >
                    <option value="">اختر نوع الغرفة</option>
                    {ROOM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="owner-form-group">
                  <label className="owner-form-label">رقم الغرفة (اختياري)</label>
                  <input
                    className="owner-form-input"
                    name="roomNumber"
                    value={variantForm.roomNumber}
                    onChange={handleVariantChange}
                    placeholder="مثلاً: 101"
                  />
                </div>

                {variantForm.name === "غرفة مشتركة" && (
                  <div className="owner-form-row">
                    <div className="owner-form-group">
                      <label className="owner-form-label">القدرة الاستيعابية (حد أقصى 5)</label>
                      <input
                        className="owner-form-input"
                        name="capacity"
                        type="number"
                        min="2"
                        max="5"
                        value={variantForm.capacity}
                        onChange={handleVariantChange}
                        onKeyDown={blockNonDigits}
                        onPaste={sanitizePaste}
                        inputMode="numeric"
                        dir="rtl"
                      />
                    </div>
                  </div>
                )}
                {variantForm.name === "شقة كاملة" && (
                  <div className="owner-form-row">
                    <div className="owner-form-group">
                      <label className="owner-form-label">القدرة الاستيعابية</label>
                      <input
                        className="owner-form-input"
                        name="capacity"
                        type="number"
                        min="1"
                        value={variantForm.capacity}
                        onChange={handleVariantChange}
                        onKeyDown={blockNonDigits}
                        onPaste={sanitizePaste}
                        inputMode="numeric"
                        dir="rtl"
                      />
                    </div>
                  </div>
                )}

                <div className="owner-form-row">
                  <div className="owner-form-group">
                    <label className="owner-form-label">سعر الغرفة / شهر</label>
                    <input
                      className="owner-form-input"
                      name="fullPrice"
                      type="number"
                      min="1"
                      step="0.01"
                      value={variantForm.fullPrice}
                      onChange={handleVariantChange}
                      onKeyDown={(e) => blockNonDigits(e, { allowDecimal: true })}
                      onPaste={(e) => sanitizePaste(e, { allowDecimal: true })}
                      inputMode="decimal"
                      dir="rtl"
                    />
                  </div>
                </div>

                {variantForm.name === "غرفة مشتركة" && (
                  <div className="owner-form-group">
                    <label className="owner-form-label">سعر الطالب الواحد / شهر</label>
                    <input
                      className="owner-form-input"
                      name="halfPrice"
                      type="number"
                      min="1"
                      step="0.01"
                      value={variantForm.halfPrice}
                      onChange={handleVariantChange}
                      onKeyDown={(e) => blockNonDigits(e, { allowDecimal: true })}
                      onPaste={(e) => sanitizePaste(e, { allowDecimal: true })}
                      inputMode="decimal"
                      dir="rtl"
                    />
                  </div>
                )}

                {/* Variant Services */}
                <div style={{ marginTop: 14 }}>
                  <label className="owner-form-label">خدمات الغرفة</label>
                  <div className="owner-services-grid">
                    {[...AVAILABLE_SERVICES, ...variantCustomServices].map((s) => {
                      const isCustom = !AVAILABLE_SERVICES.includes(s);
                      return (
                        <label key={s} className="owner-service-check">
                          <input
                            type="checkbox"
                            name="services"
                            value={s}
                            checked={variantForm.services.includes(s)}
                            onChange={handleVariantChange}
                          />
                          <span>{s}</span>
                          {isCustom && (
                            <button
                              type="button"
                              className="owner-service-remove"
                              onClick={() => removeVariantCustomService(s)}
                              aria-label={`حذف ${s}`}
                            >
                              ✕
                            </button>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="owner-form-group" style={{ marginTop: 8 }}>
                    <input
                      className="owner-form-input"
                      value={variantCustomInput}
                      onChange={(e) => setVariantCustomInput(e.target.value)}
                      onKeyDown={handleVariantCustomServiceKey}
                      placeholder="اكتب خدمة واضغط Enter لإضافتها"
                    />
                  </div>
                </div>

                {/* Variant Images */}
                <div style={{ marginTop: 14 }}>
                  <label className="owner-form-label">صور الغرفة</label>
                  <button
                    type="button"
                    className="owner-btn owner-btn-outline"
                    onClick={() => variantFileInputRef.current?.click()}
                  >
                    + رفع صور
                  </button>
                  <input
                    ref={variantFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleVariantImageFiles}
                  />
                  {variantForm.images.length > 0 && (
                    <div className="owner-images-grid" style={{ marginTop: 10 }}>
                      {variantForm.images.map((img, i) => (
                        <div key={i} className="owner-image-preview">
                          <img src={img} alt="" />
                          <button
                            type="button"
                            className="owner-image-remove"
                            onClick={() => removeVariantImage(i)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="owner-btn owner-btn-primary"
                    disabled={savingVariant}
                    onClick={handleSaveVariant}
                  >
                    {savingVariant ? "جاري الحفظ..." : "حفظ"}
                  </button>
                  <button
                    type="button"
                    className="owner-btn owner-btn-ghost"
                    onClick={() => setEditingVariant(null)}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
    </>
  );
}

