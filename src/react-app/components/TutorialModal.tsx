import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/react-app/components/ui/dialog";
import { Button } from "@/react-app/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function TutorialModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the tutorial
    const dismissed = localStorage.getItem("tutorialDismissed");
    if (!dismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("tutorialDismissed", "true");
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Dicas para começar</DialogTitle>
          <DialogDescription className="text-base">
            Siga estes passos para configurar o sistema
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Cadastre os <span className="font-semibold">Centros de Custo</span> que são os locais/projetos/conta pessoal que você vai gerenciar
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Cadastre os <span className="font-semibold">Funcionários</span> caso os tenha (pessoas que trabalham nos centros de custo)
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Verifique as <span className="font-semibold">Categorias</span> (tipos de despesa e receita)
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Comece a fazer <span className="font-semibold">Registros</span> de receitas e despesas
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              5
            </div>
            <div className="flex-1">
              <p className="text-sm">
                Use os <span className="font-semibold">Relatórios</span> para acompanhar a evolução financeira
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <Button onClick={handleDismiss}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Não mostrar novamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
