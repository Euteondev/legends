import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Shell } from "@/components/layout/Shell";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import AlbumPage from "@/pages/album";
import RankingPage from "@/pages/ranking";
import MissionsPage from "@/pages/missions";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <Shell>
      <Component />
    </Shell>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/">
        <ProtectedRoute component={HomePage} />
      </Route>
      <Route path="/album">
        <ProtectedRoute component={AlbumPage} />
      </Route>
      <Route path="/ranking">
        <ProtectedRoute component={RankingPage} />
      </Route>
      <Route path="/missions">
        <ProtectedRoute component={MissionsPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
