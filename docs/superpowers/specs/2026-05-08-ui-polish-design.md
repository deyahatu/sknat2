# UI Polish & Premium UX — Design Spec

**Date:** 2026-05-08
**Project:** Sakanat (sknat2)
**Scope:** 18 UI improvements for premium look & feel

---

## 1. Toast Notification System

**File:** `src/components/shared/Toast.jsx`

- React Context + Provider wrapping App
- `useToast()` hook → `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`
- Position: bottom-left (RTL), auto-dismiss 4s
- Slide-in animation from bottom, fade-out on dismiss
- Stack max 3 toasts
- Replace ALL `alert()` calls across the project

---

## 2. Loading Skeletons

**File:** `src/components/shared/Skeleton.jsx`

- Props: `width`, `height`, `count`, `circle` (boolean), `className`
- CSS shimmer: `@keyframes shimmer` — gradient moving left→right
- Light gray base (`#e5e7eb`), shimmer highlight (`#f3f4f6`)
- Replace ALL "جاري التحميل..." text with skeleton layouts
- Skeleton variants: `SkeletonCard` (property card shape), `SkeletonTable` (table rows), `SkeletonText` (paragraph lines)

---

## 3. Button Loading States

- Spinner SVG inside button replacing text when loading
- CSS class `.btn-loading` — adds spinner, keeps button same width
- Apply to all submit/action buttons that have loading state
- Spinner: 16px circular, white on primary buttons, gray on outline

---

## 4. 404 Not Found Page

**File:** `src/pages/NotFound.jsx`

- Large `FiAlertCircle` icon (size 64) in light circle background
- Title: "الصفحة غير موجودة"
- Subtitle: "الرابط الذي اتبعته غير صحيح أو أن الصفحة قد حُذفت"
- CTA button: "العودة للرئيسية" → `/`
- Route: `<Route path="*" element={<NotFound />} />` as last route

---

## 5. PropertyCard Hover Effects

**Modify:** `src/components/property/PropertyCard.css`

- Card: `transition: transform 0.3s ease, box-shadow 0.3s ease`
- Hover: `transform: translateY(-6px)`, `box-shadow: 0 12px 24px rgba(0,0,0,0.12)`
- Image container: `overflow: hidden`
- Image hover: `transform: scale(1.05)`, `transition: transform 0.4s ease`

---

## 6. Search View Toggle (Grid/List)

**Modify:** `src/pages/SearchPage.jsx` + `SearchPage.css`

- Toggle button group: grid icon / list icon
- Grid view: current layout (cards grid)
- List view: horizontal card — image left (160px), details right
- View preference saved in `localStorage('searchView')`
- Smooth transition between views

---

## 7. Image Lightbox

**File:** `src/components/shared/Lightbox.jsx`

- Full-screen overlay (`position: fixed; inset: 0; z-index: 9999`)
- Dark backdrop (`rgba(0,0,0,0.9)`)
- Current image centered, max-width/max-height 90vh/90vw
- Arrow buttons (left/right) for navigation
- Close button (X) top-left
- Keyboard: Escape=close, ArrowLeft/Right=navigate
- Click backdrop = close
- Used in `PropertyDetailsPage` gallery thumbnails

---

## 8. Empty States with Icons

All empty states use react-icons (Feather) at size 48, color `#d1d5db`, inside a `80px` circle with `#f9fafb` background.

| Page | Icon | Title | CTA |
|------|------|-------|-----|
| MyBookings | `FiCalendar` | ما عندك حجوزات بعد | ابحث عن سكن |
| Favorites | `FiHeart` | ما ضفت شي للمفضلة | تصفح العقارات |
| Messages | `FiMessageSquare` | لا يوجد محادثات | — |
| Notifications | `FiBell` | لا يوجد إشعارات | — |
| OwnerProperties | `FiHome` | لا توجد عقارات | أضف عقارك الأول |
| OwnerBookings | `FiCalendar` | لا توجد حجوزات | — |
| Complaints | `FiAlertCircle` | لا توجد شكاوى | — |
| Search (no results) | `FiSearch` | لم يتم العثور على نتائج | جرب معايير بحث مختلفة |

---

## 9. Page Transitions

**Modify:** `src/index.css`

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.page { animation: fadeIn 0.3s ease; }
```

No libraries. Pure CSS on existing `.page` class.

---

## 10. Animated Counters

**File:** `src/components/shared/AnimatedCounter.jsx`

- Props: `end` (target number), `duration` (default 1.5s), `prefix`, `suffix`
- `requestAnimationFrame` loop, easeOutQuad
- `IntersectionObserver` — only animate when visible
- Used in: HomePage stats section, OwnerDashboard stats, AdminDashboard stats

---

## 11. Navbar Scroll Effect

**Modify:** `src/components/layout/Navbar.jsx` + `Navbar.css`

- `useEffect` with scroll listener
- On `scrollY > 20`: add class `.navbar-scrolled`
- `.navbar-scrolled`: `backdrop-filter: blur(12px)`, `background: rgba(255,255,255,0.85)`, `box-shadow: 0 2px 12px rgba(0,0,0,0.08)`
- Smooth `transition: all 0.3s ease`

---

## 12. Micro-interactions

**Modify:** `src/index.css` (global)

- `.btn:active { transform: scale(0.97); }` — all buttons
- Card entrance stagger:
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
```
- Apply with `animation-delay` per card index (inline style `style={{ animationDelay: `${i * 0.05}s` }}`)
- Status badge pulse on PENDING: `@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.6 } }`

