import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/react-app/lib/utils"
import { Button } from "@/react-app/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/react-app/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/react-app/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  /** Termos extras para a busca (ex.: nome da categoria pai). */
  keywords?: string[]
  description?: string
  group?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nada encontrado.",
  disabled = false,
  allowClear = false,
  className,
  id,
  "aria-invalid": ariaInvalid,
}: {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  allowClear?: boolean
  className?: string
  id?: string
  "aria-invalid"?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)

  const groups = React.useMemo(() => {
    const map = new Map<string, ComboboxOption[]>()
    for (const o of options) {
      const key = o.group ?? ""
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return Array.from(map.entries())
  }, [options])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between font-normal md:h-9",
            !selected && "text-muted-foreground",
            ariaInvalid && "border-destructive",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {allowClear && selected && (
              <X
                className="size-4 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onValueChange("")
                }}
              />
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map(([group, items]) => (
              <CommandGroup key={group || "__default"} heading={group || undefined}>
                {items.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    keywords={o.keywords}
                    disabled={o.disabled}
                    onSelect={() => {
                      onValueChange(o.value)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("mr-2 size-4", o.value === value ? "opacity-100" : "opacity-0")} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.description && (
                        <span className="truncate text-xs text-muted-foreground">{o.description}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
