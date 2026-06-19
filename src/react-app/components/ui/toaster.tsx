import { useToast } from "@/react-app/hooks/use-toast";
import { X } from "lucide-react";
import { cn } from "@/react-app/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "relative pointer-events-auto flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-right-full",
            toast.variant === "destructive"
              ? "border-destructive/50 bg-destructive text-destructive-foreground"
              : "border-border bg-background text-foreground"
          )}
        >
          <div className="flex-1 space-y-1">
            {toast.title && (
              <p className="text-sm font-semibold">{toast.title}</p>
            )}
            {toast.description && (
              <p className="text-sm opacity-90">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
