import { useEffect, useState } from "react";
import { AlertCircle, X, ChevronDown, ChevronUp } from "lucide-react";

interface PendingTransaction {
  id: number;
  description: string | null;
  category_name: string;
  due_date: string | null;
  amount: number;
  type: "REVENUE" | "EXPENSE";
}

const SESSION_KEY = "finanpop_pending_alert_dismissed";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export default function PendingAlert() {
  const [items, setItems] = useState<PendingTransaction[]>([]);
  const [dismissed, setDismissed] = useState(() => !!sessionStorage.getItem(SESSION_KEY));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    fetch(`/api/transactions?due_date_start=${start}&due_date_end=${end}&status=PENDING`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data: PendingTransaction[]) => {
        const expenses = data.filter((t) => t.type === "EXPENSE");
        setItems(expenses);
      })
      .catch(() => {});
  }, [dismissed]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  };

  if (dismissed || items.length === 0) return null;

  const total = items.reduce((s, t) => s + t.amount, 0);
  const overdue = items.filter(
    (t) => t.due_date && new Date(t.due_date + "T00:00:00") < new Date()
  );
  const visible = expanded ? items : items.slice(0, 3);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 shadow-xl rounded-xl border border-orange-400/40 bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-orange-500/10 border-b border-orange-400/30">
        <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
            {items.length} despesa{items.length > 1 ? "s" : ""} pendente{items.length > 1 ? "s" : ""} este mês
          </p>
          <p className="text-xs text-muted-foreground">
            Total: {formatCurrency(total)}
            {overdue.length > 0 && (
              <span className="ml-1 text-red-500 font-medium">· {overdue.length} atrasada{overdue.length > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-border max-h-60 overflow-y-auto">
        {visible.map((t) => {
          const isOverdue = t.due_date && new Date(t.due_date + "T00:00:00") < new Date();
          return (
            <div key={t.id} className="flex items-center gap-2 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{t.description || t.category_name}</p>
                {t.due_date && (
                  <p className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    Venc. {formatDate(t.due_date)}{isOverdue ? " · Atrasado" : ""}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-red-600 flex-shrink-0">
                {formatCurrency(t.amount)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Expand / collapse */}
      {items.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Ver mais {items.length - 3}</>
          )}
        </button>
      )}
    </div>
  );
}
