import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiHome,
  FiCreditCard,
  FiStar,
  FiArrowLeft,
  FiCheckCircle,
  FiFileText,
  FiShield,
  FiHeart,
  FiCalendar,
} from "react-icons/fi";
import AnimatedCounter from "../components/shared/AnimatedCounter";
import { useAuth } from "../context/AuthContext";
import "./HomePage.css";

function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const isStudent = user?.role === "STUDENT";
  const firstName = user?.name?.split(" ")[0] || "";

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div className="landing">
      {/* ═══ Hero ═══ */}
      <section className="hero">
        <div className="hero__orb hero__orb--1" />
        <div className="hero__orb hero__orb--2" />
        <div className="hero__orb hero__orb--3" />
        <div className="hero__noise" />

        <div className="hero__inner">
          {isStudent ? (
            <h1 className="hero__title">
              أهلاً <span className="hero__title-accent">{firstName}</span>،
              <br />
              لاقي سكنك التالي
            </h1>
          ) : (
            <h1 className="hero__title">
              اعثر على
              <span className="hero__title-accent"> سكنك المثالي </span>
              بخطوات بسيطة
            </h1>
          )}

          <p className="hero__sub">
            {isStudent
              ? "تصفّح العقارات المتاحة، تابع حجوزاتك، وارجع لمفضلاتك من مكان واحد."
              : "نربط الطلاب بأصحاب العقارات لتوفير خيارات سكن موثوقة وبأسعار مناسبة (غرف مفردة، مزدوجة، استوديوهات)"}
          </p>

          <form className="hero__search" onSubmit={handleSearch}>
            <FiSearch className="hero__search-icon" />
            <input
              type="text"
              placeholder="ابحث بالحي، المدينة، أو اسم السكن..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="بحث عن سكن"
            />
            <button type="submit">
              ابحث الآن
              <FiArrowLeft className="hero__search-arrow" />
            </button>
          </form>

          <div className="hero__ctas">
            <Link to="/search" className="hero__cta hero__cta--solid">
              تصفّح العقارات
            </Link>
            {isStudent ? (
              <>
                <Link to="/bookings" className="hero__cta hero__cta--ghost">
                  <FiCalendar />
                  حجوزاتي
                </Link>
                <Link to="/favorites" className="hero__cta hero__cta--ghost">
                  <FiHeart />
                  مفضلاتي
                </Link>
              </>
            ) : (
              <Link to="/register" className="hero__cta hero__cta--ghost">
                سجّل كمالك عقار
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Stats ═══ */}
      <section className="stats">
        <div className="stats__grid">
          {[
            { end: 100, suffix: "+", label: "عقار متاح", icon: <FiHome /> },
            {
              end: 500,
              suffix: "+",
              label: "طالب مسجّل",
              icon: <FiCheckCircle />,
            },
            { end: 3, suffix: "", label: "مدن فلسطينية", icon: <FiShield /> },
            { end: 1000, suffix: "+", label: "حجز ناجح", icon: <FiFileText /> },
          ].map((s, i) => (
            <div
              className="stats__card"
              key={i}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="stats__icon">{s.icon}</div>
              <span className="stats__number">
                <AnimatedCounter end={s.end} suffix={s.suffix} />
              </span>
              <span className="stats__label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section className="features">
        <div className="features__inner">
          <span className="section-eyebrow">المميزات</span>
          <h2 className="section-title">لماذا يختار الطلاب سكنات؟</h2>

          <div className="features__grid">
            {[
              {
                icon: <FiSearch />,
                title: "بحث ذكي",
                desc: "فلتر حسب الحي، السعر، نوع الغرفة، الحرم الجامعي، والجنس",
              },
              {
                icon: <FiHome />,
                title: "خيارات متنوعة",
                desc: "غرف مفردة ومزدوجة، استوديوهات مستقلة، وشقق كاملة بأسعار تنافسية",
              },
              {
                icon: <FiCreditCard />,
                title: "دفع آمن",
                desc: "نظام دفع إلكتروني مع إيصالات وفواتير قابلة للطباعة",
              },
              {
                icon: <FiStar />,
                title: "تقييمات موثوقة",
                desc: "آراء حقيقية من طلاب سابقين تساعدك باتخاذ القرار الصحيح",
              },
            ].map((f, i) => (
              <div
                className="features__card"
                key={i}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="features__card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className="features__card-shine" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How It Works (guests only) ═══ */}
      {!isStudent && (
        <section className="steps">
          <div className="steps__inner">
            <span className="section-eyebrow">كيف تعمل؟</span>
            <h2 className="section-title">ثلاث خطوات فقط</h2>

            <div className="steps__grid">
              {[
                {
                  num: "01",
                  icon: <FiSearch />,
                  title: "ابحث",
                  desc: "تصفّح العقارات المتاحة واستخدم الفلاتر لتضييق النتائج حسب احتياجاتك",
                },
                {
                  num: "02",
                  icon: <FiFileText />,
                  title: "احجز",
                  desc: "اختر الغرفة المناسبة وأرسل طلب حجز — المالك يقبل أو يرفض خلال ساعات",
                },
                {
                  num: "03",
                  icon: <FiCheckCircle />,
                  title: "اسكن",
                  desc: "أكمل الدفع واستلم غرفتك — فاتورة إلكترونية فورية",
                },
              ].map((s, i) => (
                <div className="steps__card" key={i}>
                  <div className="steps__num">{s.num}</div>
                  <div className="steps__card-icon">{s.icon}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  {i < 2 && <div className="steps__connector" />}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ CTA ═══ */}
      <section className="cta">
        <div className="cta__noise" />
        <div className="cta__inner">
          {isStudent ? (
            <>
              <h2>جاهز تلاقي سكنك التالي؟</h2>
              <p>تصفّح العقارات المتاحة الآن، أو ارجع لحجوزاتك ومفضلاتك</p>
              <div className="cta__buttons">
                <Link to="/search" className="cta__btn cta__btn--primary">
                  تصفّح العقارات
                </Link>
                <Link to="/bookings" className="cta__btn cta__btn--outline">
                  حجوزاتي
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>جاهز تلاقي سكنك؟</h2>
              <p>انضم لمئات الطلاب الذين وجدوا سكنهم المثالي عبر سكنات</p>
              <div className="cta__buttons">
                <Link to="/register" className="cta__btn cta__btn--primary">
                  أنشئ حساب مجاناً
                </Link>
                <Link to="/search" className="cta__btn cta__btn--outline">
                  تصفّح بدون تسجيل
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default HomePage;
