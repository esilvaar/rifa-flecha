import React from 'react';
import { X, Ticket, DollarSign, User, Phone, Check, Trash2 } from 'lucide-react';

const TicketModal = ({
  isOpen,
  onClose,
  selectedBoleto,
  selectedNumbers = [],
  ticketPrice = 0,
  buyerName,
  setBuyerName,
  buyerPhone,
  setBuyerPhone,
  saleStatus,
  setSaleStatus,
  onSave,
  savingSale = false,
  onDelete = null,
  isAdmin = false,
  feedback = null,
}) => {
  if (!isOpen) return null;

  // Normalizar lista de números
  const numbersList =
    selectedNumbers && selectedNumbers.length > 0
      ? selectedNumbers
      : selectedBoleto?.numero
      ? [selectedBoleto.numero]
      : [];

  if (numbersList.length === 0) return null;

  const isMultiple = numbersList.length > 1;
  const totalPrice = numbersList.length * (parseFloat(ticketPrice) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border-t sm:border border-gray-100 dark:border-gray-700 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Barra superior de arrastre móvil */}
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight">
                {isMultiple
                  ? `Venta de ${numbersList.length} Boletos`
                  : `Gestionar Boleto #${numbersList[0]}`}
              </h3>
              {isMultiple && totalPrice > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  <DollarSign className="w-3 h-3" />
                  Total a recaudar: ${totalPrice.toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de números seleccionados */}
        <div className="mb-4 p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              {isMultiple ? 'Boletos seleccionados:' : 'Boleto seleccionado:'}
            </span>
            <span className="text-[11px] font-bold text-primary">
              {numbersList.length} {numbersList.length === 1 ? 'número' : 'números'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
            {numbersList.map((num) => (
              <span
                key={num}
                className="px-2.5 py-1 rounded-lg font-bold text-xs bg-primary/10 text-primary border border-primary/20"
              >
                #{num}
              </span>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`mb-4 p-3 text-xs rounded-xl border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                Nombre del Comprador *
              </label>
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Nombre y apellido"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                Teléfono / WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="+56912345678"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Estado de la Venta
              </label>
              <select
                value={saleStatus || 'pagado'}
                onChange={(e) => setSaleStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-gray-900 dark:text-white"
              >
                <option value="pagado">Pagado (Confirmado)</option>
                <option value="reservado">Reservado (Pendiente de pago)</option>
                {isAdmin && <option value="disponible">Disponible (Liberar)</option>}
              </select>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={savingSale}
              className="w-full py-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <Check className="w-4 h-4" />
              {savingSale ? (
                'Guardando...'
              ) : isMultiple ? (
                `Confirmar Venta (${numbersList.length} Boletos)`
              ) : selectedBoleto?.estado === 'pagado' ? (
                'Actualizar Boleto'
              ) : (
                'Confirmar Venta'
              )}
            </button>

            {isAdmin && onDelete && !isMultiple && (
              <button
                type="button"
                onClick={onDelete}
                disabled={savingSale}
                className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Liberar Boleto (Eliminar registro)
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={savingSale}
              className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketModal;

