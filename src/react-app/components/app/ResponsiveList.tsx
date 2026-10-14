import * as React from "react"

import { cn } from "@/react-app/lib/utils"
import { Card } from "@/react-app/components/ui/card"
import { Skeleton } from "@/react-app/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/react-app/components/ui/table"

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  headClassName?: string
  align?: "left" | "right" | "center"
}

const breakpointClass = {
  md: { table: "hidden md:block", cards: "md:hidden" },
  lg: { table: "hidden lg:block", cards: "lg:hidden" },
} as const

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const

/**
 * Tabela em telas largas, lista de cards abaixo do breakpoint. Mesmos dados,
 * mesmas ações — substitui a tabela+cards duplicados que cada página mantinha.
 */
export function ResponsiveList<T>({
  rows,
  columns,
  rowKey,
  renderCard,
  breakpoint = "lg",
  isLoading = false,
  skeletonRows = 6,
  emptyState,
  rowClassName,
  onRowClick,
  footer,
  className,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  renderCard: (row: T) => React.ReactNode
  breakpoint?: "md" | "lg"
  isLoading?: boolean
  skeletonRows?: number
  emptyState?: React.ReactNode
  rowClassName?: (row: T) => string | undefined
  onRowClick?: (row: T) => void
  footer?: React.ReactNode
  className?: string
}) {
  const bp = breakpointClass[breakpoint]
  const isEmpty = !isLoading && rows.length === 0

  return (
    <Card className={cn("gap-0 py-0", className)}>
      {/* Tabela */}
      <div className={bp.table}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.key} className={cn(c.align && alignClass[c.align], c.headClassName)}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <Skeleton className="h-4 w-full max-w-[9rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {isEmpty && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="whitespace-normal p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer", rowClassName?.(row))}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn(c.align && alignClass[c.align], c.className)}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Cards */}
      <div className={cn(bp.cards, "divide-y divide-border")}>
        {isLoading &&
          Array.from({ length: Math.min(skeletonRows, 4) }).map((_, i) => (
            <div key={`skc-${i}`} className="space-y-2 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        {isEmpty && emptyState}
        {!isLoading &&
          rows.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("p-4", onRowClick && "cursor-pointer active:bg-muted/50", rowClassName?.(row))}
            >
              {renderCard(row)}
            </div>
          ))}
      </div>

      {footer && <div className="border-t border-border px-3 py-2 sm:px-4">{footer}</div>}
    </Card>
  )
}
