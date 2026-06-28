import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Login from './auth/Login.jsx';
import Layout from './components/Layout.jsx';

// admin
import Users from './pages/admin/Users.jsx';
import Roles from './pages/admin/Roles.jsx';
import Settings from './pages/admin/Settings.jsx';
// owner
import Dashboard from './pages/owner/Dashboard.jsx';
import OwnerSubscriptions from './pages/owner/OwnerSubscriptions.jsx';
import Payments from './pages/owner/Payments.jsx';
import Products from './pages/owner/Products.jsx';
import Invoices from './pages/owner/Invoices.jsx';
import InvoiceView from './pages/owner/InvoiceView.jsx';
import InvoiceSettings from './pages/owner/InvoiceSettings.jsx';
import AuditLog from './pages/owner/AuditLog.jsx';
// customers (owner directory)
import CustomersList from './pages/customers/CustomersList.jsx';
import CustomerDetail from './pages/customers/CustomerDetail.jsx';
// shared / rep
import NewSubscription from './pages/rep/NewSubscription.jsx';
import RepDashboard from './pages/rep/RepDashboard.jsx';

export default function App() {
  const { user, loading, can, canScope } = useAuth();
  if (loading) return <div className="boot">Loading…</div>;
  if (!user) return <Login />;

  // Permission-driven routes. Each entry renders only if its guard passes; UI gating
  // is convenience — the server enforces via requirePermission_.
  const canSeeSubs = can('subscriptions', 'read');
  const subsAll = canScope('subscriptions', 'all');
  const routes = [];

  // Landing page: dashboard for users who can read it, else subscription list/own view.
  if (can('dashboard', 'read')) {
    routes.push({ path: '/', element: <Dashboard />, end: true });
  } else if (canSeeSubs && subsAll) {
    routes.push({ path: '/', element: <OwnerSubscriptions />, end: true });
  } else if (canSeeSubs) {
    routes.push({ path: '/', element: <RepDashboard />, end: true });
  } else if (can('users', 'read')) {
    routes.push({ path: '/', element: <Users />, end: true });
  }

  if (subsAll) routes.push({ path: '/subscriptions', element: <OwnerSubscriptions /> });
  if (can('customers', 'read')) {
    routes.push({ path: '/customers', element: <CustomersList /> });
    routes.push({ path: '/customers/:customerId', element: <CustomerDetail /> });
  }
  if (can('subscriptions', 'create')) routes.push({ path: '/new', element: <NewSubscription /> });
  if (can('payments', 'read')) routes.push({ path: '/payments', element: <Payments /> });
  if (can('products', 'read')) routes.push({ path: '/products', element: <Products /> });
  if (can('invoices', 'read')) {
    routes.push({ path: '/invoices', element: <Invoices /> });
    routes.push({ path: '/invoices/:invoiceId', element: <InvoiceView /> });
  }
  if (can('invoices', 'configure')) routes.push({ path: '/invoice-settings', element: <InvoiceSettings /> });
  if (can('users', 'read')) routes.push({ path: '/users', element: <Users /> });
  if (can('users', 'read')) routes.push({ path: '/roles', element: <Roles /> }); // view roles; edit controls gated on users:update
  if (can('settings', 'update') || can('settings', 'read')) routes.push({ path: '/settings', element: <Settings /> });
  if (can('audit', 'read')) routes.push({ path: '/audit', element: <AuditLog /> });

  return (
    <Layout>
      <Routes>
        {routes.map((r) => (
          <Route key={r.path} path={r.path} end={r.end} element={r.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
