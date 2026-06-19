import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import TopNav from "./TopNav";
import TutorialModal from "@/react-app/components/TutorialModal";
import { Loader2 } from "lucide-react";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          navigate("/", { replace: true });
          return;
        }

        // Check subscription status
        const subRes = await fetch("/api/tenant/subscription", { credentials: "include" });
        if (subRes.ok) {
          const data = await subRes.json();
          const now = new Date();
          
          // Check if trial or subscription is expired
          let expired = false;
          
          if (data.subscription_status === "TRIAL" && data.trial_ends_at) {
            const trialEnd = new Date(data.trial_ends_at);
            expired = now > trialEnd;
          } else if (data.subscription_status === "EXPIRED") {
            expired = true;
          } else if (data.subscription_ends_at) {
            const subEnd = new Date(data.subscription_ends_at);
            expired = now > subEnd;
          }
          
          setIsSubscriptionExpired(expired);
          
          // Redirect to configuracoes if expired and not already there
          if (expired && location.pathname !== "/configuracoes") {
            navigate("/configuracoes", { replace: true });
          }
        }
      } catch {
        navigate("/", { replace: true });
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, [navigate, location.pathname]);

  // Block navigation when subscription is expired
  useEffect(() => {
    if (isSubscriptionExpired && location.pathname !== "/configuracoes") {
      navigate("/configuracoes", { replace: true });
    }
  }, [location.pathname, isSubscriptionExpired, navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <TutorialModal />
      <main className="pt-16 min-h-screen">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
