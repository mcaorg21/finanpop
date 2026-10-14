import { create } from 'zustand';
import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

import {
  AlertDialog as AlertDialogRoot,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/react-app/components/ui/alert-dialog';
import { cn } from '@/react-app/lib/utils';

type AlertType = 'info' | 'success' | 'error' | 'warning';

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: AlertType;
  onClose?: () => void;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertStore extends AlertState {
  showAlert: (config: Omit<AlertState, 'isOpen'>) => void;
  hideAlert: () => void;
}

interface ConfirmStore extends ConfirmState {
  showConfirm: (config: Omit<ConfirmState, 'isOpen'>) => Promise<boolean>;
  hideConfirm: (confirmed: boolean) => void;
  resolvePromise?: (value: boolean) => void;
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
  showAlert: (config) => set({ ...config, isOpen: true }),
  hideAlert: () => {
    const { onClose } = get();
    set({ isOpen: false, onClose: undefined });
    onClose?.();
  },
}));

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'default',
  showConfirm: (config) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        variant: 'default',
        onConfirm: undefined,
        onCancel: undefined,
        ...config,
        isOpen: true,
        resolvePromise: resolve,
      });
    });
  },
  hideConfirm: (confirmed) => {
    const { resolvePromise, onConfirm, onCancel } = get();
    if (confirmed && onConfirm) onConfirm();
    if (!confirmed && onCancel) onCancel();
    if (resolvePromise) resolvePromise(confirmed);
    set({ isOpen: false, resolvePromise: undefined });
  },
}));

export const useAlert = () => {
  const { showAlert } = useAlertStore();
  const { showConfirm } = useConfirmStore();

  return {
    alert: (message: string, title = 'Aviso', type: AlertType = 'info') => {
      showAlert({ title, message, type });
    },
    success: (message: string, title = 'Sucesso') => {
      showAlert({ title, message, type: 'success' });
    },
    error: (message: string, title = 'Erro') => {
      showAlert({ title, message, type: 'error' });
    },
    warning: (message: string, title = 'Atenção') => {
      showAlert({ title, message, type: 'warning' });
    },
    confirm: (config: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      variant?: 'default' | 'destructive';
    }) => {
      return showConfirm(config);
    },
  };
};

const alertIcons = {
  info: AlertCircle,
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
} as const;

const alertTone: Record<AlertType, { bg: string; icon: string }> = {
  info: { bg: 'bg-muted', icon: 'text-foreground' },
  success: { bg: 'bg-success/10', icon: 'text-success' },
  error: { bg: 'bg-danger/10', icon: 'text-danger' },
  warning: { bg: 'bg-warning/10', icon: 'text-warning' },
};

export function AlertDialog() {
  const { isOpen, title, message, type, hideAlert } = useAlertStore();
  const Icon = alertIcons[type];
  const tone = alertTone[type];

  return (
    <AlertDialogRoot open={isOpen} onOpenChange={(open) => { if (!open) hideAlert(); }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className={tone.bg}>
            <Icon className={cn('size-7', tone.icon)} />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={hideAlert}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogRoot>
  );
}

export function ConfirmDialog() {
  const { isOpen, title, message, confirmText, cancelText, variant, hideConfirm } = useConfirmStore();
  const destructive = variant === 'destructive';

  return (
    <AlertDialogRoot open={isOpen} onOpenChange={(open) => { if (!open) hideConfirm(false); }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className={destructive ? 'bg-danger/10' : 'bg-warning/10'}>
            <AlertTriangle className={cn('size-7', destructive ? 'text-danger' : 'text-warning')} />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => hideConfirm(false)}>{cancelText || 'Cancelar'}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => hideConfirm(true)}
          >
            {confirmText || 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogRoot>
  );
}
