import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from './store/authStore';
import { initializeConfig } from './services/configService';
import MainLayout from './components/layout/MainLayout';
import LoginScreen from './components/auth/LoginScreen';
import SignupScreen from './components/auth/SignupScreen';
import PhoneAuthScreen from './components/auth/PhoneAuthScreen';
import HomePage from './pages/HomePage';
import SalesPage from './pages/SalesPage';
import ExpensesPage from './pages/ExpensesPage';
import StockPage from './pages/StockPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/common/LoadingSpinner';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const { initializeAuth, loading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize Capacitor on mobile
    if (Capacitor.isNativePlatform()) {
      console.log('Running on native platform:', Capacitor.getPlatform());
    }

    // Initialize Firebase Remote Config for payment and feature configuration
    initializeConfig();

    // Initialize auth state
    initializeAuth();
  }, [initializeAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/home" replace /> : <LoginScreen />}
          />
          <Route
            path="/signup"
            element={isAuthenticated ? <Navigate to="/home" replace /> : <SignupScreen />}
          />
          <Route
            path="/phone-auth"
            element={isAuthenticated ? <Navigate to="/home" replace /> : <PhoneAuthScreen />}
          />

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <MainLayout>
                  <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/sales" element={<SalesPage />} />
                    <Route path="/expenses" element={<ExpensesPage />} />
                    <Route path="/stock" element={<StockPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="*" element={<Navigate to="/home" replace />} />
                  </Routes>
                </MainLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>

        {/* Toast Notifications */}
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </div>
    </Router>
  );
}

export default App;
