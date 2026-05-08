import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSearch, FiFilter, FiX, FiGrid, FiList } from "react-icons/fi";
import PropertyCard from "../components/property/PropertyCard";
import {
  PROPERTY_LEVEL_SERVICES,
  TARGET_GENDERS,
  PROPERTY_KINDS,
  ROOM_KINDS,
  CAMPUSES,
} from "../constants/property";
import { api } from "../utils/api";
import "./SearchPage.css";

const EMPTY_FILTERS = {
  searchQuery: "",
  city: "",
  minPrice: "",
  maxPrice: "",
  targetGender: "",
  kind: "",
  campus: "",
  roomKind: "",
  maxDistance: "",
  services: [],
};

function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    searchQuery: initialQuery,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('searchView') || 'grid');

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      api.properties
        .list({
          q: filters.searchQuery,
          city: filters.city,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          targetGender: filters.targetGender,
          kind: filters.kind,
          campus: filters.campus,
          roomKind: filters.roomKind,
          maxDistance: filters.maxDistance,
          services: filters.services,
        })
        .then((data) => setProperties(data.properties || []))
        .catch((err) => setError(err.message || "تعذر تحميل العقارات"))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(handle);
  }, [filters]);

  const setField = (name, value) =>
    setFilters((prev) => ({ ...prev, [name]: value }));

  const toggleService = (s) => {
    setFilters((prev) => ({
      ...prev,
      services: prev.services.includes(s)
        ? prev.services.filter((x) => x !== s)
        : [...prev.services, s],
    }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.city ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.targetGender ||
    filters.kind ||
    filters.campus ||
    filters.roomKind ||
    filters.maxDistance ||
    filters.services.length > 0;

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
              placeholder="ابحث عن اسم العقار او حي/المنطقة"
              value={filters.searchQuery}
              onChange={(e) => setField("searchQuery", e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter />
            <span>فلترة</span>
          </button>
          <div className="view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => { setViewMode('grid'); localStorage.setItem('searchView', 'grid'); }}><FiGrid /></button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => { setViewMode('list'); localStorage.setItem('searchView', 'list'); }}><FiList /></button>
          </div>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group">
              <label>الحي/المنطقة</label>
              <input
                type="text"
                placeholder="مثلاً: رفيديا"
                value={filters.city}
                onChange={(e) => setField("city", e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>نوع العقار</label>
              <select
                value={filters.kind}
                onChange={(e) => setField("kind", e.target.value)}
              >
                <option value="">الكل</option>
                {PROPERTY_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.icon} {k.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>الحرم الأقرب</label>
              <select
                value={filters.campus}
                onChange={(e) => setField("campus", e.target.value)}
              >
                <option value="">الكل</option>
                {CAMPUSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>أقصى مسافة عن الحرم (دقائق)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="مثلاً: 15"
                value={filters.maxDistance}
                onChange={(e) =>
                  setField("maxDistance", e.target.value.replace(/[^\d]/g, ""))
                }
                dir="ltr"
              />
            </div>

            <div className="filter-group">
              <label>السعر الأدنى (₪)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={filters.minPrice}
                onChange={(e) =>
                  setField("minPrice", e.target.value.replace(/[^\d]/g, ""))
                }
                dir="ltr"
              />
            </div>

            <div className="filter-group">
              <label>السعر الأعلى (₪)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="5000"
                value={filters.maxPrice}
                onChange={(e) =>
                  setField("maxPrice", e.target.value.replace(/[^\d]/g, ""))
                }
                dir="ltr"
              />
            </div>

            <div className="filter-group">
              <label>الجنس المستهدف</label>
              <select
                value={filters.targetGender}
                onChange={(e) => setField("targetGender", e.target.value)}
              >
                <option value="">الكل</option>
                {TARGET_GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>نوع الغرفة</label>
              <select
                value={filters.roomKind}
                onChange={(e) => setField("roomKind", e.target.value)}
                disabled={filters.kind === "STUDIO"}
              >
                <option value="">الكل</option>
                {ROOM_KINDS.map((rk) => (
                  <option key={rk.id} value={rk.id}>
                    {rk.icon} {rk.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group filter-group-services">
              <label>الخدمات</label>
              <div className="filter-services-grid">
                {PROPERTY_LEVEL_SERVICES.map((s) => (
                  <label key={s} className="filter-service-check">
                    <input
                      type="checkbox"
                      checked={filters.services.includes(s)}
                      onChange={() => toggleService(s)}
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                className="btn btn-sm clear-filters"
                onClick={clearFilters}
              >
                <FiX />
                مسح الفلاتر
              </button>
            )}
          </div>
        )}

        <div className="search-results-info">
          <span>
            {loading ? (
              "جاري التحميل..."
            ) : (
              <>
                تم العثور على <strong>{properties.length}</strong> نتيجة
              </>
            )}
          </span>
        </div>

        {error ? (
          <div className="no-results">
            <span className="no-results-icon">⚠️</span>
            <h3>تعذر تحميل النتائج</h3>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="no-results">
            <span className="no-results-icon">⏳</span>
            <p>جاري البحث عن السكنات المتاحة...</p>
          </div>
        ) : properties.length > 0 ? (
          <div className={`search-results-grid ${viewMode}`}>
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FiSearch size={36} color="#d1d5db" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>لم يتم العثور على نتائج</h3>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>جرب معايير بحث مختلفة</p>
            {hasActiveFilters && (
              <button className="btn btn-primary" onClick={clearFilters}>
                مسح الفلاتر
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
