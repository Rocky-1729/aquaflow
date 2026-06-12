import React, { useEffect } from 'react';
import { X, Sparkles, Bell, RefreshCw, Compass } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'warning';
  time: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export default function NotificationToast({ toasts, onRemove }: NotificationToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        // Handle icons based on alert style
        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-slate-900/95 backdrop-blur border border-slate-800 text-white rounded-xl shadow-2xl p-4 flex gap-3 items-start animate-slide-in hover:border-sky-500/50 transition-all duration-300"
            style={{
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 mt-0.5">
              <Bell className="h-4 w-4 animate-bounce" />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-sans tracking-wide text-zinc-150 uppercase">
                  {toast.title}
                </h4>
                <span className="text-[9px] text-slate-500 font-mono">{toast.time}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-sans">{toast.desc}</p>
            </div>

            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 text-slate-500 hover:text-white rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {/* Embedded SlideIn CSS */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(1.5rem) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
