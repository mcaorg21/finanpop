import { useNavigate } from "react-router";

import { Badge } from "@/react-app/components/ui/badge";
import { useSession, selectTrialDaysRemaining } from "@/react-app/hooks/use-session";
import { LOGO_SRC } from "./nav";

export default function MobileHeader() {
  const navigate = useNavigate();
  const trialDays = useSession(selectTrialDaysRemaining);

  return (
    <header className="sticky top-0 z-nav flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2.5">
        <img src={LOGO_SRC} alt="" className="size-7 object-contain" />
        <span className="font-semibold tracking-tight">FinanPOP</span>
      </div>
      {trialDays !== null && (
        <Badge
          variant={trialDays < 7 ? "destructive" : "secondary"}
          className="cursor-pointer"
          onClick={() => navigate("/configuracoes")}
        >
          {trialDays <= 0 ? "Teste expirado" : `${trialDays} ${trialDays === 1 ? "dia" : "dias"} de teste`}
        </Badge>
      )}
    </header>
  );
}
