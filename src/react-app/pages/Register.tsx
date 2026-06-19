import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/react-app/components/ui/radio-group";
import { useToast } from "@/react-app/hooks/use-toast";
import { Building2, User, Lock, FileText, Mail, Shield } from "lucide-react";

// CNPJ validation function
const validateCNPJ = (cnpj: string): boolean => {
  cnpj = cnpj.replace(/[^\d]+/g, '');

  if (cnpj.length !== 14) return false;

  // Eliminate known invalid CNPJs
  if (/^(\d)\1+$/.test(cnpj)) return false;

  // Validate first check digit
  let length = cnpj.length - 2;
  let numbers = cnpj.substring(0, length);
  const digits = cnpj.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Validate second check digit
  length = length + 1;
  numbers = cnpj.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
};

// Format CNPJ
const formatCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 14) {
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return value;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [personType, setPersonType] = useState<"PF" | "PJ" | "">("");
  const [formData, setFormData] = useState({
    email: "",
    verification_code: "",
    company_name: "",
    cnpj: "",
    admin_name: "",
    username: "",
    password: "",
    confirm_password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personType) {
      toast({
        title: "Erro",
        description: "Selecione o tipo de cadastro",
        variant: "destructive",
      });
      return;
    }

    if (!codeVerified) {
      toast({
        title: "Erro",
        description: "Verifique seu email antes de criar a conta",
        variant: "destructive",
      });
      return;
    }
    
    if (formData.password !== formData.confirm_password) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    // Validate CNPJ for PJ
    if (personType === "PJ") {
      if (!formData.cnpj) {
        toast({
          title: "Erro",
          description: "CNPJ é obrigatório para pessoa jurídica",
          variant: "destructive",
        });
        return;
      }

      if (!validateCNPJ(formData.cnpj)) {
        toast({
          title: "Erro",
          description: "CNPJ inválido",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_type: personType,
          company_name: personType === "PJ" ? formData.company_name : formData.admin_name,
          cnpj: personType === "PJ" ? formData.cnpj.replace(/\D/g, '') : null,
          admin_name: formData.admin_name,
          username: formData.username,
          password: formData.password,
          email: formData.email,
          verification_code: formData.verification_code,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Track Google Ads conversion
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'conversion', {
            'send_to': 'AW-17943178867'
          });
        }
        
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Você já pode fazer login no sistema.",
        });
        navigate("/");
      } else {
        toast({
          title: "Erro ao cadastrar",
          description: data.error || "Tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === "cnpj") {
      setFormData({
        ...formData,
        [name]: formatCNPJ(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSendCode = async () => {
    if (!formData.email || !formData.email.includes("@")) {
      toast({
        title: "Erro",
        description: "Digite um email válido",
        variant: "destructive",
      });
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await res.json();

      if (res.ok) {
        setCodeSent(true);
        toast({
          title: "Código enviado!",
          description: "Verifique seu email e digite o código recebido.",
        });
      } else {
        toast({
          title: "Erro ao enviar código",
          description: data.error || "Tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!formData.verification_code || formData.verification_code.length !== 6) {
      toast({
        title: "Erro",
        description: "Digite o código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    setVerifyingCode(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: formData.email, 
          code: formData.verification_code 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCodeVerified(true);
        // Auto-fill username with email
        setFormData({
          ...formData,
          username: formData.email,
        });
        toast({
          title: "Email verificado!",
          description: "Agora você pode preencher os dados e criar sua conta.",
        });
      } else {
        toast({
          title: "Código inválido",
          description: data.error || "Verifique o código e tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive",
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img
              src="/logo-secgo.png"
              alt="FinanPOP"
              className="h-12"
            />
          </div>
          <CardTitle className="text-2xl text-center">Criar Conta</CardTitle>
          <CardDescription className="text-center">
            Cadastre-se para começar a usar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
              <Label className="text-base font-semibold">Tipo de Cadastro</Label>
              <RadioGroup
                value={personType}
                onValueChange={(value) => setPersonType(value as "PF" | "PJ")}
                className="grid grid-cols-2 gap-3"
              >
                <Label
                  htmlFor="pf"
                  className={`relative flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    personType === "PF"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="PF" id="pf" />
                  <span className="font-medium">
                    Pessoa Física
                  </span>
                </Label>
                <Label
                  htmlFor="pj"
                  className={`relative flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    personType === "PJ"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="PJ" id="pj" />
                  <span className="font-medium">
                    Pessoa Jurídica
                  </span>
                </Label>
              </RadioGroup>
            </div>

            {personType && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={loading || codeSent}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleSendCode}
                      disabled={sendingCode || !formData.email || codeSent}
                      variant="outline"
                    >
                      {sendingCode ? "Enviando..." : codeSent ? "Enviado" : "Enviar Código"}
                    </Button>
                  </div>
                </div>

                {codeSent && !codeVerified && (
                  <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Label htmlFor="verification_code" className="flex items-center gap-2 text-blue-900">
                      <Shield className="h-4 w-4" />
                      Código de Verificação *
                    </Label>
                    <p className="text-sm text-blue-700">
                      Digite o código de 6 dígitos enviado para seu email
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="verification_code"
                        name="verification_code"
                        type="text"
                        placeholder="000000"
                        value={formData.verification_code}
                        onChange={handleChange}
                        maxLength={6}
                        required
                        disabled={loading || codeVerified}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verifyingCode || !formData.verification_code || codeVerified}
                      >
                        {verifyingCode ? "Verificando..." : "Verificar"}
                      </Button>
                    </div>
                  </div>
                )}

                {codeVerified && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-sm font-medium text-green-800">✓ Email verificado com sucesso!</p>
                    <p className="text-xs text-green-700 mt-1">Agora preencha os dados abaixo para criar sua conta</p>
                  </div>
                )}

                {codeVerified && (
                  <>
                    {personType === "PJ" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="company_name" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Nome da Empresa
                          </Label>
                          <Input
                            id="company_name"
                            name="company_name"
                            type="text"
                            placeholder="Sua empresa"
                            value={formData.company_name}
                            onChange={handleChange}
                            required
                            disabled={loading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cnpj" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            CNPJ
                          </Label>
                          <Input
                            id="cnpj"
                            name="cnpj"
                            type="text"
                            placeholder="00.000.000/0000-00"
                            value={formData.cnpj}
                            onChange={handleChange}
                            maxLength={18}
                            required
                            disabled={loading}
                          />
                        </div>
                      </>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="admin_name" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Seu Nome
                      </Label>
                      <Input
                        id="admin_name"
                        name="admin_name"
                        type="text"
                        placeholder="Nome completo"
                        value={formData.admin_name}
                        onChange={handleChange}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Login
                      </Label>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        placeholder="seu.login"
                        value={formData.username}
                        onChange={handleChange}
                        required
                        disabled={true}
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        Login preenchido automaticamente com seu email
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Senha
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Confirmar Senha
                      </Label>
                      <Input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        placeholder="Digite a senha novamente"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        required
                        disabled={loading}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Cadastrando..." : "Criar Conta"}
                    </Button>
                  </>
                )}
              </>
            )}

            <div className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-primary hover:underline font-medium"
                disabled={loading}
              >
                Fazer login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
