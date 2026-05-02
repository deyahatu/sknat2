import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (schema v2)`);
});
