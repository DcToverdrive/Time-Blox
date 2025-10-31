import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmColorClass?: string;
    cancelColorClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Yes, Delete',
    cancelText = 'No, Cancel',
    confirmColorClass = 'bg-red-600 hover:bg-red-500',
    cancelColorClass = 'bg-slate-700/50 hover:bg-slate-600/50'
}) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onCancel}
            aria-modal="true"
            role="dialog"
            aria-labelledby="confirmation-title"
        >
            <div
                className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-sm p-6 border border-slate-700 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="confirmation-title" className="text-xl font-bold mb-2 text-slate-200">{title}</h2>
                <p className="text-slate-400 mb-6">{message}</p>
                <div className="flex justify-center gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className={`px-6 py-2 text-sm font-semibold text-slate-300 rounded-md transition-colors ${cancelColorClass}`}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-6 py-2 text-sm font-semibold text-white rounded-md transition-colors ${confirmColorClass}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;