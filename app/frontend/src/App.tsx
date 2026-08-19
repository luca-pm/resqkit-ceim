import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { IncidentProvider } from '@/lib/incidentContext';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import Index from './pages/Index';
import Consent from './pages/Consent';
import Profile from './pages/Profile';
import Emergency from './pages/Emergency';
import Handoff from './pages/Handoff';
import Review from './pages/Review';
import Regulations from './pages/Regulations';
import Kits from './pages/Kits';
import Learn from './pages/Learn';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
// MODULE_IMPORTS_START
// MODULE_IMPORTS_END

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/consent" element={<Consent />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/emergency" element={<Emergency />} />
    <Route path="/handoff" element={<Handoff />} />
    <Route path="/review" element={<Review />} />
    <Route path="/regulations" element={<Regulations />} />
    <Route path="/kits" element={<Kits />} />
    <Route path="/learn" element={<Learn />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/settings" element={<Settings />} />
    {/* MODULE_ROUTES_START */}
    {/* MODULE_ROUTES_END */}
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* MODULE_PROVIDERS_START */}
    {/* MODULE_PROVIDERS_END */}
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <IncidentProvider>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </IncidentProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    {/* MODULE_PROVIDERS_CLOSE */}
  </QueryClientProvider>
);

export default App;
export { AppRoutes };