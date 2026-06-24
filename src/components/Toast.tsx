'use client';

import { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type?: 'info' | 'error' | 'success';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 2500 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const colors = {
    info: 'border-slate-500/40 bg-slate-900/90 text-slate-200',
    error: 'border-red-500/40 bg-red-900/90 text-red-200',
    success: 'border-green-500/40 bg-green-900/90 text-green-200',
  };

  return (
    <div className="fixed top-6 left-1/2 z-[100] -translate-x-1/2 animate-pulse">
      <div className={`rounded-lg border px-5 py-2.5 text-sm font-medium shadow-xl backdrop-blur-md ${colors[type]}`}>
        {message}
      </div>
    </div>
  );
}
