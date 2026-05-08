# Remaining Use Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 remaining use cases: Notification system, Socket.io live chat, Report Comment, and Complaints management.

**Architecture:** Notification model + helper centralize all alerts. Socket.io upgrades existing messaging to real-time. Reports and Complaints are independent CRUD modules. Implementation order: Notifications schema → Socket.io → Reports → Complaints → Notification UI (bell + page) → wire notify() calls everywhere.

**Tech Stack:** Express, Prisma, PostgreSQL, socket.io, React, Vite

---

## File Map

### Notification System (UC-44)
- Modify: `server/prisma/schema.prisma` (Notification model + Report/Complaint models + enums)
- Create: `server/src/utils/notify.js`
- Create: `server/src/routes/notifications.js`
- Create: `src/components/shared/NotificationBell.jsx`
- Create: `src/pages/Notifications.jsx`

### Socket.io (UC-42)
- Create: `server/src/utils/socket.js`
- Create: `src/utils/socket.js`
- Modify: `server/src/index.js` (http.createServer + socket.io attach)
- Modify: `server/src/routes/messages.js` (emit on send)
- Modify: `src/components/shared/MessagesChat.jsx` (subscribe to events)

### Report Comment (UC-41)
- Create: `server/src/routes/reports.js`
- Modify: `src/pages/PropertyDetailsPage.jsx` (report button on reviews)

### Complaints (UC-34)
- Create: `server/src/routes/complaints.js`
- Create: `src/pages/Complaints.jsx`

### Wiring
- Modify: `server/src/index.js` (register new routes)
- Modify: `src/utils/api.js` (add API methods)
- Modify: `src/App.jsx` (add routes)
- Modify: `src/components/layout/Navbar.jsx` (NotificationBell + complaints)
- Modify: `src/components/owner/OwnerSidebar.jsx` (complaints link)
- Modify: `src/pages/AdminDashboard.jsx` (reports + complaints tabs)
- Modify: `server/src/routes/bookings.js` (replace push with notify)
- Modify: `server/src/routes/payments.js` (add notify)
- Modify: `server/src/routes/reviews.js` (add notify)

---

## Task 1: Schema — Add all new models + enums

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add enums and models to schema**

Add before the closing of schema.prisma:

```prisma
enum ReportReason {
  OFFENSIVE
  INCORRECT
  SPAM
}

enum ReportStatus {
  PENDING
  REVIEWED
  DISMISSED
}

enum ComplaintType {
  ACCOMMODATION
  USER_ISSUE
  TECHNICAL
  OTHER
}

enum ComplaintStatus {
  OPEN
  IN_REVIEW
  RESOLVED
  REJECTED
}

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

model Report {
  id         String       @id @default(uuid())
  type       String       @default("REVIEW")
  targetId   String
  reporterId String
  reason     ReportReason
  details    String?
  status     ReportStatus @default(PENDING)
  adminNote  String?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  reporter User @relation(fields: [reporterId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([reporterId])
  @@map("reports")
}

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
```

Add to User model these relations:
```prisma
notifications Notification[]
reports       Report[]
complaints    Complaint[]
```

- [ ] **Step 2: Push schema + regenerate**

```bash
cd /Users/mahdy/Desktop/sknat2/server && npx prisma db push && npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mahdy/Desktop/sknat2
git add server/prisma/schema.prisma
git commit -m "feat: add Notification, Report, Complaint models and enums"
```

---

## Task 2: Notification helper + routes

**Files:**
- Create: `server/src/utils/notify.js`
- Create: `server/src/routes/notifications.js`
- Modify: `server/src/index.js`
- Modify: `src/utils/api.js`

- [ ] **Step 1: Create notify helper**

```js
// server/src/utils/notify.js
import prisma from './prisma.js';
import { sendPushToUser } from './push.js';

export async function notify(userId, title, body, url) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, title, body, url },
    });
    sendPushToUser(userId, title, body, url).catch(() => {});
    return notification;
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
}
```

Note: `emitToUser` will be added in Task 4 (socket.io). For now, notify creates DB record + push only.

- [ ] **Step 2: Create notifications route**

