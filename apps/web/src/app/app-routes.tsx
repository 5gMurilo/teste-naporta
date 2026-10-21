import { Navigate, Route, Routes } from 'react-router';
import { LoginRoute } from '@/features/auth/login-route';
import { useSession } from '@/features/auth/session-provider';
import { OrderDetailPage } from '@/features/orders/order-detail-page';
import { OrdersListPage } from '@/features/orders/orders-list-page';
import { AppLayout } from './app-layout';
import { NotFound } from './not-found';
import { ProtectedRoute } from './protected-route';

function Home() {
  const { state } = useSession();
  return <Navigate to={state.status === 'authenticated' ? '/orders' : '/login'} replace />;
}

/** Route table only; the router and the session are provided by the caller. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/orders" element={<OrdersListPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
