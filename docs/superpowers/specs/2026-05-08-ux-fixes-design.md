# UX Fixes — Design Spec

**Date:** 2026-05-08
**Project:** Sakanat (sknat2)
**Scope:** Replace browser dialogs with styled components, add skeleton loaders, fix silent errors

---

## 1. Replace all `alert()` with Toast (15 locations)

Toast system already exists (`useToast()` hook from `src/components/shared/Toast.jsx`).

**Pattern:** In each file:
1. Import `{ useToast }` from Toast
2. Add `const toast = useToast();` inside component
3. Replace `alert('خطأ: ' + msg)` → `toast.error(msg)`
4. Replace `alert('تم ...')` → `toast.success('تم ...')`

**Files to fix:**

| File | alert() count | Notes |
|------|--------------|-------|
| `src/pages/AdminDashboard.jsx` | 11 | All error alerts in tabs |
| `src/components/shared/MessagesChat.jsx` | 1 | Message send error |
| `src/pages/student/MyBookings.jsx` | 1 | Invoice download fail |
| `src/pages/PropertyDetailsPage.jsx` | 2 | Report submit success/error |

---

## 2. Replace all `window.confirm()` / `window.prompt()` with ConfirmModal (12 locations)

### ConfirmModal Component

**File:** `src/components/shared/ConfirmModal.jsx`

- Props: `open`, `title`, `message`, `confirmText`, `cancelText`, `onConfirm`, `onCancel`, `variant` ('danger' | 'warning' | 'info'), `inputMode` (boolean — shows textarea for prompt replacement)
- Overlay: dark backdrop, centered card
- Card: icon (based on variant), title, message, optional textarea input, two buttons
- Danger variant: red confirm button
- Warning variant: yellow confirm button
- `inputMode`: shows textarea, passes value to `onConfirm(value)`
- Keyboard: Escape = cancel, Enter = confirm (unless inputMode)

### Usage Pattern

Replace:
```jsx
if (!window.confirm('حذف؟')) return;
await doDelete();
```

With state:
```jsx
const [confirmState, setConfirmState] = useState({ open: false, action: null });

function confirmDelete(id) {
  setConfirmState({ open: true, action: () => doDelete(id) });
}

<ConfirmModal
  open={confirmState.open}
  title="تأكيد الحذف"
  message="هل أنت متأكد؟ لا يمكن التراجع."
  confirmText="حذف"
  variant="danger"
  onConfirm={() => { confirmState.action?.(); setConfirmState({ open: false }); }}
  onCancel={() => setConfirmState({ open: false })}
/>
```

For `prompt()` replacements, use `inputMode`:
```jsx
<ConfirmModal
  open={...}
  title="سبب الرفض"
  inputMode
  confirmText="رفض"
  variant="warning"
  onConfirm={(reason) => rejectWithReason(reason)}
  onCancel={...}
/>
```

**Files to fix:**

| File | confirm/prompt count |
|------|---------------------|
| `src/pages/AdminDashboard.jsx` | 8 confirm + 2 prompt |
| `src/pages/owner/OwnerProperties.jsx` | 1 confirm |
| `src/pages/owner/AddEditProperty.jsx` | 1 confirm |
| `src/pages/owner/BankAccount.jsx` | 1 confirm |

---

## 3. Replace "جاري التحميل..." with Skeleton (15 locations)

Skeleton component already exists (`src/components/shared/Skeleton.jsx` with `Skeleton` and `SkeletonCard`).

**Pattern per page type:**

**Table pages (admin tabs):**
```jsx
if (loading) return (
  <div style={{ padding: 20 }}>
    <Skeleton height={40} style={{ marginBottom: 16 }} />
    <Skeleton height={20} count={5} />
  </div>
);
```

**Card grid pages (properties, bookings):**
```jsx
if (loading) return (
  <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
    {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
  </div>
);
```

**Single content pages (profile, bank account):**
```jsx
if (loading) return (
  <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
    <Skeleton height={80} circle style={{ margin: '0 auto 16px' }} />
    <Skeleton height={20} width="60%" />
    <Skeleton height={16} count={4} />
  </div>
);
```

**Files to fix:**

| File | Type |
|------|------|
| `src/pages/AdminDashboard.jsx` (4 tabs) | Table |
| `src/pages/owner/OwnerProperties.jsx` | Card grid |
| `src/pages/owner/OwnerBookings.jsx` | Card list |
| `src/pages/owner/OwnerDashboard.jsx` | Stats cards |
| `src/pages/owner/ManageProfile.jsx` | Single content |
| `src/pages/owner/BankAccount.jsx` | Single content |
| `src/pages/owner/RateStudents.jsx` | Table |
| `src/pages/owner/OwnerRatings.jsx` | Table |
| `src/pages/owner/Withdrawals.jsx` | Table |
| `src/pages/Complaints.jsx` | Card list |
| `src/pages/Notifications.jsx` | List |
| `src/components/shared/MessagesChat.jsx` (2 spots) | Chat |

---

## 4. Fix silent `.catch(() => {})` (10 locations)

Replace silent catches with toast error where appropriate:

| File | Fix |
|------|-----|
| `src/components/shared/NotificationBell.jsx` (5) | Keep silent — polling, not user action |
| `src/pages/Notifications.jsx` (3) | Keep silent for load, toast for actions |
| `src/pages/owner/BankAccount.jsx` (1) | Toast error |
| `src/pages/AdminDashboard.jsx` (1) | Keep silent — stats poll |

Only fix user-initiated actions. Polling/background fetches stay silent.

---

## 5. Add `className="page"` to missing pages

Pages without `.page` class don't get fadeIn animation.

| File | Fix |
|------|-----|
| `src/pages/Complaints.jsx` | Add `className="page"` to wrapper div |
| `src/pages/Notifications.jsx` | Add `className="page"` to wrapper div |

---

## Implementation Order

1. Create ConfirmModal component
2. Replace alert() → toast (all files)
3. Replace confirm()/prompt() → ConfirmModal (all files)
4. Replace loading text → Skeleton (all files)
5. Fix silent catches + add page class

---

## Files Summary

### New Files
- `src/components/shared/ConfirmModal.jsx`

### Modified Files (by frequency)
- `src/pages/AdminDashboard.jsx` — alert→toast (11), confirm→modal (8), prompt→modal (2), loading→skeleton (4)
- `src/pages/owner/OwnerProperties.jsx` — confirm→modal (1), loading→skeleton (1)
- `src/pages/owner/AddEditProperty.jsx` — confirm→modal (1)
- `src/pages/owner/BankAccount.jsx` — confirm→modal (1), loading→skeleton (1), catch fix (1)
- `src/pages/owner/OwnerBookings.jsx` — loading→skeleton (1)
- `src/pages/owner/OwnerDashboard.jsx` — loading→skeleton (1)
- `src/pages/owner/ManageProfile.jsx` — loading→skeleton (1)
- `src/pages/owner/RateStudents.jsx` — loading→skeleton (1)
- `src/pages/owner/OwnerRatings.jsx` — loading→skeleton (1)
- `src/pages/owner/Withdrawals.jsx` — loading→skeleton (1)
- `src/pages/student/MyBookings.jsx` — alert→toast (1)
- `src/pages/PropertyDetailsPage.jsx` — alert→toast (2)
- `src/pages/Complaints.jsx` — loading→skeleton (1), page class (1)
- `src/pages/Notifications.jsx` — loading→skeleton (1), page class (1)
- `src/components/shared/MessagesChat.jsx` — alert→toast (1), loading→skeleton (2)
