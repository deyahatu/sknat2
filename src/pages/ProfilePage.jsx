import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { FiUser, FiMail, FiPhone, FiEdit2, FiSave, FiShield, FiCalendar, FiX, FiLock } from 'react-icons/fi';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSaving, setIsSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  if (!user) return null;

  const roleTranslations = {
    STUDENT: 'طالب',
    OWNER: 'مالك عقار',
    ADMIN: 'مدير'
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus({ type: '', message: '' });

    try {
      await api.users.updateProfile(formData);
      await refreshUser();
      setStatus({ type: 'success', message: 'تم تحديث الملف الشخصي بنجاح' });
      setIsEditing(false);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'حدث خطأ أثناء التحديث' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordStatus({ type: '', message: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'كلمات المرور غير متطابقة' });
      setIsChangingPassword(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      setIsChangingPassword(false);
      return;
    }

    try {
      await api.auth.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordStatus({ type: 'success', message: 'تم تغيير كلمة المرور بنجاح' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordStatus({ type: 'error', message: err.message || 'حدث خطأ أثناء تغيير كلمة المرور' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formattedDate = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'غير محدد';

  return (
    <div className="page profile-page">
      <div className="container profile-container">
        <div className="profile-header-bg"></div>
        
        <div className="profile-card">
          <div className="profile-header-content">
            <div className="profile-user-main">
              <div className="profile-avatar">
                <div className="profile-avatar-inner">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="profile-title">
                <h1>{user.name}</h1>
                <div className={`profile-role-badge ${user.role.toLowerCase()}`}>
                  <FiShield /> {roleTranslations[user.role] || user.role}
                </div>
              </div>
            </div>
            
            {!isEditing && (
              <button className="btn btn-outline" onClick={() => setIsEditing(true)}>
                <FiEdit2 /> تعديل البيانات
              </button>
            )}
          </div>

          {status.message && (
            <div className={`profile-message ${status.type}`}>
              {status.message}
            </div>
          )}

          {isEditing ? (
            <form className="profile-edit-form" onSubmit={handleSave}>
              <div className="form-group">
                <label>الاسم الكامل</label>
                <div className="input-wrapper">
                  <FiUser className="input-icon" />
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>رقم الهاتف</label>
                <div className="input-wrapper">
                  <FiPhone className="input-icon" />
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    required
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ opacity: 0.6 }}>
                <label>البريد الإلكتروني (غير قابل للتعديل)</label>
                <div className="input-wrapper">
                  <FiMail className="input-icon" />
                  <input type="email" value={user.email} disabled dir="ltr" style={{ textAlign: 'right' }} />
                </div>
              </div>

              <div className="profile-edit-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  <FiX /> إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  <FiSave /> {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-body">
              <div className="profile-field">
                <label><FiMail /> البريد الإلكتروني</label>
                <div className="profile-field-value" dir="ltr" style={{ textAlign: 'right' }}>
                  {user.email}
                </div>
              </div>
              <div className="profile-field">
                <label><FiPhone /> رقم الهاتف</label>
                <div className="profile-field-value" dir="ltr" style={{ textAlign: 'right' }}>
                  {user.phone || 'غير متوفر'}
                </div>
              </div>
              <div className="profile-field">
                <label><FiCalendar /> تاريخ الانضمام</label>
                <div className="profile-field-value">{formattedDate}</div>
              </div>
            </div>
          )}
        </div>

        <div className="profile-card" style={{ marginTop: '24px' }}>
          <div className="profile-header-content" style={{ paddingBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FiLock size={22} />
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>تغيير كلمة المرور</h2>
            </div>
          </div>

          {passwordStatus.message && (
            <div className={`profile-message ${passwordStatus.type}`}>
              {passwordStatus.message}
            </div>
          )}

          <form className="profile-edit-form" onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>كلمة المرور الحالية</label>
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  required
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>كلمة المرور الجديدة</label>
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  required
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                  placeholder="6 أحرف على الأقل"
                />
              </div>
            </div>

            <div className="form-group">
              <label>تأكيد كلمة المرور الجديدة</label>
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  required
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                />
              </div>
            </div>

            <div className="profile-edit-actions">
              <button type="submit" className="btn btn-primary" disabled={isChangingPassword}>
                <FiSave /> {isChangingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
