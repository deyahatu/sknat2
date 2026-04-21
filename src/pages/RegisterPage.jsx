import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiPhone, FiCreditCard } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    idNumber: '',
    idPhoto: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const isOwner = formData.role === 'owner';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleIdPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFormData((prev) => ({ ...prev, idPhoto: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }
    if (isOwner && !formData.idNumber.trim()) {
      setError('رقم الهوية مطلوب للتسجيل كمالك عقار');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role.toUpperCase(),
        ...(isOwner && { idNumber: formData.idNumber, idPhoto: formData.idPhoto }),
      });

      navigate(isOwner ? '/owner' : '/');
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>إنشاء حساب</h1>
            <p>أنشئ حسابك للبدء في البحث عن سكن أو عرض عقارك</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="role-selector">
              <button
                type="button"
                className={`role-btn ${formData.role === 'student' ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'student' })}
              >
                🎓 طالب
              </button>
              <button
                type="button"
                className={`role-btn ${formData.role === 'owner' ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'owner' })}
              >
                🏠 مالك عقار
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="name">الاسم الكامل</label>
              <div className="input-wrapper">
                <FiUser className="input-icon" />
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="أدخل اسمك الكامل"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-email">البريد الإلكتروني</label>
              <div className="input-wrapper">
                <FiMail className="input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="phone">رقم الجوال</label>
              <div className="input-wrapper">
                <FiPhone className="input-icon" />
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  placeholder="05XXXXXXXX"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {isOwner && (
              <>
                <div className="form-group">
                  <label htmlFor="idNumber">رقم الهوية *</label>
                  <div className="input-wrapper">
                    <FiCreditCard className="input-icon" />
                    <input
                      id="idNumber"
                      type="text"
                      name="idNumber"
                      placeholder="أدخل رقم الهوية الوطنية"
                      value={formData.idNumber}
                      onChange={handleChange}
                      required
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>صورة الهوية (اختياري)</label>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ width: '100%', marginBottom: 8 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {formData.idPhoto ? 'تم رفع الصورة ✓' : 'رفع صورة الهوية'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleIdPhoto}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="reg-password">كلمة المرور</label>
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="8 أحرف على الأقل"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className="btn btn-primary btn-lg auth-submit"
              disabled={loading}
            >
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              لديك حساب بالفعل؟{' '}
              <Link to="/login">تسجيل الدخول</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
