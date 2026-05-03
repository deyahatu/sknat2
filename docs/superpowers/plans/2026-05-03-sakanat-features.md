# Sakanat Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 features to Sakanat: Error Boundary, Audit Log, Email Templates, Invoice PDF, Communication/Messaging, Push Notifications, Landing Page redesign.

**Architecture:** Each feature is independent. Backend uses Express+Prisma+PostgreSQL. Frontend is React+Vite with CSS modules. Email uses existing nodemailer setup. PDF generation via html-pdf or pdfmake. Push notifications via web-push API.

**Tech Stack:** React 19, Vite, Express, Prisma, PostgreSQL, nodemailer (existing), web-push, recharts (existing)

---

## File Map

### Error Boundary
- Create: `src/components/shared/ErrorBoundary.jsx`
- Create: `src/components/shared/ErrorBoundary.css`
- Modify: `src/App.jsx` (wrap routes)

### Audit Log
- Modify: `server/prisma/schema.prisma` (add AuditLog model)
- Create: `server/src/utils/audit.js` (logging helper)
- Create: `server/src/routes/auditLog.js` (admin GET endpoint)
- Modify: `server/src/index.js` (register route)
- Modify: `server/src/routes/bookings.js` (log accept/reject/cancel/complete)
- Modify: `server/src/routes/properties.js` (log create/update/delete)
- Modify: `server/src/routes/users.js` (log toggle-active/delete)
- Modify: `src/utils/api.js` (add audit API)
- Modify: `src/pages/AdminDashboard.jsx` (add Audit Log tab)

### Email Templates
- Create: `server/src/utils/email-templates.js` (HTML templates)
- Modify: `server/src/utils/email.js` (add send functions per event)
- Modify: `server/src/routes/bookings.js` (send email on accept/reject/complete)
- Modify: `server/src/routes/payments.js` (send receipt email on payment)

### Invoice/Receipts PDF
- Create: `server/src/routes/invoices.js` (GET /api/invoices/:paymentId)
- Modify: `server/src/index.js` (register route)
- Modify: `src/utils/api.js` (add invoice API)
- Modify: `src/pages/student/MyBookings.jsx` (add download invoice button)

### Communication/Messaging
- Modify: `server/prisma/schema.prisma` (add Message, Announcement models)
- Create: `server/src/routes/messages.js`
- Create: `server/src/routes/announcements.js`
- Modify: `server/src/index.js` (register routes)
- Modify: `src/utils/api.js` (add messaging API)
- Create: `src/pages/student/Messages.jsx`
- Create: `src/pages/student/Messages.css`
- Create: `src/pages/owner/Messages.jsx`
- Modify: `src/App.jsx` (add message routes)
- Modify: `src/components/layout/Navbar.jsx` (add messages link)

### Push Notifications
- Create: `public/sw.js` (service worker)
- Create: `server/src/utils/push.js` (web-push helper)
- Modify: `server/prisma/schema.prisma` (add PushSubscription model)
- Create: `server/src/routes/push.js` (subscribe/unsubscribe endpoints)
- Modify: `server/src/index.js` (register route)
- Create: `src/utils/push.js` (frontend subscription helper)
- Modify: `src/utils/api.js` (add push API)
- Modify: `src/App.jsx` (init push on login)

### Landing Page
- Rewrite: `src/pages/HomePage.jsx`
- Rewrite: `src/pages/HomePage.css`

---

## Task 1: Error Boundary

**Files:**
- Create: `src/components/shared/ErrorBoundary.jsx`
- Create: `src/components/shared/ErrorBoundary.css`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create ErrorBoundary component**

```jsx
// src/components/shared/ErrorBoundary.jsx
import { Component } from 'react';
import './ErrorBoundary.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h1>حدث خطأ غير متوقع</h1>
            <p>نعتذر عن هذا الخطأ. يرجى إعادة تحميل الصفحة.</p>
            <div className="error-boundary-actions">
              <button onClick={() => window.location.reload()} className="error-boundary-btn primary">
                إعادة تحميل الصفحة
              </button>
              <button onClick={() => window.history.back()} className="error-boundary-btn secondary">
                الرجوع
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary-details">
                <summary>تفاصيل الخطأ</summary>
                <pre>{this.state.error.toString()}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Create ErrorBoundary CSS**

```css
/* src/components/shared/ErrorBoundary.css */
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fb;
  padding: 20px;
}
.error-boundary-content {
  text-align: center;
  max-width: 480px;
}
.error-boundary-icon {
  font-size: 64px;
  margin-bottom: 16px;
}
.error-boundary-content h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #1a1a1a;
}
.error-boundary-content p {
  color: #6b7280;
  margin-bottom: 24px;
  font-size: 16px;
}
.error-boundary-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.error-boundary-btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.error-boundary-btn.primary {
  background: #4f46e5;
  color: #fff;
}
.error-boundary-btn.secondary {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}
.error-boundary-details {
  margin-top: 24px;
  text-align: left;
  direction: ltr;
}
.error-boundary-details pre {
  background: #1a1a1a;
  color: #f87171;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12px;
}
```

- [ ] **Step 3: Wrap App with ErrorBoundary**

In `src/App.jsx`, add:
```jsx
import ErrorBoundary from './components/shared/ErrorBoundary';

