import { MoreHorizontal, type LucideIcon } from "lucide-react"

import { cn } from "@/react-app/lib/utils"
import { Button } from "@/react-app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/react-app/components/ui/dropdown-menu"

export interface RowAction {
  label: string
  onSelect: () => void
  icon?: LucideIcon
  destructive?: boolean
  disabled?: boolean
  hidden?: boolean
  /** Linha divisória antes deste item. */
  separatorBefore?: boolean
}

/** Menu "⋯" de ações — o mesmo componente na linha da tabela e no card mobile. */
export function RowActionsMenu({
  actions,
  ariaLabel = "Ações",
  className,
}: {
  actions: RowAction[]
  ariaLabel?: string
  className?: string
}) {
  const visible = actions.filter((a) => !a.hidden)
  if (visible.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={ariaLabel}
          className={cn("shrink-0", className)}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44" onClick={(e) => e.stopPropagation()}>
        {visible.map((a, i) => (
          <div key={a.label}>
            {a.separatorBefore && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={a.disabled}
              onSelect={() => a.onSelect()}
              className={cn(a.destructive && "text-destructive focus:text-destructive")}
            >
              {a.icon && <a.icon className="size-4" />}
              {a.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
