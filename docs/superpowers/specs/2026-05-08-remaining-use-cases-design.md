# Remaining Use Cases Design Spec

**Date:** 2026-05-08
**Project:** Sakanat (sknat2)
**Scope:** UC-34 (Complaints), UC-41 (Report Comment), UC-42 (Live Chat), UC-44 (In-app Notifications)

---

## UC-41: Report Comment (بلاغ تقييم)

### Data Model

```prisma
model Report {
  id          String       @id @default(uuid())
  type        String       @default("REVIEW") // REVIEW only for now
  targetId    String       // reviewId
  reporterId  String
  reason      ReportReason
  details     String?
  status      ReportStatus @default(PENDING)
  adminNote   String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  reporter User @relation(fields: [reporterId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([reporterId])
  @@map("reports")
}

enum ReportReason {
  OFFENSIVE    // محتوى مسيء
  INCORRECT    // معلومات خاطئة
  SPAM         // سبام
}

enum ReportStatus {
  PENDING
  REVIEWED
  DISMISSED
}
```

Add to User model: `reports Report[]`

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reports` | Student/Owner | Create report `{ type, targetId, reason, details? }` |
| GET | `/api/reports` | Admin | List all reports (filter by status) |
| PATCH | `/api/reports/:id/review` | Admin | Review report `{ action: 'delete_review' \| 'dismiss', adminNote? }` |

### Frontend

- **PropertyDetailsPage.jsx:** 🚩 button next to each review → modal with reason select + optional details
- **AdminDashboard.jsx:** New tab "بلاغات التقييمات" — table: reporter, review excerpt, reason, status, actions (delete review / dismiss)

---

## UC-34: Manage Complaints (شكاوى)

### Data Model

```prisma
model Complaint {
  id            String          @id @default(uuid())
  userId        String
  userName      String
  type          ComplaintType
  subject       String
  description   String
  image         String?         @db.Text
  status        ComplaintStatus  @default(OPEN)
  adminResponse String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@map("complaints")
}

enum ComplaintType {
  ACCOMMODATION  // مشكلة بالسكن
  USER           // مشكلة مع مستخدم
  TECHNICAL      // مشكلة تقنية
  OTHER          // أخرى
}

enum ComplaintStatus {
  OPEN           // مفتوحة
  IN_REVIEW      // قيد المراجعة
  RESOLVED       // محلولة
  REJECTED       // مرفوضة
}
```

Add to User model: `complaints Complaint[]`

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/complaints` | Student/Owner | Create complaint `{ type, subject, description, image? }` |
| GET | `/api/complaints/mine` | Student/Owner | My complaints |
| GET | `/api/complaints` | Admin | All complaints (filter by status, type) |
| PATCH | `/api/complaints/:id` | Admin | Update status + response `{ status, adminResponse? }` |

### Frontend

**Student/Owner:**
- Page: `/complaints` — list my complaints + "تقديم شكوى" button
- Form: type select + subject + description textarea + image upload (optional)
- Each complaint shows status badge + admin response if exists

**Admin:**
- Tab "الشكاوى" in AdminDashboard
- Table: user, type, subject, status, date, actions
- Filter by status + type
- Click → expand details + reply form

---

## UC-42: Live Chat (socket.io upgrade)

### Architecture

Upgrade existing Message system (HTTP-only) to real-time using socket.io.

**No schema changes.** Uses existing `Message` model.

### Server Changes

**Dependencies:** `socket.io`

**`server/src/index.js`:**
- Create HTTP server from express app
- Attach `socket.io` server with CORS config
- On connection: authenticate via token cookie/handshake
- Join user to room `user_<userId>`
- Track online users in memory Map

**`server/src/utils/socket.js`:**
```js
// Singleton io instance
let io = null;
export function setIO(ioInstance) { io = ioInstance; }
export function getIO() { return io; }
export function emitToUser(userId, event, data) {
  if (io) io.to(`user_${userId}`).emit(event, data);
}
```

**`server/src/routes/messages.js`:**
- After POST message: `emitToUser(receiverId, 'new_message', message)`
- Typing: handled client-side via socket directly

### Client Changes

**`src/utils/socket.js`:**
```js
// Singleton socket connection
import { io } from 'socket.io-client';
let socket = null;
export function connectSocket(token) {
  if (socket) return socket;
  socket = io('/', { auth: { token }, withCredentials: true });
  return socket;
}
export function getSocket() { return socket; }
export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
```

