import { Link } from 'react-router-dom';
import { FiSearch, FiShield, FiDollarSign, FiMapPin } from 'react-icons/fi';
import PropertyCard from '../components/property/PropertyCard';
import { properties } from '../data/properties';
import './HomePage.css';

function HomePage() {
  const featuredProperties = properties.filter((p) => p.isFeatured);

  return (
    <div className="page home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-overlay" />
        <div className="container hero-content">
          <h1 className="hero-title">ابحث عن سكنك الطلابي بسهولة</h1>
          <p className="hero-subtitle">
            منصة سكنات تربطك بأفضل خيارات السكن الطلابي القريبة من جامعتك بأسعار مناسبة
          </p>
          <div className="hero-search">
            <div className="hero-search-box">
              <FiSearch className="hero-search-icon" />
              <input
                type="text"
                placeholder="ابحث بالمدينة أو الحي أو اسم الجامعة..."
                className="hero-search-input"
              />
              <Link to="/search" className="btn btn-primary">
                بحث
              </Link>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-number">+500</span>
              <span className="hero-stat-label">عقار متاح</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-number">+1200</span>
              <span className="hero-stat-label">طالب مسجل</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-number">+50</span>
              <span className="hero-stat-label">مدينة</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center' }}>لماذا سكنات؟</h2>
          <p className="section-subtitle" style={{ textAlign: 'center' }}>
            نوفر لك تجربة سهلة وآمنة للبحث عن السكن الطلابي المناسب
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FiSearch />
              </div>
              <h3>بحث سهل</h3>
              <p>ابحث وقارن بين مئات الخيارات بفلاتر متقدمة تناسب احتياجاتك</p>
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
              <p>خيارات متنوعة تناسب جميع الميزانيات مع شفافية كاملة في الأسعار</p>
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

      {/* Featured Properties */}
      <section className="featured-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">عقارات مميزة</h2>
              <p className="section-subtitle">اكتشف أفضل خيارات السكن الطلابي المتاحة</p>
            </div>
            <Link to="/search" className="btn btn-outline">
              عرض الكل
            </Link>
          </div>
          <div className="properties-grid">
            {featuredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container cta-content">
          <h2>هل أنت مالك عقار؟</h2>
          <p>انضم إلى سكنات وابدأ بتأجير عقارك للطلاب بسهولة وأمان</p>
          <Link to="/register" className="btn btn-primary btn-lg">
            سجّل كمالك عقار
          </Link>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
