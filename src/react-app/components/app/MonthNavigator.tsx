import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/react-app/lib/utils"
import { Button } from "@/react-app/components/ui/button"
import { currentMonth, formatMonthLabel, shiftMonth } from "@/react-app/lib/format"

/** ◀ Outubro 2026 ▶ com atalho "Hoje". `value` no formato YYYY-MM. */
export function MonthNavigator({
  value,
  onChange,
  showToday = true,
  className,
}: {
  value: string
  onChange: (ym: string) => void
  showToday?: boolean
  className?: string
}) {
  const isCurrent = value === currentMonth()
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Mês anterior"
        onClick={() => onChange(shiftMonth(value, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-[9.5rem] select-none text-center text-sm font-medium tabular-nums">
        {formatMonthLabel(value)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Próximo mês"
        onClick={() => onChange(shiftMonth(value, 1))}
      >
        <ChevronRight />
      </Button>
      {showToday && !isCurrent && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(currentMonth())}>
          Hoje
        </Button>
      )}
    </div>
  )
}