**`src/components/shared/MessagesChat.jsx`:**
- On mount: subscribe to `new_message` → auto-append
- On mount: subscribe to `typing` → show indicator
- On input change: emit `typing` event (debounced)
- On unmount: cleanup listeners

**Events:**
| Event | Direction | Data |
|-------|-----------|------|
| `new_message` | server→client | `{ message }` |
| `typing` | client→server→client | `{ senderId, receiverId }` |
| `stop_typing` | client→server→client | `{ senderId, receiverId }` |
| `online_users` | server→client | `[userId, ...]` |

---

## UC-44: In-app Notifications

### Data Model

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  title     String
  body      String
  url       String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
  @@map("notifications")
}
```

Add to User model: `notifications Notification[]`

### Notification Helper

**`server/src/utils/notify.js`:**
```js
import prisma from './prisma.js';
import { sendPushToUser } from './push.js';
import { emitToUser } from './socket.js';

export async function notify(userId, title, body, url) {
  const notification = await prisma.notification.create({
    data: { userId, title, body, url },
  });
  // Push notification (fire-and-forget)
  sendPushToUser(userId, title, body, url).catch(() => {});
  // Real-time socket event
  emitToUser(userId, 'notification', notification);
  return notification;
}
```

### Events That Trigger Notifications

| Event | Recipient | Title | Body |
|-------|-----------|-------|------|
| New booking request | Owner | طلب حجز جديد | "طالب جديد يريد حجز غرفة" |
| Booking accepted | Student | تم قبول حجزك | "تم قبول طلب حجزك" |
| Booking rejected | Student | تم رفض حجزك | "تم رفض طلب حجزك" |
| Booking completed | Student | اكتمل حجزك | "تم إكمال حجزك" |
| Payment received | Owner | دفعة جديدة | "تم استلام دفعة" |
| New message | Receiver | رسالة جديدة | "لديك رسالة جديدة" |
| Complaint reply | User | رد على شكواك | "تم الرد على شكواك" |
| New review | Owner | تقييم جديد | "تقييم جديد على عقارك" |

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Auth | My notifications (paginated, newest first) |
| GET | `/api/notifications/unread-count` | Auth | `{ count: N }` |
| PATCH | `/api/notifications/read-all` | Auth | Mark all as read |
| PATCH | `/api/notifications/:id/read` | Auth | Mark one as read |

### Frontend

**Navbar (all roles):**
- 🔔 bell icon with red badge showing unread count
- Click → dropdown with last 10 notifications
- Each notification: title, body, time ago, click → navigate to url
- "عرض الكل" link → `/notifications` page
- Poll unread count every 30s OR use socket `notification` event

**Notifications Page (`/notifications`):**
- Full list of all notifications
- Unread highlighted
- Click → mark as read + navigate

---

## Implementation Order

1. **Notification model + helper** (dependency for all others)
2. **Socket.io setup** (dependency for live chat + real-time notifications)
3. **Report Comment** (standalone, simple)
4. **Complaints** (standalone, medium)
5. **Live Chat upgrade** (uses socket)
6. **In-app Notification UI** (uses notification model + socket)

---

## Files Changed Summary

### New Files
- `server/src/routes/reports.js`
- `server/src/routes/complaints.js`
- `server/src/routes/notifications.js`
- `server/src/utils/notify.js`
- `server/src/utils/socket.js`
- `src/utils/socket.js`
- `src/pages/student/Complaints.jsx`
- `src/pages/Notifications.jsx`
- `src/components/shared/NotificationBell.jsx`

### Modified Files
- `server/prisma/schema.prisma` — 4 new models + enums
- `server/src/index.js` — socket.io server setup
- `server/src/routes/messages.js` — emit socket events
- `server/src/routes/bookings.js` — replace push calls with notify()
- `server/src/routes/payments.js` — add notify()
- `server/src/routes/reviews.js` — add notify()
- `server/src/routes/complaints.js` — add notify() on admin reply
- `src/utils/api.js` — add reports, complaints, notifications methods
- `src/App.jsx` — add routes
- `src/components/layout/Navbar.jsx` — add NotificationBell + complaints link
- `src/components/shared/MessagesChat.jsx` — socket.io integration
- `src/pages/AdminDashboard.jsx` — add complaints + reports tabs
- `src/pages/PropertyDetailsPage.jsx` — add report button on reviews
