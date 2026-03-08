import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardLayout from "./components/DashboardLayout";
import HomePage from "./pages/dashboard/HomePage";
import FinancePage from "./pages/dashboard/FinancePage";
import ExpensesPage from "./pages/dashboard/ExpensesPage";
import MeterPage from "./pages/dashboard/MeterPage";
import ArchivePage from "./pages/dashboard/ArchivePage";
import WorkersPage from "./pages/dashboard/WorkersPage";
import PlombaPage from "./pages/dashboard/PlombaPage";
import ReferralsPage from "./pages/dashboard/ReferralsPage";
import SecurityPage from "./pages/dashboard/SecurityPage";
import AIAssistantPage from "./pages/dashboard/AIAssistantPage";
import TelegramPage from "./pages/dashboard/TelegramPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isSuperAdmin } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (isSuperAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isSuperAdmin } = useAuth();
  if (!isLoggedIn || !isSuperAdmin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isSuperAdmin } = useAuth();
  if (isLoggedIn && isSuperAdmin) return <Navigate to="/admin" replace />;
  if (isLoggedIn) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<HomePage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="meter" element={<MeterPage />} />
              <Route path="archive" element={<ArchivePage />} />
              <Route path="workers" element={<WorkersPage />} />
              <Route path="plomba" element={<PlombaPage />} />
              <Route path="referrals" element={<ReferralsPage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="ai" element={<AIAssistantPage />} />
              <Route path="telegram" element={<TelegramPage />} />
            </Route>
            <Route path="/admin" element={<AdminRoute><SuperAdminPage /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
