import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { X } from "lucide-react"

import { cn } from "@/react-app/lib/utils"
import { Button } from "@/react-app/components/ui/button"

// Painel lateral (desktop) / folha inferior ou tela cheia (mobile), sobre o mesmo
// primitivo do Dialog. Breakpoint de layout: lg (igual ao sidebar/barra inferior).

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-overlay bg-black/60",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

type SheetSide = "right" | "left" | "bottom"
type SheetSize = "sm" | "md" | "lg" | "full"
type SheetMobileSide = "bottom" | "full"

const desktopWidth: Record<SheetSize, string> = {
  sm: "lg:w-[400px]",
  md: "lg:w-[520px]",
  lg: "lg:w-[720px]",
  full: "lg:w-full",
}

const desktopSide: Record<SheetSide, string> = {
  right:
    "lg:inset-y-0 lg:right-0 lg:h-dvh lg:border-l lg:data-[state=open]:slide-in-from-right lg:data-[state=closed]:slide-out-to-right",
  left:
    "lg:inset-y-0 lg:left-0 lg:h-dvh lg:border-r lg:data-[state=open]:slide-in-from-left lg:data-[state=closed]:slide-out-to-left",
  bottom:
    "lg:inset-x-0 lg:bottom-0 lg:max-h-[85dvh] lg:w-full lg:border-t lg:rounded-t-2xl lg:data-[state=open]:slide-in-from-bottom lg:data-[state=closed]:slide-out-to-bottom",
}

const mobileSideClass: Record<SheetMobileSide, string> = {
  bottom:
    "max-lg:inset-x-0 max-lg:bottom-0 max-lg:h-[92dvh] max-lg:border-t max-lg:rounded-t-2xl max-lg:data-[state=open]:slide-in-from-bottom max-lg:data-[state=closed]:slide-out-to-bottom",
  full:
    "max-lg:inset-0 max-lg:h-dvh max-lg:data-[state=open]:slide-in-from-bottom max-lg:data-[state=closed]:slide-out-to-bottom",
}

function SheetContent({
  className,
  children,
  side = "right",
  size = "md",
  mobileSide = "bottom",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide
  size?: SheetSize
  mobileSide?: SheetMobileSide
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-sheet flex flex-col bg-background border-border shadow-lg outline-none duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          desktopSide[side],
          side !== "bottom" && desktopWidth[size],
          mobileSideClass[mobileSide],
          className
        )}
        {...props}
      >
        {mobileSide === "bottom" && (
          <div aria-hidden className="lg:hidden mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        )}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button variant="ghost" size="icon-sm" className="absolute right-3 top-3">
              <X className="size-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 px-4 pt-4 pb-3 pr-14 sm:px-6", className)}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border bg-background px-4 pt-3 sm:flex-row sm:justify-end sm:px-6",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