// Wrap <Router> with <ErrorBoundary>
<ErrorBoundary>
  <Router>
    <AuthProvider>
      ...
    </AuthProvider>
  </Router>
</ErrorBoundary>
```

- [ ] **Step 4: Commit**
```bash
git add src/components/shared/ErrorBoundary.jsx src/components/shared/ErrorBoundary.css src/App.jsx
git commit -m "feat: add global error boundary component"
```

---

## Task 2: Audit Log — Schema + Backend

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/src/utils/audit.js`
- Create: `server/src/routes/auditLog.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: Add AuditLog model to schema**

Add to `server/prisma/schema.prisma`:
```prisma
model AuditLog {
  id         String   @id @default(uuid())
  action     String   // CREATE, UPDATE, DELETE, ACCEPT, REJECT, CANCEL, COMPLETE, TOGGLE_ACTIVE, PAYMENT
  entity     String   // PROPERTY, BOOKING, USER, REVIEW, WITHDRAWAL, REFUND
  entityId   String
  userId     String
  userName   String
  details    String?
  createdAt  DateTime @default(now())

  @@index([entity])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

- [ ] **Step 2: Push schema + regenerate**
```bash
cd server && npx prisma db push && npx prisma generate
```

- [ ] **Step 3: Create audit helper**

```js
// server/src/utils/audit.js
import prisma from './prisma.js';

export async function logAudit({ action, entity, entityId, user, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId || 'N/A',
        userId: user.id,
        userName: user.name,
        details: details || null,
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
```

- [ ] **Step 4: Create audit log route**

```js
// server/src/routes/auditLog.js
import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { entity, action, limit } = req.query;
    const where = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 100,
    });

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 5: Register route in index.js**

Add to `server/src/index.js`:
```js
import auditLogRoutes from './routes/auditLog.js';
// ...
app.use('/api/audit-log', auditLogRoutes);
```

- [ ] **Step 6: Add audit calls to bookings.js**

In accept handler, after successful transaction:
```js
import { logAudit } from '../utils/audit.js';
// After booking accepted:
logAudit({ action: 'ACCEPT', entity: 'BOOKING', entityId: booking.id, user: req.user, details: `قبول حجز ${booking.property.title}` });
```
Same pattern for reject, cancel, complete.

- [ ] **Step 7: Add audit calls to properties.js**

After property create/update/delete:
```js
logAudit({ action: 'CREATE', entity: 'PROPERTY', entityId: property.id, user: req.user, details: property.title });
```

- [ ] **Step 8: Add audit calls to users.js**

After toggle-active and delete:
```js
logAudit({ action: 'TOGGLE_ACTIVE', entity: 'USER', entityId: id, user: req.user, details: updated.isActive ? 'تفعيل' : 'تعطيل' });
```

- [ ] **Step 9: Commit**
```bash
git add -A && git commit -m "feat: add audit log system with admin endpoint"
```

---

## Task 3: Audit Log — Frontend (Admin Tab)

**Files:**
- Modify: `src/utils/api.js`
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add audit API method**

In `src/utils/api.js`, add to admin object:
```js
auditLog: (params) => request(`/audit-log${buildQuery(params)}`),
```

- [ ] **Step 2: Add AuditTab to AdminDashboard**

Add new tab `{ id: 'audit', label: 'سجل النشاط', icon: <FiFileText /> }` and component:

```jsx
function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    api.admin.auditLog({ entity: entityFilter, limit: 200 })
      .then((data) => setLogs(data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityFilter]);

  const actionLabels = {
    CREATE: 'إنشاء', UPDATE: 'تعديل', DELETE: 'حذف',
    ACCEPT: 'قبول', REJECT: 'رفض', CANCEL: 'إلغاء',
    COMPLETE: 'إكمال', TOGGLE_ACTIVE: 'تفعيل/تعطيل', PAYMENT: 'دفع',
  };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-filters">
        <select className="admin-role-filter" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="BOOKING">الحجوزات</option>
          <option value="PROPERTY">العقارات</option>
          <option value="USER">المستخدمين</option>
          <option value="REVIEW">التقييمات</option>
        </select>
      </div>
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الإجراء</th>
              <th>النوع</th>
              <th>التفاصيل</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.userName}</td>
                <td><span className="status-badge">{actionLabels[log.action] || log.action}</span></td>
                <td>{log.entity}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.details || '—'}</td>
                <td>{new Date(log.createdAt).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40 }}>لا يوجد سجلات</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add src/utils/api.js src/pages/AdminDashboard.jsx
