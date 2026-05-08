import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SearchPage from './pages/SearchPage';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/student/ProfilePage';
import MyBookings from './pages/student/MyBookings';
import PaymentPage from './pages/student/PaymentPage';
import RateAccommodation from './pages/student/RateAccommodation';
import Favorites from './pages/student/Favorites';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OwnerLayout from './pages/owner/OwnerLayout';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerProperties from './pages/owner/OwnerProperties';
import AddEditProperty from './pages/owner/AddEditProperty';
import OwnerBookings from './pages/owner/OwnerBookings';
import OwnerRatings from './pages/owner/OwnerRatings';
import RateStudents from './pages/owner/RateStudents';
import BankAccount from './pages/owner/BankAccount';
import Withdrawals from './pages/owner/Withdrawals';
import ManageProfile from './pages/owner/ManageProfile';
import StudentMessages from './pages/student/Messages';
import OwnerMessages from './pages/owner/OwnerMessages';
import Complaints from './pages/Complaints';
import Notifications from './pages/Notifications';

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === 'OWNER' ? '/owner' : '/'} replace />;
  return children;
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function PublicLayout() {
  const { user } = useAuth();
  if (user?.role === 'OWNER') return <Navigate to="/owner" replace />;
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
      <AuthProvider>
        <Routes>
          {/* Owner section — uses its own layout (no global Navbar/Footer) */}
          <Route
            path="/owner"
            element={
              <ProtectedRoute roles={['OWNER']}>
                <OwnerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OwnerDashboard />} />
            <Route path="properties" element={<OwnerProperties />} />
            <Route path="properties/add" element={<AddEditProperty />} />
            <Route path="properties/:id/edit" element={<AddEditProperty />} />
            <Route path="bookings" element={<OwnerBookings />} />
            <Route path="ratings" element={<OwnerRatings />} />
            <Route path="rate-students" element={<RateStudents />} />
            <Route path="bank-account" element={<BankAccount />} />
            <Route path="withdrawals" element={<Withdrawals />} />
            <Route path="manage-profile" element={<ManageProfile />} />
            <Route path="messages" element={<OwnerMessages />} />
            <Route path="complaints" element={<Complaints />} />
          </Route>

          {/* Public + student/admin routes — global Navbar/Footer layout */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path="/reset-password/:token" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/property/:id" element={<PropertyDetailsPage />} />
            <Route path="/profile" element={<ProtectedRoute roles={['STUDENT']}><ProfilePage /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute roles={['STUDENT']}><MyBookings /></ProtectedRoute>} />
            <Route path="/payment/:bookingId" element={<ProtectedRoute roles={['STUDENT']}><PaymentPage /></ProtectedRoute>} />
            <Route path="/rate/:bookingId" element={<ProtectedRoute roles={['STUDENT']}><RateAccommodation /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute roles={['STUDENT']}><Favorites /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute roles={['STUDENT']}><StudentMessages /></ProtectedRoute>} />
            <Route path="/complaints" element={<ProtectedRoute roles={['STUDENT']}><Complaints /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute roles={['STUDENT', 'OWNER', 'ADMIN']}><Notifications /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
