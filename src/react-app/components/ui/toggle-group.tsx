import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/react-app/lib/utils"

// Controle segmentado (Despesa | Receita, Pendente | Pago, presets de período...).

const toggleGroupVariants = cva("inline-flex items-center gap-1 rounded-lg bg-muted p-1", {
  variants: {
    full: {
      true: "flex w-full",
      false: "",
    },
  },
  defaultVariants: { full: false },
})

const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium text-muted-foreground transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "h-7 px-2.5 text-xs",
        default: "h-8 px-3 text-sm",
        lg: "h-10 px-4 text-sm",
      },
      full: {
        true: "flex-1",
        false: "",
      },
    },
    defaultVariants: { size: "default", full: false },
  }
)

type ItemVariants = VariantProps<typeof toggleGroupItemVariants>

const ToggleGroupContext = React.createContext<ItemVariants>({ size: "default", full: false })

function ToggleGroup({
  className,
  size = "default",
  full = false,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & ItemVariants) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(toggleGroupVariants({ full }), className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ size, full }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  size,
  full,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & ItemVariants) {
  const ctx = React.useContext(ToggleGroupContext)
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(toggleGroupItemVariants({ size: size ?? ctx.size, full: full ?? ctx.full }), className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
