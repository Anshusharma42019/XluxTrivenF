import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import { lazy, Suspense } from 'react';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Users = lazy(() => import('./pages/Users'));
const CNP = lazy(() => import('./pages/CNP'));
const Verification = lazy(() => import('./pages/Verification'));
const ReadyToShipment = lazy(() => import('./pages/ReadyToShipment'));
const Shiprocket = lazy(() => import('./pages/Shiprocket'));
const NdrDetail = lazy(() => import('./pages/NdrDetail'));
const FollowUp = lazy(() => import('./pages/FollowUp'));
const CallAgain = lazy(() => import('./pages/CallAgain'));
const Attendance = lazy(() => import('./pages/Attendance'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const AppointmentBook = lazy(() => import('./pages/AppointmentBook'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const ReorderCommission = lazy(() => import('./pages/ReorderCommission'));
const Shipmaxx = lazy(() => import('./pages/Shipmaxx'));
const NdrPage = lazy(() => import('./pages/NdrPage'));
const ShipmaxxNdr = lazy(() => import('./pages/ShipmaxxNdr'));
const ShipmaxxFollowup = lazy(() => import('./pages/ShipmaxxFollowup'));
const Whatsapp = lazy(() => import('./pages/Whatsapp'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[300px]">
    <div className="w-8 h-8 border-[3px] border-green-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to={user?.role === 'doctor' ? '/doctor-dashboard' : '/dashboard'} replace />} />
        <Route path="dashboard" element={
          ['sales', 'support', 'logistics'].includes(user?.role)
            ? <StaffDashboard />
            : <ProtectedRoute roles={['admin', 'manager']}><Dashboard /></ProtectedRoute>
        } />
        <Route path="doctor-dashboard" element={
          <ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>
        } />
        <Route path="leads" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><Leads /></ProtectedRoute>
        } />
        <Route path="pipeline" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><Pipeline /></ProtectedRoute>
        } />
        <Route path="cnp" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><CNP /></ProtectedRoute>
        } />
        <Route path="call-again" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><CallAgain /></ProtectedRoute>
        } />
        <Route path="tasks" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><Tasks /></ProtectedRoute>
        } />
        <Route path="attendance" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support', 'logistics']}><Attendance /></ProtectedRoute>
        } />
        <Route path="appointments" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'doctor', 'support']}><AppointmentBook /></ProtectedRoute>
        } />
        <Route path="follow-up" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><FollowUp /></ProtectedRoute>
        } />
        <Route path="reorder-commission" element={
          <ProtectedRoute roles={['admin']}>
            <ReorderCommission />
          </ProtectedRoute>
        } />
        <Route path="verification" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><Verification /></ProtectedRoute>
        } />
        <Route path="ready-to-shipment" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics']}><ReadyToShipment /></ProtectedRoute>
        } />
        <Route path="shiprocket" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics']}><Shiprocket /></ProtectedRoute>
        } />
        <Route path="shiprocket/orders" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics']}><Shiprocket initialSection="orders" /></ProtectedRoute>
        } />
        <Route path="shiprocket/shipments" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics']}><Shiprocket initialSection="shipments" /></ProtectedRoute>
        } />
        <Route path="shiprocket/returns" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics']}><Shiprocket initialSection="returns" initialReturnsTab="returns" /></ProtectedRoute>
        } />
        <Route path="shiprocket/ndr" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics']}><NdrPage /></ProtectedRoute>
        } />
        <Route path="shiprocket/ndr/detail" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics']}><NdrDetail /></ProtectedRoute>
        } />
        <Route path="shipmaxx" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics', 'support']}><Shipmaxx /></ProtectedRoute>
        } />
        <Route path="shipmaxx/ndr" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics', 'support']}><ShipmaxxNdr /></ProtectedRoute>
        } />
        <Route path="shipmaxx/followup" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'logistics', 'support']}><ShipmaxxFollowup /></ProtectedRoute>
        } />
        <Route path="whatsapp" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support']}><Whatsapp /></ProtectedRoute>
        } />
        <Route path="orders/:id" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support', 'logistics']}><OrderDetail /></ProtectedRoute>
        } />
        <Route path="notifications" element={
          <ProtectedRoute roles={['admin', 'manager', 'sales', 'support', 'logistics']}><Notifications /></ProtectedRoute>
        } />
        <Route path="users" element={
          <ProtectedRoute roles={['admin', 'manager']}>
            <Users />
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
