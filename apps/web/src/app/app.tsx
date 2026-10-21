import { BrowserRouter } from 'react-router';
import { SessionProvider } from '@/features/auth/session-provider';
import { AppRoutes } from './app-routes';

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}
