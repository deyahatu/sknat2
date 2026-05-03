import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-overlay" />
        <div className="hero-container">
          <span className="hero-brand">🏠 سكنات</span>
          <h1 className="hero-title">ابحث عن سكنك الطلابي المثالي</h1>
          <p className="hero-subtitle">
            منصة سكنات تربط الطلاب بأصحاب العقارات لتوفير أفضل خيارات السكن
            الطلابي بأسعار مناسبة
          </p>

          <form className="hero-search-bar" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="ابحث عن سكن، منطقة، أو مدينة..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit">بحث</button>
          </form>

          <div className="hero-cta-buttons">
            <Link to="/search" className="btn-primary">
              ابحث الآن
            </Link>
            <Link to="/register" className="btn-outline">
              سجّل كمالك عقار
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-card">
            <span className="stat-number">100+</span>
            <span className="stat-label">عقار متاح</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">500+</span>
            <span className="stat-label">طالب مسجّل</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">3</span>
            <span className="stat-label">مدن فلسطينية</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">1000+</span>
            <span className="stat-label">حجز ناجح</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-container">
          <h2 className="section-heading">لماذا سكنات؟</h2>
          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-emoji">🔍</span>
              <h3>بحث متقدم</h3>
              <p>فلترة حسب الحي، السعر، نوع الغرفة، والجنس</p>
            </div>
            <div className="feature-card">
              <span className="feature-emoji">🛏️</span>
              <h3>غرف متنوعة</h3>
              <p>مفردة، مزدوجة، استوديو، وشقق كاملة</p>
            </div>
            <div className="feature-card">
              <span className="feature-emoji">💳</span>
              <h3>دفع آمن</h3>
              <p>نظام دفع إلكتروني مع فواتير وإيصالات</p>
            </div>
            <div className="feature-card">
              <span className="feature-emoji">⭐</span>
              <h3>تقييمات حقيقية</h3>
              <p>آراء الطلاب تساعدك باختيار السكن الأفضل</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-section">
        <div className="section-container">
          <h2 className="section-heading">كيف تعمل المنصة؟</h2>
          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">1</span>
              <span className="step-emoji">🔍</span>
              <h3>ابحث</h3>
              <p>تصفّح العقارات المتاحة وفلتر حسب احتياجاتك</p>
            </div>
            <div className="step-card">
              <span className="step-number">2</span>
              <span className="step-emoji">📋</span>
              <h3>احجز</h3>
              <p>أرسل طلب حجز واتفق مع المالك</p>
            </div>
            <div className="step-card">
              <span className="step-number">3</span>
              <span className="step-emoji">🏠</span>
              <h3>اسكن</h3>
              <p>ادفع واستلم غرفتك</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>جاهز تلاقي سكنك؟</h2>
          <p>سجّل الآن مجاناً وابدأ البحث</p>
          <Link to="/register" className="btn-cta">
            ابدأ الآن
          </Link>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
