import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiMail,
  FiLock,
  FiUser,
  FiEye,
  FiEyeOff,
  FiPhone,
  FiCreditCard,
  FiBookOpen,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import "./AuthPages.css";

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "student",
    idNumber: "",
    idPhoto: "",
    gender: "",
    major: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [step, setStep] = useState("form"); // "form" | "otp"
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState(null);
  const [otpSuccess, setOtpSuccess] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register } = useAuth();
  const navigate = useNavigate();

  const isOwner = formData.role === "owner";

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let filteredValue = value;

    if (name === "name" || name === "major") {
      filteredValue = value.replace(/[^؀-ۿa-zA-Z\s]/g, "");
    } else if (name === "phone" || name === "idNumber") {
      filteredValue = value.replace(/[^\d]/g, "");
    } else if (name === "password" || name === "confirmPassword") {
      filteredValue = value.replace(/[؀-ۿ]/g, "");
    }

    setFormData({ ...formData, [name]: filteredValue });
  };

  const handleIdPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      setFormData((prev) => ({ ...prev, idPhoto: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("كلمات المرور غير متطابقة");
      return;
    }
    if (!isOwner && !/^s\d{8}@stu\.najah\.edu$/i.test(formData.email.trim())) {
      setError("يجب استخدام البريد الجامعي (مثال: s12345678@stu.najah.edu)");
      return;
    }
    if (formData.phone.length !== 10) {
      setError("رقم الجوال يجب أن يتكوّن من 10 أرقام بالضبط");
      return;
    }
    if (!formData.idNumber.trim()) {
      setError(isOwner ? "رقم الهوية مطلوب" : "الرقم الجامعي مطلوب");
      return;
    }
    if (!formData.idPhoto) {
      setError(isOwner ? "صورة الهوية مطلوبة" : "صورة البطاقة الجامعية مطلوبة");
      return;
    }
    if (!isOwner && !formData.gender) {
      setError("يرجى اختيار الجنس");
      return;
    }
    if (!isOwner && !formData.major.trim()) {
      setError("التخصص مطلوب");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role.toUpperCase(),
        idNumber: formData.idNumber,
        idPhoto: formData.idPhoto,
        ...(!isOwner && {
          gender: formData.gender,
          major: formData.major.trim(),
        }),
      });

      if (result?.requiresVerification) {
        setPendingEmail(result.email || formData.email.trim());
        setStep("otp");
        setResendCooldown(60);
        return;
      }

      navigate("/login", {
        state: { successMessage: "تم إنشاء الحساب بنجاح. يرجى تسجيل الدخول." },
      });
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setOtpError(null);
    setOtpSuccess(null);

    if (!/^\d{6}$/.test(otpCode)) {
      setOtpError("الرمز يجب أن يتكون من 6 أرقام");
      return;
    }

    setVerifying(true);
    try {
      await api.auth.verifyEmail(pendingEmail, otpCode);
      navigate("/login", {
        state: {
          successMessage: "تم التحقق من بريدك بنجاح. يمكنك الآن تسجيل الدخول.",
        },
      });
    } catch (err) {
      setOtpError(err.message || "تعذر التحقق من الرمز");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setOtpError(null);
    setOtpSuccess(null);
    setResending(true);
    try {
      await api.auth.resendCode(pendingEmail);
      setOtpSuccess("تم إرسال رمز جديد إلى بريدك");
      setResendCooldown(60);
    } catch (err) {
      setOtpError(err.message || "تعذر إرسال الرمز");
    } finally {
      setResending(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="page auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1>تحقق من بريدك الجامعي</h1>
              <p>
                أرسلنا رمزاً مكوناً من 6 أرقام إلى{" "}
                <strong dir="ltr">{pendingEmail}</strong>
              </p>
            </div>

            <form className="auth-form" onSubmit={handleVerify}>
              <div className="form-group">
                <label htmlFor="otp-code">رمز التحقق</label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/[^\d]/g, ""))
                  }
                  placeholder="••••••"
                  dir="ltr"
                  className="auth-otp-input"
                  autoFocus
                  required
                />
              </div>

              {otpError && <div className="auth-error">{otpError}</div>}
              {otpSuccess && (
                <div className="auth-error auth-otp-success">
                  {otpSuccess}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg auth-submit"
                disabled={verifying}
              >
                {verifying ? "جاري التحقق..." : "تأكيد"}
              </button>
            </form>

            <div className="auth-footer auth-footer-center">
              <p>
                لم يصلك الرمز؟{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="auth-ghost-btn"
                >
                  {resending
                    ? "جاري الإرسال..."
                    : resendCooldown > 0
                      ? `إعادة الإرسال خلال ${resendCooldown}s`
                      : "إعادة الإرسال"}
                </button>
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setOtpCode("");
                    setOtpError(null);
                    setOtpSuccess(null);
                  }}
                  className="auth-ghost-btn-subtle"
                >
                  ← العودة لتعديل البيانات
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                className={`role-btn ${formData.role === "student" ? "active" : ""}`}
                onClick={() => setFormData({ ...formData, role: "student" })}
              >
                🎓 طالب
              </button>
              <button
                type="button"
                className={`role-btn ${formData.role === "owner" ? "active" : ""}`}
                onClick={() => setFormData({ ...formData, role: "owner" })}
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
                  maxLength={10}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="idNumber">
                {isOwner ? "رقم الهوية  " : "الرقم الجامعي "}
              </label>
              <div className="input-wrapper">
                <FiCreditCard className="input-icon" />
                <input
                  id="idNumber"
                  type="text"
                  name="idNumber"
                  placeholder={
                    isOwner ? "أدخل رقم الهوية " : "أدخل الرقم الجامعي"
                  }
                  value={formData.idNumber}
                  onChange={handleChange}
                  maxLength={isOwner ? 9 : 8}
                  required
                  dir="ltr"
                />
              </div>
            </div>
            {!isOwner && (
              <>
                <div className="form-group">
                  <label>الجنس</label>
                  <div className="role-selector">
                    <button
                      type="button"
                      className={`role-btn ${formData.gender === "MALE" ? "active" : ""}`}
                      onClick={() =>
                        setFormData({ ...formData, gender: "MALE" })
                      }
                    >
                      ذكر
                    </button>
                    <button
                      type="button"
                      className={`role-btn ${formData.gender === "FEMALE" ? "active" : ""}`}
                      onClick={() =>
                        setFormData({ ...formData, gender: "FEMALE" })
                      }
                    >
                      أنثى
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="major">التخصص</label>
                  <div className="input-wrapper">
                    <FiBookOpen className="input-icon" />
                    <input
                      id="major"
                      type="text"
                      name="major"
                      placeholder="مثلاً: علم حاسوب"
                      value={formData.major}
                      onChange={handleChange}
                      maxLength={100}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>
                {isOwner ? "صورة الهوية  " : "صورة البطاقة الجامعية "}
              </label>
              <button
                type="button"
                className="btn btn-outline auth-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                {formData.idPhoto ? "تم رفع الصورة ✓" : "رفع الصورة"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="auth-file-input-hidden"
                onChange={handleIdPhoto}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">كلمة المرور</label>
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
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
                  type={showPassword ? "text" : "password"}
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
              {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              لديك حساب بالفعل؟ <Link to="/login">تسجيل الدخول</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
