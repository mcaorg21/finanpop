import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/react-app/lib/utils"
import { Button } from "@/react-app/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select"

function pageWindow(page: number, pageCount: number, radius = 2): number[] {
  const start = Math.max(1, page - radius)
  const end = Math.min(pageCount, page + radius)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)
  return pages
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50],
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  className?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1
  const last = Math.min(total, current * pageSize)

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 text-sm", className)}>
      <p className="text-muted-foreground tabular-nums">
        {total === 0 ? "Nenhum registro" : `${first}–${last} de ${total}`}
      </p>

      <div className="flex items-center gap-1">
        {onPageSizeChange && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="mr-2 w-[7.5rem]" aria-label="Itens por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft />
        </Button>

        <div className="hidden items-center gap-1 lg:flex">
          {pageWindow(current, pageCount).map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === current ? "secondary" : "ghost"}
              size="sm"
              className="min-w-8 px-2 tabular-nums"
              aria-current={p === current ? "page" : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ))}
        </div>
        <span className="px-1 text-muted-foreground tabular-nums lg:hidden">
          {current}/{pageCount}
        </span>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Próxima página"
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
