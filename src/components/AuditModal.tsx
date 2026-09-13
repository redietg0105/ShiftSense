import React, { useEffect, useRef } from 'react';
import { AuditEntry } from '../services/storage';
import {
  History,
  X,
  ShieldCheck,
  Clock,
  Download,
  FileText
} from 'lucide-react';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditEntry[];
  onExportCSV: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  logs,
  onExportCSV,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Move focus into the dialog on open, close on Escape, and return focus
  // to whatever triggered it on close (standard modal dialog behavior).
  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      aria-describedby="audit-modal-description"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 id="audit-modal-title" className="text-base font-bold text-slate-900">
                Schedule Authorization Audit Trail
              </h3>
              <p id="audit-modal-description" className="text-xs text-slate-500">
                Immutable compliance log of schedule reviews, overrides, and manager signatures.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close audit trail"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No schedule approvals logged yet in this session.</p>
              <p className="text-xs text-slate-400 mt-1">
                Approvals made in the Manager Workflow will automatically record timestamped entries here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{log.action}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                        {log.dateTarget}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs">{log.details}</p>
                    <div className="text-slate-400 text-[11px] flex items-center space-x-2">
                      <span>Authorized by: <strong className="text-slate-700">{log.userName}</strong> ({log.userRole})</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center space-x-1 shrink-0 self-start sm:self-center">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Stored persistently in browser localStorage.
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onExportCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download CSV</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
