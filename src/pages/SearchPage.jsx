import { useState, useMemo } from 'react';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi';
import PropertyCard from '../components/property/PropertyCard';
import { properties, cities, propertyTypes } from '../data/properties';
import './SearchPage.css';

// TODO: connect API — replace mock data with real search endpoint
function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const matchesSearch =
        !searchQuery ||
        property.title.includes(searchQuery) ||
        property.district.includes(searchQuery) ||
        property.city.includes(searchQuery);

      const matchesCity = !selectedCity || property.city === selectedCity;
      const matchesType = !selectedType || property.type === selectedType;

      const matchesMinPrice =
        !priceRange.min || property.price >= Number(priceRange.min);
      const matchesMaxPrice =
        !priceRange.max || property.price <= Number(priceRange.max);

      return matchesSearch && matchesCity && matchesType && matchesMinPrice && matchesMaxPrice;
    });
  }, [searchQuery, selectedCity, selectedType, priceRange]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedType('');
    setPriceRange({ min: '', max: '' });
  };

  const hasActiveFilters = searchQuery || selectedCity || selectedType || priceRange.min || priceRange.max;

  return (
    <div className="page search-page">
      <div className="container">
        <div className="search-header">
          <h1>البحث عن سكن طلابي</h1>
          <p>تصفح جميع الخيارات المتاحة واستخدم الفلاتر لتضييق البحث</p>
        </div>

        <div className="search-bar">
          <div className="search-bar-input">
            <FiSearch className="search-bar-icon" />
            <input
              type="text"
              placeholder="ابحث بالمدينة، الحي، أو اسم العقار..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter />
            <span>فلترة</span>
          </button>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group">
              <label>المدينة</label>
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="">جميع المدن</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>نوع السكن</label>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="">جميع الأنواع</option>
                {propertyTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>السعر الأدنى (₪)</label>
              <input
                type="number"
                placeholder="0"
                value={priceRange.min}
                onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                dir="ltr"
              />
            </div>

            <div className="filter-group">
              <label>السعر الأعلى (₪)</label>
              <input
                type="number"
                placeholder="5000"
                value={priceRange.max}
                onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                dir="ltr"
              />
            </div>

            {hasActiveFilters && (
              <button className="btn btn-sm clear-filters" onClick={clearFilters}>
                <FiX />
                مسح الفلاتر
              </button>
            )}
          </div>
        )}

        <div className="search-results-info">
          <span>تم العثور على <strong>{filteredProperties.length}</strong> نتيجة</span>
        </div>

        {filteredProperties.length > 0 ? (
          <div className="search-results-grid">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="no-results">
            <span className="no-results-icon">🔍</span>
            <h3>لا توجد نتائج</h3>
            <p>حاول تعديل معايير البحث أو مسح الفلاتر</p>
            <button className="btn btn-primary" onClick={clearFilters}>
              مسح الفلاتر
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
