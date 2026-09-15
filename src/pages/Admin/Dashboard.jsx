import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { supabase } from "../../services/supabase";
import { AuthContext } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';
import { useNavigate } from 'react-router-dom';
import RifaGrid from "../../components/Rifa/RifaGrid";
import PendingReservations from "../../components/Rifa/PendingReservations";
import TicketModal from "../../components/Rifa/TicketModal";
import InviteMemberModal from "./Modals/InviteMemberModal";
import CustomizePublicPage from "./Tabs/CustomizePublicPage";
import {
  getOrganizationRifas,
  createRifaWithBoletos,
  getBoletosByRifa,
  checkSlugAvailable,
  updateBoletosBatch,
} from '../../services/organizationService';
import { formatSlug } from "../../utils/slugUtils";
import { TOTAL_NUMBERS, TOTAL_PAGES } from "../../config";
import {
  Ticket,
  Users,
  Palette,
  UserPlus,
  Plus,
  Store,
  LogOut,
  ExternalLink,
  Copy,
  Share2,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Mail,
  DollarSign,
  Check,
  X,
  Clock,
  Trash2,
  Menu,
} from 'lucide-react';

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
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  // Formulario manual de boletos
  const [vendedor, setVendedor] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saleStatus, setSaleStatus] = useState("pagado");

  // Modales y Notificaciones
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateRifaModalOpen, setIsCreateRifaModalOpen] = useState(false);
  const [newRifaTitle, setNewRifaTitle] = useState('');
  const [newRifaSlug, setNewRifaSlug] = useState('');
  const [createSlugStatus, setCreateSlugStatus] = useState({ state: 'idle', message: '' });
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

  // Menús desplegables agrupados y Sidebar móvil
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isRifaMenuOpen, setIsRifaMenuOpen] = useState(false);
  const [isRifaSelectOpen, setIsRifaSelectOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const headerMenuRef = useRef(null);
  const rifaMenuRef = useRef(null);
  const rifaSelectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setIsHeaderMenuOpen(false);
      }
      if (rifaMenuRef.current && !rifaMenuRef.current.contains(event.target)) {
        setIsRifaMenuOpen(false);
      }
      if (rifaSelectRef.current && !rifaSelectRef.current.contains(event.target)) {
        setIsRifaSelectOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsHeaderMenuOpen(false);
        setIsRifaMenuOpen(false);
        setIsRifaSelectOpen(false);
        setIsMobileSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
            newPendingData.push({
              boletoId: b.id,
              ...newData[num],
              id: num,
              numero: num,
            });
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
      
      let formattedMembers = membersData || [];

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: perfilesData, error: perfilesError } = await supabase
          .from('perfiles')
          .select('id, nombre, email')
          .in('id', userIds);

        if (!perfilesError && perfilesData) {
          formattedMembers = membersData.map(m => {
            const perfil = perfilesData.find(p => p.id === m.user_id);
            return {
              ...m,
              nombre: perfil?.nombre,
              user_email: perfil?.email
            };
          });
        } else {
          console.warn("No se pudieron cargar los perfiles (puede que la tabla aún no exista):", perfilesError);
        }
      }
      
      setOrgMembers(formattedMembers);

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

  // Selección de número en la grilla (soporta múltiple para disponibles y unitario para ocupados)
  const handleNumberClick = (num) => {
    const isSold = soldNumbers.includes(num);
    const isPending = pendingNumbers.includes(num);

    // Si es vendido o pendiente, abrir modal individual para gestionar o liberar
    if (isSold || isPending) {
      setCurrentNumber(num);
      setSelectedNumbers([num]);
      const data = numberData[num];
      setName(data?.nombre || "");
      setPhone(data?.telefono || "+569");
      setVendedor(data?.vendedor || (user ? user.email : ""));
      setSaleStatus(data?.status === 'approved' ? 'pagado' : 'reservado');
      setIsTicketModalOpen(true);
      return;
    }

    // Si es disponible, acumular o desmarcar en selección múltiple
    setSelectedNumbers((prev) => {
      const exists = prev.includes(num);
      const next = exists ? prev.filter((n) => n !== num) : [...prev, num];
      if (next.length === 1 && !exists) {
        setCurrentNumber(num);
      } else if (next.length === 0) {
        setCurrentNumber(null);
      }
      return next;
    });
  };

  // Guardar o actualizar uno o múltiples boletos
  const handleSaveOrUpdate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!name.trim() || !selectedRifa?.id) return;

    const numbersToSave = selectedNumbers.length > 0 ? selectedNumbers : (currentNumber ? [currentNumber] : []);
    if (numbersToSave.length === 0) return;

    if (saleStatus === 'disponible') {
      handleDelete();
      return;
    }

    try {
      if (numbersToSave.length > 1) {
        await updateBoletosBatch(selectedRifa.id, numbersToSave, {
          nombre_comprador: name.trim(),
          telefono_comprador: phone.trim(),
          vendedor_id: user?.id,
          estado: saleStatus,
        });
        showNotification(`¡${numbersToSave.length} boletos registrados a nombre de ${name.trim()}!`, 'success');
      } else {
        const singleNum = numbersToSave[0];
        const { error } = await supabase
          .from('boletos')
          .update({
            nombre_comprador: name.trim(),
            telefono_comprador: phone.trim(),
            vendedor_id: user?.id,
            estado: saleStatus,
          })
          .eq('rifa_id', selectedRifa.id)
          .eq('numero', singleNum);

        if (error) throw error;
        showNotification(`Boleto #${singleNum} registrado con éxito`, 'success');
      }

      setIsTicketModalOpen(false);
      setSelectedNumbers([]);
      setCurrentNumber(null);
      setName("");
      setPhone("+569");
      await loadRifasAndBoletos();
    } catch (err) {
      console.error(err);
      showNotification('Error al registrar venta', 'error');
    }
  };

  // Liberar número
  const handleDelete = async () => {
    if (!currentNumber || !selectedRifa?.id) return;
    const numToLiberate = currentNumber;
    setIsTicketModalOpen(false); // Cerrar inmediatamente el modal de boleto para evitar sobreposición
    setConfirmModal({
      show: true,
      title: 'Liberar Número',
      message: `¿Estás seguro de que deseas liberar el número #${numToLiberate}?`,
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
            .eq('numero', numToLiberate);

          if (error) throw error;

          showNotification(`Número #${numToLiberate} liberado`, 'info');
          setSelectedNumbers([]);
          setCurrentNumber(null);
          setName("");
          setPhone("+569");
          await loadRifasAndBoletos();
        } catch (err) {
          showNotification('Error al liberar número', 'error');
        }
      }
    });
  };

  // Aprobar reserva
  const approveReservation = async (itemOrNum) => {
    if (!selectedRifa?.id) return;
    try {
      const boletoId = typeof itemOrNum === 'object' ? itemOrNum.boletoId : null;
      const numero = typeof itemOrNum === 'object' ? itemOrNum.numero : (typeof itemOrNum === 'number' ? itemOrNum : parseInt(itemOrNum, 10));

      let query = supabase.from('boletos').update({ estado: 'pagado' });

      if (boletoId) {
        query = query.eq('id', boletoId);
      } else if (!isNaN(numero)) {
        query = query.eq('rifa_id', selectedRifa.id).eq('numero', numero);
      } else {
        query = query.eq('id', itemOrNum);
      }

      const { error } = await query;
      if (error) throw error;
      showNotification(`Reserva #${numero || ''} aprobada con éxito`, 'success');
      await loadRifasAndBoletos();
    } catch (err) {
      console.error('Error al aprobar reserva:', err);
      showNotification('Error al aprobar reserva', 'error');
    }
  };

  // Rechazar reserva
  const rejectReservation = async (itemOrNum) => {
    if (!selectedRifa?.id) return;
    const numDisplay = typeof itemOrNum === 'object' ? itemOrNum.numero : itemOrNum;
    setConfirmModal({
      show: true,
      title: 'Rechazar Reserva',
      message: `¿Estás seguro de que deseas rechazar y liberar el número #${numDisplay}?`,
      onConfirm: async () => {
        try {
          const boletoId = typeof itemOrNum === 'object' ? itemOrNum.boletoId : null;
          const numero = typeof itemOrNum === 'object' ? itemOrNum.numero : (typeof itemOrNum === 'number' ? itemOrNum : parseInt(itemOrNum, 10));

          let query = supabase.from('boletos').update({
            nombre_comprador: null,
            telefono_comprador: null,
            vendedor_id: null,
            estado: 'disponible',
          });

          if (boletoId) {
            query = query.eq('id', boletoId);
          } else if (!isNaN(numero)) {
            query = query.eq('rifa_id', selectedRifa.id).eq('numero', numero);
          } else {
            query = query.eq('id', itemOrNum);
          }

          const { error } = await query;
          if (error) throw error;
          showNotification(`Reserva #${numDisplay} rechazada y número liberado`, 'info');
          await loadRifasAndBoletos();
        } catch (err) {
          console.error('Error al rechazar reserva:', err);
          showNotification('Error al rechazar reserva', 'error');
        }
      }
    });
  };

  // Comprobar disponibilidad de slug para nueva rifa
  useEffect(() => {
    if (!newRifaSlug.trim() || !isCreateRifaModalOpen) {
      setCreateSlugStatus({ state: 'idle', message: '' });
      return;
    }

    const clean = formatSlug(newRifaSlug);
    setCreateSlugStatus({ state: 'checking', message: 'Comprobando...' });

    const timer = setTimeout(async () => {
      try {
        const available = await checkSlugAvailable(clean);
        if (available) {
          setCreateSlugStatus({ state: 'available', message: '¡Disponible!' });
        } else {
          setCreateSlugStatus({ state: 'taken', message: 'Ya en uso' });
        }
      } catch (err) {
        setCreateSlugStatus({ state: 'idle', message: '' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [newRifaSlug, isCreateRifaModalOpen]);

  // Crear Rifa nueva
  const handleCreateRifa = async (e) => {
    e.preventDefault();
    if (!newRifaTitle.trim() || !activeOrg?.id) return;

    if (createSlugStatus.state === 'taken') {
      showNotification('El alias/enlace de la rifa ya está en uso. Elige uno diferente.', 'error');
      return;
    }

    setCreatingRifa(true);
    try {
      const created = await createRifaWithBoletos(activeOrg.id, {
        titulo: newRifaTitle.trim(),
        slug: formatSlug(newRifaSlug) || null,
        total_boletos: parseInt(newRifaTotal, 10) || 100,
        precio: parseFloat(newRifaPrice) || 1000,
      });
      showNotification(`¡Rifa "${created.titulo}" creada con éxito!`, 'success');
      setIsCreateRifaModalOpen(false);
      setNewRifaTitle('');
      setNewRifaSlug('');
      setCreateSlugStatus({ state: 'idle', message: '' });
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
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border text-xs font-bold animate-fadeIn ${notification.type === 'error'
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 text-center border border-gray-100 dark:border-gray-700 shadow-2xl">
            <h3 className="text-base font-bold mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmModal({ ...confirmModal, show: false });
                  setCurrentNumber(null);
                  setSelectedNumbers([]);
                }}
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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between lg:justify-start gap-3 flex-wrap">
            {/* Botón Hamburger para abrir Sidebar en móvil */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition active:scale-95 flex-shrink-0"
              title="Abrir menú de navegación"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center p-1 border border-gray-200 dark:border-gray-600 shadow-sm flex-shrink-0">
                <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold leading-tight truncate">
                  {activeOrg?.nombre || 'Mi Organización'}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400">
                  Panel de Administración
                </p>
              </div>
            </div>

            {/* Selector de organización si el usuario pertenece a varias (Desktop) */}
            {organizations.length > 1 && (
              <select
                value={activeOrg?.id || ''}
                onChange={(e) => switchOrg(e.target.value)}
                className="hidden sm:block px-2.5 py-1 text-xs font-medium bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl max-w-[140px] sm:max-w-xs truncate"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.nombre} ({org.rol})
                  </option>
                ))}
              </select>
            )}

            {/* Pestañas de Vista en Desktop (en móvil se controlan mediante el Sidebar) */}
            <div className="hidden md:flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl w-auto">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'grid'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                  }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Boletos y Ventas</span>
              </button>
              <button
                onClick={() => setActiveTab('control')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'control'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                  }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Miembros y Métricas</span>
              </button>
              <button
                onClick={() => setActiveTab('customize')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'customize'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                  }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Personalizar Página</span>
              </button>
            </div>
          </div>

          {/* Menú Desplegable de Gestión (Ultra Compacto para Web y Móvil) */}
          <div className="relative flex-shrink-0" ref={headerMenuRef}>
            <button
              onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-95 transition shadow-sm flex items-center gap-2 active:scale-95"
              aria-expanded={isHeaderMenuOpen}
              title="Opciones de gestión"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Gestión</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isHeaderMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isHeaderMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-1.5 z-40 animate-fadeIn divide-y divide-gray-100 dark:divide-gray-700/60">
                {/* Categoría: Campaña y Equipo */}
                <div className="py-1">
                  <span className="block px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Campaña y Equipo
                  </span>
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsCreateRifaModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition"
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    <span>Nueva Rifa</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsInviteModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition"
                  >
                    <UserPlus className="w-4 h-4 text-primary" />
                    <span>Invitar Vendedor</span>
                  </button>
                </div>

                {/* Categoría: Navegación */}
                <div className="py-1">
                  <span className="block px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Navegación
                  </span>
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      navigate('/vendedor');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition"
                  >
                    <Store className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span>Portal de Ventas</span>
                  </button>
                </div>

                {/* Categoría: Sesión */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SIDEBAR MÓVIL (Pestañas de Navegación) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fadeIn">
          {/* Fondo oscuro backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          {/* Panel Lateral Drawer */}
          <div className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white dark:bg-gray-800 shadow-2xl p-5 flex flex-col justify-between z-10 border-r border-gray-100 dark:border-gray-700 animate-slideRight">
            <div className="space-y-6">
              {/* Cabecera del Sidebar */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center p-1.5 border border-gray-200 dark:border-gray-600 shadow-xs">
                    <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold truncate">
                      {activeOrg?.nombre || 'Mi Organización'}
                    </h2>
                    <p className="text-[10px] text-gray-400">
                      Navegación del Panel
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Cerrar navegación"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Selector de Organización en Móvil (si pertenece a más de una) */}
              {organizations.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Organización Activa
                  </label>
                  <select
                    value={activeOrg?.id || ''}
                    onChange={(e) => {
                      switchOrg(e.target.value);
                      setIsMobileSidebarOpen(false);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.nombre} ({org.rol})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pestañas de Navegación del Panel */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block px-1">
                  Vistas Principales
                </span>

                <button
                  onClick={() => {
                    setActiveTab('grid');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl text-xs font-bold transition flex items-center gap-3 ${
                    activeTab === 'grid'
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeTab === 'grid' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Boletos y Ventas</p>
                    <p className="text-[10px] text-gray-400 font-normal">Grilla interactiva y cobros</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('control');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl text-xs font-bold transition flex items-center gap-3 ${
                    activeTab === 'control'
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeTab === 'control' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Miembros y Métricas</p>
                    <p className="text-[10px] text-gray-400 font-normal">Equipo de ventas y balances</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('customize');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl text-xs font-bold transition flex items-center gap-3 ${
                    activeTab === 'customize'
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activeTab === 'customize' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    <Palette className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Personalizar Página</p>
                    <p className="text-[10px] text-gray-400 font-normal">Imágenes, textos y diseño</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Pie del Sidebar con versión */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 text-[11px] text-gray-400 text-center">
              Sistema de Gestión de Rifas
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Selector de Rifa Activa */}
        {rifas.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Rifa:</span>

              {/* Selector de Rifa Personalizado con el estilo del Dropdown de Opciones */}
              <div className="relative flex-1 sm:flex-none" ref={rifaSelectRef}>
                <button
                  type="button"
                  onClick={() => setIsRifaSelectOpen((prev) => !prev)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-bold text-gray-800 dark:text-gray-200 transition flex items-center justify-between sm:justify-center gap-2.5 active:scale-95 shadow-xs"
                  aria-expanded={isRifaSelectOpen}
                  title="Seleccionar rifa activa"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Ticket className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="truncate max-w-[180px] sm:max-w-xs text-left">
                      {selectedRifa ? selectedRifa.titulo : 'Seleccionar rifa'}
                    </span>
                    {selectedRifa && (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md flex-shrink-0">
                        ${parseFloat(selectedRifa.precio).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isRifaSelectOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRifaSelectOpen && (
                  <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-1.5 z-40 animate-fadeIn divide-y divide-gray-100 dark:divide-gray-700/60 max-h-72 overflow-y-auto custom-scrollbar">
                    <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Rifas Disponibles ({rifas.length})
                    </div>
                    <div className="py-1">
                      {rifas.map((r) => {
                        const isSelected = selectedRifa?.id === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelectedRifa(r);
                              setIsRifaSelectOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 text-left text-xs transition flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 font-medium'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs">{r.titulo}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                                ${parseFloat(r.precio).toLocaleString()} • {r.total_boletos} boletos
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Menú Desplegable de Opciones de Rifa (Ultra Compacto) */}
            <div className="relative" ref={rifaMenuRef}>
              <button
                onClick={() => setIsRifaMenuOpen((prev) => !prev)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-bold text-gray-800 dark:text-gray-200 transition flex items-center justify-between sm:justify-center gap-2 active:scale-95 shadow-xs"
                aria-expanded={isRifaMenuOpen}
                title="Opciones de la rifa"
              >
                <div className="flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-primary" />
                  <span>Opciones de Rifa</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRifaMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRifaMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 sm:w-60 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-1.5 z-40 animate-fadeIn divide-y divide-gray-100 dark:divide-gray-700/60">
                  {/* Categoría: Difusión y Enlaces */}
                  <div className="py-1">
                    <span className="block px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Difusión y Enlaces
                    </span>
                    <button
                      onClick={() => {
                        setIsRifaMenuOpen(false);
                        const identifier = selectedRifa.slug || selectedRifa.id;
                        const url = `${window.location.origin}/#/rifa/${identifier}`;
                        window.open(url, '_blank');
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Ver Página Pública</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsRifaMenuOpen(false);
                        const identifier = selectedRifa.slug || selectedRifa.id;
                        const url = `${window.location.origin}/#/rifa/${identifier}`;
                        navigator.clipboard.writeText(url);
                        showNotification('¡Enlace copiado al portapapeles!', 'success');
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition"
                    >
                      <Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Copiar Enlace</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsRifaMenuOpen(false);
                        const identifier = selectedRifa.slug || selectedRifa.id;
                        const url = `${window.location.origin}/#/rifa/${identifier}`;
                        const msg = encodeURIComponent(`¡Participa en nuestra rifa "${selectedRifa.titulo}"! Elige y reserva tu número online aquí: ${url}`);
                        window.open(`https://wa.me/?text=${msg}`, '_blank');
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition"
                    >
                      <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Compartir por WhatsApp</span>
                    </button>
                  </div>

                  {/* Categoría: Reportes y Exportación */}
                  <div className="py-1">
                    <span className="block px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Exportación de Datos
                    </span>
                    <button
                      onClick={() => {
                        setIsRifaMenuOpen(false);
                        downloadSoldNumbers('csv');
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition"
                    >
                      <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span>Descargar Boletos (CSV)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Si aún no hay rifas creadas */}
        {rifas.length === 0 && !loadingData && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 sm:p-12 text-center border border-gray-100 dark:border-gray-700 max-w-md mx-auto shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <Ticket className="w-8 h-8" />
            </div>
            <h2 className="text-base sm:text-lg font-bold">Sin Rifas Creadas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-6">
              Tu organización aún no tiene ninguna rifa registrada. Crea la primera para comenzar a vender números.
            </p>
            <button
              onClick={() => setIsCreateRifaModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-90 transition shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mx-auto active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Primera Rifa</span>
            </button>
          </div>
        )}

        {/* TAB 1: GRILLA Y VENTAS */}
        {activeTab === 'grid' && selectedRifa && (
          <div className="space-y-5 sm:space-y-6">
            {/* Reservas por Aprobar: Primero en móvil y visible arriba */}
            <PendingReservations
              boletos={pendingNumbersData}
              onApprove={approveReservation}
              onReject={rejectReservation}
            />

            {/* Grilla Principal */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 gap-2">
                <h3 className="font-bold text-sm">Boletos Disponibles</h3>
                <div className="flex items-center gap-3 sm:gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-red-500" /> Vendidos: {soldNumbers.length}
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
                      selectedNumbers={selectedNumbers}
                      currentNumber={currentNumber}
                      onNumberClick={handleNumberClick}
                      pageIndex={pageIndex}
                      isAdmin={true}
                      totalNumbers={totalRifaNumbers}
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

        {/* TAB 2: MIEMBROS Y MÉTRICAS */}
        {activeTab === 'control' && (
          <div className="space-y-5 sm:space-y-6">
            {/* Métricas Generales en grid 2x2 para móvil */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Miembros</p>
                  <Users className="w-4 h-4 text-primary opacity-80" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-primary mt-1">{orgMembers.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Invitaciones</p>
                  <Clock className="w-4 h-4 text-amber-500 opacity-80" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-amber-500 mt-1">{orgInvites.filter(i => i.estado === 'pendiente').length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Vendidos</p>
                  <Ticket className="w-4 h-4 text-emerald-600 opacity-80" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{soldNumbers.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Recaudación</p>
                  <DollarSign className="w-4 h-4 text-blue-600 opacity-80" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">${totalRecaudado.toLocaleString()}</p>
              </div>
            </div>

            {/* Lista de Miembros de la Organización */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 gap-2">
                <div>
                  <h3 className="font-bold text-sm">Miembros de la Organización</h3>
                  <p className="text-xs text-gray-500">Usuarios asignados con rol Admin o Vendedor</p>
                </div>
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invitar Miembro</span>
                </button>
              </div>

              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-3 font-semibold rounded-l-xl">Usuario</th>
                      <th className="px-4 py-3 font-semibold text-center">Boletos Vendidos</th>
                      <th className="px-4 py-3 font-semibold text-right rounded-r-xl">Rol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {orgMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {m.nombre || m.user_email || m.user_id.substring(0, 8)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-semibold border border-gray-200 dark:border-gray-600">
                            {soldNumbers.filter(num => numberData[num]?.vendedor === m.user_id).length}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                            m.rol === 'admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          }`}>
                            {m.rol}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                setName('');
                setPhone('+569');
                setSaleStatus('pagado');
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
                setCurrentNumber(null);
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
          setCurrentNumber(null);
        }}
        selectedBoleto={currentNumber ? { numero: currentNumber, ...numberData[currentNumber] } : null}
        selectedNumbers={selectedNumbers}
        ticketPrice={selectedRifa?.precio || 0}
        buyerName={name}
        setBuyerName={setName}
        buyerPhone={phone}
        setBuyerPhone={setPhone}
        saleStatus={saleStatus}
        setSaleStatus={setSaleStatus}
        onSave={handleSaveOrUpdate}
        savingSale={false}
        onDelete={(soldNumbers.includes(currentNumber) || pendingNumbers.includes(currentNumber)) ? handleDelete : null}
        isAdmin={true}
      />

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border-t sm:border border-gray-100 dark:border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Barra móvil */}
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Ticket className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base">Crear Nueva Rifa</h3>
              </div>
              <button
                onClick={() => setIsCreateRifaModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRifa} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Título de la Rifa *</label>
                <input
                  type="text"
                  required
                  value={newRifaTitle}
                  onChange={(e) => {
                    const title = e.target.value;
                    setNewRifaTitle(title);
                    if (!newRifaSlug || newRifaSlug === formatSlug(newRifaTitle)) {
                      setNewRifaSlug(formatSlug(title));
                    }
                  }}
                  placeholder="Ej. Rifa Navideña, Rifa Solidaria..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border rounded-xl"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-500">Enlace Amigable (Slug / Alias)</label>
                  {createSlugStatus.state === 'checking' && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" /> Comprobando...
                    </span>
                  )}
                  {createSlugStatus.state === 'available' && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Disponible
                    </span>
                  )}
                  {createSlugStatus.state === 'taken' && (
                    <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                      <X className="w-3 h-3" /> Ya en uso
                    </span>
                  )}
                </div>
                <div className="flex items-center rounded-xl bg-gray-50 dark:bg-gray-700 border overflow-hidden">
                  <span className="px-2.5 text-[11px] text-gray-400 font-mono bg-gray-100/80 dark:bg-gray-800/80 border-r py-2 select-none">
                    /#/rifa/
                  </span>
                  <input
                    type="text"
                    value={newRifaSlug}
                    onChange={(e) => setNewRifaSlug(formatSlug(e.target.value))}
                    placeholder="ej. gran-sorteo"
                    className="w-full px-2.5 py-2 text-xs bg-transparent outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Tus clientes accederán directamente usando este enlace corto.
                </p>
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
                  className="flex-1 py-2.5 text-xs font-semibold border rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingRifa}
                  className="flex-1 py-2.5 text-xs font-semibold bg-primary text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
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