import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

/**
 * Confirmation Dialog Component
 * Addresses Issue #23: Confirmation dialogs for destructive actions
 * 
 * Replaces window.confirm with accessible modal dialogs
 */

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'danger',
  loading = false,
}) => {
  const variantConfig = {
    danger: {
      icon: <XCircle size={48} />,
      iconColor: 'text-error',
      buttonVariant: 'danger' as const,
    },
    warning: {
      icon: <AlertTriangle size={48} />,
      iconColor: 'text-warning',
      buttonVariant: 'accent' as const,
    },
    info: {
      icon: <Info size={48} />,
      iconColor: 'text-info',
      buttonVariant: 'primary' as const,
    },
    success: {
      icon: <CheckCircle size={48} />,
      iconColor: 'text-success',
      buttonVariant: 'success' as const,
    },
  };

  const config = variantConfig[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      closeOnBackdropClick={!loading}
      closeOnEscape={!loading}
    >
      <div className="text-center py-4">
        <div className={`inline-flex mb-4 ${config.iconColor}`}>
          {config.icon}
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {title}
        </h3>

        <p className="text-gray-600 mb-6">
          {message}
        </p>

        <div className="flex gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>

          <Button
            variant={config.buttonVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;