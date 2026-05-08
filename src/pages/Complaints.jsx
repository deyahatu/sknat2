import { useState, useEffect } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import { api } from '../utils/api';
import Skeleton, { SkeletonCard } from '../components/shared/Skeleton';

const TYPE_LABELS = {
  ACCOMMODATION: 'مشكلة بالسكن',
  USER_ISSUE: 'مشكلة مع مستخدم',
  TECHNICAL: 'مشكلة تقنية',
  OTHER: 'أخرى',
};

const STATUS_CONFIG = {
  OPEN:       { label: 'مفتوحة',        color: '#2563eb', bg: '#dbeafe' },
  IN_REVIEW:  { label: 'قيد المراجعة',  color: '#d97706', bg: '#fef3c7' },
  RESOLVED:   { label: 'محلولة',        color: '#059669', bg: '#d1fae5' },
  REJECTED:   { label: 'مرفوضة',        color: '#dc2626', bg: '#fee2e2' },
};

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ type: 'ACCOMMODATION', subject: '', description: '' });

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await api.complaints.mine();
      setComplaints(data.complaints || []);
    } catch {
      setError('فشل في تحميل الشكاوى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      setError('يرجى تعبئة جميع الحقول.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await api.complaints.create(form);
      setShowForm(false);
      setForm({ type: 'ACCOMMODATION', subject: '', description: '' });
      fetchComplaints();
    } catch (err) {
      setError(err.message || 'فشل تقديم الشكوى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem', direction: 'rtl', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><FiAlertCircle /> شكاواي</h1>
        <button
          onClick={() => { setShowForm(true); setError(''); }}
          style={{
            background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
            padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
          }}
        >
          + تقديم شكوى
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 500,
            direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.2rem', color: '#1e293b' }}>تقديم شكوى جديدة</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>نوع الشكوى</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.95rem' }}
                >
                  {Object.entries(TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>الموضوع</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="اكتب موضوع الشكوى..."
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>التفاصيل</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="اشرح مشكلتك بالتفصيل..."
                  rows={5}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); }}
                  style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '0.6rem 1.4rem', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: 20 }}>{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}</div>
      ) : complaints.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f9fafb', borderRadius: 12 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FiAlertCircle size={36} color="#d1d5db" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>لا توجد شكاوى</h3>
          <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 0 }}>لم تقدم أي شكوى حتى الآن</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {complaints.map((c) => {
            const sc = STATUS_CONFIG[c.status] || { label: c.status, color: '#6b7280', bg: '#f3f4f6' };
            return (
              <div key={c.id} style={{
                background: '#fff', borderRadius: 12, padding: '1.25rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      background: '#ede9fe', color: '#6d28d9', borderRadius: 6,
                      padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600,
                    }}>
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                    <span style={{
                      background: sc.bg, color: sc.color, borderRadius: 6,
                      padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600,
                    }}>
                      {sc.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#1e293b' }}>{c.subject}</h3>
                <p style={{ margin: '0 0 10px', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.6 }}>{c.description}</p>
                {c.adminResponse && (
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
                    padding: '0.75rem 1rem', marginTop: 8,
                  }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', fontWeight: 600, marginBottom: 4 }}>رد الإدارة:</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#15803d' }}>{c.adminResponse}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