```js
// server/src/routes/notifications.js
import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// My notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

// Unread count
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// Mark all read
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'تم قراءة جميع الإشعارات.' });
  } catch (err) {
    next(err);
  }
});

// Mark one read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json({ message: 'تم.' });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 3: Register route in index.js**

Read `server/src/index.js`, add:
```js
import notificationRoutes from './routes/notifications.js';
// ...
app.use('/api/notifications', notificationRoutes);
```

- [ ] **Step 4: Add API methods**

Read `src/utils/api.js`, add to exports:
```js
notifications: {
  list: () => request('/notifications'),
  unreadCount: () => request('/notifications/unread-count'),
  readAll: () => request('/notifications/read-all', { method: 'PATCH' }),
  read: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
},
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mahdy/Desktop/sknat2
git add server/src/utils/notify.js server/src/routes/notifications.js server/src/index.js src/utils/api.js
git commit -m "feat: add notification system — helper, routes, API methods"
```

---

## Task 3: Report Comment (UC-41)

**Files:**
- Create: `server/src/routes/reports.js`
- Modify: `server/src/index.js`
- Modify: `src/utils/api.js`
- Modify: `src/pages/PropertyDetailsPage.jsx`
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Create reports route**

```js
// server/src/routes/reports.js
import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Create report
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { type, targetId, reason, details } = req.body;
    if (!targetId || !reason) {
      return res.status(400).json({ error: 'يرجى تحديد السبب.' });
    }

    const existing = await prisma.report.findFirst({
      where: { targetId, reporterId: req.user.id },
    });
    if (existing) {
      return res.status(400).json({ error: 'لقد أبلغت عن هذا المحتوى مسبقاً.' });
    }

    const report = await prisma.report.create({
      data: {
        type: type || 'REVIEW',
        targetId,
        reporterId: req.user.id,
        reason,
        details: details?.trim() || null,
      },
    });

    res.status(201).json({ message: 'تم إرسال البلاغ بنجاح.', report });
  } catch (err) {
    next(err);
  }
});

// Admin: list reports
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const reports = await prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch review details for each report
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let review = null;
        if (r.type === 'REVIEW') {
          review = await prisma.review.findUnique({
            where: { id: r.targetId },
            select: { id: true, rating: true, comment: true, student: { select: { name: true } }, property: { select: { title: true } } },
          });
        }
        return { ...r, review };
      }),
    );

    res.json({ reports: enriched });
  } catch (err) {
    next(err);
  }
});

// Admin: review report (delete review or dismiss)
router.patch('/:id/review', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { action, adminNote } = req.body;
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'البلاغ غير موجود.' });

    if (action === 'delete_review') {
      await prisma.review.delete({ where: { id: report.targetId } }).catch(() => {});
      await prisma.report.update({
        where: { id: req.params.id },
        data: { status: 'REVIEWED', adminNote: adminNote || 'تم حذف التقييم' },
      });
      res.json({ message: 'تم حذف التقييم وإغلاق البلاغ.' });
    } else {
      await prisma.report.update({
        where: { id: req.params.id },
        data: { status: 'DISMISSED', adminNote: adminNote || null },
      });
      res.json({ message: 'تم رفض البلاغ.' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Register route + add API methods**

In `server/src/index.js`:
```js
import reportRoutes from './routes/reports.js';
app.use('/api/reports', reportRoutes);
```

In `src/utils/api.js`:
```js
reports: {
  create: (body) => request('/reports', { method: 'POST', body: JSON.stringify(body) }),
  list: (status) => request(`/reports${status ? `?status=${status}` : ''}`),
  review: (id, body) => request(`/reports/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }),
},
```

- [ ] **Step 3: Add report button to PropertyDetailsPage**

Read `src/pages/PropertyDetailsPage.jsx`. In the review item render (where each review is mapped), add a 🚩 button after the review comment:

```jsx
{isStudent && review.student.id !== user?.id && (
  <button
    className="report-btn"
    onClick={() => handleReport(review.id)}
    title="الإبلاغ عن هذا التقييم"
  >
    🚩
  </button>
)}
```

Add handler:
```jsx
const [reportingId, setReportingId] = useState(null);
const [reportReason, setReportReason] = useState('');

