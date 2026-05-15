import React, { useEffect } from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  testId?: string;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, onClose, title, message, testId }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-md animate-in fade-in duration-300"
      aria-modal="true"
      aria-labelledby="modal-title"
      data-testid={testId}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-md bg-surface-container border border-error/20 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        role="alert"
      >
        {/* Error Header */}
        <div className="bg-error-container/10 p-lg flex flex-col items-center text-center space-y-md border-b border-error/10">
          <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-on-error-container shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 15c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 id="modal-title" className="font-headline-md text-headline-md text-error">
            {title}
          </h2>
        </div>

        {/* Message Body */}
        <div className="p-lg">
          <p className="text-on-surface-variant text-body-lg text-center leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="p-lg pt-0">
          <button
            onClick={onClose}
            className="w-full py-md px-lg bg-error text-on-error font-bold rounded-xl hover:bg-error/90 active:scale-[0.98] transition-all shadow-lg shadow-error/20"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
