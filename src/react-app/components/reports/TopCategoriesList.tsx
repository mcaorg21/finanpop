import { cn } from "@/react-app/lib/utils";
import { formatCurrency } from "@/react-app/lib/format";

export interface CategorySlice {
  id: number | null; // null = "Outros"
  name: string;
  value: number;
  color: string;
}

/** Lista com barras em div (sem SVG — sai íntegra no PDF). Serve de legenda clicável do donut. */
export function TopCategoriesList({
  slices,
  total,
  selectedId,
  onSelect,
  className,
}: {
  slices: CategorySlice[];
  total: number;
  selectedId: number | null;
  onSelect?: (id: number | null) => void;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-1.5", className)}>
      {slices.map((s) => {
        const pct = total > 0 ? (s.value / total) * 100 : 0;
        const clickable = !!onSelect && s.id != null;
        const active = selectedId != null && selectedId === s.id;
        const dimmed = selectedId != null && !active;
        return (
          <li key={s.id ?? "others"}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect?.(active ? null : s.id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors",
                clickable && "hover:bg-muted/60",
                active && "bg-muted",
                dimmed && "opacity-50"
              )}
            >
              <span className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatCurrency(s.value)}</span>
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
              </span>
              <span className="block h-1 w-full overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: s.color }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
