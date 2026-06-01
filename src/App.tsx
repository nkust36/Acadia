import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/auth/RouteGuards";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Analysis from "@/pages/Analysis";
import AddExpense from "@/pages/AddExpense";
import CategorySettings from "@/pages/CategorySettings";
import Feed from "@/pages/Feed";
import Login from "@/pages/Login";
import ExpenseDetail from "@/pages/ExpenseDetail";
import Records from "@/pages/Records";
import Plaza from "@/pages/Plaza";
import Friends from "@/pages/Friends";
import Chat from "@/pages/Chat";
import Profile from "@/pages/Profile";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import PrivacySettings from "@/pages/PrivacySettings";
import UserProfile from "@/pages/UserProfile";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/add" element={<AddExpense />} />
        <Route path="/categories" element={<CategorySettings />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/records/:expenseId" element={<ExpenseDetail />} />
        <Route path="/records" element={<Records />} />
        <Route path="/plaza" element={<Plaza />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:friendUid" element={<Chat />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/settings" element={<ProfileSettingsPage />} />
        <Route path="/profile/privacy" element={<PrivacySettings />} />
        <Route path="/profile/:uid" element={<UserProfile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
