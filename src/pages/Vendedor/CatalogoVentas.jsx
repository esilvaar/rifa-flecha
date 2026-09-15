import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';
import { useNavigate } from 'react-router-dom';
import { getOrganizationRifas, getBoletosByRifa, updateBoletoVenta, updateBoletosBatch } from '../../services/organizationService';
import RifaGrid from '../../components/Rifa/RifaGrid';
import PendingReservations from '../../components/Rifa/PendingReservations';
import TicketModal from '../../components/Rifa/TicketModal';
import {
  Ticket,
  DollarSign,
  Award,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  LogOut,
  ArrowLeft,
  Store,
} from 'lucide-react';

const CatalogoVentas = () => {
  const { user, logout } = useAuth();
  const { activeOrg, role } = useOrganization();
  const navigate = useNavigate();

  const [rifas, setRifas] = useState([]);
  const [selectedRifa, setSelectedRifa] = useState(null);
  const [boletos, setBoletos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoleto, setSelectedBoleto] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [saleStatus, setSaleStatus] = useState('pagado');
  const [savingSale, setSavingSale] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);

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
        setPageIndex(0);
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
    if (!selectedRifa) return;
    try {
      const data = await getBoletosByRifa(selectedRifa.id);
      setBoletos(data.sort((a, b) => a.numero - b.numero));
    } catch (err) {
      console.error('Error cargando boletos:', err);
    }
  }, [selectedRifa]);

  useEffect(() => {
    loadRifas();
  }, [loadRifas]);

  useEffect(() => {
    loadBoletos();
  }, [loadBoletos]);

  // Selección de número en la grilla (soporta múltiple para disponibles y unitario para ocupados)
  const handleNumberClick = (number) => {
    const boleto = boletos.find((b) => b.numero === number);
    if (!boleto) return;

    const isMine = boleto.vendedor_id === user?.id;
    const isOrphanPending = boleto.estado === 'reservado' && !boleto.vendedor_id;
    const isAvailable = boleto.estado === 'disponible';

    // Si es un boleto vendido por mí o una reserva que puedo gestionar, abrir individualmente
    if (!isAvailable) {
      if (isMine || role === 'admin' || isOrphanPending) {
        setSelectedBoleto(boleto);
        setSelectedNumbers([number]);
        setBuyerName(boleto.nombre_comprador || '');
        setBuyerPhone(boleto.telefono_comprador || '+569');
        setSaleStatus(boleto.estado === 'reservado' ? 'pagado' : boleto.estado);
        setFeedback(null);
        setIsTicketModalOpen(true);
      }
      return;
    }

    // Si es disponible, acumular o desmarcar en selección múltiple
    setSelectedNumbers((prev) => {
      const exists = prev.includes(number);
      const next = exists ? prev.filter((n) => n !== number) : [...prev, number];
      if (next.length === 1 && !exists) {
        setSelectedBoleto(boleto);
      } else if (next.length === 0) {
        setSelectedBoleto(null);
      }
      return next;
    });
  };

  // Guardar venta de uno o múltiples boletos
  const handleSaveSale = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!buyerName.trim() || !selectedRifa?.id) return;

    const numbersToSave = selectedNumbers.length > 0 ? selectedNumbers : (selectedBoleto ? [selectedBoleto.numero] : []);
    if (numbersToSave.length === 0) return;

    setSavingSale(true);
    try {
      if (numbersToSave.length > 1) {
        await updateBoletosBatch(selectedRifa.id, numbersToSave, {
          nombre_comprador: buyerName.trim(),
          telefono_comprador: buyerPhone.trim(),
          vendedor_id: user?.id,
          estado: saleStatus,
        });

        setFeedback({
          type: 'success',
          message: `¡${numbersToSave.length} boletos registrados con éxito!`,
        });
      } else {
        const singleNum = numbersToSave[0];
        const singleBoleto = boletos.find((b) => b.numero === singleNum) || selectedBoleto;
        await updateBoletoVenta(singleBoleto.id, {
          nombre_comprador: buyerName.trim(),
          telefono_comprador: buyerPhone.trim(),
          vendedor_id: user?.id,
          estado: saleStatus,
        });

        setFeedback({
          type: 'success',
          message: `¡Boleto #${singleNum} registrado con éxito!`,
        });
      }

      await loadBoletos();

      setTimeout(() => {
        setIsTicketModalOpen(false);
        setSelectedNumbers([]);
        setSelectedBoleto(null);
        setFeedback(null);
        setBuyerName('');
        setBuyerPhone('+569');
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

  const handleApprovePending = async (boleto) => {
    setSavingSale(true);
    try {
      await updateBoletoVenta(boleto.id, {
        nombre_comprador: boleto.nombre_comprador,
        telefono_comprador: boleto.telefono_comprador,
        vendedor_id: user?.id,
        estado: 'pagado',
      });
      await loadBoletos();
    } catch (err) {
      console.error('Error aprobando:', err);
    } finally {
      setSavingSale(false);
    }
  };

  const handleRejectPending = async (boleto) => {
    setSavingSale(true);
    try {
      await updateBoletoVenta(boleto.id, {
        nombre_comprador: null,
        telefono_comprador: null,
        vendedor_id: null,
        estado: 'disponible',
      });
      await loadBoletos();
    } catch (err) {
      console.error('Error rechazando:', err);
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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center p-1 border border-gray-200 dark:border-gray-600 shadow-sm flex-shrink-0">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold leading-tight truncate">
                {activeOrg?.nombre || 'Organización'}
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                Portal de Ventas • <span className="font-semibold text-primary">{user?.nombre || user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs font-semibold px-3 py-1.5 sm:py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Panel Admin</span>
              </button>
            )}

            <button
              onClick={() => logout()}
              className="text-xs font-semibold px-3 py-1.5 sm:py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center gap-1.5 text-gray-700 dark:text-gray-200"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Boletos Vendidos</p>
              <Ticket className="w-4 h-4 text-primary opacity-80" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-primary mt-1">{misBoletos.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Total Recaudado</p>
              <DollarSign className="w-4 h-4 text-emerald-600 opacity-80" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${totalRecaudado.toLocaleString()}</p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Precio por Boleto</p>
              <Award className="w-4 h-4 text-gray-500 opacity-80" />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200 mt-1">${parseFloat(selectedRifa?.precio || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Selector de Rifa */}
        {rifas.length > 1 && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Seleccionar Rifa:</label>
            <select
              value={selectedRifa?.id || ''}
              onChange={(e) => {
                const found = rifas.find((r) => r.id === e.target.value);
                setSelectedRifa(found);
                setPageIndex(0);
                setSelectedBoleto(null);
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
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 sm:p-12 text-center border border-gray-100 dark:border-gray-700 max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-3 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <Ticket className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold">No hay rifas activas</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tu administrador aún no ha creado rifas en esta organización.
            </p>
          </div>
        )}

        {/* Layout Principal: Reservas y Grilla */}
        {!loading && selectedRifa && (
          <div className="space-y-5 sm:space-y-6">
            
            {/* Reservas por Aprobar (Aparecen primero en móvil y arriba si existen) */}
            <PendingReservations
              boletos={boletos.filter(b => b.estado === 'reservado' && (!b.vendedor_id || b.vendedor_id === user?.id))}
              onApprove={handleApprovePending}
              onReject={handleRejectPending}
              loading={savingSale}
            />

            {/* Grilla Principal */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 gap-2">
                <h3 className="font-bold text-sm">Boletos Disponibles</h3>
                <div className="flex items-center gap-3 sm:gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-red-500" /> Vendidos: {boletos.filter(b => b.estado === 'pagado').length}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-400" /> Pendientes: {boletos.filter(b => b.estado === 'reservado').length}
                  </span>
                </div>
              </div>

              {/* Grilla dinámica según total_boletos de la rifa */}
              {(() => {
                const totalRifaNumbers = selectedRifa?.total_boletos || 100;
                const totalRifaPages = Math.max(1, Math.ceil(totalRifaNumbers / 100));

                return (
                  <>
                    <RifaGrid
                      soldNumbers={boletos.filter(b => b.estado === 'pagado').map(b => b.numero)}
                      pendingNumbers={boletos.filter(b => b.estado === 'reservado').map(b => b.numero)}
                      mySoldNumbers={boletos.filter(b => b.estado === 'pagado' && b.vendedor_id === user?.id).map(b => b.numero)}
                      selectedNumbers={selectedNumbers}
                      currentNumber={selectedBoleto?.numero}
                      onNumberClick={handleNumberClick}
                      pageIndex={pageIndex}
                      totalNumbers={totalRifaNumbers}
                      isAdmin={role === 'admin'}
                    />

                    <div className="flex justify-center items-center gap-2 sm:gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 flex-wrap">
                      <button
                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                        disabled={pageIndex === 0}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Anterior</span>
                      </button>
                      <span className="text-[11px] sm:text-xs text-gray-500">
                        Página {pageIndex + 1} de {totalRifaPages} ({totalRifaNumbers} total)
                      </span>
                      <button
                        onClick={() => setPageIndex((p) => Math.min(totalRifaPages - 1, p + 1))}
                        disabled={pageIndex >= totalRifaPages - 1}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                      >
                        <span>Siguiente</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* Barra Flotante Inferior de Selección Múltiple */}
      {selectedNumbers.length > 0 && !isTicketModalOpen && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white dark:bg-white/95 dark:text-gray-900 px-4 sm:px-5 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-gray-700 dark:border-gray-200 animate-fadeIn backdrop-blur-md w-[calc(100%-2rem)] sm:w-auto max-w-lg">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {selectedNumbers.length}
            </span>
            <div className="text-xs truncate">
              <span className="font-semibold">
                {selectedNumbers.length === 1 ? '1 boleto' : `${selectedNumbers.length} boletos`}
              </span>
              {selectedRifa?.precio > 0 && (
                <span className="text-emerald-400 dark:text-emerald-600 font-bold ml-1">
                  (${(selectedNumbers.length * parseFloat(selectedRifa.precio)).toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setBuyerName('');
                setBuyerPhone('+569');
                setSaleStatus('pagado');
                setFeedback(null);
                setIsTicketModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 transition shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Registrar</span>
            </button>
            <button
              onClick={() => {
                setSelectedNumbers([]);
                setSelectedBoleto(null);
              }}
              className="p-2 text-xs font-medium opacity-70 hover:opacity-100 rounded-xl hover:bg-white/10 dark:hover:bg-black/10 transition"
              title="Desmarcar seleccionados"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL GESTIONAR BOLETO */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => {
          setIsTicketModalOpen(false);
          setSelectedNumbers([]);
          setSelectedBoleto(null);
          setFeedback(null);
        }}
        selectedBoleto={selectedBoleto}
        selectedNumbers={selectedNumbers}
        ticketPrice={selectedRifa?.precio || 0}
        buyerName={buyerName}
        setBuyerName={setBuyerName}
        buyerPhone={buyerPhone}
        setBuyerPhone={setBuyerPhone}
        saleStatus={saleStatus}
        setSaleStatus={setSaleStatus}
        onSave={handleSaveSale}
        savingSale={savingSale}
        isAdmin={role === 'admin'}
        feedback={feedback}
      />
    </div>
  );
};

export default CatalogoVentas;
