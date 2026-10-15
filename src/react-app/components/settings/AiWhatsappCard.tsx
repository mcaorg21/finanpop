import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Lock, MessageCircle } from "lucide-react";

import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { useAlert } from "@/react-app/hooks/use-alert";
import { useToast } from "@/react-app/hooks/use-toast";

interface Status {
  enterprise: boolean;
  models?: string[];
  openai?: { configured: boolean; last4: string | null; model: string };
  whatsapp?: { number: string | null; linked: boolean; phone: string | null; pending_code: string | null; pending_expires: string | null };
}

const json = { headers: { "Content-Type": "application/json" }, credentials: "include" as const };

const formatPhone = (key: string | null) => (key ? `+${key.slice(0, 2)} (${key.slice(2, 4)}) ${key.slice(4, key.length - 4)}-${key.slice(-4)}` : "");

export default function AiWhatsappCard() {
  const { toast } = useToast();
  const { confirm } = useAlert();
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/app/api/integrations/status", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as Status;
      setStatus(data);
      if (data.openai) setModel(data.openai.model);
    } catch { /* sem rede: o card fica em carregando */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const call = async (url: string, init: RequestInit, okMessage?: string) => {
    const res = await fetch(url, { credentials: "include", ...init });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: data.error || "Erro ao salvar", variant: "destructive" });
      return null;
    }
    if (okMessage) toast({ title: okMessage });
    return data;
  };

  const saveOpenAI = async () => {
    setSaving(true);
    try {
      const ok = await call("/app/api/integrations/openai", { ...json, method: "PUT", body: JSON.stringify({ api_key: apiKey || undefined, model }) }, apiKey ? "Chave validada e salva" : "Modelo atualizado");
      if (ok) { setApiKey(""); await load(); }
    } finally {
      setSaving(false);
    }
  };

  const removeOpenAI = async () => {
    if (!(await confirm({ title: "Remover chave da OpenAI?", message: "O lançamento por WhatsApp para de funcionar até você cadastrar outra chave.", variant: "destructive" }))) return;
    if (await call("/app/api/integrations/openai", { method: "DELETE" }, "Chave removida")) await load();
  };

  const startLink = async () => {
    setLinking(true);
    try {
      if (await call("/app/api/integrations/whatsapp/link", { ...json, method: "POST", body: JSON.stringify({ phone }) })) await load();
    } finally {
      setLinking(false);
    }
  };

  const unlink = async () => {
    if (!(await confirm({ title: "Desvincular WhatsApp?", message: "Este número deixa de lançar despesas no FinanPOP.", variant: "destructive" }))) return;
    if (await call("/app/api/integrations/whatsapp/link", { method: "DELETE" }, "WhatsApp desvinculado")) await load();
  };

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base font-semibold">
        <Bot className="size-4" /> IA e WhatsApp
        <Badge variant="outline" className="text-xs">Enterprise</Badge>
      </CardTitle>
      <CardDescription>Lance despesas mandando texto, áudio ou foto da nota pelo WhatsApp.</CardDescription>
    </CardHeader>
  );

  if (!status) {
    return <Card>{header}<CardContent><Loader2 className="size-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  if (!status.enterprise) {
    return (
      <Card>
        {header}
        <CardContent>
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>
              Este recurso é exclusivo do <strong className="text-foreground">plano Enterprise</strong>. Envie uma mensagem como
              &ldquo;gastei 45,90 no mercado no pix&rdquo;, um áudio ou a foto de uma nota fiscal e a IA registra o lançamento para você
              confirmar. Fale com a gente para contratar.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { openai, whatsapp, models = [] } = status;

  return (
    <Card>
      {header}
      <CardContent className="space-y-6">
        {/* OpenAI */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Chave da OpenAI</Label>
            {openai?.configured && <Badge variant="success">Configurada · …{openai.last4}</Badge>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              placeholder={openai?.configured ? "Digite para substituir a chave" : "sk-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1"
            />
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveOpenAI} disabled={saving || (!apiKey && !openai?.configured)}>
              {saving && <Loader2 className="animate-spin" />} {apiKey ? "Validar e salvar" : "Salvar modelo"}
            </Button>
            {openai?.configured && <Button size="sm" variant="outline" onClick={removeOpenAI}>Remover chave</Button>}
          </div>
          <p className="text-xs text-muted-foreground">
            A chave é guardada criptografada e usada só para interpretar suas mensagens; o custo é cobrado na sua conta OpenAI.
          </p>
        </div>

        {/* WhatsApp */}
        <div className="space-y-3 border-t pt-6">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="size-4" /> WhatsApp</Label>
            {whatsapp?.linked && <Badge variant="success">Vinculado · {formatPhone(whatsapp.phone)}</Badge>}
          </div>

          {whatsapp?.linked ? (
            <>
              <p className="text-sm text-muted-foreground">
                Envie despesas para {whatsapp.number ? <strong className="text-foreground">{whatsapp.number}</strong> : "o número do FinanPOP"}.
                Você sempre confirma antes de lançar.
              </p>
              <Button size="sm" variant="outline" onClick={unlink}>Desvincular</Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input inputMode="tel" placeholder="Seu WhatsApp com DDD, ex.: (11) 99999-8888" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={startLink} disabled={linking || !phone.trim()}>
                  {linking && <Loader2 className="animate-spin" />} Gerar código
                </Button>
              </div>
              {whatsapp?.pending_code && (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                  Para confirmar que o número é seu, envie esta mensagem
                  {whatsapp.number ? <> para <strong>{whatsapp.number}</strong></> : " para o WhatsApp do FinanPOP"}:
                  <div className="mt-2 rounded bg-background px-3 py-2 text-center font-mono text-lg font-semibold tracking-wider">
                    VINCULAR {whatsapp.pending_code}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>O código vale por 15 minutos.</span>
                    <Button size="sm" variant="ghost" onClick={load}>Já enviei</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