---

## 13. Inline Form Validation

**Pattern:** Per-field error state

- Each form field gets `error` string state
- On blur: validate field, set error
- Display: red border (`border-color: #dc2626`) + error text below (`color: #dc2626; font-size: 12px`)
- Clear error on input change
- Apply to: LoginPage, RegisterPage, AddEditProperty, PaymentPage, Complaints form

---

## 14. Booking Status Timeline

**File:** `src/components/shared/StatusTimeline.jsx`

- Props: `status` (current booking status), `hasPayment`
- Horizontal line with 4-5 circles: معلق → مقبول → مدفوع → مكتمل
- Past steps: green circle + ✓
- Current step: blue circle + pulse
- Future steps: gray circle
- CANCELLED: red X on current step, gray line after
- REJECTED: red X on step 2
- Used in: MyBookings cards, booking detail view

---

## 15. Avatar Upload Preview

**Modify:** `src/pages/student/ProfilePage.jsx`, `src/pages/owner/ManageProfile.jsx`

- Circular avatar (80px) showing current image or initial letter
- Click → hidden file input triggers
- On file select: FileReader → preview immediately in circle
- Submit with form saves base64 to server
- Hover effect: overlay with camera icon

---

## 16. Gradient Text

**Add to:** `src/index.css`

```css
.gradient-text {
  background: linear-gradient(135deg, #4f46e5, #0891b2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

Apply to: hero title, section headings in HomePage, admin dashboard title.

---

## 17. Favicon + Meta Tags

**Modify:** `index.html`

- Generate proper favicon from 🏠 or design simple house icon
- Sizes: `favicon.ico` (32x32), `apple-touch-icon.png` (180x180), `icon-192.png`, `icon-512.png`
- OG meta tags:
  - `og:title` = "سكنات — منصة السكن الطلابي"
  - `og:description` = "ابحث عن سكنك الطلابي المثالي في فلسطين"
  - `og:type` = "website"
  - `og:image` = "/og-image.png" (1200x630 social preview)
- `<meta name="theme-color" content="#1e1b4b">`
- `<meta name="description" content="...">`

---

## 18. Print Invoice Enhancement

**Modify:** `handleDownloadInvoice` in `src/pages/student/MyBookings.jsx`

- Logo "سكنات" at top center
- Invoice number large + bold
- Structured table: وصف | المبلغ
- Rows: السكن، الغرفة، الفترة، السعر الشهري، الإجمالي
- `@media print`: hide browser chrome, clean margins
- Footer: "منصة سكنات للسكن الطلابي — فاتورة إلكترونية"

---

## Implementation Order

1. **Shared components first:** Toast, Skeleton, AnimatedCounter, Lightbox, StatusTimeline, NotFound
2. **Global CSS:** gradient-text, fadeIn, fadeInUp, micro-interactions, navbar scroll
3. **Page-specific:** PropertyCard hover, Search toggle, Empty states, Inline validation
4. **Polish:** Avatar upload, Favicon/meta, Print invoice, Button loading

---

## Files Summary

### New Files
- `src/components/shared/Toast.jsx`
- `src/components/shared/Skeleton.jsx`
- `src/components/shared/Lightbox.jsx`
- `src/components/shared/AnimatedCounter.jsx`
- `src/components/shared/StatusTimeline.jsx`
- `src/pages/NotFound.jsx`

### Modified Files
- `src/index.css` — animations, gradient-text, micro-interactions
- `src/App.jsx` — Toast provider, 404 route
- `src/components/layout/Navbar.jsx` + `Navbar.css` — scroll effect
- `src/components/property/PropertyCard.css` — hover effects
- `src/pages/SearchPage.jsx` + `SearchPage.css` — view toggle
- `src/pages/PropertyDetailsPage.jsx` — lightbox integration
- `src/pages/student/MyBookings.jsx` — timeline, empty state, invoice
- `src/pages/student/Favorites.jsx` — empty state
- `src/pages/student/Messages.jsx` — empty state
- `src/pages/student/ProfilePage.jsx` — avatar upload
- `src/pages/owner/ManageProfile.jsx` — avatar upload
- `src/pages/owner/OwnerProperties.jsx` — empty state
- `src/pages/owner/OwnerBookings.jsx` — empty state
- `src/pages/Complaints.jsx` — empty state
- `src/pages/Notifications.jsx` — empty state
- `src/pages/LoginPage.jsx` — inline validation, toast
- `src/pages/RegisterPage.jsx` — inline validation, toast
- `src/pages/HomePage.jsx` — animated counters, gradient text
- `src/pages/AdminDashboard.jsx` — animated counters, skeletons
- `src/pages/owner/OwnerDashboard.jsx` — animated counters
- `index.html` — favicon, meta tags
- Multiple pages — replace `alert()` with `toast()`
