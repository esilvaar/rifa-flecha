import React, { useState, useEffect, useContext } from "react";
import { supabase } from "../../services/supabase";
import { AuthContext } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import RifaGrid from "../../components/Rifa/RifaGrid";
import { TOTAL_NUMBERS, TOTAL_PAGES } from "../../config";

const Dashboard = () => {
  const [soldNumbers, setSoldNumbers] = useState([]);
  const [pendingNumbersData, setPendingNumbersData] = useState([]); // Array de objetos {id, ...data}
  const [pendingNumbers, setPendingNumbers] = useState([]); // Array solo IDs para grid
  
  const [currentNumber, setCurrentNumber] = useState(null);
  const [numberData, setNumberData] = useState({});
  const [pageIndex, setPageIndex] = useState(0);
  
  const [vendedor, setVendedor] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [notification, setNotification] = useState({ message: '', type: '', show: false });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });
  
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'control'
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Escuchar 'users' pendientes y aprobados (Solo si es admin)
  useEffect(() => {
    if (user?.role !== 'admin') return;

    const fetchUsers = async () => {
      // Pendientes
      const { data: pending, error: ep } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'pending');
      if (!ep) setPendingUsers(pending || []);

      // Aprobados
      const { data: approved, error: ea } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'approved');
      if (!ea) setApprovedUsers(approved || []);
    };

    fetchUsers();

    const channel = supabase
      .channel('admin-users-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Escuchar 'vendidos'
  useEffect(() => {
    const processVendidos = (data) => {
      const newData = {};
      const newSold = [];
      const newPending = [];
      const newPendingData = [];

      data.forEach((row) => {
        const num = parseInt(row.id, 10);
        
        newData[num] = {
          nombre: row.nombre,
          telefono: row.telefono,
          vendedor: row.vendedor || "",
          status: row.status || 'approved'
        };

        if (row.status === 'pending') {
            newPending.push(num);
            newPendingData.push({ id: num, ...row });
        } else {
            newSold.push(num);
        }
      });
      setNumberData(newData);
      setSoldNumbers(newSold);
      setPendingNumbers(newPending);
      setPendingNumbersData(newPendingData.sort((a,b) => a.id - b.id));
    };

    const fetchVendidos = async () => {
      const { data, error } = await supabase.from('vendidos').select('*');
      if (error) {
        console.error("Error fetching vendidos:", error);
        return;
      }
      processVendidos(data);
    };

    fetchVendidos();

    const channel = supabase
      .channel('admin-vendidos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendidos' },
        () => {
          fetchVendidos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification({ message: '', type: '', show: false }), 2000);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleNumberClick = (num) => {
    setCurrentNumber(num);
    const data = numberData[num];
    if (data) {
      setName(data.nombre);
      setPhone(data.telefono);
      setVendedor(data.vendedor || (user ? user.email : ""));
    } else {
      setName("");
      setPhone("+569");
      setVendedor(user ? user.email : "");
    }
  };

  const handleSaveOrUpdate = async () => {
    if (!currentNumber || !name.trim()) return;

    try {
        const { error } = await supabase.from('vendidos').upsert({
            id: currentNumber,
            nombre: name, 
            telefono: phone, 
            vendedor: vendedor,
            status: 'approved' // Venta directa = aprobado
        });

        if (error) throw error;
        
        showNotification(`Venta guardada (N° ${currentNumber})`, 'success');
        setCurrentNumber(null);
        setName("");
        setPhone("");
    } catch (err) {
        showNotification('Error al registrar venta', 'error');
    }
  };

  const handleDelete = async () => {
    if (!currentNumber) return;
    setConfirmModal({
      show: true,
      title: 'Liberar Número',
      message: `¿Estás seguro de que deseas liberar el número #${currentNumber}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('vendidos')
            .delete()
            .eq('id', currentNumber);
          if (error) throw error;
          
          showNotification(`Número ${currentNumber} liberado`, 'info');
          setCurrentNumber(null);
          setName("");
          setPhone("");
        } catch (err) {
          showNotification('Error al liberar número', 'error');
        }
      }
    });
  };

  const approveReservation = async (numId) => {
    try {
      const { error } = await supabase
        .from('vendidos')
        .update({ status: 'approved' })
        .eq('id', numId);
      if (error) throw error;
      showNotification(`Reserva #${numId} aprobada`, 'success');
    } catch (err) {
      showNotification('Error al aprobar reserva', 'error');
    }
  };

  const rejectReservation = async (numId) => {
    setConfirmModal({
      show: true,
      title: 'Rechazar Reserva',
      message: `¿Estás seguro de que deseas rechazar y liberar el número #${numId}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('vendidos')
            .delete()
            .eq('id', numId);
          if (error) throw error;
          showNotification(`Reserva #${numId} rechazada`, 'info');
        } catch (err) {
          showNotification('Error al rechazar reserva', 'error');
        }
      }
    });
  };

  const approveUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'approved' })
        .eq('id', userId);
      if (error) throw error;
      showNotification('Usuario aprobado con éxito', 'success');
    } catch (err) {
      showNotification('Error al aprobar usuario', 'error');
    }
  };

  const rejectUser = async (userId) => {
    setConfirmModal({
      show: true,
      title: 'Rechazar Usuario',
      message: '¿Estás seguro de que deseas rechazar este usuario? Se eliminará su registro de acceso.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);
          if (error) throw error;
          showNotification('Usuario rechazado', 'info');
        } catch (err) {
          showNotification('Error al rechazar usuario', 'error');
        }
      }
    });
  };

  // Cálculo de Estadísticas para la central
  const getSalesCount = (email) => {
    return Object.values(numberData).filter(
      ticket => ticket.status === 'approved' && ticket.vendedor?.toLowerCase().trim() === email.toLowerCase().trim()
    ).length;
  };

  const getTopSellers = () => {
    const counts = {};
    Object.values(numberData).forEach((ticket) => {
      if (ticket.status === 'approved' && ticket.vendedor) {
        const sellerEmail = ticket.vendedor.toLowerCase().trim();
        counts[sellerEmail] = (counts[sellerEmail] || 0) + 1;
      }
    });

    const list = Object.keys(counts).map((email) => {
      const userProfile = approvedUsers.find(u => u.email.toLowerCase() === email);
      return {
        email,
        nombre: userProfile ? userProfile.nombre : email.split('@')[0],
        cantidad: counts[email]
      };
    });

    return list.sort((a, b) => b.cantidad - a.cantidad);
  };

  const downloadSoldNumbers = (format) => {
    const BOM = "\uFEFF"; // Byte Order Mark para obligar a Excel/Word a leer UTF-8

    if (format === 'csv') {
      const headers = ["Número", "Comprador", "Teléfono", "Vendedor", "Estado"];
      const rows = [];

      for (let i = 1; i <= TOTAL_NUMBERS; i++) {
        const ticket = numberData[i];
        if (ticket) {
          rows.push([
            i,
            ticket.nombre || '',
            ticket.telefono || '',
            ticket.vendedor || '',
            ticket.status === 'approved' ? 'Vendido' : 'Pendiente'
          ]);
        }
      }

      const csvContent = [
        headers.join(","),
        ...rows.map(e => e.map(val => `"${val}"`).join(","))
      ].join("\n");

      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, "lista_numeros_vendidos.csv");
    } else if (format === 'txt') {
      let txtContent = "RIFA CLUB DEPORTIVO FLECHA - NÚMEROS VENDIDOS\n";
      txtContent += "===================================================\n\n";

      for (let i = 1; i <= TOTAL_NUMBERS; i++) {
        const ticket = numberData[i];
        if (ticket) {
          txtContent += `Número #${i}\n`;
          txtContent += `  Comprador : ${ticket.nombre || 'N/A'}\n`;
          txtContent += `  Teléfono  : ${ticket.telefono || 'N/A'}\n`;
          txtContent += `  Vendedor  : ${ticket.vendedor || 'N/A'}\n`;
          txtContent += `  Estado    : ${ticket.status === 'approved' ? 'Vendido (Aprobado)' : 'Pendiente'}\n`;
          txtContent += "---------------------------------------------------\n";
        }
      }

      const blob = new Blob([BOM + txtContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, "lista_numeros_vendidos.txt");
    } else if (format === 'doc') {
      let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
        <meta charset="utf-8">
        <title>Lista de Números Vendidos</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; }
          h1 { text-align: center; color: #1e3a8a; font-size: 20pt; margin-bottom: 5px; }
          h2 { text-align: center; font-size: 14pt; color: #555; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
        </head>
        <body>
          <h1>Club Deportivo Flecha</h1>
          <h2>Lista de Números Vendidos y Reservas</h2>
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Comprador</th>
                <th>Teléfono</th>
                <th>Vendedor</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (let i = 1; i <= TOTAL_NUMBERS; i++) {
        const ticket = numberData[i];
        if (ticket) {
          htmlContent += `
            <tr>
              <td><strong>#${i}</strong></td>
              <td>${ticket.nombre || ''}</td>
              <td>${ticket.telefono || ''}</td>
              <td>${ticket.vendedor || ''}</td>
              <td>${ticket.status === 'approved' ? 'Vendido' : 'Pendiente'}</td>
            </tr>
          `;
        }
      }

      htmlContent += `
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([BOM + htmlContent], { type: 'application/msword;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, "lista_numeros_vendidos.doc");
    }
  };

  const triggerDownload = (url, filename) => {
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSold = soldNumbers.length;
  const totalRaised = totalSold * 1000;
  const topSellers = getTopSellers();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white font-display">
      {/* Toast */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg shadow-xl text-white font-bold ${notification.type === 'error' ? 'bg-red-600' : 'bg-primary'}`}>
          {notification.message}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-earthy-navy w-full max-w-md rounded-2xl shadow-2xl border border-olive-drab/20 p-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{confirmModal.title}</h3>
            <p className="text-sm opacity-80 mb-6 dark:text-gray-300">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmModal({ show: false })} className="flex-1 py-3 rounded-xl font-bold border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5">Cancelar</button>
              <button type="button" onClick={() => { confirmModal.onConfirm(); setConfirmModal({ show: false }); }} className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-earthy-navy border-b border-olive-drab/10 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">dashboard</span>
              Panel de Control
          </h1>
          {user?.role === 'admin' && (
            <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-xl border border-gray-200 dark:border-white/5">
              <button 
                onClick={() => setActiveTab('grid')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'grid' ? 'bg-primary text-earthy-navy shadow-sm' : 'opacity-60 hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined text-sm">grid_on</span>
                Ventas y Reservas
              </button>
              <button 
                onClick={() => setActiveTab('control')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'control' ? 'bg-primary text-earthy-navy shadow-sm' : 'opacity-60 hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined text-sm">monitoring</span>
                Centro de Control Admin
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="font-semibold opacity-70">{user?.email}</span>
          <button onClick={handleLogout} className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200" title="Cerrar Sesión">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto p-4 md:p-8">
        {activeTab === 'grid' ? (
          <div className="flex flex-col xl:flex-row gap-8">
            {/* Lado Izquierdo: Grilla */}
            <div className="flex-1 bg-white dark:bg-earthy-navy/40 p-6 rounded-2xl border border-olive-drab/10 shadow-sm">
                <RifaGrid 
                    soldNumbers={soldNumbers}
                    pendingNumbers={pendingNumbers}
                    currentNumber={currentNumber} 
                    onNumberClick={handleNumberClick} 
                    pageIndex={pageIndex} 
                    isAdmin={true}
                />
                
                <div className="flex justify-center mt-4 gap-4">
                     <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded" onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}>◀</button>
                     <span className="opacity-50 text-xs py-2">Página {pageIndex + 1} de {TOTAL_PAGES}</span>
                     <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded" onClick={() => setPageIndex(p => Math.min(TOTAL_PAGES - 1, p + 1))} disabled={pageIndex === TOTAL_PAGES - 1}>▶</button>
                </div>
            </div>

            {/* Lado Derecho: Panel de Gestión */}
            <aside className="w-full xl:w-[400px] flex flex-col gap-6">
                
                {/* 1. SECCIÓN DE RESERVAS PENDIENTES */}
                {pendingNumbersData.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-6 rounded-2xl border border-yellow-200 dark:border-yellow-700/30">
                        <h3 className="font-bold text-yellow-700 dark:text-yellow-500 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined">notifications_active</span>
                            Reservas Pendientes ({pendingNumbersData.length})
                        </h3>
                        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                            {pendingNumbersData.map((item) => (
                                <div key={item.id} className="bg-white dark:bg-earthy-navy p-3 rounded-lg shadow-sm border border-yellow-100 dark:border-white/5 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-xs font-black">#{item.id}</span>
                                            <span className="font-bold text-sm">{item.nombre}</span>
                                        </div>
                                        <div className="text-xs opacity-60 mt-0.5">{item.telefono}</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => approveReservation(item.id)} className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200" title="Aprobar"><span className="material-symbols-outlined text-lg">check</span></button>
                                        <button onClick={() => rejectReservation(item.id)} className="p-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200" title="Rechazar"><span className="material-symbols-outlined text-lg">close</span></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. SECCIÓN DE SOLICITUDES DE USUARIOS */}
                {user?.role === 'admin' && pendingUsers.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-200 dark:border-blue-700/30">
                        <h3 className="font-bold text-blue-700 dark:text-blue-400 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined">group_add</span>
                            Solicitudes de Vendedores ({pendingUsers.length})
                        </h3>
                        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                            {pendingUsers.map((item) => (
                                <div key={item.id} className="bg-white dark:bg-earthy-navy p-3 rounded-lg shadow-sm border border-blue-100 dark:border-white/5 flex justify-between items-center">
                                    <div>
                                        <span className="font-bold text-sm dark:text-white">{item.nombre}</span>
                                        <div className="text-xs opacity-60 mt-0.5">{item.email}</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => approveUser(item.id)} className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200" title="Aprobar"><span className="material-symbols-outlined text-lg">check</span></button>
                                        <button onClick={() => rejectUser(item.id)} className="p-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200" title="Rechazar"><span className="material-symbols-outlined text-lg">close</span></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. FORMULARIO MANUAL */}
                <div className="bg-white dark:bg-earthy-navy/40 p-8 rounded-2xl border border-olive-drab/10 shadow-xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">edit_note</span>
                        {currentNumber ? `Gestionar N° ${currentNumber}` : "Selecciona un número"}
                    </h3>

                    <form className="flex flex-col gap-4">
                        <input type="text" className="w-full bg-background-light dark:bg-background-dark border-none rounded-lg p-3 text-sm" placeholder="Nombre Comprador" value={name} onChange={(e) => setName(e.target.value)} disabled={!currentNumber} />
                        <input type="tel" className="w-full bg-background-light dark:bg-background-dark border-none rounded-lg p-3 text-sm" placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!currentNumber} />
                        <input type="text" className="w-full bg-background-light dark:bg-background-dark border-none rounded-lg p-3 text-sm" placeholder="Vendedor Responsable" value={vendedor} onChange={(e) => setVendedor(e.target.value)} disabled={!currentNumber} />

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button type="button" onClick={handleSaveOrUpdate} disabled={!currentNumber || !name.trim()} className="col-span-2 bg-primary text-earthy-navy py-3 rounded-xl font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50">
                                {soldNumbers.includes(currentNumber) ? 'Actualizar Datos' : 'Registrar Venta Directa'}
                            </button>
                            {(soldNumbers.includes(currentNumber) || pendingNumbers.includes(currentNumber)) && (
                                <button type="button" onClick={handleDelete} className="col-span-2 bg-red-500/10 text-red-500 border border-red-500/20 py-2 rounded-xl font-bold uppercase text-xs hover:bg-red-500 hover:text-white transition-colors">
                                    Liberar Número
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </aside>
          </div>
        ) : (
          /* TAB 2: CENTRO DE CONTROL ADMIN */
          <div className="flex flex-col gap-8 animate-fadeIn">
            {/* Cabecera Sección con botón de descarga */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Estadísticas y Control</h2>
                <p className="text-xs opacity-60 mt-1">Supervisión general del rendimiento y usuarios registrados.</p>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="bg-primary text-earthy-navy px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:scale-[1.02] transition-transform flex items-center gap-2 shadow-lg"
                >
                  <span className="material-symbols-outlined">download</span>
                  Descargar Lista
                  <span className="material-symbols-outlined text-sm">arrow_drop_down</span>
                </button>
                {showDownloadMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-earthy-navy rounded-xl shadow-2xl border border-olive-drab/10 overflow-hidden z-50">
                    <button 
                      onClick={() => { downloadSoldNumbers('csv'); setShowDownloadMenu(false); }}
                      className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 text-earthy-navy dark:text-white"
                    >
                      <span className="material-symbols-outlined text-sm text-green-500 font-bold">table_view</span>
                      Archivo CSV (.csv)
                    </button>
                    <button 
                      onClick={() => { downloadSoldNumbers('txt'); setShowDownloadMenu(false); }}
                      className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 text-earthy-navy dark:text-white"
                    >
                      <span className="material-symbols-outlined text-sm text-blue-500 font-bold">description</span>
                      Archivo Texto (.txt)
                    </button>
                    <button 
                      onClick={() => { downloadSoldNumbers('doc'); setShowDownloadMenu(false); }}
                      className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 text-earthy-navy dark:text-white"
                    >
                      <span className="material-symbols-outlined text-sm text-indigo-500 font-bold">article</span>
                      Documento Word (.doc)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Fila de Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tarjeta 1: Total Vendidos */}
              <div className="bg-white dark:bg-earthy-navy/40 p-6 rounded-2xl border border-olive-drab/10 shadow-sm flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60">Números Vendidos</span>
                    <h3 className="text-3xl font-black mt-1 text-primary">{totalSold} / {TOTAL_NUMBERS}</h3>
                  </div>
                  <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                    <span className="material-symbols-outlined text-2xl">confirmation_number</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-100 dark:bg-black/30 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-500" 
                      style={{ width: `${(totalSold / TOTAL_NUMBERS) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold opacity-60 mt-1.5 block">
                    {((totalSold / TOTAL_NUMBERS) * 100).toFixed(1)}% del total reservado/vendido
                  </span>
                </div>
              </div>

              {/* Tarjeta 2: Recaudación */}
              <div className="bg-white dark:bg-earthy-navy/40 p-6 rounded-2xl border border-olive-drab/10 shadow-sm flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60">Recaudación Estimada</span>
                    <h3 className="text-3xl font-black mt-1 text-green-500">${totalRaised.toLocaleString('es-CL')}</h3>
                  </div>
                  <div className="bg-green-500/10 text-green-500 p-2.5 rounded-xl">
                    <span className="material-symbols-outlined text-2xl">payments</span>
                  </div>
                </div>
                <span className="text-xs opacity-60 mt-4 block">
                  Basado en {totalSold} números aprobados a $1.000 CLP c/u.
                </span>
              </div>

              {/* Tarjeta 3: Vendedores Activos */}
              <div className="bg-white dark:bg-earthy-navy/40 p-6 rounded-2xl border border-olive-drab/10 shadow-sm flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60">Vendedores Aprobados</span>
                    <h3 className="text-3xl font-black mt-1 text-blue-500">{approvedUsers.length}</h3>
                  </div>
                  <div className="bg-blue-500/10 text-blue-500 p-2.5 rounded-xl">
                    <span className="material-symbols-outlined text-2xl">group</span>
                  </div>
                </div>
                <span className="text-xs opacity-60 mt-4 block">
                  Vendedores registrados habilitados para realizar reservas.
                </span>
              </div>
            </div>

            {/* Dos Columnas: Vendedores y Top */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Vendedores Registrados (3 cols) */}
              <div className="lg:col-span-3 bg-white dark:bg-earthy-navy/40 p-6 rounded-2xl border border-olive-drab/10 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">groups</span>
                  Vendedores Registrados ({approvedUsers.length})
                </h3>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-olive-drab/10 opacity-60 text-xs uppercase font-bold">
                        <th className="py-3 px-2">Nombre</th>
                        <th className="py-3 px-2">Correo</th>
                        <th className="py-3 px-2 text-right">Rendimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedUsers.map((usr) => {
                        const sales = getSalesCount(usr.email);
                        return (
                          <tr key={usr.id} className="border-b border-olive-drab/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-2 font-bold">{usr.nombre}</td>
                            <td className="py-3.5 px-2 opacity-70 text-xs">{usr.email}</td>
                            <td className="py-3.5 px-2 text-right font-black text-primary">
                              {sales} N°
                            </td>
                          </tr>
                        );
                      })}
                      {approvedUsers.length === 0 && (
                        <tr>
                          <td colSpan="3" className="py-8 text-center opacity-50 italic">
                            No hay vendedores aprobados registrados aún.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Vendedores (2 cols) */}
              <div className="lg:col-span-2 bg-white dark:bg-earthy-navy/40 p-6 rounded-2xl border border-olive-drab/10 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">emoji_events</span>
                  Ranking de Ventas
                </h3>
                <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2">
                  {topSellers.map((item, idx) => {
                    const maxSales = topSellers[0]?.cantidad || 1;
                    const pct = (item.cantidad / maxSales) * 100;
                    return (
                      <div key={item.email} className="flex flex-col gap-1.5 p-3 bg-gray-50 dark:bg-black/10 rounded-xl border border-olive-drab/5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-gray-300 text-gray-800' : idx === 2 ? 'bg-amber-600 text-amber-900' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}>
                              {idx + 1}
                            </span>
                            {item.nombre}
                          </span>
                          <span className="font-black text-primary">{item.cantidad} Ventas</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-black/20 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {topSellers.length === 0 && (
                    <div className="py-8 text-center opacity-50 italic">
                      No hay registros de ventas aprobadas.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;