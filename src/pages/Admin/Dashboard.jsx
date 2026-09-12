import React, { useState, useEffect, useContext, useCallback } from "react";
import { supabase } from "../../services/supabase";
import { AuthContext } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';
import { useNavigate } from 'react-router-dom';
import RifaGrid from "../../components/Rifa/RifaGrid";
import InviteMemberModal from "./Modals/InviteMemberModal";
import CustomizePublicPage from "./Tabs/CustomizePublicPage";
import {
  getOrganizationRifas,
  createRifaWithBoletos,
  getBoletosByRifa,
} from '../../services/organizationService';
import { TOTAL_NUMBERS, TOTAL_PAGES } from "../../config";

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const { activeOrg, organizations, switchOrg, role } = useOrganization();
  const navigate = useNavigate();

  // Estados de Rifa y Boletos
  const [rifas, setRifas] = useState([]);
  const [selectedRifa, setSelectedRifa] = useState(null);
  const [soldNumbers, setSoldNumbers] = useState([]);
  const [pendingNumbersData, setPendingNumbersData] = useState([]);
  const [pendingNumbers, setPendingNumbers] = useState([]);
  const [numberData, setNumberData] = useState({});
  const [currentNumber, setCurrentNumber] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);

  // Formulario manual de boletos
  const [vendedor, setVendedor] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Modales y Notificaciones
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateRifaModalOpen, setIsCreateRifaModalOpen] = useState(false);
  const [newRifaTitle, setNewRifaTitle] = useState('');
  const [newRifaPrice, setNewRifaPrice] = useState('1000');
  const [newRifaTotal, setNewRifaTotal] = useState('100');
  const [creatingRifa, setCreatingRifa] = useState(false);

  const [notification, setNotification] = useState({ message: '', type: '', show: false });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Miembros e Invitaciones de la Org
  const [orgMembers, setOrgMembers] = useState([]);
  const [orgInvites, setOrgInvites] = useState([]);
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'control'
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification({ message: '', type: '', show: false }), 2500);
  };

  /**
   * Cargar rifas y boletos de la organización activa
   */
  const loadRifasAndBoletos = useCallback(async () => {
    if (!activeOrg?.id) return;
    setLoadingData(true);
    try {
      const dataRifas = await getOrganizationRifas(activeOrg.id);
      setRifas(dataRifas);

      let current = selectedRifa;
      if (!current || !dataRifas.some((r) => r.id === current.id)) {
        current = dataRifas.length > 0 ? dataRifas[0] : null;
        setSelectedRifa(current);
      }

      if (current?.id) {
        const dataBoletos = await getBoletosByRifa(current.id);
        const newData = {};
        const newSold = [];
        const newPending = [];
        const newPendingData = [];

        dataBoletos.forEach((b) => {
          const num = b.numero;
          const isSold = b.estado === 'pagado';
          const isPending = b.estado === 'reservado';

          newData[num] = {
            id: b.id,
            numero: num,
            nombre: b.nombre_comprador || '',
            telefono: b.telefono_comprador || '',
            vendedor: b.vendedor_id || '',
            status: isSold ? 'approved' : isPending ? 'pending' : 'available'
          };

          if (isPending) {
            newPending.push(num);
            newPendingData.push({ id: num, boletoId: b.id, ...newData[num] });
          } else if (isSold) {
            newSold.push(num);
          }
        });

        setNumberData(newData);
        setSoldNumbers(newSold);
        setPendingNumbers(newPending);
        setPendingNumbersData(newPendingData.sort((a, b) => a.id - b.id));
      } else {
        setNumberData({});
        setSoldNumbers([]);
        setPendingNumbers([]);
        setPendingNumbersData([]);
      }
    } catch (err) {
      console.warn("Aviso al consultar rifas y boletos:", err);
    } finally {
      setLoadingData(false);
    }
  }, [activeOrg?.id, selectedRifa]);

  /**
   * Cargar miembros e invitaciones de la organización activa
   */
  const loadOrgMembers = useCallback(async () => {
    if (!activeOrg?.id) return;
    try {
      const { data: membersData } = await supabase
        .from('miembros_organizacion')
        .select('*')
        .eq('org_id', activeOrg.id);
      setOrgMembers(membersData || []);

      const { data: invitesData } = await supabase
        .from('invitaciones')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('created_at', { ascending: false });
      setOrgInvites(invitesData || []);
    } catch (err) {
      console.warn("Aviso consultando miembros de la organización:", err);
    }
  }, [activeOrg?.id]);

  useEffect(() => {
    loadRifasAndBoletos();
    loadOrgMembers();
  }, [loadRifasAndBoletos, loadOrgMembers]);

  // Selección de número en la grilla
  const handleNumberClick = (num) => {
    setCurrentNumber(num);
    const data = numberData[num];
    if (data && data.status !== 'available') {
      setName(data.nombre);
      setPhone(data.telefono);
      setVendedor(data.vendedor || (user ? user.email : ""));
    } else {
      setName("");
      setPhone("+569");
      setVendedor(user ? user.email : "");
    }
  };

  // Guardar o actualizar un boleto
  const handleSaveOrUpdate = async () => {
    if (!currentNumber || !name.trim() || !selectedRifa?.id) return;

    try {
      const { error } = await supabase
        .from('boletos')
        .update({
          nombre_comprador: name.trim(),
          telefono_comprador: phone.trim(),
          vendedor_id: user?.id,
          estado: 'pagado',
        })
        .eq('rifa_id', selectedRifa.id)
        .eq('numero', currentNumber);

      if (error) throw error;

      showNotification(`Boleto #${currentNumber} registrado`, 'success');
      setCurrentNumber(null);
      setName("");
      setPhone("");
      await loadRifasAndBoletos();
    } catch (err) {
      console.error(err);
      showNotification('Error al registrar venta', 'error');
    }
  };

  // Liberar número
  const handleDelete = async () => {
    if (!currentNumber || !selectedRifa?.id) return;
    setConfirmModal({
      show: true,
      title: 'Liberar Número',
      message: `¿Estás seguro de que deseas liberar el número #${currentNumber}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('boletos')
            .update({
              nombre_comprador: null,
              telefono_comprador: null,
              vendedor_id: null,
              estado: 'disponible',
            })
            .eq('rifa_id', selectedRifa.id)
            .eq('numero', currentNumber);

          if (error) throw error;

          showNotification(`Número #${currentNumber} liberado`, 'info');
          setCurrentNumber(null);
          setName("");
          setPhone("");
          await loadRifasAndBoletos();
        } catch (err) {
          showNotification('Error al liberar número', 'error');
        }
      }
    });
  };

  // Aprobar reserva
  const approveReservation = async (numId) => {
    if (!selectedRifa?.id) return;
    try {
      const { error } = await supabase
        .from('boletos')
        .update({ estado: 'pagado' })
        .eq('rifa_id', selectedRifa.id)
        .eq('numero', numId);

      if (error) throw error;
      showNotification(`Reserva #${numId} aprobada`, 'success');
      await loadRifasAndBoletos();
    } catch (err) {
      showNotification('Error al aprobar reserva', 'error');
    }
  };

  // Rechazar reserva
  const rejectReservation = async (numId) => {
    if (!selectedRifa?.id) return;
    setConfirmModal({
      show: true,
      title: 'Rechazar Reserva',
      message: `¿Estás seguro de que deseas rechazar y liberar el número #${numId}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('boletos')
            .update({
              nombre_comprador: null,
              telefono_comprador: null,
              vendedor_id: null,
              estado: 'disponible',
            })
            .eq('rifa_id', selectedRifa.id)
            .eq('numero', numId);

          if (error) throw error;
          showNotification(`Reserva #${numId} rechazada`, 'info');
          await loadRifasAndBoletos();
        } catch (err) {
          showNotification('Error al rechazar reserva', 'error');
        }
      }
    });
  };

  // Crear Rifa nueva
  const handleCreateRifa = async (e) => {
    e.preventDefault();
    if (!newRifaTitle.trim() || !activeOrg?.id) return;
    setCreatingRifa(true);
    try {
      const created = await createRifaWithBoletos(activeOrg.id, {
        titulo: newRifaTitle.trim(),
        total_boletos: parseInt(newRifaTotal, 10) || 100,
        precio: parseFloat(newRifaPrice) || 1000,
      });
      showNotification(`¡Rifa "${created.titulo}" creada con éxito!`, 'success');
      setIsCreateRifaModalOpen(false);
      setNewRifaTitle('');
      setSelectedRifa(created);
      await loadRifasAndBoletos();
    } catch (err) {
      showNotification(err.message || 'Error al crear rifa', 'error');
    } finally {
      setCreatingRifa(false);
    }
  };

  // Descargas de números
  const downloadSoldNumbers = (format) => {
    const BOM = "\uFEFF";
    const total = selectedRifa?.total_boletos || TOTAL_NUMBERS;

    if (format === 'csv') {
      const headers = ["Número", "Comprador", "Teléfono", "Vendedor", "Estado"];
      const rows = [];

      for (let i = 1; i <= total; i++) {
        const ticket = numberData[i];
        if (ticket && ticket.status !== 'available') {
          rows.push([
            i,
            ticket.nombre || '',
            ticket.telefono || '',
            ticket.vendedor || '',
            ticket.status === 'approved' ? 'Pagado' : 'Reservado'
          ]);
        }
      }

      const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rifa_${selectedRifa?.titulo || 'ventas'}.csv`;
      a.click();
    }
  };

  const totalRecaudado = soldNumbers.length * (parseFloat(selectedRifa?.precio) || 0);

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen text-earthy-navy dark:text-white font-sans transition-colors">
      {/* Notificación Toast */}
      {notification.show && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border text-xs font-bold animate-fadeIn ${
          notification.type === 'error'
            ? 'bg-red-500 text-white border-red-600'
            : notification.type === 'info'
            ? 'bg-blue-500 text-white border-blue-600'
            : 'bg-emerald-500 text-white border-emerald-600'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Modal de Confirmación */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 text-center border border-gray-100 dark:border-gray-700 shadow-2xl">
            <h3 className="text-base font-bold mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const cb = confirmModal.onConfirm;
                  setConfirmModal({ ...confirmModal, show: false });
                  if (cb) cb();
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER MULTI-TENANT */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center p-1 border border-gray-200 dark:border-gray-600 shadow-sm">
                <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight">
                  {activeOrg?.nombre || 'Mi Organización'}
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Panel de Administración SaaS
                </p>
              </div>
            </div>

            {/* Selector de organización si el usuario pertenece a varias */}
            {organizations.length > 1 && (
              <select
                value={activeOrg?.id || ''}
                onChange={(e) => switchOrg(e.target.value)}
                className="px-2.5 py-1 text-xs font-medium bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.nombre} ({org.rol})
                  </option>
                ))}
              </select>
            )}

            {/* Pestañas de Vista */}
            <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'grid'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                }`}
              >
                🎟️ Boletos y Ventas
              </button>
              <button
                onClick={() => setActiveTab('control')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'control'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                }`}
              >
                👥 Miembros y Métricas
              </button>
              <button
                onClick={() => setActiveTab('customize')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'customize'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                }`}
              >
                🎨 Personalizar Página
              </button>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition flex items-center gap-1.5"
            >
              <span>✉️ Invitar Vendedor</span>
            </button>

            <button
              onClick={() => setIsCreateRifaModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 transition shadow-sm flex items-center gap-1.5"
            >
              <span>➕ Nueva Rifa</span>
            </button>

            <button
              onClick={() => navigate('/vendedor')}
              className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-xs font-semibold transition"
              title="Ir a vista vendedor"
            >
              Ver Portal Ventas
            </button>

            <button
              onClick={() => logout()}
              className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition text-xs font-bold"
              title="Cerrar Sesión"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Selector de Rifa Activa */}
        {rifas.length > 0 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Rifa seleccionada:</span>
              <select
                value={selectedRifa?.id || ''}
                onChange={(e) => {
                  const found = rifas.find((r) => r.id === e.target.value);
                  setSelectedRifa(found);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl"
              >
                {rifas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.titulo} • ${parseFloat(r.precio).toLocaleString()} ({r.total_boletos} boletos)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/#/rifa/${selectedRifa.id}`;
                  window.open(url, '_blank');
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition flex items-center gap-1.5"
                title="Abrir página pública para clientes"
              >
                <span>🔗 Ver Página</span>
              </button>

              <button
                onClick={() => {
                  const url = `${window.location.origin}/#/rifa/${selectedRifa.id}`;
                  navigator.clipboard.writeText(url);
                  showNotification('¡Enlace copiado al portapapeles! Listo para enviar a tus clientes.', 'success');
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition flex items-center gap-1.5"
                title="Copiar enlace directo de la rifa"
              >
                <span>📋 Copiar Enlace</span>
              </button>

              <button
                onClick={() => {
                  const url = `${window.location.origin}/#/rifa/${selectedRifa.id}`;
                  const msg = encodeURIComponent(`🎟️ ¡Participa en nuestra rifa "${selectedRifa.titulo}"! Elige y reserva tu número online aquí: ${url}`);
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                title="Compartir enlace por WhatsApp"
              >
                <span>📲 Compartir WhatsApp</span>
              </button>

              <button
                onClick={() => downloadSoldNumbers('csv')}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <span>📥 CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Si aún no hay rifas creadas */}
        {rifas.length === 0 && !loadingData && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700 max-w-md mx-auto shadow-sm">
            <div className="text-4xl mb-3">🎟️</div>
            <h2 className="text-lg font-bold">Sin Rifas Creadas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-6">
              Tu organización aún no tiene ninguna rifa registrada. Crea la primera para comenzar a vender números.
            </p>
            <button
              onClick={() => setIsCreateRifaModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-90 transition shadow-lg shadow-primary/25"
            >
              ➕ Crear Primera Rifa
            </button>
          </div>
        )}

        {/* TAB 1: GRILLA Y VENTAS */}
        {activeTab === 'grid' && selectedRifa && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lado Izquierdo: Grilla */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-sm">Boletos Disponibles</h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500" /> Vendidos: {soldNumbers.length}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-400" /> Pendientes: {pendingNumbers.length}
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
                      soldNumbers={soldNumbers}
                      pendingNumbers={pendingNumbers}
                      currentNumber={currentNumber}
                      onNumberClick={handleNumberClick}
                      pageIndex={pageIndex}
                      isAdmin={true}
                      totalNumbers={totalRifaNumbers}
                    />

                    <div className="flex justify-center items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                        disabled={pageIndex === 0}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold disabled:opacity-40"
                      >
                        ◀ Anterior
                      </button>
                      <span className="text-xs text-gray-500">
                        Página {pageIndex + 1} de {totalRifaPages} ({totalRifaNumbers} números en total)
                      </span>
                      <button
                        onClick={() => setPageIndex((p) => Math.min(totalRifaPages - 1, p + 1))}
                        disabled={pageIndex >= totalRifaPages - 1}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold disabled:opacity-40"
                      >
                        Siguiente ▶
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Lado Derecho: Gestión y Reservas Pendientes */}
            <div className="space-y-6">
              {/* Reservas Pendientes */}
              {pendingNumbersData.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-3xl border border-amber-200 dark:border-amber-800/40">
                  <h3 className="font-bold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Reservas por Aprobar</span>
                    <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full text-[10px]">
                      {pendingNumbersData.length}
                    </span>
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {pendingNumbersData.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-amber-100 dark:border-gray-700 flex justify-between items-center text-xs"
                      >
                        <div>
                          <span className="font-bold text-amber-600">#{item.id}</span> • {item.nombre}
                          <p className="text-[10px] text-gray-500">{item.telefono}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => approveReservation(item.id)}
                            className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-bold text-xs"
                            title="Aprobar"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => rejectReservation(item.id)}
                            className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-bold text-xs"
                            title="Rechazar"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulario Manual de Boleto */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <h3 className="font-bold text-sm">
                  {currentNumber ? `Gestionar Boleto #${currentNumber}` : 'Selecciona un boleto en la grilla'}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Nombre Comprador</label>
                    <input
                      type="text"
                      disabled={!currentNumber}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nombre y apellido"
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      disabled={!currentNumber}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+569..."
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl"
                    />
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={!currentNumber || !name.trim()}
                      onClick={handleSaveOrUpdate}
                      className="w-full py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-40 transition shadow-sm"
                    >
                      {soldNumbers.includes(currentNumber) ? 'Actualizar Boleto' : 'Registrar Venta'}
                    </button>

                    {(soldNumbers.includes(currentNumber) || pendingNumbers.includes(currentNumber)) && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="w-full py-2 border border-red-200 text-red-600 font-bold text-xs rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        Liberar Boleto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MIEMBROS Y MÉTRICAS */}
        {activeTab === 'control' && (
          <div className="space-y-6">
            {/* Métricas Generales */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p className="text-xs text-gray-500 font-medium">Miembros en el Equipo</p>
                <p className="text-2xl font-bold text-primary mt-1">{orgMembers.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p className="text-xs text-gray-500 font-medium">Invitaciones Pendientes</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">{orgInvites.filter(i => i.estado === 'pendiente').length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p className="text-xs text-gray-500 font-medium">Boletos Vendidos</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{soldNumbers.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p className="text-xs text-gray-500 font-medium">Recaudación Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${totalRecaudado.toLocaleString()}</p>
              </div>
            </div>

            {/* Lista de Miembros de la Organización */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <h3 className="font-bold text-sm">Miembros de la Organización</h3>
                  <p className="text-xs text-gray-500">Usuarios asignados con rol Admin o Vendedor</p>
                </div>
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition"
                >
                  ➕ Invitar Miembro
                </button>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {orgMembers.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold">Usuario ID: {m.user_id.substring(0, 8)}...</p>
                      <p className="text-gray-400 text-[11px]">Vinculado el: {new Date(m.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                      m.rol === 'admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}>
                      {m.rol}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERSONALIZAR PÁGINA PÚBLICA */}
        {activeTab === 'customize' && (
          <CustomizePublicPage
            selectedRifa={selectedRifa}
            activeOrg={activeOrg}
            onRifaUpdated={(updated) => {
              setSelectedRifa(updated);
              setRifas(prev => prev.map(r => r.id === updated.id ? updated : r));
            }}
            showNotification={showNotification}
          />
        )}
      </main>

      {/* MODAL INVITAR MIEMBRO */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          loadOrgMembers();
        }}
      />

      {/* MODAL CREAR RIFA */}
      {isCreateRifaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-base">Crear Nueva Rifa</h3>
              <button
                onClick={() => setIsCreateRifaModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRifa} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Título de la Rifa</label>
                <input
                  type="text"
                  required
                  value={newRifaTitle}
                  onChange={(e) => setNewRifaTitle(e.target.value)}
                  placeholder="Ej. Rifa Navideña, Rifa Solidaria..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Total Boletos</label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="1000"
                    value={newRifaTotal}
                    onChange={(e) => setNewRifaTotal(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Precio ($)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newRifaPrice}
                    onChange={(e) => setNewRifaPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRifaModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold border rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingRifa}
                  className="flex-1 py-2 text-xs font-semibold bg-primary text-white rounded-xl disabled:opacity-50"
                >
                  {creatingRifa ? 'Creando...' : 'Crear Rifa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;