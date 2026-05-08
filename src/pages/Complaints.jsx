import { useState, useEffect } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import { api } from '../utils/api';
import Skeleton, { SkeletonCard } from '../components/shared/Skeleton';
import './Complaints.css';

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
    <div className="page cmp-page">
      <div className="cmp-header">
        <h1 className="cmp-title"><FiAlertCircle /> شكاواي</h1>
        <button
          className="cmp-add-btn"
          onClick={() => { setShowForm(true); setError(''); }}
        >
          + تقديم شكوى
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="cmp-modal-overlay">
          <div className="cmp-modal">
            <h2 className="cmp-modal-title">تقديم شكوى جديدة</h2>
            <form onSubmit={handleSubmit}>
              <div className="cmp-form-group">
                <label className="cmp-form-label">نوع الشكوى</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {Object.entries(TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div className="cmp-form-group">
                <label className="cmp-form-label">الموضوع</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="اكتب موضوع الشكوى..."
                />
              </div>
              <div className="cmp-form-group">
                <label className="cmp-form-label">التفاصيل</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="اشرح مشكلتك بالتفصيل..."
                  rows={5}
                />
              </div>
              {error && <p className="cmp-form-error">{error}</p>}
              <div className="cmp-form-actions">
                <button
                  type="button"
                  className="cmp-cancel-btn"
                  onClick={() => { setShowForm(false); setError(''); }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="cmp-submit-btn"
                  disabled={submitting}
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
        <div className="cmp-grid">
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : complaints.length === 0 ? (
        <div className="cmp-empty">
          <div className="cmp-empty-icon">
            <FiAlertCircle size={36} color="#d1d5db" />
          </div>
          <h3 className="cmp-empty-title">لا توجد شكاوى</h3>
          <p className="cmp-empty-subtitle">لم تقدم أي شكوى حتى الآن</p>
        </div>
      ) : (
        <div className="cmp-list">
          {complaints.map((c) => {
            const sc = STATUS_CONFIG[c.status] || { label: c.status, color: '#6b7280', bg: '#f3f4f6' };
            return (
              <div key={c.id} className="cmp-card">
                <div className="cmp-card-header">
                  <div className="cmp-card-badges">
                    <span className="cmp-card-type">
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                    <span
                      className="cmp-card-status"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <span className="cmp-card-date">
                    {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                <h3 className="cmp-card-subject">{c.subject}</h3>
                <p className="cmp-card-desc">{c.description}</p>
                {c.adminResponse && (
                  <div className="cmp-card-response">
                    <p className="cmp-card-response-label">رد الإدارة:</p>
                    <p className="cmp-card-response-text">{c.adminResponse}</p>
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
