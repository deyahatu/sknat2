import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { setIO } from './utils/socket.js';
import { verifyToken } from './utils/jwt.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import propertyRoutes from './routes/properties.js';
import studentRatingRoutes from './routes/studentRatings.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes, { webhookHandler as stripeWebhookHandler } from './routes/payments.js';
import withdrawalRoutes from './routes/withdrawals.js';
import favoriteRoutes from './routes/favorites.js';
import refundRoutes from './routes/refunds.js';
import reviewRoutes from './routes/reviews.js';
import adminRoutes from './routes/admin.js';
import auditLogRoutes from './routes/auditLog.js';
import invoiceRoutes from './routes/invoices.js';
import messageRoutes from './routes/messages.js';
import pushRoutes from './routes/push.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import complaintRoutes from './routes/complaints.js';
import blockAppealRoutes from './routes/blockAppeals.js';
import chatRoutes from './routes/chat.js';
import { startRenewalScheduler } from './utils/renewalScheduler.js';
import { startAccountDeletionScheduler } from './utils/accountDeletionScheduler.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Stripe webhook MUST be mounted with the raw body BEFORE express.json,
// otherwise the signature verification (which hashes the raw bytes) fails.
app.post('/api/payments/webhook', ...stripeWebhookHandler);

app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// General API rate limit
import { apiLimiter } from './middleware/rateLimit.js';
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/student-ratings', studentRatingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/block-appeals', blockAppealRoutes);
app.use('/api/chat', chatRoutes);

// File upload endpoint
import { authenticate } from './middleware/auth.js';
import { upload, filesToUrls, fileToUrl } from './utils/upload.js';
app.post('/api/upload', authenticate, upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'لم يتم رفع أي صورة.' });
  }
  const urls = filesToUrls(req.files);
  res.json({ urls });
});
app.post('/api/upload/single', authenticate, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع أي صورة.' });
  }
  res.json({ url: fileToUrl(req.file) });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'خطأ في الخادم',
  });
});

const server = createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

setIO(io);

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

  // Rate limit typing events: max 1 per second per socket
  let lastTyping = 0;
  socket.on('typing', ({ to }) => {
    const now = Date.now();
    if (now - lastTyping < 1000) return;
    lastTyping = now;
    if (typeof to === 'string' && to.length > 0) {
      io.to(`user_${to}`).emit('typing', { from: userId });
    }
  });

  socket.on('stop_typing', ({ to }) => {
    if (typeof to === 'string' && to.length > 0) {
      io.to(`user_${to}`).emit('stop_typing', { from: userId });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startRenewalScheduler();
  startAccountDeletionScheduler();
});
