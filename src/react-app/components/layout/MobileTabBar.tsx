import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { Menu, Plus } from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { useTransactionSheet } from "@/react-app/hooks/use-transaction-sheet";
import { NAV_MAIN, NAV_MORE_ROUTES, isRouteActive } from "./nav";
import MoreDrawer from "./MoreDrawer";

const tabClass = (active: boolean) =>
  cn(
    "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
    active ? "text-foreground" : "text-muted-foreground"
  );

export default function MobileTabBar() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const openCreate = useTransactionSheet((s) => s.openCreate);

  const [inicio, lancamentos, relatorios] = NAV_MAIN;
  const moreActive = NAV_MORE_ROUTES.some((r) => isRouteActive(location.pathname, r));

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-nav border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {[inicio, lancamentos].map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => tabClass(isActive)}>
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}

          <div className="flex items-start justify-center">
            <button
              type="button"
              aria-label="Novo lançamento"
              onClick={() => openCreate()}
              className="-translate-y-4 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
            >
              <Plus className="size-7" />
            </button>
          </div>

          <NavLink to={relatorios.to} className={({ isActive }) => tabClass(isActive)}>
            <relatorios.icon className="size-5" />
            {relatorios.label}
          </NavLink>

          <button type="button" className={tabClass(moreActive || moreOpen)} onClick={() => setMoreOpen(true)}>
            <Menu className="size-5" />
            Mais
          </button>
        </div>
      </nav>

      <MoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
