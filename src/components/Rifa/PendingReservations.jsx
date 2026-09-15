import React from 'react';
import { Bell, Check, X, Phone, User } from 'lucide-react';

const PendingReservations = ({
  boletos = [],
  onApprove,
  onReject,
  loading = false,
}) => {
  if (!boletos || boletos.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 sm:p-5 rounded-3xl border border-amber-200 dark:border-amber-800/40 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-200/60 dark:bg-amber-800/60 flex items-center justify-center text-amber-800 dark:text-amber-200">
            <Bell className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wider">
            Reservas por Aprobar
          </h3>
        </div>
        <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
          {boletos.length} {boletos.length === 1 ? 'pendiente' : 'pendientes'}
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
        {boletos.map((item) => (
          <div
            key={item.boletoId || item.id || item.numero}
            className="bg-white dark:bg-gray-800 p-3 sm:p-3.5 rounded-2xl border border-amber-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-xs"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 text-xs">
                  #{item.numero}
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{item.nombre_comprador || item.nombre || 'Sin nombre'}</span>
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span>{item.telefono_comprador || item.telefono || 'Sin teléfono'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => onApprove && onApprove(item)}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                title="Aprobar reserva"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aprobar</span>
              </button>
              <button
                type="button"
                onClick={() => onReject && onReject(item)}
                disabled={loading}
                className="p-1.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-800/60 text-red-700 dark:text-red-300 font-bold text-xs transition flex items-center justify-center disabled:opacity-50 active:scale-95"
                title="Rechazar reserva"
                aria-label="Rechazar reserva"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingReservations;
