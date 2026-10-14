import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/react-app/lib/utils"
import { Button } from "@/react-app/components/ui/button"
import { Checkbox } from "@/react-app/components/ui/checkbox"
import { Input } from "@/react-app/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/react-app/components/ui/popover"

export interface MultiSelectOption {
  value: string
  label: string
  /** Recuo visual para itens filhos (ex.: subcategorias). */
  indent?: boolean
}

export function MultiSelectPopover({
  options,
  value,
  onChange,
  placeholder = "Todos",
  label,
  searchable = true,
  size = "default",
  className,
}: {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Prefixo no botão, ex.: "Categorias". */
  label?: string
  searchable?: boolean
  size?: "sm" | "default"
  className?: string
}) {
  const [query, setQuery] = React.useState("")
  const selectedSet = React.useMemo(() => new Set(value), [value])

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? "1 selecionado"
        : `${value.length} selecionados`

  const toggle = (v: string, checked: boolean) => {
    if (checked) onChange([...value, v])
    else onChange(value.filter((x) => x !== v))
  }

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn("w-full justify-between font-normal", value.length === 0 && "text-muted-foreground", className)}
        >
          <span className="truncate">
            {label && <span className="text-muted-foreground">{label}: </span>}
            <span className={cn(value.length > 0 && "text-foreground")}>{summary}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] gap-0 p-0" align="start">
        {searchable && (
          <div className="border-b border-border p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-8 md:h-8"
            />
          </div>
        )}
        <div className="max-h-[280px] overflow-y-auto p-1">
          {visible.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          )}
          {visible.map((o) => {
            const checked = selectedSet.has(o.value)
            return (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                  o.indent && "pl-6"
                )}
              >
                <Checkbox checked={checked} onCheckedChange={(c) => toggle(o.value, c === true)} />
                <span className="truncate">{o.label}</span>
              </label>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">{value.length} de {options.length}</span>
          <Button type="button" variant="ghost" size="xs" disabled={value.length === 0} onClick={() => onChange([])}>
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
