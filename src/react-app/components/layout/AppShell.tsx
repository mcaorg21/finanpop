import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";

import TutorialModal from "@/react-app/components/TutorialModal";
import TransactionSheet from "@/react-app/components/transactions/TransactionSheet";
import { useSession, selectIsExpired } from "@/react-app/hooks/use-session";
import Sidebar from "./Sidebar";
import MobileHeader from "./MobileHeader";
import MobileTabBar from "./MobileTabBar";

export default function AppShell() {
  const location = useLocation();
  const status = useSession((s) => s.status);
  const load = useSession((s) => s.load);
  const refresh = useSession((s) => s.refresh);
  const isExpired = useSession(selectIsExpired);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/" replace />;
  }

  if (isExpired && location.pathname !== "/configuracoes") {
    return <Navigate to="/configuracoes" replace />;
  }

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <MobileHeader />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 pb-24 lg:p-8 lg:pb-8">
          <Outlet />
        </div>
      </main>
      <MobileTabBar />
      <TransactionSheet />
      <TutorialModal />
    </div>
  );
}
