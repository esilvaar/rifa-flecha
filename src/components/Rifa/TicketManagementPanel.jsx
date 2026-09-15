import React from 'react';
import { Check, X, MousePointerClick } from 'lucide-react';

const TicketManagementPanel = ({
  selectedBoleto,
  boletosPendientes = [],
  savingSale = false,
  feedback = null,
  buyerName,
  setBuyerName,
  buyerPhone,
  setBuyerPhone,
  saleStatus,
  setSaleStatus,
  onSave,
  onCancel,
  onApprovePending,
  onRejectPending,
  onDelete,
  isAdmin = false
}) => {
  return (
    <div className="space-y-6 sticky top-6 lg:top-24">
      {/* Reservas Pendientes por Aprobar */}
      {boletosPendientes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-3xl border border-amber-200 dark:border-amber-800/40 shadow-sm">
          <h3 className="font-bold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Reservas por Aprobar</span>
            <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {boletosPendientes.length}
            </span>
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {boletosPendientes.map((item) => (
              <div
                key={item.boletoId || item.id || item.numero}
                className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-amber-100 dark:border-gray-700 flex justify-between items-center text-xs shadow-xs"
              >
                <div>
                  <span className="font-bold text-amber-600 dark:text-amber-400">#{item.numero}</span> • {item.nombre_comprador || item.nombre || 'Sin nombre'}
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{item.telefono_comprador || item.telefono || 'Sin teléfono'}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onApprovePending && onApprovePending(item)}
                    disabled={savingSale}
                    className="p-1.5 px-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold text-xs transition disabled:opacity-50 flex items-center justify-center"
                    title="Aprobar"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectPending && onRejectPending(item)}
                    disabled={savingSale}
                    className="p-1.5 px-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 font-bold text-xs transition disabled:opacity-50 flex items-center justify-center"
                    title="Rechazar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario de Gestión de Boleto */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {selectedBoleto ? `Gestionar Boleto #${selectedBoleto.numero}` : 'Gestionar Boleto'}
          </h3>
          {selectedBoleto && (
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-primary/10 text-primary">
              #{selectedBoleto.numero}
            </span>
          )}
        </div>

        {feedback && (
          <div
            className={`p-3 text-xs rounded-xl border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {selectedBoleto ? (
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Nombre Comprador *
                </label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+569..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white font-mono"
                />
              </div>

              {setSaleStatus && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Estado de la Venta
                  </label>
                  <select
                    value={saleStatus || 'pagado'}
                    onChange={(e) => setSaleStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white"
                  >
                    <option value="pagado">Pagado (Confirmado)</option>
                    <option value="reservado">Reservado (Pendiente de pago)</option>
                    {isAdmin && <option value="disponible">Disponible (Liberar)</option>}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={savingSale}
                className="w-full py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-50"
              >
                {savingSale ? 'Guardando...' : (selectedBoleto.estado === 'pagado' ? 'Actualizar Boleto' : 'Registrar Venta')}
              </button>

              {isAdmin && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={savingSale}
                  className="w-full py-2 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                >
                  Liberar Boleto
                </button>
              )}

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancelar Selección
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="py-8 text-center text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            <MousePointerClick className="w-8 h-8 mx-auto mb-2 text-primary opacity-60" />
            <p className="text-xs font-medium">Selecciona un boleto en la grilla</p>
            <p className="text-[10px] mt-0.5 text-gray-400">Haz clic en cualquier número para asignar y registrar su venta.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketManagementPanel;