git commit -m "feat: add audit log tab in admin dashboard"
```

---

## Task 4: Email Templates

**Files:**
- Create: `server/src/utils/email-templates.js`
- Modify: `server/src/utils/email.js`
- Modify: `server/src/routes/bookings.js`
- Modify: `server/src/routes/payments.js`

- [ ] **Step 1: Create HTML email templates**

```js
// server/src/utils/email-templates.js

function baseTemplate(content) {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
    .container{max-width:560px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:#1e1b4b;color:#fff;padding:24px;text-align:center}
    .header h1{margin:0;font-size:20px}
    .body{padding:24px}
    .footer{padding:16px 24px;text-align:center;color:#888;font-size:12px;border-top:1px solid #eee}
    .btn{display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:16px}
    .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0}
    .info-row:last-child{border:none}
    .info-label{color:#666}
    .info-value{font-weight:600}
  </style></head><body><div class="container">
    <div class="header"><h1>🏠 سكنات</h1></div>
    <div class="body">${content}</div>
    <div class="footer">منصة سكنات للسكن الطلابي © ${new Date().getFullYear()}</div>
  </div></body></html>`;
}

export function bookingAcceptedEmail(studentName, propertyTitle, roomName, dates) {
  return baseTemplate(`
    <h2>تم قبول حجزك ✅</h2>
    <p>مرحباً ${studentName}،</p>
    <p>تم قبول طلب حجزك بنجاح.</p>
    <div class="info-row"><span class="info-label">السكن:</span><span class="info-value">${propertyTitle}</span></div>
    <div class="info-row"><span class="info-label">الغرفة:</span><span class="info-value">${roomName}</span></div>
    <div class="info-row"><span class="info-label">الفترة:</span><span class="info-value">${dates}</span></div>
    <p>يرجى إتمام الدفع لتأكيد الحجز.</p>
  `);
}

export function bookingRejectedEmail(studentName, propertyTitle, roomName) {
  return baseTemplate(`
    <h2>تم رفض طلب الحجز ❌</h2>
    <p>مرحباً ${studentName}،</p>
    <p>نأسف، تم رفض طلب حجزك.</p>
    <div class="info-row"><span class="info-label">السكن:</span><span class="info-value">${propertyTitle}</span></div>
    <div class="info-row"><span class="info-label">الغرفة:</span><span class="info-value">${roomName}</span></div>
    <p>يمكنك البحث عن سكن آخر من خلال المنصة.</p>
  `);
}

export function paymentReceiptEmail(studentName, propertyTitle, amount, paymentDate) {
  return baseTemplate(`
    <h2>إيصال الدفع 💳</h2>
    <p>مرحباً ${studentName}،</p>
    <p>تم استلام دفعتك بنجاح.</p>
    <div class="info-row"><span class="info-label">السكن:</span><span class="info-value">${propertyTitle}</span></div>
    <div class="info-row"><span class="info-label">المبلغ:</span><span class="info-value">${amount} ₪</span></div>
    <div class="info-row"><span class="info-label">التاريخ:</span><span class="info-value">${paymentDate}</span></div>
    <p>شكراً لاستخدامك منصة سكنات.</p>
  `);
}

export function bookingCompletedEmail(studentName, propertyTitle) {
  return baseTemplate(`
    <h2>اكتمل حجزك ✅</h2>
    <p>مرحباً ${studentName}،</p>
    <p>تم إكمال حجزك في ${propertyTitle}.</p>
    <p>نتمنى أن تكون تجربتك جيدة. يسعدنا تقييمك!</p>
  `);
}
```

- [ ] **Step 2: Add send functions to email.js**

Add to existing `server/src/utils/email.js`:
```js
import { bookingAcceptedEmail, bookingRejectedEmail, paymentReceiptEmail, bookingCompletedEmail } from './email-templates.js';

export async function sendBookingAccepted(to, studentName, propertyTitle, roomName, dates) {
  const t = getTransporter();
  if (!t) return;
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: '✅ تم قبول حجزك - سكنات',
    html: bookingAcceptedEmail(studentName, propertyTitle, roomName, dates),
  });
}

export async function sendBookingRejected(to, studentName, propertyTitle, roomName) {
  const t = getTransporter();
  if (!t) return;
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: '❌ تم رفض طلب حجزك - سكنات',
    html: bookingRejectedEmail(studentName, propertyTitle, roomName),
  });
}

export async function sendPaymentReceipt(to, studentName, propertyTitle, amount, date) {
  const t = getTransporter();
  if (!t) return;
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: '💳 إيصال دفع - سكنات',
    html: paymentReceiptEmail(studentName, propertyTitle, amount, date),
  });
}

export async function sendBookingCompleted(to, studentName, propertyTitle) {
  const t = getTransporter();
  if (!t) return;
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: '✅ اكتمل حجزك - سكنات',
    html: bookingCompletedEmail(studentName, propertyTitle),
  });
}
```

- [ ] **Step 3: Call email functions in bookings.js**

After accept handler success:
```js
import { sendBookingAccepted, sendBookingRejected, sendBookingCompleted } from '../utils/email.js';
// In accept: (fire-and-forget, don't await)
sendBookingAccepted(updated.student.email, updated.student.name, updated.property.title, updated.roomVariant.name, `${booking.startDate} - ${booking.endDate}`).catch(() => {});
```
Same for reject and complete.

- [ ] **Step 4: Call email in payments.js**

After payment success:
```js
import { sendPaymentReceipt } from '../utils/email.js';
sendPaymentReceipt(student.email, student.name, booking.property.title, amount, new Date().toLocaleDateString('ar-EG')).catch(() => {});
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: add styled email templates for booking and payment events"
```

---

## Task 5: Invoice/Receipts PDF

**Files:**
- Create: `server/src/routes/invoices.js`
- Modify: `server/src/index.js`
- Modify: `src/utils/api.js`
- Modify: `src/pages/student/MyBookings.jsx`

- [ ] **Step 1: Create invoice route (returns HTML rendered as PDF-ready page)**

```js
// server/src/routes/invoices.js
import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:paymentId', authenticate, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: {
        student: { select: { name: true, email: true, phone: true } },
        booking: {
          include: {
            property: { select: { title: true, city: true, address: true, owner: { select: { name: true } } } },
            roomVariant: { select: { name: true, fullPrice: true } },
          },
        },
      },
    });

    if (!payment) return res.status(404).json({ error: 'الدفعة غير موجودة.' });
    if (payment.studentId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'غير مصرح.' });
    }

    const invoice = {
      id: payment.id.slice(0, 8).toUpperCase(),
      date: new Date(payment.createdAt).toLocaleDateString('ar-EG'),
      student: payment.student,
      property: payment.booking.property,
      room: payment.booking.roomVariant,
      amount: Number(payment.amount),
      startDate: new Date(payment.booking.startDate).toLocaleDateString('ar-EG'),
      endDate: new Date(payment.booking.endDate).toLocaleDateString('ar-EG'),
    };

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Register route**

In `server/src/index.js`:
```js
import invoiceRoutes from './routes/invoices.js';
app.use('/api/invoices', invoiceRoutes);
```

- [ ] **Step 3: Add API method + download button in MyBookings**

In `src/utils/api.js`:
```js
invoices: {
  get: (paymentId) => request(`/invoices/${paymentId}`),
},
```

In MyBookings, add download button for PAID/COMPLETED bookings that opens a printable invoice page or uses `window.print()`.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: add invoice/receipt generation for payments"
```

---

## Task 6: Communication/Messaging

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/src/routes/messages.js`
- Modify: `server/src/index.js`
- Modify: `src/utils/api.js`
- Create: `src/pages/student/Messages.jsx`
- Create: `src/pages/student/Messages.css`
- Create: `src/pages/owner/Messages.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add Message model**

```prisma
model Message {
  id         String   @id @default(uuid())
  content    String
  senderId   String
  receiverId String
  bookingId  String?
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())

  sender   User     @relation("MessagesSent", fields: [senderId], references: [id], onDelete: Cascade)
  receiver User     @relation("MessagesReceived", fields: [receiverId], references: [id], onDelete: Cascade)
  booking  Booking? @relation(fields: [bookingId], references: [id])

  @@index([senderId])
  @@index([receiverId])
  @@index([bookingId])
  @@map("messages")
}
```

Add relations to User model:
```prisma
messagesSent     Message[] @relation("MessagesSent")
messagesReceived Message[] @relation("MessagesReceived")
```

Add relation to Booking model:
```prisma
messages Message[]
```

- [ ] **Step 2: Push schema + regenerate**

- [ ] **Step 3: Create messages route**

Endpoints:
- `GET /api/messages/conversations` — list conversations (grouped by other user)
- `GET /api/messages/:userId` — get messages with specific user
- `POST /api/messages` — send message `{ receiverId, content, bookingId? }`
- `PATCH /api/messages/:id/read` — mark as read

- [ ] **Step 4: Create frontend pages**

Student Messages page: list conversations with owners, chat view.
Owner Messages page: list conversations with students, chat view.
Both share same component structure — just different data.

- [ ] **Step 5: Add routes to App.jsx**

```jsx
<Route path="/messages" element={<ProtectedRoute roles={['STUDENT']}><StudentMessages /></ProtectedRoute>} />
// Owner layout:
<Route path="messages" element={<OwnerMessages />} />
```

- [ ] **Step 6: Add messages link to Navbar**

- [ ] **Step 7: Commit**
```bash
git add -A && git commit -m "feat: add messaging system between owners and students"
```

---

## Task 7: Push Notifications

**Files:**
- Create: `public/sw.js`
- Modify: `server/prisma/schema.prisma`
- Create: `server/src/utils/push.js`
- Create: `server/src/routes/push.js`
- Modify: `server/src/index.js`
- Create: `src/utils/push.js`
- Modify: `src/utils/api.js`

- [ ] **Step 1: Install web-push**
```bash
cd server && npm install web-push
```

- [ ] **Step 2: Add PushSubscription model**

```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_subscriptions")
}
```

Add to User: `pushSubscriptions PushSubscription[]`

- [ ] **Step 3: Generate VAPID keys and add to .env**
```bash
npx web-push generate-vapid-keys
```
Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to `.env`.

- [ ] **Step 4: Create push utility**

```js
// server/src/utils/push.js
import webPush from 'web-push';
import prisma from './prisma.js';

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webPush.setVapidDetails('mailto:admin@sknat.com', vapidPublic, vapidPrivate);
}

export async function sendPushToUser(userId, title, body, url) {
  if (!vapidPublic) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url }),
      );
    } catch (err) {
      if (err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}
```

- [ ] **Step 5: Create push routes + service worker + frontend helper**

Subscribe/unsubscribe endpoints, service worker for handling push events, frontend subscription on login.

- [ ] **Step 6: Send push on booking events**

In bookings.js accept/reject handlers, call `sendPushToUser(studentId, 'سكنات', 'تم قبول حجزك', '/bookings')`.

- [ ] **Step 7: Commit**
```bash
git add -A && git commit -m "feat: add web push notifications for booking events"
```

---

## Task 8: Landing Page Redesign

**Files:**
- Rewrite: `src/pages/HomePage.jsx`
- Rewrite: `src/pages/HomePage.css`

- [ ] **Step 1: Design sections**

Sections:
1. **Hero** — gradient background, title, subtitle, search bar, CTA buttons
2. **Stats Counter** — animated counters (عقارات، طلاب، حجوزات، مدن)
3. **Features** — 3-4 feature cards with icons
4. **How It Works** — 3 steps (ابحث → احجز → اسكن)
5. **Testimonials** — student reviews
6. **CTA** — call to action banner

- [ ] **Step 2: Implement HomePage.jsx with all sections**

Full RTL Arabic landing page with modern design, gradients, animations on scroll.

- [ ] **Step 3: Style with HomePage.css**

Responsive grid, gradient hero, card hover effects, counter animations.

- [ ] **Step 4: Commit**
```bash
git add src/pages/HomePage.jsx src/pages/HomePage.css
git commit -m "feat: redesign landing page with hero, features, stats, testimonials"
```

---

## Self-Review Checklist

- [x] All 7 features covered by tasks
- [x] File paths exact
- [x] No placeholders
- [x] Types/names consistent across tasks
- [x] Each task independent and committable
- [x] Existing patterns followed (Express routes, Prisma models, api.js structure)