async function handleReport(reviewId) {
  const reason = prompt('سبب البلاغ:\n1. محتوى مسيء (OFFENSIVE)\n2. معلومات خاطئة (INCORRECT)\n3. سبام (SPAM)\n\nاكتب الرقم:');
  const reasons = { '1': 'OFFENSIVE', '2': 'INCORRECT', '3': 'SPAM' };
  const mapped = reasons[reason];
  if (!mapped) return;
  try {
    await api.reports.create({ type: 'REVIEW', targetId: reviewId, reason: mapped });
    alert('تم إرسال البلاغ بنجاح.');
  } catch (err) {
    alert(err.message);
  }
}
```

- [ ] **Step 4: Add reports tab to AdminDashboard**

Read `src/pages/AdminDashboard.jsx`. Add tab:
```js
{ id: 'reports', label: 'بلاغات التقييمات', icon: <FiFlag /> }
```

Add `{activeTab === 'reports' && <ReportsTab />}` and create `ReportsTab` component:
- Fetch `api.reports.list(filter)`
- Table: reporter, review excerpt, reason, status, actions
- Actions: "حذف التقييم" (calls `api.reports.review(id, { action: 'delete_review' })`) and "رفض" (calls `api.reports.review(id, { action: 'dismiss' })`)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add report comment system (UC-41) — backend, frontend, admin tab"
```

---

## Task 4: Socket.io setup (UC-42)

**Files:**
- Create: `server/src/utils/socket.js`
- Create: `src/utils/socket.js`
- Modify: `server/src/index.js`
- Modify: `server/src/routes/messages.js`
- Modify: `server/src/utils/notify.js`
- Modify: `src/components/shared/MessagesChat.jsx`

- [ ] **Step 1: Install socket.io**

```bash
cd /Users/mahdy/Desktop/sknat2/server && npm install socket.io
cd /Users/mahdy/Desktop/sknat2 && npm install socket.io-client
```

- [ ] **Step 2: Create server socket utility**

```js
// server/src/utils/socket.js
let io = null;

export function setIO(ioInstance) { io = ioInstance; }
export function getIO() { return io; }

export function emitToUser(userId, event, data) {
  if (io) io.to(`user_${userId}`).emit(event, data);
}
```

- [ ] **Step 3: Modify server/src/index.js — add socket.io**

Read `server/src/index.js`. Replace `app.listen(...)` block with:

```js
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { setIO } from './utils/socket.js';
import { verifyToken } from './utils/jwt.js';

const server = createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

setIO(io);

const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie?.match(/token=([^;]+)/)?.[1];
    if (!token) return next(new Error('Authentication required'));
    const decoded = verifyToken(token);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { userId } = socket;
  socket.join(`user_${userId}`);
  onlineUsers.set(userId, socket.id);
  io.emit('online_users', Array.from(onlineUsers.keys()));

  socket.on('typing', ({ to }) => {
    io.to(`user_${to}`).emit('typing', { from: userId });
  });

  socket.on('stop_typing', ({ to }) => {
    io.to(`user_${to}`).emit('stop_typing', { from: userId });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Remove old `app.listen(PORT, ...)` block.

- [ ] **Step 4: Update messages route — emit on send**

Read `server/src/routes/messages.js`. After `prisma.message.create(...)` in POST handler, add:

```js
import { emitToUser } from '../utils/socket.js';
// after message created:
emitToUser(receiverId, 'new_message', message);
```

- [ ] **Step 5: Update notify.js — add socket emit**

Read `server/src/utils/notify.js`, add:
```js
import { emitToUser } from './socket.js';
// inside notify(), after create:
emitToUser(userId, 'notification', notification);
```

- [ ] **Step 6: Create frontend socket utility**

```js
// src/utils/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function connectSocket() {
  if (socket?.connected) return socket;
  socket = io('/', { withCredentials: true });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
```

- [ ] **Step 7: Update MessagesChat — real-time messages + typing**

Read `src/components/shared/MessagesChat.jsx`. Add:
- On mount: `connectSocket()`, subscribe to `new_message` → append to messages if from current chat user
- On input change: emit `typing` debounced (300ms), on blur emit `stop_typing`
- Subscribe to `typing`/`stop_typing` → show "يكتب..." indicator
- On unmount: remove listeners

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add socket.io for real-time chat — typing, online status (UC-42)"
```

---

## Task 5: Complaints (UC-34)

**Files:**
- Create: `server/src/routes/complaints.js`
- Create: `src/pages/Complaints.jsx`
- Modify: `server/src/index.js`
- Modify: `src/utils/api.js`
- Modify: `src/App.jsx`
- Modify: `src/components/layout/Navbar.jsx`
- Modify: `src/components/owner/OwnerSidebar.jsx`
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Create complaints route**

