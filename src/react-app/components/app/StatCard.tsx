import * as React from "react"

import { cn } from "@/react-app/lib/utils"
import { Card } from "@/react-app/components/ui/card"
import { Skeleton } from "@/react-app/components/ui/skeleton"

const toneClass = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted-foreground",
} as const

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
  loading = false,
  onClick,
  className,
}: {
  label: string
  value: React.ReactNode
  tone?: keyof typeof toneClass
  hint?: React.ReactNode
  loading?: boolean
  onClick?: () => void
  className?: string
}) {
  const clickable = !!onClick
  return (
    <Card
      size="sm"
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.() } } : undefined}
      className={cn(
        "gap-1 px-4 py-4",
        clickable && "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-28" />
      ) : (
        <p className={cn("truncate text-xl font-semibold tabular-nums lg:text-2xl", toneClass[tone])}>{value}</p>
      )}
      {hint && !loading && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  )
}
