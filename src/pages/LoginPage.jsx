import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/shared/Toast';
import './AuthPages.css';

function LoginPage() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(location.state?.successMessage || null);
  const [fieldErrors, setFieldErrors] = useState({});

  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  function validateField(name, value) {
    if (name === 'email' && !value.trim()) return 'البريد الإلكتروني مطلوب';
    if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'بريد إلكتروني غير صالح';
    if (name === 'password' && !value) return 'كلمة المرور مطلوبة';
    if (name === 'password' && value.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    return '';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateField('email', email);
    const passwordErr = validateField('password', password);
    if (emailErr || passwordErr) {
      setFieldErrors({ email: emailErr, password: passwordErr });
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await login(email, password);
      navigate(data.user?.role === 'OWNER' ? '/owner' : '/');
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>تسجيل الدخول</h1>
            <p>أدخل بياناتك للوصول إلى حسابك</p>
          </div>

          {successMessage && (
            <div
              style={{
                background: '#d4edda',
                color: '#155724',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                textAlign: 'center',
                fontSize: '14px',
                border: '1px solid #c3e6cb',
              }}
            >
              {successMessage}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">البريد الإلكتروني</label>
              <div className="input-wrapper" style={{ borderColor: fieldErrors.email ? '#dc2626' : undefined }}>
                <FiMail className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })); }}
                  onBlur={(e) => setFieldErrors(prev => ({ ...prev, email: validateField('email', e.target.value) }))}
                  dir="ltr"
                />
              </div>
              {fieldErrors.email && <span style={{ color: '#dc2626', fontSize: 12, marginTop: 4, display: 'block' }}>{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">كلمة المرور</label>
              <div className="input-wrapper" style={{ borderColor: fieldErrors.password ? '#dc2626' : undefined }}>
                <FiLock className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value.replace(/[؀-ۿ]/g, '')); setFieldErrors(prev => ({ ...prev, password: '' })); }}
                  onBlur={(e) => setFieldErrors(prev => ({ ...prev, password: validateField('password', e.target.value) }))}
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
              {fieldErrors.password && <span style={{ color: '#dc2626', fontSize: 12, marginTop: 4, display: 'block' }}>{fieldErrors.password}</span>}
            </div>

            <div className="form-actions">
              <Link to="/forgot-password" className="forgot-link">نسيت كلمة المرور؟</Link>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className={`btn btn-primary btn-lg auth-submit ${loading ? 'btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              ليس لديك حساب؟{' '}
              <Link to="/register">إنشاء حساب جديد</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
