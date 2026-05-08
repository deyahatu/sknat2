import { useState, useEffect, useRef } from 'react';
import { FiAlertCircle, FiPlus, FiHome, FiUsers, FiTool, FiMoreHorizontal, FiClock, FiCheckCircle, FiXCircle, FiEye, FiSend, FiArrowRight, FiHash } from 'react-icons/fi';
import { api } from '../utils/api';
import { useToast } from '../components/shared/Toast';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: 'ACCOMMODATION', subject: '', description: '' });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const replyRef = useRef(null);

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

  // When ticket selected, scroll to reply
  useEffect(() => {
    if (selectedTicket && replyRef.current) {
      replyRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [selectedTicket]);

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

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      await api.complaints.reply(selectedTicket.id, replyText);
      setReplyText('');
      // Refresh ticket
      const data = await api.complaints.get(selectedTicket.id);
      setSelectedTicket(data.complaint);
      fetchComplaints();
    } catch (err) {
      toast.error(err.message || 'فشل إرسال الرد.');
    } finally {
      setSendingReply(false);
    }
  };

  const openTicket = async (c) => {
    try {
      const data = await api.complaints.get(c.id);
      setSelectedTicket(data.complaint);
    } catch {
      setSelectedTicket(c);
    }
  };

  function timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return 'الآن';
    if (diff < 60) return `منذ ${diff} د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)} س`;
    return `منذ ${Math.floor(diff / 1440)} يوم`;
  }

  // ── Ticket Detail View ──
  if (selectedTicket) {
    const sc = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.OPEN;
    const tc = TYPE_CONFIG[selectedTicket.type] || TYPE_CONFIG.OTHER;
    const replies = selectedTicket.replies || [];
    const isClosed = selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'REJECTED';

    return (
      <div className="page cmp-page">
        <button className="tk-back" onClick={() => setSelectedTicket(null)}>
          <FiArrowRight /> العودة للشكاوى
        </button>

        <div className="tk-header">
          <div className="tk-header-top">
            <span className="tk-number"><FiHash />TK-{String(selectedTicket.ticketNumber).padStart(4, '0')}</span>
            <span className="tk-status" style={{ background: sc.bg, color: sc.color }}>{sc.icon} {sc.label}</span>
          </div>
          <h1 className="tk-subject">{selectedTicket.subject}</h1>
          <div className="tk-meta">
            <span className="tk-type-badge" style={{ color: tc.color, background: `${tc.color}10` }}>{tc.icon} {tc.label}</span>
            <span>{timeAgo(selectedTicket.createdAt)}</span>
          </div>
        </div>

        {/* Conversation Thread */}
        <div className="tk-thread">
          {/* Original message */}
          <div className="tk-msg tk-msg-user">
            <div className="tk-msg-avatar">{selectedTicket.userName?.charAt(0)}</div>
            <div className="tk-msg-bubble">
              <div className="tk-msg-sender">{selectedTicket.userName} <span className="tk-msg-time">{timeAgo(selectedTicket.createdAt)}</span></div>
              <p>{selectedTicket.description}</p>
              {selectedTicket.image && <img src={selectedTicket.image} alt="مرفق" className="tk-msg-image" />}
            </div>
          </div>

          {/* Replies */}
          {replies.map((r) => {
            const isAdmin = r.userRole === 'ADMIN';
            return (
              <div key={r.id} className={`tk-msg ${isAdmin ? 'tk-msg-admin' : 'tk-msg-user'}`}>
                <div className={`tk-msg-avatar ${isAdmin ? 'tk-msg-avatar-admin' : ''}`}>
                  {r.userName?.charAt(0)}
                </div>
                <div className="tk-msg-bubble">
                  <div className="tk-msg-sender">
                    {r.userName}
                    {isAdmin && <span className="tk-admin-badge">مدير</span>}
                    <span className="tk-msg-time">{timeAgo(r.createdAt)}</span>
                  </div>
                  <p>{r.message}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply Input */}
        {!isClosed ? (
          <div className="tk-reply" ref={replyRef}>
            <textarea
              className="tk-reply-input"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="اكتب ردك..."
              rows={3}
            />
            <button
              className={`tk-reply-btn ${sendingReply ? 'btn-loading' : ''}`}
              onClick={handleReply}
              disabled={sendingReply || !replyText.trim()}
            >
              {!sendingReply && <><FiSend /> إرسال</>}
            </button>
          </div>
        ) : (
          <div className="tk-closed">هذه الشكوى مغلقة</div>
        )}
      </div>
    );
  }

  // ── Ticket List View ──
  return (
    <div className="page cmp-page">
      <div className="cmp-hero">
        <div>
          <h1 className="cmp-hero-title"><FiAlertCircle /> الشكاوى</h1>
          <p className="cmp-hero-sub">تقديم ومتابعة الشكاوى — نظام التذاكر</p>
        </div>
        <button className="cmp-hero-btn" onClick={() => setShowForm(true)}>
          <FiPlus /> تذكرة جديدة
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
            <h2 className="cmp-modal-title"><FiAlertCircle /> تذكرة جديدة</h2>
            <form onSubmit={handleSubmit}>
              <div className="cmp-form-group">
                <label className="cmp-form-label">نوع المشكلة</label>
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
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="عنوان قصير للمشكلة..." className="cmp-input" />
              </div>
              <div className="cmp-form-group">
                <label className="cmp-form-label">التفاصيل</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="اشرح مشكلتك بالتفصيل..." rows={4} className="cmp-textarea" />
              </div>
              <div className="cmp-form-actions">
                <button type="button" className="cmp-cancel-btn" onClick={() => setShowForm(false)}>إلغاء</button>
                <button type="submit" className={`cmp-submit-btn ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
                  {submitting ? '' : 'إرسال التذكرة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket List */}
      {loading ? (
        <Skeleton height={70} count={4} />
      ) : complaints.length === 0 ? (
        <div className="cmp-empty">
          <div className="cmp-empty-icon"><FiAlertCircle size={36} /></div>
          <h3 className="cmp-empty-title">لا توجد تذاكر</h3>
          <p className="cmp-empty-sub">لم تقدم أي شكوى حتى الآن</p>
          <button className="cmp-empty-cta" onClick={() => setShowForm(true)}><FiPlus /> تذكرة جديدة</button>
        </div>
      ) : (
        <div className="tk-list">
          {complaints.map((c) => {
            const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.OPEN;
            const tc = TYPE_CONFIG[c.type] || TYPE_CONFIG.OTHER;
            const replyCount = c.replies?.length || 0;
            return (
              <div key={c.id} className="tk-item" onClick={() => openTicket(c)}>
                <div className="tk-item-icon" style={{ background: `${tc.color}12`, color: tc.color }}>{tc.icon}</div>
                <div className="tk-item-info">
                  <div className="tk-item-top">
                    <span className="tk-item-number">TK-{String(c.ticketNumber).padStart(4, '0')}</span>
                    <span className="tk-item-subject">{c.subject}</span>
                  </div>
                  <div className="tk-item-bottom">
                    <span>{tc.label}</span>
                    <span>&middot;</span>
                    <span>{timeAgo(c.createdAt)}</span>
                    {replyCount > 0 && <><span>&middot;</span><span>{replyCount} رد</span></>}
                  </div>
                </div>
                <span className="tk-item-status" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
