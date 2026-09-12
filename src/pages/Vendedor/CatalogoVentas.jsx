import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';
import { getOrganizationRifas, getBoletosByRifa, updateBoletoVenta } from '../../services/organizationService';

const CatalogoVentas = () => {
  const { user, logout } = useAuth();
  const { activeOrg, role } = useOrganization();

  const [rifas, setRifas] = useState([]);
  const [selectedRifa, setSelectedRifa] = useState(null);
  const [boletos, setBoletos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoleto, setSelectedBoleto] = useState(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [saleStatus, setSaleStatus] = useState('pagado');
  const [savingSale, setSavingSale] = useState(false);
  const [feedback, setFeedback] = useState(null);

  /**
   * Cargar rifas de la organización activa
   */
  const loadRifas = useCallback(async () => {
    if (!activeOrg?.id) return;
    setLoading(true);
    try {
      const data = await getOrganizationRifas(activeOrg.id);
      setRifas(data);
      if (data.length > 0) {
        setSelectedRifa(data[0]);
      }
    } catch (err) {
      console.error('Error cargando rifas:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.id]);

  /**
   * Cargar boletos de la rifa seleccionada
   */
  const loadBoletos = useCallback(async () => {
    if (!selectedRifa?.id) return;
    try {
      const data = await getBoletosByRifa(selectedRifa.id);
      setBoletos(data);
    } catch (err) {
      console.error('Error cargando boletos:', err);
    }
  }, [selectedRifa?.id]);

  useEffect(() => {
    loadRifas();
  }, [loadRifas]);

  useEffect(() => {
    loadBoletos();
  }, [loadBoletos]);

  const handleOpenSaleModal = (boleto) => {
    // Si el boleto ya está vendido por otro vendedor, no permitir editarlo
    if (boleto.estado !== 'disponible' && boleto.vendedor_id !== user?.id && role !== 'admin') {
      return;
    }

    setSelectedBoleto(boleto);
    setBuyerName(boleto.nombre_comprador || '');
    setBuyerPhone(boleto.telefono_comprador || '');
    setSaleStatus(boleto.estado === 'disponible' ? 'pagado' : boleto.estado);
    setFeedback(null);
  };

  const handleSaveSale = async (e) => {
    e.preventDefault();
    if (!selectedBoleto || !buyerName.trim()) return;

    setSavingSale(true);
    try {
      await updateBoletoVenta(selectedBoleto.id, {
        nombre_comprador: buyerName.trim(),
        telefono_comprador: buyerPhone.trim(),
        vendedor_id: user?.id,
        estado: saleStatus,
      });

      setFeedback({
        type: 'success',
        message: `¡Boleto #${selectedBoleto.numero} registrado con éxito!`,
      });

      await loadBoletos();

      setTimeout(() => {
        setSelectedBoleto(null);
        setFeedback(null);
      }, 1200);
    } catch (err) {
      console.error('Error guardando venta:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error al registrar venta',
      });
    } finally {
      setSavingSale(false);
    }
  };

  // Mis métricas de vendedor
  const misBoletos = boletos.filter((b) => b.vendedor_id === user?.id);
  const totalRecaudado = misBoletos.reduce((acc) => acc + (parseFloat(selectedRifa?.precio) || 0), 0);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white transition-colors">
      {/* Header del Vendedor */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎟️</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                {activeOrg?.nombre || 'Organización'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Portal de Ventas • <span className="font-semibold text-primary">{user?.nombre || user?.email}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Métricas rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Boletos Vendidos por Mí</p>
            <p className="text-3xl font-bold text-primary mt-1">{misBoletos.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Recaudado por Mí</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${totalRecaudado.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Precio por Boleto</p>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-200 mt-1">${parseFloat(selectedRifa?.precio || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Selector de Rifa */}
        {rifas.length > 1 && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Seleccionar Rifa:</label>
            <select
              value={selectedRifa?.id || ''}
              onChange={(e) => {
                const found = rifas.find((r) => r.id === e.target.value);
                setSelectedRifa(found);
              }}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
            >
              {rifas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.titulo} (${parseFloat(r.precio).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Estado de carga */}
        {loading && (
          <div className="py-12 text-center text-xs text-gray-500">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
            Cargando rifas y boletos...
          </div>
        )}

        {/* Si no hay rifas creadas */}
        {!loading && rifas.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700 max-w-lg mx-auto">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-bold">No hay rifas activas</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tu administrador aún no ha creado rifas en esta organización.
            </p>
          </div>
        )}

        {/* Cuadrícula de Boletos */}
        {!loading && selectedRifa && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedRifa.titulo}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedRifa.descripcion || 'Haz clic en un boleto disponible para registrar una venta.'}</p>
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                  <span className="text-gray-600 dark:text-gray-400">Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-emerald-500" />
                  <span className="text-gray-600 dark:text-gray-400">Vendido por Mí</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-amber-400" />
                  <span className="text-gray-600 dark:text-gray-400">Reservado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-gray-400 opacity-50" />
                  <span className="text-gray-600 dark:text-gray-400">Otro Vendedor</span>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-20 gap-2">
              {boletos.map((boleto) => {
                const isMine = boleto.vendedor_id === user?.id;
                const isSold = boleto.estado === 'pagado';
                const isPending = boleto.estado === 'reservado';
                const isAvailable = boleto.estado === 'disponible';

                let colorClasses = 'bg-gray-50 dark:bg-gray-700/60 hover:bg-primary/20 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';

                if (isMine && isSold) {
                  colorClasses = 'bg-emerald-500 text-white font-bold border-emerald-600 shadow-sm';
                } else if (isMine && isPending) {
                  colorClasses = 'bg-amber-400 text-gray-900 font-bold border-amber-500';
                } else if (!isAvailable) {
                  colorClasses = 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 opacity-40 cursor-not-allowed';
                }

                return (
                  <button
                    key={boleto.id}
                    onClick={() => handleOpenSaleModal(boleto)}
                    disabled={!isAvailable && !isMine && role !== 'admin'}
                    className={`aspect-square rounded-xl text-xs font-semibold border flex items-center justify-center transition active:scale-95 ${colorClasses}`}
                    title={
                      isAvailable
                        ? `Boleto #${boleto.numero} - Disponible`
                        : `Boleto #${boleto.numero} - ${boleto.nombre_comprador || 'Ocupado'}`
                    }
                  >
                    {boleto.numero}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal para Registrar Venta */}
      {selectedBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-lg">
                Registrar Boleto #{selectedBoleto.numero}
              </h3>
              <button
                onClick={() => setSelectedBoleto(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                ✕
              </button>
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

            <form onSubmit={handleSaveSale} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nombre del Comprador
                </label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Estado de la Venta
                </label>
                <select
                  value={saleStatus}
                  onChange={(e) => setSaleStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                >
                  <option value="pagado">Pagado (Confirmado)</option>
                  <option value="reservado">Reservado (Pendiente de pago)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedBoleto(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSale}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  {savingSale ? 'Guardando...' : 'Confirmar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogoVentas;
