import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';

export default function OwnerProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
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

  useEffect(() => { load(); }, []);

  async function handleDelete(id, title) {
    if (!window.confirm(`هل أنت متأكد من حذف "${title}"؟`)) return;
    setDeleting(id);
    try {
      await api.properties.delete(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleAvailability(id, current) {
    try {
      await api.properties.toggleAvailability(id, !current);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="owner-page-header">
        <h1 className="owner-page-title">عقاراتي</h1>
        <Link to="/owner/properties/add" className="owner-btn owner-btn-primary">
          + إضافة عقار
        </Link>
      </div>

      {error && <div className="owner-form-error">{error}</div>}

      {loading ? (
        <div className="owner-loading">جاري التحميل...</div>
      ) : properties.length === 0 ? (
        <div className="owner-card">
          <div className="owner-empty">لا توجد عقارات. أضف عقارك الأول!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {properties.map((p) => (
            <div key={p.id} className="owner-card">
              <div style={{ display: 'flex', gap: 16, padding: '16px 20px', alignItems: 'center', flexWrap: 'wrap' }}>
                {p.images?.[0] && (
                  <img
                    src={p.images[0]}
                    alt={p.title}
                    style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--owner-text)' }}>{p.title}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--owner-text-muted)' }}>
                    {p.city} · {Number(p.price).toFixed(0)} ريال/شهر
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--owner-text-muted)' }}>
                    {p.rooms} غرف · {p.studentsCount}/{p.rooms * p.capacityPerRoom} طالب
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <span
                    className={`owner-badge ${p.available ? 'approved' : 'rejected'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleToggleAvailability(p.id, p.available)}
                    title="اضغط للتغيير"
                  >
                    {p.available ? 'متاح' : 'غير متاح'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="owner-btn owner-btn-outline owner-btn-sm"
                      onClick={() => navigate(`/owner/properties/${p.id}/edit`)}
                    >
                      تعديل
                    </button>
                    <button
                      className="owner-btn owner-btn-danger owner-btn-sm"
                      disabled={deleting === p.id}
                      onClick={() => handleDelete(p.id, p.title)}
                    >
                      {deleting === p.id ? '...' : 'حذف'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