```js
// server/src/routes/complaints.js
import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notify } from '../utils/notify.js';

const router = Router();

// Create complaint
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { type, subject, description, image } = req.body;
    if (!type || !subject?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'يرجى تعبئة جميع الحقول المطلوبة.' });
    }

    const complaint = await prisma.complaint.create({
      data: {
        userId: req.user.id,
        userName: req.user.name,
        type,
        subject: subject.trim(),
        description: description.trim(),
        image: image || null,
      },
    });

    res.status(201).json({ message: 'تم تقديم الشكوى بنجاح.', complaint });
  } catch (err) {
    next(err);
  }
});

// My complaints
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) {
    next(err);
  }
});

// Admin: all complaints
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const complaints = await prisma.complaint.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ complaints });
  } catch (err) {
    next(err);
  }
});

// Admin: update complaint
router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, adminResponse } = req.body;
    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة.' });

    const updated = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status, adminResponse: adminResponse || null },
    });

    if (adminResponse) {
      notify(complaint.userId, 'رد على شكواك', adminResponse, '/complaints');
    }

    res.json({ message: 'تم تحديث الشكوى.', complaint: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Register route + API methods**

In `server/src/index.js`:
```js
import complaintRoutes from './routes/complaints.js';
app.use('/api/complaints', complaintRoutes);
```

In `src/utils/api.js`:
```js
complaints: {
  create: (body) => request('/complaints', { method: 'POST', body: JSON.stringify(body) }),
  mine: () => request('/complaints/mine'),
  list: (params) => request(`/complaints${buildQuery(params)}`),
  update: (id, body) => request(`/complaints/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
},
```

- [ ] **Step 3: Create Complaints page**

Create `src/pages/Complaints.jsx` — shared by student + owner:
- List my complaints with status badges
- "تقديم شكوى" button → form modal (type select, subject input, description textarea, image upload optional)
- Each complaint shows: type, subject, status, date, admin response if exists

- [ ] **Step 4: Add routes to App.jsx**

Read `src/App.jsx`:
```jsx
import Complaints from './pages/Complaints';
// Student route:
<Route path="/complaints" element={<ProtectedRoute roles={['STUDENT']}><Complaints /></ProtectedRoute>} />
// Owner route (inside /owner):
<Route path="complaints" element={<Complaints />} />
```

- [ ] **Step 5: Add complaints link to Navbar + OwnerSidebar**

Navbar: add `{ path: '/complaints', label: 'الشكاوى', icon: <FiAlertTriangle /> }` for students.

OwnerSidebar: add `{ to: "/owner/complaints", label: "الشكاوى", icon: "⚠️" }` in التواصل section.

- [ ] **Step 6: Add complaints tab to AdminDashboard**

Add tab `{ id: 'complaints', label: 'الشكاوى', icon: <FiAlertTriangle /> }` and `ComplaintsTab` component:
- Fetch `api.complaints.list({ status, type })`
- Table: user, type, subject, status, date, actions
- Filters: status + type dropdowns
- Actions: change status dropdown + reply textarea

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add complaints system (UC-34) — submit, track, admin manage"
```

---

## Task 6: Notification Bell + Page (UC-44 frontend)

**Files:**
- Create: `src/components/shared/NotificationBell.jsx`
- Create: `src/pages/Notifications.jsx`
- Modify: `src/components/layout/Navbar.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create NotificationBell component**

```jsx
// src/components/shared/NotificationBell.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { api } from '../../utils/api';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.notifications.unreadCount().then((d) => setCount(d.count)).catch(() => {});
    const interval = setInterval(() => {
      api.notifications.unreadCount().then((d) => setCount(d.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    api.notifications.list().then((d) => setNotifications((d.notifications || []).slice(0, 10))).catch(() => {});
  }, [open]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return 'الآن';
    if (diff < 60) return `منذ ${diff} د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)} س`;
    return `منذ ${Math.floor(diff / 1440)} يوم`;
  }

  async function handleClick(n) {
    if (!n.isRead) {
      await api.notifications.read(n.id).catch(() => {});
      setCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.url) navigate(n.url);
  }

  async function handleReadAll() {
    await api.notifications.readAll().catch(() => {});
    setCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={() => setOpen(!open)}>
        <FiBell />
        {count > 0 && <span className="notif-bell-badge">{count}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <strong>الإشعارات</strong>
            {count > 0 && <button onClick={handleReadAll} className="notif-read-all">قراءة الكل</button>}
          </div>
          <div className="notif-dropdown-list">
            {notifications.length === 0 && <div className="notif-empty">لا يوجد إشعارات</div>}
            {notifications.map((n) => (
              <div key={n.id} className={`notif-item ${n.isRead ? '' : 'unread'}`} onClick={() => handleClick(n)}>
                <div className="notif-item-title">{n.title}</div>
                <div className="notif-item-body">{n.body}</div>
                <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>
          <button className="notif-view-all" onClick={() => { setOpen(false); navigate('/notifications'); }}>
            عرض الكل
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create Notifications page**

`src/pages/Notifications.jsx` — full list, unread highlighted, click → read + navigate.

- [ ] **Step 3: Add NotificationBell to Navbar**

Read `src/components/layout/Navbar.jsx`. Add `<NotificationBell />` next to logo for logged-in users. Add CSS for `.notif-bell-wrap`, `.notif-dropdown`, etc. in Navbar.css.

- [ ] **Step 4: Add route**

In `src/App.jsx`:
```jsx
import Notifications from './pages/Notifications';
<Route path="/notifications" element={<ProtectedRoute roles={['STUDENT', 'OWNER']}><Notifications /></ProtectedRoute>} />
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add notification bell dropdown + notifications page (UC-44)"
```

---

## Task 7: Wire notify() calls across all event sources

**Files:**
- Modify: `server/src/routes/bookings.js`
- Modify: `server/src/routes/payments.js`
- Modify: `server/src/routes/reviews.js`
- Modify: `server/src/routes/messages.js`

- [ ] **Step 1: Replace push calls with notify() in bookings.js**

Read `server/src/routes/bookings.js`. Replace all `sendPushToUser(...)` calls with `notify(...)`:

```js
import { notify } from '../utils/notify.js';

