import { useEffect, useState } from "react";
import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import "./ProfilePage.css";

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

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [info, setInfo] = useState({ name: "", phone: "", email: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoStatus, setInfoStatus] = useState({ type: "", message: "" });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ type: "", message: "" });

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

    if (!name) {
      setInfoStatus({ type: "error", message: "الاسم الكامل مطلوب" });
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      setInfoStatus({
        type: "error",
        message: "رقم الجوال يجب أن يتكون من 10 أرقام بالضبط",
      });
      return;
    }

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
      setInfoStatus({
        type: "error",
        message: err.message || "حدث خطأ أثناء تحديث البيانات",
      });
    } finally {
      setSavingInfo(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordStatus({ type: "", message: "" });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordStatus({ type: "error", message: "كلمات المرور غير متطابقة" });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordStatus({
        type: "error",
        message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
      });
      return;
    }

    if (passwordData.newPassword === passwordData.currentPassword) {
      setPasswordStatus({
        type: "error",
        message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
      });
      return;
    }

    setSavingPassword(true);
    try {
      await api.auth.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword,
      );
      setPasswordStatus({
        type: "success",
        message: "تم تغيير كلمة المرور بنجاح",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordStatus({
        type: "error",
        message: err.message || "حدث خطأ أثناء تغيير كلمة المرور",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="page profile-page">
        <div className="container profile-container">
          <div className="profile-loading">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="page profile-page">
        <div className="container profile-container">
          <div className="profile-form-error">
            {loadError || "تعذر تحميل البيانات"}
          </div>
        </div>
      </div>
    );
  }

  const joined = formatDate(profile.createdAt);
  const initial = (profile.name || "ط").charAt(0).toUpperCase();

  return (
    <div className="page profile-page">
      <div className="container profile-container">
        <div className="student-profile-hero">
          <div className="student-profile-hero-main">
            <div className="student-profile-hero-avatar">{initial}</div>
            <div>
              <h1 className="student-profile-hero-name">{profile.name}</h1>
              <div className="student-profile-hero-meta">
                <span className="student-badge approved">طالب</span>
                <span className="student-profile-hero-joined">
                  عضو منذ {joined}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="student-profile-grid">
          <div className="student-profile-col">
            <div className="student-card">
              <div className="student-card-header">
                <h2 className="student-card-title">المعلومات الشخصية</h2>
              </div>
              <div className="student-profile-card-body">
                {infoStatus.message && (
                  <div
                    className={
                      infoStatus.type === "success"
                        ? "profile-form-success"
                        : "profile-form-error"
                    }
                  >
                    {infoStatus.message}
                  </div>
                )}

                <form onSubmit={handleSaveInfo}>
                  <div className="student-form-group">
                    <label className="student-form-label">الاسم الكامل</label>
                    <input
                      className="student-form-input"
                      value={info.name}
                      onChange={(e) =>
                        setInfo({ ...info, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="student-form-group">
                    <label className="student-form-label">رقم الجوال</label>
                    <input
                      className="student-form-input"
                      value={info.phone}
                      onChange={(e) =>
                        setInfo({ ...info, phone: e.target.value })
                      }
                      onKeyDown={blockNonDigits}
                      onPaste={sanitizePaste}
                      inputMode="tel"
                      maxLength={10}
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="student-form-group">
                    <label className="student-form-label">
                      البريد الإلكتروني
                    </label>
                    <input
                      className="student-form-input"
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
                    className="student-btn student-btn-primary"
                    disabled={savingInfo}
                  >
                    {savingInfo ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </button>
                </form>
              </div>
            </div>

            <div className="student-card student-profile-card-gap">
              <div className="student-card-header">
                <h2 className="student-card-title">تغيير كلمة المرور</h2>
              </div>
              <div className="student-profile-card-body">
                {passwordStatus.message && (
                  <div
                    className={
                      passwordStatus.type === "success"
                        ? "profile-form-success"
                        : "profile-form-error"
                    }
                  >
                    {passwordStatus.message}
                  </div>
                )}

                <form onSubmit={handlePasswordChange}>
                  <div className="student-form-group">
                    <label className="student-form-label">
                      كلمة المرور الحالية
                    </label>
                    <input
                      className="student-form-input"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          currentPassword: e.target.value.replace(/[؀-ۿ]/g, ""),
                        })
                      }
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="student-form-group">
                    <label className="student-form-label">
                      كلمة المرور الجديدة
                    </label>
                    <input
                      className="student-form-input"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value.replace(/[؀-ۿ]/g, ""),
                        })
                      }
                      placeholder="8 أحرف على الأقل"
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="student-form-group">
                    <label className="student-form-label">
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <input
                      className="student-form-input"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value.replace(/[؀-ۿ]/g, ""),
                        })
                      }
                      required
                      dir="ltr"
                    />
                  </div>

                  <button
                    type="submit"
                    className="student-btn student-btn-primary"
                    disabled={savingPassword}
                  >
                    {savingPassword
                      ? "جاري التغيير..."
                      : "تغيير كلمة المرور"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="student-profile-col">
            <div className="student-card">
              <div className="student-card-header">
                <h2 className="student-card-title">بيانات التحقق</h2>
              </div>
              <div className="student-profile-card-body">
                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">
                    الرقم الجامعي
                  </span>
                  <span className="student-profile-info-value" dir="ltr">
                    {profile.idNumber || "—"}
                  </span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">التخصص</span>
                  <span className="student-profile-info-value">
                    {profile.major || "—"}
                  </span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">الجنس</span>
                  <span className="student-profile-info-value">
                    {profile.gender === "MALE"
                      ? "ذكر"
                      : profile.gender === "FEMALE"
                        ? "أنثى"
                        : "—"}
                  </span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">
                    البريد الإلكتروني
                  </span>
                  <span className="student-profile-info-value" dir="ltr">
                    {profile.email}
                  </span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">
                    تاريخ الانضمام
                  </span>
                  <span className="student-profile-info-value">{joined}</span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">الصلاحيات</span>
                  <span className="student-badge approved">طالب</span>
                </div>
              </div>
            </div>

            <div className="student-card student-profile-card-gap">
              <div className="student-card-header">
                <h2 className="student-card-title">حالة الحساب</h2>
              </div>
              <div className="student-profile-card-body">
                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">الحساب</span>
                  <span className="student-badge approved">مفعّل</span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">
                    رقم الجوال
                  </span>
                  <span className="student-profile-info-value" dir="ltr">
                    {profile.phone || "—"}
                  </span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">
                    آخر تحديث
                  </span>
                  <span className="student-profile-info-value">
                    {formatDate(profile.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
