import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Loader2, Lock, MessageCircle } from "lucide-react";

import { Badge } from "@/react-app/components/ui/badge";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react-app/components/ui/select";
import { Switch } from "@/react-app/components/ui/switch";
import { useAlert } from "@/react-app/hooks/use-alert";
import { useToast } from "@/react-app/hooks/use-toast";

interface Status {
  enterprise: boolean;
  models?: string[];
  openai?: { configured: boolean; last4: string | null; model: string };
  whatsapp?: {
    number: string | null;
    linked: boolean;
    phone: string | null;
    pending_code: string | null;
    pending_expires: string | null;
    notice?: { enabled: boolean; hour: number };
  };
}

/** Mesmo intervalo aceito pelo servidor (NOTICE_MIN_HOUR..NOTICE_MAX_HOUR em whatsapp/daily-notice.ts). */
const NOTICE_HOURS = Array.from({ length: 18 }, (_, i) => i + 5);

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
  const [subscribing, setSubscribing] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);

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

  const saveNotice = async (change: { enabled?: boolean; hour?: number }) => {
    setSavingNotice(true);
    try {
      if (await call("/app/api/integrations/whatsapp/notice", { ...json, method: "PUT", body: JSON.stringify(change) }, change.enabled === undefined ? "Horário atualizado" : change.enabled ? "Aviso diário ativado" : "Aviso diário desativado")) await load();
    } finally {
      setSavingNotice(false);
    }
  };

  const unlink = async () => {
    if (!(await confirm({ title: "Desvincular WhatsApp?", message: "Este número deixa de lançar despesas no FinanPOP.", variant: "destructive" }))) return;
    if (await call("/app/api/integrations/whatsapp/link", { method: "DELETE" }, "WhatsApp desvinculado")) await load();
  };

  const subscribe = async () => {
    setSubscribing(true);
    try {
      const data = await call("/app/api/tenant/create-payment-link", { ...json, method: "POST", body: JSON.stringify({ plan: "ENTERPRISE" }) });
      if (data?.url) window.open(data.url, "_blank");
    } finally {
      setSubscribing(false);
    }
  };

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base font-semibold">
        <Bot className="size-4" /> IA e WhatsApp
        <Badge variant="outline" className="text-xs">Enterprise</Badge>
      </CardTitle>
      <CardDescription>Lance, consulte gastos e veja gráficos pelo WhatsApp, por texto, áudio ou foto da nota.</CardDescription>
    </CardHeader>
  );

  if (!status) {
    return <Card>{header}<CardContent><Loader2 className="size-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  if (!status.enterprise) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>
              Este recurso é exclusivo do <strong className="text-foreground">plano Enterprise</strong>. Atualize o seu plano para
              lançar despesas, consultar gastos e ver gráficos direto pelo WhatsApp.
            </p>
          </div>
          <ul className="space-y-1.5 text-sm">
            {[
              "Lance por texto, áudio ou foto da nota fiscal: a IA preenche e você só confirma",
              "Pergunte quanto gastou, o saldo e as contas a vencer",
              "Receba gráficos e resumos dos seus gastos em imagem",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3 rounded-lg border p-4">
            <p>
              <span className="text-2xl font-semibold">R$ 39,90</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </p>
            <Button className="w-full gap-2" onClick={subscribe} disabled={subscribing}>
              {subscribing && <Loader2 className="animate-spin" />}
              {subscribing ? "Gerando link..." : "Atualizar para o plano Enterprise"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Você usa a sua própria chave da OpenAI, e o custo da IA é cobrado por ela. Depois da confirmação do pagamento, o plano
              Enterprise é liberado na sua conta.
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
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="daily-notice" className="text-sm font-medium">Aviso diário das contas do dia</Label>
                    <p className="text-xs text-muted-foreground">
                      Todo dia o FinanPOP manda no WhatsApp as contas que vencem e as atrasadas, e não envia nada nos dias sem conta.
                      Pela regra do WhatsApp, só chega se você tiver enviado alguma mensagem para ele nas últimas 24 horas.
                    </p>
                  </div>
                  <Switch
                    id="daily-notice"
                    checked={!!whatsapp.notice?.enabled}
                    disabled={savingNotice}
                    onCheckedChange={(enabled) => saveNotice({ enabled })}
                  />
                </div>
                {whatsapp.notice?.enabled && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>A partir das</span>
                    <Select value={String(whatsapp.notice.hour)} onValueChange={(h) => saveNotice({ hour: Number(h) })} disabled={savingNotice}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NOTICE_HOURS.map((h) => <SelectItem key={h} value={String(h)}>{h}h</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
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
