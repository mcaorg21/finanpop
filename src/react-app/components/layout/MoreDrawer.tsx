import { NavLink } from "react-router";
import { LogOut } from "lucide-react";

import { cn } from "@/react-app/lib/utils";
import { Badge } from "@/react-app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/react-app/components/ui/avatar";
import { Button } from "@/react-app/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/react-app/components/ui/sheet";
import { useSession, selectTrialDaysRemaining, trialBadgeText } from "@/react-app/hooks/use-session";
import { initials } from "@/react-app/lib/format";
import { NAV_CADASTROS, NAV_EQUIPE, NAV_FOOTER, type NavItem } from "./nav";

function DrawerList({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ label, to, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground active:bg-muted"
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export default function MoreDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useSession((s) => s.user);
  const subscription = useSession((s) => s.subscription);
  const logout = useSession((s) => s.logout);
  const trialDays = useSession(selectTrialDaysRemaining);
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" mobileSide="bottom" className="max-lg:h-auto max-lg:max-h-[85dvh]" showCloseButton={false}>
        <SheetTitle className="sr-only">Mais opções</SheetTitle>
        <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-3">
            <Avatar className="size-10">
              <AvatarFallback>{initials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{subscription?.name ?? user?.username ?? ""}</p>
            </div>
            {subscription?.subscription_plan && <Badge variant="outline">{subscription.subscription_plan}</Badge>}
          </div>

          {trialDays !== null && (
            <NavLink to="/configuracoes" onClick={close} className="mt-2 block">
              <Badge variant={trialDays < 7 ? "destructive" : "secondary"} className="w-full justify-center">
                {trialBadgeText(trialDays)}
              </Badge>
            </NavLink>
          )}

          <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cadastros</p>
          <DrawerList items={NAV_CADASTROS} onNavigate={close} />
          <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Equipe</p>
          <DrawerList items={NAV_EQUIPE} onNavigate={close} />
          <div className="my-3 border-t border-border" />
          <DrawerList items={NAV_FOOTER} onNavigate={close} />
          <Button
            type="button"
            variant="ghost"
            className="mt-0.5 w-full justify-start gap-3 px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => { close(); logout(); }}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
