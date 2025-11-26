import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Communities from "./pages/Communities.jsx";
import CommunityPosts from "./pages/CommunityPosts.jsx";
import Admin from "./pages/Admin.jsx";
import Validation from "./pages/Validation.jsx";
import RequirePrivileged from "./components/RequirePrivileged.jsx";
import NotFound from "./pages/NotFound.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";
import ChatWidget from './components/ChatWidget';
import { useAuth } from "@/contexts/AuthContext";
import TermsOfService from "./pages/TermsOfService.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

const queryClient = new QueryClient();

// Toggle this flag to switch between smoke test UI and the full app.
const USE_SMOKE_TEST = false;

const ChatWidgetGate = () => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const hideOn = new Set(['/login', '/register','/']);
  if (hideOn.has(location.pathname)) return null;
  return <ChatWidget />;
};

const FullApp = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ChatWidgetGate />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/communities/:id" element={<CommunityPosts />} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="/validation" element={<RequirePrivileged><Validation /></RequirePrivileged>} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

const SmokeApp = () => (
  <div style={{ padding: 24 }}>
    <h1>CareCircle — smoke test</h1>
    <p>If you see this, React and Vite are working; the full app was replaced for diagnostics.</p>
    <p>Navigate to <code>/dashboard</code> or other routes when the full app is restored.</p>
  </div>
)

const App = USE_SMOKE_TEST ? SmokeApp : FullApp

export default App;
