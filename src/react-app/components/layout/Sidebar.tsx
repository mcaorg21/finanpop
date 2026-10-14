import { NavLink } from "react-router";
import { LogOut, Plus } from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { initials } from "@/react-app/lib/format";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/react-app/components/ui/avatar";
import { useSession, selectTrialDaysRemaining, trialBadgeText } from "@/react-app/hooks/use-session";
import { useTransactionSheet } from "@/react-app/hooks/use-transaction-sheet";
import { LOGO_SRC, NAV_CADASTROS, NAV_EQUIPE, NAV_FOOTER, NAV_MAIN, type NavItem } from "./nav";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-muted font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  );

function NavList({ items }: { items: NavItem[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ label, to, icon: Icon }) => (
        <li key={to}>
          <NavLink to={to} className={linkClass}>
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const user = useSession((s) => s.user);
  const subscription = useSession((s) => s.subscription);
  const logout = useSession((s) => s.logout);
  const trialDays = useSession(selectTrialDaysRemaining);
  const openCreate = useTransactionSheet((s) => s.openCreate);

  return (
    <aside className="fixed inset-y-0 left-0 z-nav hidden w-64 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
        <img src={LOGO_SRC} alt="" className="size-8 object-contain" />
        <span className="font-semibold tracking-tight">FinanPOP</span>
      </div>

      <div className="px-4 pt-4">
        <Button type="button" size="lg" className="w-full" onClick={() => openCreate()}>
          <Plus />
          Novo lançamento
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        <NavList items={NAV_MAIN} />
        <SectionLabel>Cadastros</SectionLabel>
        <NavList items={NAV_CADASTROS} />
        <SectionLabel>Equipe</SectionLabel>
        <NavList items={NAV_EQUIPE} />
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{subscription?.name ?? user?.username ?? ""}</p>
          </div>
          {subscription?.subscription_plan && (
            <Badge variant="outline" className="shrink-0">{subscription.subscription_plan}</Badge>
          )}
        </div>

        {trialDays !== null && (
          <NavLink to="/configuracoes" className="block px-2 pb-2">
            <Badge variant={trialDays < 7 ? "destructive" : "secondary"} className="w-full justify-center">
              {trialBadgeText(trialDays)}
            </Badge>
          </NavLink>
        )}

        <NavList items={NAV_FOOTER} />
        <Button
          type="button"
          variant="ghost"
          className="mt-0.5 w-full justify-start gap-3 px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => logout()}
        >
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
