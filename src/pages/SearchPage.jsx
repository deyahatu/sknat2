import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSearch, FiFilter, FiX } from "react-icons/fi";
import PropertyCard from "../components/property/PropertyCard";
import {
  AVAILABLE_SERVICES,
  FIELD_LIMITS,
  TARGET_GENDERS,
} from "../constants/property";
import { findCanonical } from "../utils/text";
import { api } from "../utils/api";
import "./SearchPage.css";

const EMPTY_FILTERS = {
  searchQuery: "",
  city: "",
  minPrice: "",
  maxPrice: "",
  rooms: "",
  bathrooms: "",
  targetGender: "",
  services: [],
};

function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    searchQuery: initialQuery,
  });
  const [customServices, setCustomServices] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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
          rooms: filters.rooms,
          bathrooms: filters.bathrooms,
          targetGender: filters.targetGender,
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

  const handleCustomServiceKey = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = customInput.trim();
    if (!value) return;

    const canonicalPredefined = findCanonical(value, AVAILABLE_SERVICES);
    if (canonicalPredefined) {
      if (!filters.services.includes(canonicalPredefined)) {
        setFilters((prev) => ({
          ...prev,
          services: [...prev.services, canonicalPredefined],
        }));
      }
      setCustomInput("");
      return;
    }

    const canonicalCustom = findCanonical(value, customServices);
    if (canonicalCustom) {
      setCustomInput("");
      return;
    }

    setCustomServices((prev) => [...prev, value]);
    setFilters((prev) => ({ ...prev, services: [...prev.services, value] }));
    setCustomInput("");
  };

  const removeCustomService = (name) => {
    setCustomServices((prev) => prev.filter((s) => s !== name));
    setFilters((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s !== name),
    }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setCustomServices([]);
    setCustomInput("");
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.city ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.rooms ||
    filters.bathrooms ||
    filters.targetGender ||
    filters.services.length > 0;

  const roomOptions = Array.from(
    { length: FIELD_LIMITS.rooms },
    (_, i) => i + 1,
  );
  const bathroomOptions = Array.from(
    { length: FIELD_LIMITS.bathrooms },
    (_, i) => i + 1,
  );

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
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group">
              <label>الحي/المنطقة</label>
              <input
                type="text"
                placeholder="مثلاً:الحرم الجديد"
                value={filters.city}
                onChange={(e) => setField("city", e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>السعر الأدنى (₪)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={filters.minPrice}
                onChange={(e) => setField("minPrice", e.target.value.replace(/[^\d]/g, ""))}
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
                onChange={(e) => setField("maxPrice", e.target.value.replace(/[^\d]/g, ""))}
                dir="ltr"
              />
            </div>

            <div className="filter-group">
              <label>عدد الغرف</label>
              <select
                value={filters.rooms}
                onChange={(e) => setField("rooms", e.target.value)}
              >
                <option value="">الكل</option>
                {roomOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>عدد الحمامات</label>
              <select
                value={filters.bathrooms}
                onChange={(e) => setField("bathrooms", e.target.value)}
              >
                <option value="">الكل</option>
                {bathroomOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
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

            <div className="filter-group filter-group-services">
              <label>الخدمات</label>
              <div className="filter-services-grid">
                {AVAILABLE_SERVICES.map((s) => (
                  <label key={s} className="filter-service-check">
                    <input
                      type="checkbox"
                      checked={filters.services.includes(s)}
                      onChange={() => toggleService(s)}
                    />
                    <span>{s}</span>
                  </label>
                ))}
                {customServices.map((s) => (
                  <span key={s} className="filter-service-check filter-service-custom">
                    <span>{s}</span>
                    <button
                      type="button"
                      className="filter-service-remove"
                      onClick={() => removeCustomService(s)}
                      aria-label={`حذف ${s}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                className="filter-custom-input"
                placeholder="اكتب خدمة إضافية واضغط Enter"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value.replace(/[^؀-ۿa-zA-Z\s]/g, ""))}
                onKeyDown={handleCustomServiceKey}
              />
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
            {loading
              ? "جاري التحميل..."
              : (
                <>تم العثور على <strong>{properties.length}</strong> نتيجة</>
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
          <div className="search-results-grid">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="no-results">
            <span className="no-results-icon">🔍</span>
            <h3>لا توجد نتائج</h3>
            <p>حاول تعديل معايير البحث أو مسح الفلاتر</p>
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
