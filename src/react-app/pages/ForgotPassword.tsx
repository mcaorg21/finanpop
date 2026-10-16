import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader } from "@/react-app/components/ui/card";
import { Input } from "@/react-app/components/ui/input";
import { Button } from "@/react-app/components/ui/button";
import { Label } from "@/react-app/components/ui/label";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/app/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      if (response.ok) {
        setSent(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Não foi possível enviar. Tente novamente.");
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
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Recuperar senha</h1>
          <CardDescription className="text-sm">
            Informe seu e-mail ou usuário e enviaremos um link para criar uma nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-muted rounded-lg text-sm text-foreground">
                Se houver uma conta com esses dados, enviamos um link para o e-mail cadastrado. O link vale por 1 hora.
                Não encontrou? Confira a pasta de <strong>spam</strong> ou lixo eletrônico.
              </div>
              <Button className="w-full h-12" onClick={() => navigate("/login")}>
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm font-medium">E-mail ou usuário</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="voce@email.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-12 text-base"
                  required
                  autoComplete="username"
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading || !identifier.trim()}>
                {isLoading ? "Enviando..." : "Enviar link"}
              </Button>

              <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                <button type="button" onClick={() => navigate("/login")} className="text-primary hover:underline font-medium">
                  Voltar ao login
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
