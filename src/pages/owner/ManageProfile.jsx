import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

const ROLE_LABELS = {
  OWNER: "مالك عقار",
  ADMIN: "مدير",
  STUDENT: "طالب",
};

const PHONE_KEY_ALLOWLIST = [
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
];

function blockNonDigits(e) {
  if (PHONE_KEY_ALLOWLIST.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}

function sanitizePaste(e) {
  const pasted = (e.clipboardData || window.clipboardData).getData("text");
  if (!/^\d+$/.test(pasted)) e.preventDefault();
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function ManageProfile() {
  const { refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [info, setInfo] = useState({ name: "", phone: "", email: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoStatus, setInfoStatus] = useState({ type: "", message: "" });

  const [pwd, setPwd] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdStatus, setPwdStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    api.users
      .profile()
      .then((res) => {
        setProfile(res.user);
        setInfo({
          name: res.user.name || "",
          phone: res.user.phone || "",
          email: res.user.email || "",
        });
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveInfo(e) {
    e.preventDefault();
    setInfoStatus({ type: "", message: "" });

    const name = info.name.trim();
    const phone = info.phone.trim();
    const email = info.email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInfoStatus({
        type: "error",
        message: "يرجى إدخال بريد إلكتروني صحيح",
      });
      return;
    }

    setSavingInfo(true);
    try {
      const res = await api.users.updateProfile({ name, phone, email });
      setProfile((prev) => ({ ...prev, ...res.user }));
      await refreshUser();
      setInfoStatus({ type: "success", message: "تم تحديث البيانات بنجاح" });
    } catch (err) {
      setInfoStatus({ type: "error", message: err.message });
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdStatus({ type: "", message: "" });

    if (pwd.newPassword !== pwd.confirmPassword) {
      setPwdStatus({ type: "error", message: "كلمات المرور غير متطابقة" });
      return;
    }
    if (pwd.newPassword.length < 8) {
      setPwdStatus({
        type: "error",
        message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
      });
      return;
    }
    if (pwd.newPassword === pwd.currentPassword) {
      setPwdStatus({
        type: "error",
        message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
      });
      return;
    }

    setSavingPwd(true);
    try {
      await api.auth.changePassword(pwd.currentPassword, pwd.newPassword);
      setPwdStatus({ type: "success", message: "تم تغيير كلمة المرور بنجاح" });
      setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPwdStatus({ type: "error", message: err.message });
    } finally {
      setSavingPwd(false);
    }
  }

  if (loading) return <div className="owner-loading">جاري التحميل...</div>;

  if (loadError || !profile) {
    return (
      <div className="owner-form-error">
        {loadError || "تعذر تحميل البيانات"}
      </div>
    );
  }

  const joined = formatDate(profile.createdAt);
  const hasBank = !!(profile.bankName && profile.bankAccountNumber);
  const maskedAccount = profile.bankAccountNumber
    ? `****${profile.bankAccountNumber.slice(-4)}`
    : null;

  return (
    <>
      {/* Hero */}
      <div className="owner-profile-hero">
        <div className="owner-profile-hero-main">
          <div>
            <h1 className="owner-profile-hero-name">{profile.name}</h1>
            <div className="owner-profile-hero-meta">
              <span className="owner-badge approved">
                {ROLE_LABELS[profile.role] || profile.role}
              </span>
              <span className="owner-profile-hero-joined">
                عضو منذ {joined}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="owner-profile-grid">
        {/* Right (first in RTL): editable forms */}
        <div className="owner-profile-col">
          <div className="owner-card">
            <div className="owner-card-header">
              <h2 className="owner-card-title">المعلومات الشخصية</h2>
            </div>
            <div className="owner-profile-card-body">
              {infoStatus.message && (
                <div
                  className={
                    infoStatus.type === "success"
                      ? "owner-form-success"
                      : "owner-form-error"
                  }
                >
                  {infoStatus.message}
                </div>
              )}
              <form onSubmit={handleSaveInfo}>
                <div className="owner-form-group">
                  <label className="owner-form-label">الاسم الكامل</label>
                  <input
                    className="owner-form-input"
                    value={info.name}
                    onChange={(e) => setInfo({ ...info, name: e.target.value })}
                    required
                  />
                </div>

                <div className="owner-form-group">
                  <label className="owner-form-label">رقم الجوال</label>
                  <input
                    className="owner-form-input"
                    value={info.phone}
                    onChange={(e) =>
                      setInfo({ ...info, phone: e.target.value })
                    }
                    onKeyDown={blockNonDigits}
                    onPaste={sanitizePaste}
                    inputMode="tel"
                    required
                    dir="ltr"
                  />
                </div>

                <div className="owner-form-group">
                  <label className="owner-form-label">البريد الإلكتروني</label>
                  <input
                    className="owner-form-input"
                    type="email"
                    value={info.email}
                    onChange={(e) =>
                      setInfo({ ...info, email: e.target.value })
                    }
                    required
                    dir="ltr"
                  />
                </div>

                <button
                  type="submit"
                  className="owner-btn owner-btn-primary"
                  disabled={savingInfo}
                >
                  {savingInfo ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </form>
            </div>
          </div>

          <div className="owner-card owner-profile-card-gap">
            <div className="owner-card-header">
              <h2 className="owner-card-title">تغيير كلمة المرور</h2>
            </div>
            <div className="owner-profile-card-body">
              {pwdStatus.message && (
                <div
                  className={
                    pwdStatus.type === "success"
                      ? "owner-form-success"
                      : "owner-form-error"
                  }
                >
                  {pwdStatus.message}
                </div>
              )}
              <form onSubmit={handleChangePassword}>
                <div className="owner-form-group">
                  <label className="owner-form-label">
                    كلمة المرور الحالية
                  </label>
                  <input
                    className="owner-form-input"
                    type="password"
                    value={pwd.currentPassword}
                    onChange={(e) =>
                      setPwd({ ...pwd, currentPassword: e.target.value })
                    }
                    required
                    dir="ltr"
                  />
                </div>
                <div className="owner-form-group">
                  <label className="owner-form-label">
                    كلمة المرور الجديدة
                  </label>
                  <input
                    className="owner-form-input"
                    type="password"
                    value={pwd.newPassword}
                    onChange={(e) =>
                      setPwd({ ...pwd, newPassword: e.target.value })
                    }
                    placeholder="8 أحرف على الأقل"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="owner-form-group">
                  <label className="owner-form-label">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    className="owner-form-input"
                    type="password"
                    value={pwd.confirmPassword}
                    onChange={(e) =>
                      setPwd({ ...pwd, confirmPassword: e.target.value })
                    }
                    required
                    dir="ltr"
                  />
                </div>

                <button
                  type="submit"
                  className="owner-btn owner-btn-primary"
                  disabled={savingPwd}
                >
                  {savingPwd ? "جاري التغيير..." : "تغيير كلمة المرور"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Left column: read-only account info */}
        <div className="owner-profile-col">
          <div className="owner-card">
            <div className="owner-card-header">
              <h2 className="owner-card-title">بيانات التحقق</h2>
            </div>
            <div className="owner-profile-card-body">
              <div className="owner-profile-info-row">
                <span className="owner-profile-info-label">رقم الهوية</span>
                <span className="owner-profile-info-value" dir="ltr">
                  {profile.idNumber || "—"}
                </span>
              </div>
              <div className="owner-profile-info-row">
                <span className="owner-profile-info-label">
                  البريد الإلكتروني
                </span>
                <span className="owner-profile-info-value" dir="ltr">
                  {profile.email}
                </span>
              </div>
              <div className="owner-profile-info-row">
                <span className="owner-profile-info-label">تاريخ الانضمام</span>
                <span className="owner-profile-info-value">{joined}</span>
              </div>
              <div className="owner-profile-info-row">
                <span className="owner-profile-info-label">الصلاحيات</span>
                <span className="owner-badge approved">
                  {ROLE_LABELS[profile.role] || profile.role}
                </span>
              </div>
            </div>
          </div>

          <div className="owner-card owner-profile-card-gap">
            <div className="owner-card-header">
              <h2 className="owner-card-title">الإعدادات المالية</h2>
            </div>
            <div className="owner-profile-card-body">
              <div className="owner-profile-info-row">
                <span className="owner-profile-info-label">الحساب البنكي</span>
                <span
                  className={`owner-badge ${hasBank ? "approved" : "pending"}`}
                >
                  {hasBank ? "مُفعّل" : "غير مضاف"}
                </span>
              </div>
              {hasBank && (
                <>
                  <div className="owner-profile-info-row">
                    <span className="owner-profile-info-label">البنك</span>
                    <span className="owner-profile-info-value">
                      {profile.bankName}
                    </span>
                  </div>
                  <div className="owner-profile-info-row">
                    <span className="owner-profile-info-label">
                      صاحب الحساب
                    </span>
                    <span className="owner-profile-info-value">
                      {profile.bankAccountHolder}
                    </span>
                  </div>
                  <div className="owner-profile-info-row">
                    <span className="owner-profile-info-label">رقم الحساب</span>
                    <span className="owner-profile-info-value" dir="ltr">
                      {maskedAccount}
                    </span>
                  </div>
                </>
              )}

              <div className="owner-profile-actions">
                <Link
                  to="/owner/bank-account"
                  className="owner-btn owner-btn-outline owner-profile-link-btn"
                >
                  {hasBank ? "تعديل الحساب البنكي" : "إضافة حساب بنكي"}
                </Link>
                <Link
                  to="/owner/withdrawals"
                  className="owner-btn owner-btn-ghost owner-profile-link-btn"
                >
                  طلبات السحب
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
