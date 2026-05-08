import { useState, useEffect } from 'react';
import { FiAlertCircle, FiPlus, FiHome, FiUsers, FiTool, FiMoreHorizontal, FiClock, FiCheckCircle, FiXCircle, FiEye, FiMessageCircle } from 'react-icons/fi';
import { api } from '../utils/api';
import { useToast } from '../components/shared/Toast';
import Skeleton from '../components/shared/Skeleton';
import './Complaints.css';

const TYPE_CONFIG = {
  ACCOMMODATION: { label: 'مشكلة بالسكن', icon: <FiHome />, color: '#4f46e5' },
  USER_ISSUE:    { label: 'مشكلة مع مستخدم', icon: <FiUsers />, color: '#d97706' },
  TECHNICAL:     { label: 'مشكلة تقنية', icon: <FiTool />, color: '#0891b2' },
  OTHER:         { label: 'أخرى', icon: <FiMoreHorizontal />, color: '#6b7280' },
};

const STATUS_CONFIG = {
  OPEN:       { label: 'مفتوحة', icon: <FiClock />, color: '#4f46e5', bg: '#eef2ff' },
  IN_REVIEW:  { label: 'قيد المراجعة', icon: <FiEye />, color: '#d97706', bg: '#fffbeb' },
  RESOLVED:   { label: 'محلولة', icon: <FiCheckCircle />, color: '#059669', bg: '#ecfdf5' },
  REJECTED:   { label: 'مرفوضة', icon: <FiXCircle />, color: '#dc2626', bg: '#fef2f2' },
};

export default function Complaints() {
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: 'ACCOMMODATION', subject: '', description: '' });
  const [expanded, setExpanded] = useState(null);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await api.complaints.mine();
      setComplaints(data.complaints || []);
    } catch {
      toast.error('فشل في تحميل الشكاوى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error('يرجى تعبئة جميع الحقول.');
      return;
    }
    try {
      setSubmitting(true);
      await api.complaints.create(form);
      toast.success('تم تقديم الشكوى بنجاح.');
      setShowForm(false);
      setForm({ type: 'ACCOMMODATION', subject: '', description: '' });
      fetchComplaints();
    } catch (err) {
      toast.error(err.message || 'فشل تقديم الشكوى.');
    } finally {
      setSubmitting(false);
    }
  };

  function timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return 'الآن';
    if (diff < 60) return `منذ ${diff} د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
    return `منذ ${Math.floor(diff / 1440)} يوم`;
  }

  return (
    <div className="page cmp-page">
      {/* Header */}
      <div className="cmp-hero">
        <div className="cmp-hero-content">
          <h1 className="cmp-hero-title"><FiAlertCircle /> الشكاوى</h1>
          <p className="cmp-hero-sub">تقديم ومتابعة الشكاوى</p>
        </div>
        <button className="cmp-hero-btn" onClick={() => setShowForm(true)}>
          <FiPlus /> تقديم شكوى
        </button>
      </div>

      {/* Stats */}
      {complaints.length > 0 && (
        <div className="cmp-stats">
          {Object.entries(STATUS_CONFIG).map(([key, s]) => {
            const count = complaints.filter(c => c.status === key).length;
            return (
              <div key={key} className="cmp-stat" style={{ borderBottom: `3px solid ${s.color}` }}>
                <div className="cmp-stat-count" style={{ color: s.color }}>{count}</div>
                <div className="cmp-stat-label">{s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="cmp-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="cmp-modal-title"><FiAlertCircle /> تقديم شكوى جديدة</h2>
            <form onSubmit={handleSubmit}>
              <div className="cmp-form-group">
                <label className="cmp-form-label">نوع الشكوى</label>
                <div className="cmp-type-selector">
                  {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
                    <button
                      key={val}
                      type="button"
                      className={`cmp-type-btn ${form.type === val ? 'active' : ''}`}
                      style={form.type === val ? { borderColor: cfg.color, color: cfg.color, background: `${cfg.color}08` } : {}}
                      onClick={() => setForm({ ...form, type: val })}
                    >
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="cmp-form-group">
                <label className="cmp-form-label">الموضوع</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="اكتب موضوع الشكوى..."
                  className="cmp-input"
                />
              </div>
              <div className="cmp-form-group">
                <label className="cmp-form-label">التفاصيل</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="اشرح مشكلتك بالتفصيل..."
                  rows={4}
                  className="cmp-textarea"
                />
              </div>
              <div className="cmp-form-actions">
                <button type="button" className="cmp-cancel-btn" onClick={() => setShowForm(false)}>إلغاء</button>
                <button type="submit" className={`cmp-submit-btn ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
                  {submitting ? '' : 'إرسال الشكوى'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="cmp-skeleton"><Skeleton height={80} count={4} /></div>
      ) : complaints.length === 0 ? (
        <div className="cmp-empty">
          <div className="cmp-empty-icon"><FiAlertCircle size={36} /></div>
          <h3 className="cmp-empty-title">لا توجد شكاوى</h3>
          <p className="cmp-empty-sub">لم تقدم أي شكوى حتى الآن</p>
          <button className="cmp-empty-cta" onClick={() => setShowForm(true)}>
            <FiPlus /> تقديم شكوى
          </button>
        </div>
      ) : (
        <div className="cmp-list">
          {complaints.map((c) => {
            const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.OPEN;
            const tc = TYPE_CONFIG[c.type] || TYPE_CONFIG.OTHER;
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className={`cmp-card ${isOpen ? 'cmp-card-expanded' : ''}`} style={{ borderRight: `4px solid ${sc.color}` }}>
                <div className="cmp-card-header" onClick={() => setExpanded(isOpen ? null : c.id)}>
                  <div className="cmp-card-type-icon" style={{ background: `${tc.color}12`, color: tc.color }}>
                    {tc.icon}
                  </div>
                  <div className="cmp-card-info">
                    <div className="cmp-card-subject">{c.subject}</div>
                    <div className="cmp-card-meta">{tc.label} &middot; {timeAgo(c.createdAt)}</div>
                  </div>
                  <span className="cmp-card-badge" style={{ background: sc.bg, color: sc.color }}>
                    {sc.icon} {sc.label}
                  </span>
                  <span className="cmp-card-chevron">{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div className="cmp-card-body">
                    <div className="cmp-card-desc">
                      <p>{c.description}</p>
                    </div>
                    {c.adminResponse && (
                      <div className="cmp-card-response">
                        <div className="cmp-card-response-header">
                          <FiMessageCircle /> رد الإدارة
                        </div>
                        <p>{c.adminResponse}</p>
                      </div>
                    )}
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
