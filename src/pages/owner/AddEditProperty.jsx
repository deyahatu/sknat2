import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../utils/api';

const AVAILABLE_SERVICES = [
  'واي فاي', 'مكيف', 'غسالة', 'مطبخ مشترك', 'موقف سيارات',
  'مصعد', 'تدفئة', 'مطبخ خاص', 'حمام خاص', 'حراسة',
];

const EMPTY_FORM = {
  title: '',
  city: '',
  address: '',
  description: '',
  policy: '',
  price: '',
  rooms: '',
  capacityPerRoom: '',
  studentsCount: '',
  bathrooms: '',
  area: '',
  targetGender: 'MALE',
  services: [],
  otherServices: '',
  images: [],
  available: true,
};

export default function AddEditProperty() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    api.properties.get(id)
      .then((res) => {
        const p = res.property;
        setForm({
          title: p.title || '',
          city: p.city || '',
          address: p.address || '',
          description: p.description || '',
          policy: p.policy || '',
          price: String(p.price || ''),
          rooms: String(p.rooms || ''),
          capacityPerRoom: String(p.capacityPerRoom || ''),
          studentsCount: String(p.studentsCount ?? ''),
          bathrooms: String(p.bathrooms || ''),
          area: p.area != null ? String(p.area) : '',
          targetGender: p.targetGender || 'MALE',
          services: p.services || [],
          otherServices: p.otherServices || '',
          images: p.images || [],
          available: p.available ?? true,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'services') {
      setForm((prev) => ({
        ...prev,
        services: checked
          ? [...prev.services, value]
          : prev.services.filter((s) => s !== value),
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  function handleImageFiles(e) {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm((prev) => ({ ...prev, images: [...prev.images, ev.target.result] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removeImage(idx) {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        rooms: Number(form.rooms),
        capacityPerRoom: Number(form.capacityPerRoom),
        studentsCount: Number(form.studentsCount),
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        area: form.area ? Number(form.area) : null,
      };
      if (isEdit) {
        await api.properties.update(id, payload);
      } else {
        await api.properties.create(payload);
      }
      navigate('/owner/properties');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="owner-loading">جاري التحميل...</div>;

  return (
    <>
      <div className="owner-page-header">
        <h1 className="owner-page-title">{isEdit ? 'تعديل العقار' : 'إضافة عقار جديد'}</h1>
        <button className="owner-btn owner-btn-ghost" onClick={() => navigate('/owner/properties')}>
          رجوع
        </button>
      </div>

      {error && <div className="owner-form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="owner-card" style={{ marginBottom: 20 }}>
          <div className="owner-card-header">
            <h2 className="owner-card-title">المعلومات الأساسية</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="owner-form-group">
              <label className="owner-form-label">اسم العقار *</label>
              <input className="owner-form-input" name="title" value={form.title} onChange={handleChange} required />
            </div>
            <div className="owner-form-row">
              <div className="owner-form-group">
                <label className="owner-form-label">المدينة *</label>
                <input className="owner-form-input" name="city" value={form.city} onChange={handleChange} required />
              </div>
              <div className="owner-form-group">
                <label className="owner-form-label">العنوان *</label>
                <input className="owner-form-input" name="address" value={form.address} onChange={handleChange} required />
              </div>
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">الوصف *</label>
              <textarea className="owner-form-textarea" name="description" value={form.description} onChange={handleChange} required rows={3} />
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">سياسة السكن *</label>
              <textarea className="owner-form-textarea" name="policy" value={form.policy} onChange={handleChange} required rows={2} />
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">الجنس المستهدف *</label>
              <select className="owner-form-select" name="targetGender" value={form.targetGender} onChange={handleChange}>
                <option value="MALE">ذكور</option>
                <option value="FEMALE">إناث</option>
              </select>
            </div>
          </div>
        </div>

        <div className="owner-card" style={{ marginBottom: 20 }}>
          <div className="owner-card-header">
            <h2 className="owner-card-title">السعر والأرقام</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="owner-form-row">
              <div className="owner-form-group">
                <label className="owner-form-label">السعر / شهر (ريال) *</label>
                <input className="owner-form-input" name="price" type="number" min="1" step="0.01" value={form.price} onChange={handleChange} required dir="ltr" />
              </div>
              <div className="owner-form-group">
                <label className="owner-form-label">عدد الغرف *</label>
                <input className="owner-form-input" name="rooms" type="number" min="1" value={form.rooms} onChange={handleChange} required dir="ltr" />
              </div>
            </div>
            <div className="owner-form-row">
              <div className="owner-form-group">
                <label className="owner-form-label">الطاقة الاستيعابية للغرفة *</label>
                <input className="owner-form-input" name="capacityPerRoom" type="number" min="1" value={form.capacityPerRoom} onChange={handleChange} required dir="ltr" />
              </div>
              <div className="owner-form-group">
                <label className="owner-form-label">عدد الطلاب الحاليين</label>
                <input className="owner-form-input" name="studentsCount" type="number" min="0" value={form.studentsCount} onChange={handleChange} dir="ltr" />
              </div>
            </div>
            <div className="owner-form-row">
              <div className="owner-form-group">
                <label className="owner-form-label">عدد الحمامات</label>
                <input className="owner-form-input" name="bathrooms" type="number" min="1" value={form.bathrooms} onChange={handleChange} dir="ltr" />
              </div>
              <div className="owner-form-group">
                <label className="owner-form-label">المساحة (م²)</label>
                <input className="owner-form-input" name="area" type="number" min="1" value={form.area} onChange={handleChange} dir="ltr" />
              </div>
            </div>
            <div className="owner-form-group">
              <label className="owner-form-label">الحالة</label>
              <select className="owner-form-select" name="available" value={String(form.available)} onChange={(e) => setForm({ ...form, available: e.target.value === 'true' })}>
                <option value="true">متاح</option>
                <option value="false">غير متاح</option>
              </select>
            </div>
          </div>
        </div>

        <div className="owner-card" style={{ marginBottom: 20 }}>
          <div className="owner-card-header">
            <h2 className="owner-card-title">الخدمات</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="owner-services-grid">
              {AVAILABLE_SERVICES.map((s) => (
                <label key={s} className="owner-service-check">
                  <input
                    type="checkbox"
                    name="services"
                    value={s}
                    checked={form.services.includes(s)}
                    onChange={handleChange}
                  />
                  {s}
                </label>
              ))}
            </div>
            <div className="owner-form-group" style={{ marginTop: 14 }}>
              <label className="owner-form-label">خدمات أخرى</label>
              <input className="owner-form-input" name="otherServices" value={form.otherServices} onChange={handleChange} placeholder="اذكر أي خدمات إضافية" />
            </div>
          </div>
        </div>

        <div className="owner-card" style={{ marginBottom: 24 }}>
          <div className="owner-card-header">
            <h2 className="owner-card-title">الصور *</h2>
          </div>
          <div style={{ padding: '20px' }}>
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
              style={{ display: 'none' }}
              onChange={handleImageFiles}
            />
            {form.images.length > 0 && (
              <div className="owner-images-grid" style={{ marginTop: 16 }}>
                {form.images.map((img, i) => (
                  <div key={i} className="owner-image-preview">
                    <img src={img} alt="" />
                    <button type="button" className="owner-image-remove" onClick={() => removeImage(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="owner-btn owner-btn-primary" disabled={saving}>
            {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إضافة العقار'}
          </button>
          <button type="button" className="owner-btn owner-btn-ghost" onClick={() => navigate('/owner/properties')}>
            إلغاء
          </button>
        </div>
      </form>
    </>
  );
}
