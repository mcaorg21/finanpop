import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader } from "@/react-app/components/ui/card";
import { Input } from "@/react-app/components/ui/input";
import { Button } from "@/react-app/components/ui/button";
import { Label } from "@/react-app/components/ui/label";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("A senha deve ter no mínimo 6 caracteres");
    if (password !== confirm) return setError("As senhas não conferem");
    setIsLoading(true);
    try {
      const response = await fetch("/app/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (response.ok) {
        setDone(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Não foi possível alterar a senha.");
      }
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="text-center space-y-2 pb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Nova senha</h1>
          <CardDescription className="text-sm">Escolha uma nova senha para acessar o FinanPOP.</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-muted rounded-lg text-sm text-foreground">Senha alterada com sucesso.</div>
              <Button className="w-full h-12" onClick={() => navigate("/login")}>Ir para o login</Button>
            </div>
          ) : !token ? (
            <div className="space-y-4 text-center">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                Link inválido. Solicite um novo.
              </div>
              <Button className="w-full h-12" onClick={() => navigate("/esqueci-senha")}>Solicitar novo link</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Nova senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base" required autoComplete="new-password" placeholder="Mínimo de 6 caracteres" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-sm font-medium">Confirmar senha</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 text-base" required autoComplete="new-password" />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center">
                  {error}{" "}
                  {error.includes("expirado") && (
                    <button type="button" className="underline" onClick={() => navigate("/esqueci-senha")}>Solicitar novo link</button>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
