import { useEffect, useMemo, useState } from 'react';
import { FiAlertOctagon, FiImage, FiVideo, FiX, FiInbox, FiClock, FiCheckCircle, FiXCircle, FiUploadCloud } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import Skeleton from '../shared/Skeleton';
import './Complaints.css';

const STATUS_META = {
  PENDING: { label: 'قيد المراجعة', icon: <FiClock />, cls: 'pending' },
  REVIEWED: { label: 'تمت المراجعة', icon: <FiCheckCircle />, cls: 'reviewed' },
  DISMISSED: { label: 'مرفوضة', icon: <FiXCircle />, cls: 'dismissed' },
};

// Bookings in these statuses establish a real relationship — only counter-
// parties in such bookings can be the target of a complaint.
const ELIGIBLE_BOOKING_STATUSES = ['APPROVED', 'PAID', 'COMPLETED'];

export default function ComplaintsView() {
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role;

  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [bookingId, setBookingId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [bookingsRes, complaintsRes] = await Promise.all([
          role === 'STUDENT' ? api.bookings.studentList() : api.bookings.ownerList(),
          api.complaints.mine(),
        ]);
        if (cancelled) return;
        setBookings(bookingsRes.bookings || []);
        setComplaints(complaintsRes.complaints || []);
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'تعذر تحميل البيانات.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // For students, each booking → one option (the property's owner is the target).
  // For owners, the booking's student is the target.
  // If the same target appears across multiple bookings, we still show one row
  // per booking so the complainant can be specific about which stay it concerns.
  const targetOptions = useMemo(() => {
    return bookings
      .filter((b) => ELIGIBLE_BOOKING_STATUSES.includes(b.status))
      .map((b) => {
        if (role === 'STUDENT') {
          const owner = b.property?.owner;
          if (!owner) return null;
          return {
            bookingId: b.id,
            targetId: owner.id,
            targetName: owner.name,
            propertyTitle: b.property?.title || '—',
            label: `${owner.name} — ${b.property?.title || ''}`,
          };
        }
        const student = b.student;
        if (!student) return null;
        return {
          bookingId: b.id,
          targetId: student.id,
          targetName: student.name,
          propertyTitle: b.property?.title || '—',
          label: `${student.name} — ${b.property?.title || ''}`,
        };
      })
      .filter(Boolean);
  }, [bookings, role]);

  const selectedOption = targetOptions.find((o) => o.bookingId === bookingId);

  function handleImagePick(e) {
    const files = Array.from(e.target.files || []);
    const next = [...imageFiles, ...files].slice(0, 8);
    setImageFiles(next);
    e.target.value = '';
  }

  function removeImage(idx) {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleVideoPick(e) {
    const file = e.target.files?.[0] || null;
    setVideoFile(file);
    e.target.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (!selectedOption) {
      setFormError(
        role === 'STUDENT'
          ? 'اختر السكن الذي تريد تقديم شكوى عن صاحبه.'
          : 'اختر الطالب الذي تريد تقديم شكوى عنه.',
      );
      return;
    }
    if (!subject.trim()) {
      setFormError('أدخل عنواناً للشكوى.');
      return;
    }
    if (!description.trim()) {
      setFormError('أدخل وصفاً للشكوى.');
      return;
    }
    setSubmitting(true);
    try {
      let images = [];
      let videoUrl = null;
      if (imageFiles.length > 0 || videoFile) {
        const uploadRes = await api.complaints.uploadMedia({
          images: imageFiles,
          video: videoFile,
        });
        images = uploadRes.imageUrls || [];
        videoUrl = uploadRes.videoUrl || null;
      }
      const res = await api.complaints.create({
        targetUserId: selectedOption.targetId,
        bookingId: selectedOption.bookingId,
        subject: subject.trim(),
        description: description.trim(),
        images,
        videoUrl,
      });
      toast.success('تم إرسال الشكوى — سيقوم المشرف بمراجعتها.');
      setComplaints((prev) => [
        {
          ...res.complaint,
          target: {
            id: selectedOption.targetId,
            name: selectedOption.targetName,
          },
          booking: { id: selectedOption.bookingId, property: { title: selectedOption.propertyTitle } },
        },
        ...prev,
      ]);
      setBookingId('');
      setSubject('');
      setDescription('');
      setImageFiles([]);
      setVideoFile(null);
    } catch (err) {
      setFormError(err.message || 'تعذر إرسال الشكوى.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="complaints-page">
        <Skeleton height={64} />
        <div style={{ height: 16 }} />
        <Skeleton height={240} />
      </div>
    );
  }

  const noEligibleBookings = targetOptions.length === 0;

  return (
    <div className="complaints-page">
      <header className="complaints-hero">
        <h1>
          <FiAlertOctagon /> الشكاوى
        </h1>
        <p>
          {role === 'STUDENT'
            ? 'قدّم شكوى ضد مالك عقار سكنت عنده — مع إمكانية إرفاق صور أو فيديو.'
            : 'قدّم شكوى ضد طالب سكن لديك — مع إمكانية إرفاق صور أو فيديو.'}
        </p>
      </header>

      <section className="complaints-form-card">
        <h2>تقديم شكوى جديدة</h2>
        {noEligibleBookings ? (
          <div className="complaints-empty-mini">
            {role === 'STUDENT'
              ? 'لا توجد حجوزات مؤكدة بعد. تقدر تقدّم شكوى فقط ضد مالك سكنت عنده فعلاً.'
              : 'لا يوجد طلاب سكنوا في عقاراتك بعد. تقدر تقدّم شكوى فقط ضد طالب سكن لديك.'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="complaints-form">
            <div className="complaints-field">
              <label htmlFor="complaint-target">
                {role === 'STUDENT' ? 'الشكوى ضد (مالك / سكن)' : 'الشكوى ضد (طالب / سكن)'}
              </label>
              <select
                id="complaint-target"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                required
              >
                <option value="">— اختر —</option>
                {targetOptions.map((o) => (
                  <option key={o.bookingId} value={o.bookingId}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="complaints-field">
              <label htmlFor="complaint-subject">عنوان الشكوى</label>
              <input
                id="complaint-subject"
                type="text"
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="ملخص قصير للموضوع"
                required
              />
            </div>

            <div className="complaints-field">
              <label htmlFor="complaint-desc">تفاصيل الشكوى</label>
              <textarea
                id="complaint-desc"
                rows={5}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح ما حدث بالتفصيل…"
                required
              />
              <small className="complaints-counter">
                {description.length}/2000
              </small>
            </div>

            <div className="complaints-field">
              <span className="complaints-field-label">
                <FiImage /> صور (اختياري — حتى 8 صور، كل واحدة حتى 5MB)
              </span>
              <label className="complaints-dropzone" htmlFor="complaint-images">
                <FiUploadCloud className="complaints-dropzone-icon" />
                <span className="complaints-dropzone-title">اختر الصور</span>
                <span className="complaints-dropzone-hint">
                  JPEG / PNG / WebP — يمكن اختيار أكثر من صورة
                </span>
                <input
                  id="complaint-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImagePick}
                  className="complaints-file-hidden"
                />
              </label>
              {imageFiles.length > 0 && (
                <div className="complaints-thumbs">
                  {imageFiles.map((f, i) => (
                    <div key={i} className="complaints-thumb">
                      <img src={URL.createObjectURL(f)} alt={`صورة ${i + 1}`} />
                      <button type="button" onClick={() => removeImage(i)} aria-label="حذف">
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="complaints-field">
              <span className="complaints-field-label">
                <FiVideo /> فيديو (اختياري — حتى 25MB)
              </span>
              <label className="complaints-dropzone" htmlFor="complaint-video">
                <FiUploadCloud className="complaints-dropzone-icon" />
                <span className="complaints-dropzone-title">اختر فيديو</span>
                <span className="complaints-dropzone-hint">
                  MP4 / WebM / MOV — ملف واحد
                </span>
                <input
                  id="complaint-video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoPick}
                  className="complaints-file-hidden"
                />
              </label>
              {videoFile && (
                <div className="complaints-video-preview">
                  <FiVideo />
                  <span>{videoFile.name}</span>
                  <button type="button" onClick={() => setVideoFile(null)} aria-label="حذف">
                    <FiX />
                  </button>
                </div>
              )}
            </div>

            {formError && <div className="complaints-error">{formError}</div>}

            <button type="submit" className="complaints-submit-btn" disabled={submitting}>
              {submitting ? 'جارٍ الإرسال…' : 'إرسال الشكوى'}
            </button>
          </form>
        )}
      </section>

      <section className="complaints-list-card">
        <h2>شكاويّ السابقة ({complaints.length})</h2>
        {complaints.length === 0 ? (
          <div className="complaints-empty">
            <FiInbox size={48} />
            <p>لم تقدّم أي شكوى بعد.</p>
          </div>
        ) : (
          <ul className="complaints-list">
            {complaints.map((c) => {
              const meta = STATUS_META[c.status] || STATUS_META.PENDING;
              return (
                <li key={c.id} className="complaints-item">
                  <div className="complaints-item-head">
                    <div>
                      <h3>{c.subject}</h3>
                      <p className="complaints-item-sub">
                        ضد <strong>{c.target?.name || '—'}</strong>
                        {c.booking?.property?.title ? ` • ${c.booking.property.title}` : ''}
                      </p>
                    </div>
                    <span className={`complaints-status ${meta.cls}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <p className="complaints-item-desc">{c.description}</p>
                  {(c.images?.length > 0 || c.videoUrl) && (
                    <div className="complaints-media">
                      {c.images?.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                          <img src={u} alt={`دليل ${i + 1}`} />
                        </a>
                      ))}
                      {c.videoUrl && (
                        <video src={c.videoUrl} controls preload="metadata" />
                      )}
                    </div>
                  )}
                  {c.adminNote && (
                    <div className="complaints-admin-note">
                      <strong>ملاحظة المشرف:</strong> {c.adminNote}
                    </div>
                  )}
                  <small className="complaints-date">
                    {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                  </small>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
