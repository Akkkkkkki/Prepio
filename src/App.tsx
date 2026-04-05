import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import { AuthProvider, useAuthContext } from "./components/AuthProvider";
import OfflineBanner from "@/components/OfflineBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createAuthReturnState } from "./lib/researchDraft";

const queryClient = new QueryClient();
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Practice = lazy(() => import("./pages/Practice"));
const History = lazy(() => import("./pages/History"));
const Profile = lazy(() => import("./pages/Profile"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

interface ProtectedRouteProps {
  children: JSX.Element;
}

const RouteFallback = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-28 rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return <RouteFallback />;
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        state={createAuthReturnState({ pathname: location.pathname + location.search })}
        replace
      />
    );
  }

  return children;
};

const RouteElement = ({ children }: ProtectedRouteProps) => (
  <Suspense fallback={<RouteFallback />}>{children}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-2 focus:left-2 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md">
            Skip to main content
          </a>
          <OfflineBanner />
          <Routes>
            <Route path="/auth" element={<RouteElement><Auth /></RouteElement>} />
            <Route path="/" element={<RouteElement><Home /></RouteElement>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <RouteElement>
                    <Dashboard />
                  </RouteElement>
                </ProtectedRoute>
              }
            />
            <Route
              path="/practice"
              element={
                <ProtectedRoute>
                  <RouteElement>
                    <Practice />
                  </RouteElement>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <RouteElement>
                    <History />
                  </RouteElement>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <RouteElement>
                    <Profile />
                  </RouteElement>
                </ProtectedRoute>
              }
            />
            <Route
              path="/search/:searchId"
              element={
                <ProtectedRoute>
                  <RouteElement>
                    <Dashboard />
                  </RouteElement>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<RouteElement><NotFound /></RouteElement>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
