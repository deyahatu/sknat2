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
import paymentRoutes from './routes/payments.js';
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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

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
