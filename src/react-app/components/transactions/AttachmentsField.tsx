import { Camera, Paperclip, X } from "lucide-react";

import { Button } from "@/react-app/components/ui/button";
import { Label } from "@/react-app/components/ui/label";
import { useAlert } from "@/react-app/hooks/use-alert";
import { useToast } from "@/react-app/hooks/use-toast";
import { formatFileSize, getFileTypeLabel } from "@/react-app/lib/format";

export interface Attachment {
  id: number;
  transaction_id: number;
  filename: string;
  original_name: string;
  content_type: string;
  size: number;
}

function FileRow({
  typeLabel,
  name,
  size,
  onView,
  onRemove,
}: {
  typeLabel: string;
  name: string;
  size: number;
  onView?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1.5">
      <span className="shrink-0 rounded border border-border px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
        {typeLabel}
      </span>
      <span className="flex-1 truncate text-sm">{name}</span>
      <span className="text-xs text-muted-foreground">{formatFileSize(size)}</span>
      {onView && (
        <Button type="button" variant="ghost" size="xs" onClick={onView}>
          Ver
        </Button>
      )}
      <Button type="button" variant="ghost" size="icon-xs" className="text-destructive" aria-label="Remover" onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}

export function AttachmentsField({
  pendingFiles,
  onPendingChange,
  existing,
  onExistingChange,
}: {
  pendingFiles: File[];
  onPendingChange: (files: File[]) => void;
  existing: Attachment[];
  onExistingChange: (items: Attachment[]) => void;
}) {
  const { confirm } = useAlert();
  const { toast } = useToast();

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onPendingChange([...pendingFiles, ...Array.from(e.target.files)]);
    }
    e.target.value = "";
  };

  const deleteExisting = async (attachment: Attachment) => {
    const ok = await confirm({
      title: "Excluir anexo?",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/app/api/attachments/${attachment.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        onExistingChange(existing.filter((a) => a.id !== attachment.id));
        toast({ title: "Anexo excluído" });
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Anexos</Label>
      <div className="flex gap-2">
        <label className="flex-1">
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={addFiles}
            className="hidden"
          />
          <Button type="button" variant="outline" className="w-full" asChild>
            <span><Paperclip /> Adicionar arquivo</span>
          </Button>
        </label>
        <label>
          <input type="file" accept="image/*" capture="environment" onChange={addFiles} className="hidden" />
          <Button type="button" variant="outline" asChild>
            <span><Camera /> Câmera</span>
          </Button>
        </label>
      </div>

      {existing.length > 0 && (
        <div className="space-y-1.5">
          {existing.map((a) => (
            <FileRow
              key={a.id}
              typeLabel={getFileTypeLabel(a.content_type)}
              name={a.original_name}
              size={a.size}
              onView={() => window.open(`/app/api/attachments/${a.id}/download`, "_blank")}
              onRemove={() => deleteExisting(a)}
            />
          ))}
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Novos arquivos (enviados ao salvar):</p>
          {pendingFiles.map((file, i) => (
            <FileRow
              key={`${file.name}-${i}`}
              typeLabel={getFileTypeLabel(file.type)}
              name={file.name}
              size={file.size}
              onRemove={() => onPendingChange(pendingFiles.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
