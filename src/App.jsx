import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StaffDashboard from './pages/StaffDashboard';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Tasks from './pages/Tasks';
import Notifications from './pages/Notifications';
import Users from './pages/Users';
import CNP from './pages/CNP';
import Verification from './pages/Verification';
import ReadyToShipment from './pages/ReadyToShipment';
import Shiprocket from './pages/Shiprocket';
import NdrDetail from './pages/NdrDetail';
import FollowUp from './pages/FollowUp';
import CallAgain from './pages/CallAgain';
import Attendance from './pages/Attendance';
import OrderDetail from './pages/OrderDetail';
import AppointmentBook from './pages/AppointmentBook';
import DoctorDashboard from './pages/DoctorDashboard';
import ReorderCommission from './pages/ReorderCommission';
import Shipmaxx from './pages/Shipmaxx';
import NdrPage from './pages/NdrPage';
import ShipmaxxNdr from './pages/ShipmaxxNdr';
import ShipmaxxFollowup from './pages/ShipmaxxFollowup';
import Whatsapp from './pages/Whatsapp';

function AppRoutes() {
  const { user } = useAuth();
  return (
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
