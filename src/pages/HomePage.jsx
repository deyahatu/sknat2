import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiShield,
  FiDollarSign,
  FiMapPin,
  FiArrowLeft,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import PropertyCard from "../components/property/PropertyCard";
import { api } from "../utils/api";
import "./HomePage.css";

function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStudent = user?.role === "STUDENT";

  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.properties
      .list()
      .then((data) => setFeatured((data.properties || []).slice(0, 6)))
      .catch(() => setFeatured([]))
      .finally(() => setFeaturedLoading(false));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div className="page home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-shape hero-shape-1" />
          <div className="hero-shape hero-shape-2" />
          <div className="hero-shape hero-shape-3" />
        </div>

        <div className="container hero-content">
          {isStudent ? (
            <h1 className="hero-title">
              أهلاً <span className="hero-text-accent">{user.name}</span>
              <br />
              سكنك بانتظارك
            </h1>
          ) : (
            <h1 className="hero-title">ابحث عن سكنك الطلابي بسهولة</h1>
          )}

          <p className="hero-subtitle">
            منصة سكنات تربطك بأفضل خيارات السكن الطلابي القريبة من جامعة بأسعار
            مناسبة
          </p>

          {isStudent ? (
            <form className="hero-search" onSubmit={handleSearch}>
              <FiSearch />
              <input
                type="text"
                placeholder="ابحث باسم السكن أو المنطقة..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit">بحث</button>
            </form>
          ) : (
            <div className="hero-actions">
              <Link to="/search" className="hero-btn hero-btn-primary">
                ابدأ التصفّح
                <FiArrowLeft />
              </Link>
              <Link to="/register" className="hero-btn hero-btn-ghost">
                إنشاء حساب
              </Link>
            </div>
          )}
        </div>

        <div className="hero-scroll-hint">
          <span></span>
        </div>
      </section>

      {/* Features Section — guests only */}
      {!isStudent && (
        <section className="features-section">
          <div className="container">
            <h2 className="section-title" style={{ textAlign: "center" }}>
              لماذا سكنات؟
            </h2>
            <p className="section-subtitle" style={{ textAlign: "center" }}>
              نوفر لك تجربة سهلة وآمنة للبحث عن السكن الطلابي المناسب
            </p>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">
                  <FiSearch />
                </div>
                <h3>بحث سهل</h3>
                <p>
                  ابحث وقارن بين مئات الخيارات بفلاتر متقدمة تناسب احتياجاتك
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <FiShield />
                </div>
                <h3>مصداقية وأمان</h3>
                <p>جميع العقارات موثقة ومراجعة من فريقنا لضمان تجربة آمنة</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <FiDollarSign />
                </div>
                <h3>أسعار مناسبة</h3>
                <p>
                  خيارات متنوعة تناسب جميع الميزانيات مع شفافية كاملة في الأسعار
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <FiMapPin />
                </div>
                <h3>مواقع استراتيجية</h3>
                <p>عقارات قريبة من الجامعات والخدمات الأساسية والمواصلات</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Properties */}
      <section className="featured-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">عقارات مميزة</h2>
              <p className="section-subtitle">
                اكتشف أفضل خيارات السكن الطلابي المتاحة
              </p>
            </div>
            <Link to="/search" className="btn btn-outline">
              عرض الكل
            </Link>
          </div>
          {featuredLoading ? (
            <div
              style={{ textAlign: "center", padding: "40px 0", color: "#666" }}
            >
              جاري تحميل العقارات...
            </div>
          ) : featured.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "40px 0", color: "#666" }}
            >
              لا توجد عقارات متاحة حالياً.
            </div>
          ) : (
            <div className="properties-grid">
              {featured.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Owner CTA — guests only */}
      {!isStudent && (
        <section className="owner-cta-section">
          <div className="container owner-cta-content">
            <div>
              <h2>عندك سكن للإيجار؟</h2>
              <p>انضم إلى سكنات وابدأ بتأجير عقارك للطلاب بسهولة وأمان</p>
            </div>
            <Link to="/register" className="hero-btn hero-btn-white">
              سجّل كمالك
              <FiArrowLeft />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default HomePage;
