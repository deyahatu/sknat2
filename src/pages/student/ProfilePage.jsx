import { useEffect, useRef, useState } from "react";
import { FiCamera, FiTrash2, FiUser, FiMail, FiPhone, FiLock, FiBook, FiHash, FiCalendar, FiShield } from "react-icons/fi";
import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import "./ProfilePage.css";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

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

  const [info, setInfo] = useState({ name: "", phone: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoStatus, setInfoStatus] = useState({ type: "", message: "" });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ type: "", message: "" });

  const avatarInputRef = useRef(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    api.users
      .profile()
      .then((res) => {
        setProfile(res.user);
        setInfo({
          name: res.user.name || "",
          phone: res.user.phone || "",
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

    setSavingInfo(true);
    try {
      const res = await api.users.updateProfile({ name, phone });
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

  async function uploadAvatar(dataUrl) {
    setSavingAvatar(true);
    setAvatarStatus({ type: "", message: "" });
    try {
      const res = await api.users.updateProfile({ avatar: dataUrl });
      setProfile((prev) => ({ ...prev, ...res.user }));
      await refreshUser();
      setAvatarStatus({
        type: "success",
        message: dataUrl ? "تم تحديث الصورة الشخصية" : "تم حذف الصورة الشخصية",
      });
    } catch (err) {
      setAvatarStatus({
        type: "error",
        message: err.message || "تعذر تحديث الصورة الشخصية",
      });
    } finally {
      setSavingAvatar(false);
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarStatus({
        type: "error",
        message: "يرجى رفع صورة بصيغة JPG أو PNG أو WEBP",
      });
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarStatus({
        type: "error",
        message: "حجم الصورة يجب ألا يتجاوز 2 ميجابايت",
      });
      return;
    }

    api.upload.single(file)
      .then((data) => uploadAvatar(data.url))
      .catch((err) => setAvatarStatus({ type: "error", message: err.message || "فشل رفع الصورة" }));
    reader.onerror = () =>
      setAvatarStatus({ type: "error", message: "تعذر قراءة الصورة" });
    reader.readAsDataURL(file);
  }

  async function handleAvatarRemove() {
    await uploadAvatar(null);
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
            <div className="student-profile-hero-avatar-wrap">
              <div className="student-profile-hero-avatar">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} />
                ) : (
                  initial
                )}
              </div>
              <button
                type="button"
                className="student-profile-avatar-btn"
                onClick={() => avatarInputRef.current?.click()}
                disabled={savingAvatar}
                aria-label={profile.avatar ? "تغيير الصورة الشخصية" : "إضافة صورة شخصية"}
                title={profile.avatar ? "تغيير الصورة" : "إضافة صورة"}
              >
                <FiCamera />
              </button>
              {profile.avatar && (
                <button
                  type="button"
                  className="student-profile-avatar-btn student-profile-avatar-btn-remove"
                  onClick={handleAvatarRemove}
                  disabled={savingAvatar}
                  aria-label="حذف الصورة الشخصية"
                  title="حذف الصورة"
                >
                  <FiTrash2 />
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                hidden
              />
            </div>
            <div>
              <h1 className="student-profile-hero-name">{profile.name}</h1>
              <div className="student-profile-hero-meta">
                <span className="student-badge approved">طالب</span>
                <span className="student-profile-hero-joined">
                  عضو منذ {joined}
                </span>
              </div>
              {avatarStatus.message && (
                <div
                  className={`student-profile-avatar-status student-profile-avatar-status-${avatarStatus.type}`}
                >
                  {avatarStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="student-profile-grid">
          <div className="student-profile-col">
            <div className="student-card">
              <div className="student-card-header">
                <h2 className="student-card-title"><FiUser className="pp-icon-lg" /> المعلومات الشخصية</h2>
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
                    <label className="student-form-label"><FiUser className="pp-icon" /> الاسم الكامل</label>
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
                    <label className="student-form-label"><FiPhone className="pp-icon" /> رقم الجوال</label>
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
                      <FiMail className="pp-icon" /> البريد الجامعي
                    </label>
                    <input
                      className="student-form-input student-form-input-locked"
                      type="email"
                      value={profile.email}
                      readOnly
                      dir="ltr"
                      title="لا يمكن تغيير البريد الجامعي بعد التسجيل"
                    />
                    <p className="student-form-hint">
                      <FiLock className="pp-icon" /> لا يمكن تغيير البريد الجامعي بعد التسجيل
                    </p>
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
                <h2 className="student-card-title"><FiLock className="pp-icon-lg" /> تغيير كلمة المرور</h2>
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
                <h2 className="student-card-title"><FiBook className="pp-icon-lg" /> البيانات الأكاديمية</h2>
              </div>
              <div className="student-profile-card-body">
                <div className="student-profile-info-row">
                  <span className="student-profile-info-label">
                    <FiHash className="pp-icon" /> الرقم الجامعي
                  </span>
                  <span className="student-profile-info-value" dir="ltr">
                    {profile.idNumber || "—"}
                  </span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label"><FiBook className="pp-icon" /> التخصص</span>
                  <span className="student-profile-info-value">
                    {profile.major || "—"}
                  </span>
                </div>

                <div className="student-profile-info-row">
                  <span className="student-profile-info-label"><FiUser className="pp-icon" /> الجنس</span>
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
                    <FiCalendar className="pp-icon" /> تاريخ الانضمام
                  </span>
                  <span className="student-profile-info-value">{joined}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
