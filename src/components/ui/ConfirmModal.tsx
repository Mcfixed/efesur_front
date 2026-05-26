import React, { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { IconAlertTriangle } from "@tabler/icons-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDestructive = true,
}: ConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="max-w-md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4 text-text-200">
          <div className={`p-3 rounded-full ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-brand-100/10 text-brand-100'}`}>
            <IconAlertTriangle size={24} />
          </div>
          <div className="flex-1 mt-1">
            {message}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {cancelText}
          </Button>
          <Button 
            variant={isDestructive ? "danger" : "primary"} 
            onClick={handleConfirm} 
            isLoading={isSubmitting}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