// In POST (new booking): replace sendPushToUser
notify(property.ownerId, 'طلب حجز جديد', 'طالب جديد يريد حجز غرفة', '/owner/bookings');

// In accept: replace sendPushToUser
notify(updated.student.id, 'تم قبول حجزك', 'تم قبول طلب حجزك ✅', '/bookings');

// In reject: replace sendPushToUser
notify(updated.student.id, 'تم رفض حجزك', 'تم رفض طلب حجزك ❌', '/bookings');

// In complete: replace sendPushToUser
notify(updated.student.id, 'اكتمل حجزك', 'تم إكمال حجزك 🏠', '/bookings');
```

Remove `import { sendPushToUser } from '../utils/push.js';` (now handled inside notify).

- [ ] **Step 2: Add notify to payments.js**

Read `server/src/routes/payments.js`. After payment success:
```js
import { notify } from '../utils/notify.js';
// after payment processed:
notify(booking.property.ownerId, 'دفعة جديدة', `تم استلام دفعة بقيمة ${amount} ₪`, '/owner/bookings');
```

Need to include `property.ownerId` in booking query.

- [ ] **Step 3: Add notify to reviews.js**

Read `server/src/routes/reviews.js`. After review created:
```js
import { notify } from '../utils/notify.js';
// after review created:
notify(property.ownerId, 'تقييم جديد', `تقييم جديد على ${property.title}`, '/owner/ratings');
```

Need to fetch property.ownerId from review's propertyId.

- [ ] **Step 4: Add notify to messages.js**

Read `server/src/routes/messages.js`. After message created:
```js
import { notify } from '../utils/notify.js';
// after message sent:
notify(receiverId, 'رسالة جديدة', `رسالة من ${req.user.name}`, '/messages');
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: wire notify() across bookings, payments, reviews, messages"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 4 UCs covered — UC-41 (Task 3), UC-34 (Task 5), UC-42 (Task 4), UC-44 (Tasks 2+6+7)
- [x] **No placeholders:** All steps have code or exact instructions
- [x] **Type consistency:** `notify(userId, title, body, url)` signature consistent across all calls. `emitToUser(userId, event, data)` consistent. Schema field names match route code.
- [x] **Implementation order:** Schema first → notify helper → socket.io → reports → complaints → notification UI → wiring. Each task buildable independently after Task 1.
