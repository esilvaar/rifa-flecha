import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../services/supabase";
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';
import RifaGrid from "../../components/Rifa/RifaGrid";
import { TOTAL_NUMBERS, TOTAL_PAGES } from "../../config";
import { isUUID, formatSlug } from "../../utils/slugUtils";
import {
  Ticket,
  Settings,
  Calendar,
  Gift,
  ShoppingCart,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  User,
  Phone,
} from 'lucide-react';

const Home = () => {
  const { rifaId } = useParams();
  const { user } = useAuth();
  const { role, activeOrg } = useOrganization();
  const [soldNumbers, setSoldNumbers] = useState([]);
  const [pendingNumbers, setPendingNumbers] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+569");
  const [showModal, setShowModal] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [isReserving, setIsReserving] = useState(false);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'success' });
  const [activeRifa, setActiveRifa] = useState(null);
  const navigate = useNavigate();

  // Configuración de premios por defecto
  const defaultPrizes = [
    { title: "Mecedora", desc: "Mecedora de descanso ergonómica", img: `${process.env.PUBLIC_URL}/assets/mecedora.png` },
    { title: "Torta", desc: "Exquisita torta para compartir", img: `${process.env.PUBLIC_URL}/assets/torta.png` },
    { title: "Premio Sorpresa", desc: "Un increíble regalo especial", img: `${process.env.PUBLIC_URL}/assets/regalo.png` }
  ];

  const prizes = (activeRifa?.premios && Array.isArray(activeRifa.premios) && activeRifa.premios.length > 0)
    ? activeRifa.premios
    : defaultPrizes;

  const fetchBoletosData = useCallback(async () => {
    try {
      // 1. Intentar cargar por rifaId específico (UUID o Slug) o la primera rifa activa
      let query = supabase.from('rifas').select('*');
      if (rifaId) {
        if (isUUID(rifaId)) {
          query = query.eq('id', rifaId);
        } else {
          // Búsqueda por slug amigable
          query = query.eq('slug', formatSlug(rifaId));
        }
      } else {
        query = query.eq('estado', 'activa').order('created_at', { ascending: false });
      }

      let { data: rifasData } = await query.limit(1);

      // Fallback inteligente: si no se encontró por slug directo, intentar buscar por coincidencia en título
      if ((!rifasData || rifasData.length === 0) && rifaId && !isUUID(rifaId)) {
        const cleanedTitleSearch = rifaId.replace(/[-_]/g, ' ').trim();
        const { data: fallbackByTitle } = await supabase
          .from('rifas')
          .select('*')
          .ilike('titulo', `%${cleanedTitleSearch}%`)
          .limit(1);
        if (fallbackByTitle && fallbackByTitle.length > 0) {
          rifasData = fallbackByTitle;
        }
      }

      if (rifasData && rifasData.length > 0) {
        const currentRifa = rifasData[0];
        setActiveRifa(currentRifa);

        const { data: boletosData } = await supabase
          .from('boletos')
          .select('*')
          .eq('rifa_id', currentRifa.id);

        if (boletosData) {
          const sold = [];
          const pending = [];
          boletosData.forEach((b) => {
            if (b.estado === 'pagado') sold.push(b.numero);
            else if (b.estado === 'reservado') pending.push(b.numero);
          });
          setSoldNumbers(sold);
          setPendingNumbers(pending);
          return;
        }
      }

      // 2. Fallback silencioso a tabla vendidos
      const { data } = await supabase.from('vendidos').select('*');
      if (data) {
        const sold = [];
        const pending = [];
        data.forEach((row) => {
          const num = parseInt(row.id, 10);
          if (row.status === 'pending') {
            pending.push(num);
          } else {
            sold.push(num);
          }
        });
        setSoldNumbers(sold);
        setPendingNumbers(pending);
      }
    } catch (err) {
      console.warn("Información de rifa aún no disponible:", err);
    }
  }, [rifaId]);

  useEffect(() => {
    fetchBoletosData();
  }, [fetchBoletosData]);

  // Actualizar metadatos y título dinámicamente según la rifa activa
  useEffect(() => {
    if (activeRifa) {
      document.title = `${activeRifa.titulo} | Sistema de Gestión de Rifas`;

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', activeRifa.titulo);

      const twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', activeRifa.titulo);

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', activeRifa.descripcion || 'Elige y reserva tu número online de forma rápida y segura.');

      const twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', activeRifa.descripcion || 'Elige y reserva tu número online de forma rápida y segura.');

      const imageUrl = activeRifa.imagen_url
        ? activeRifa.imagen_url.split('#')[0]
        : `${window.location.origin}/logo.png`;

      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', imageUrl);

      const ogImageSec = document.querySelector('meta[property="og:image:secure_url"]');
      if (ogImageSec) ogImageSec.setAttribute('content', imageUrl);

      const twImage = document.querySelector('meta[name="twitter:image"]');
      if (twImage) twImage.setAttribute('content', imageUrl);
    } else {
      document.title = 'Sistema de Gestión de Rifas';
    }
  }, [activeRifa]);

  const handleNumberClick = (number) => {
    if (soldNumbers.includes(number) || pendingNumbers.includes(number)) return;
    setSelectedNumbers((prev) =>
      prev.includes(number) ? prev.filter((n) => n !== number) : [...prev, number]
    );
  };

  const handleReserve = async (e) => {
    e.preventDefault();
    if (selectedNumbers.length === 0 || !buyerName.trim() || !buyerPhone.trim()) return;

    setIsReserving(true);
    try {
      if (activeRifa?.id) {
        const { error: updateErr } = await supabase
          .from('boletos')
          .update({
            nombre_comprador: buyerName.trim(),
            telefono_comprador: buyerPhone.trim(),
            estado: 'reservado',
          })
          .eq('rifa_id', activeRifa.id)
          .in('numero', selectedNumbers);

        if (updateErr) throw updateErr;
      } else {
        const inserts = selectedNumbers.map((num) => ({
          id: num,
          nombre: buyerName.trim(),
          telefono: buyerPhone.trim(),
          status: 'pending',
        }));
        const { error } = await supabase.from('vendidos').insert(inserts);
        if (error) throw error;
      }

      const reservedList = selectedNumbers.map((n) => `#${n}`).join(', ');
      setShowModal(false);
      setAlertModal({
        show: true,
        title: '¡Reserva Realizada!',
        message: `¡${selectedNumbers.length === 1 ? 'El número' : 'Los números'} ${reservedList} ${selectedNumbers.length === 1 ? 'ha sido reservado' : 'han sido reservados'} correctamente! Espera la confirmación del organizador.`,
        type: 'success',
      });
      setSelectedNumbers([]);
      setBuyerName("");
      setBuyerPhone("+569");
      await fetchBoletosData();
    } catch (error) {
      console.error("Error reservando:", error);
      setAlertModal({
        show: true,
        title: 'Número no Disponible',
        message: error.message || 'Lo sentimos, uno o más de los números seleccionados ya fueron reservados o comprados por otra persona.',
        type: 'error',
      });
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen font-display">

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-olive-drab/10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center p-1.5 shadow-sm border border-gray-200 dark:border-gray-700">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight uppercase dark:text-white leading-tight">
                {activeRifa ? activeRifa.titulo : "Sistema de Gestión de Rifas"}
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                {activeRifa ? "Sorteo y Venta Online" : "Plataforma de Rifas"}
              </p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#premios" className="text-sm font-semibold hover:text-primary transition-colors">Premios</a>
            <a href="#comprar" className="text-sm font-semibold hover:text-primary transition-colors">Comprar</a>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate(role === 'admin' ? '/admin' : '/vendedor')}
                className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:opacity-90 transition shadow-md shadow-primary/20 flex items-center gap-1.5 active:scale-95"
              >
                {role === 'admin' ? (
                  <>
                    <Settings className="w-3.5 h-3.5" />
                    <span>Panel Admin</span>
                  </>
                ) : (
                  <>
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Portal Vendedor</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="bg-primary text-white px-5 py-2 rounded-xl font-bold text-xs hover:scale-105 transition-transform shadow-md shadow-primary/20"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-10">

        {/* --- HERO SECTION (Principal) --- */}
        <section className="py-8 sm:py-12">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10">
            <div className="flex flex-col gap-5 sm:gap-6 flex-1">
              <div className="flex flex-col gap-3 sm:gap-4">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tighter uppercase dark:text-white">
                  {activeRifa ? (
                    <span>{activeRifa.titulo}</span>
                  ) : (
                    <>Gran Rifa <br /><span className="text-primary">A Beneficio</span></>
                  )}
                </h1>
                <p className="text-base sm:text-lg opacity-90 leading-relaxed dark:text-gray-300">
                  {activeRifa?.descripcion || "Participa para ganar increíbles premios. Apoya reservando tu número online de forma rápida y segura."}
                </p>
                {activeRifa && (
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold flex-wrap">
                    <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl font-bold">
                      Valor: ${parseFloat(activeRifa.precio).toLocaleString()} por boleto
                    </span>
                    <span className="text-gray-500">
                      Total: {activeRifa.total_boletos} números
                    </span>
                    {activeRifa.fecha_sorteo && (
                      <span className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>Sorteo: {new Date(activeRifa.fecha_sorteo).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Imagen Destacada del Premio si está configurada */}
            {activeRifa?.imagen_url && (() => {
              const [url, hash] = activeRifa.imagen_url.split('#');
              const params = new URLSearchParams(hash || '');
              const fit = params.get('fit') || 'cover';
              const pos = params.get('pos') || 'center';

              return (
                <div className="w-full md:w-[380px] lg:w-[440px] aspect-video md:aspect-square rounded-3xl overflow-hidden shadow-2xl border border-olive-drab/20 bg-white dark:bg-gray-800 flex items-center justify-center p-2 group">
                  <img
                    src={url}
                    alt={activeRifa.titulo}
                    style={{ objectFit: fit, objectPosition: pos }}
                    onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                    className="w-full h-full rounded-2xl group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              );
            })()}
          </div>
        </section>

        {/* --- SECCIÓN DE PREMIOS (Recuperada) --- */}
        <section className="py-12 sm:py-16 border-t border-olive-drab/10" id="premios">
          <div className="flex items-center justify-between mb-8 sm:mb-10 px-2 sm:px-4">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight dark:text-white">Nuestros Premios</h2>
            <Gift className="w-7 h-7 text-primary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2 sm:px-4">
            {prizes.map((prize, idx) => (
              <div key={idx} className="group cursor-pointer">
                <div className="aspect-square bg-white dark:bg-gray-800 rounded-2xl mb-4 p-4 flex items-center justify-center border border-olive-drab/10 transition-all duration-500 group-hover:border-primary/50 shadow-sm">
                  <img
                    src={prize.img}
                    alt={prize.title}
                    onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/assets/regalo.png`; }}
                    className="max-h-full max-w-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <h3 className="font-bold text-lg dark:text-white">{prize.title}</h3>
                <p className="text-sm text-olive-drab">{prize.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- SECCIÓN DE COMPRA --- */}
        <section className="py-12 sm:py-16 border-t border-olive-drab/10" id="comprar">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

            {/* Lado Izquierdo: Grilla */}
            <div className="flex-1 min-w-0">
              <div className="mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-black uppercase mb-2 dark:text-white">Elige tu número</h2>
                <p className="opacity-70 dark:text-gray-400 text-xs sm:text-sm">Haz clic en los números disponibles. <span className="font-bold text-primary">Valor: ${activeRifa ? parseFloat(activeRifa.precio).toLocaleString() : '1.000'}</span></p>
              </div>

              {/* Leyenda */}
              <div className="flex gap-4 sm:gap-6 mb-6 sm:mb-8 text-xs font-bold uppercase tracking-wider dark:text-gray-300 flex-wrap">
                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50"></div> <span>Libre</span></div>
                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-primary/20 border-2 border-primary border-dashed"></div> <span>Selección</span></div>
                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-amber-400"></div> <span>Reservado</span></div>
                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-red-500"></div> <span>Vendido</span></div>
              </div>

              {/* Grilla dinámica */}
              {(() => {
                const totalHomeNumbers = activeRifa?.total_boletos || 100;
                const totalHomePages = Math.max(1, Math.ceil(totalHomeNumbers / 100));

                return (
                  <>
                    <RifaGrid
                      soldNumbers={soldNumbers}
                      pendingNumbers={pendingNumbers}
                      selectedNumbers={selectedNumbers}
                      onNumberClick={handleNumberClick}
                      pageIndex={pageIndex}
                      totalNumbers={totalHomeNumbers}
                    />

                    {/* Paginación */}
                    <div className="flex items-center justify-between mt-6 bg-white dark:bg-earthy-navy/30 p-3.5 sm:p-4 rounded-2xl border border-olive-drab/10 flex-wrap gap-2">
                      <button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-primary/10 disabled:opacity-30 dark:text-white text-xs font-semibold">
                        <ChevronLeft className="w-4 h-4" /> <span>Anterior</span>
                      </button>
                      <span className="text-xs font-bold dark:text-gray-300">
                        Página {pageIndex + 1} de {totalHomePages} ({totalHomeNumbers} números)
                      </span>
                      <button onClick={() => setPageIndex((p) => Math.min(totalHomePages - 1, p + 1))} disabled={pageIndex >= totalHomePages - 1} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-primary/10 disabled:opacity-30 dark:text-white text-xs font-semibold">
                        <span>Siguiente</span> <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Lado Derecho: Resumen */}
            <aside className="w-full lg:w-[350px]">
              <div className="lg:sticky lg:top-24 bg-white dark:bg-earthy-navy/40 p-6 sm:p-8 rounded-3xl border border-olive-drab/20 shadow-xl backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 dark:text-white">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    <span>Resumen</span>
                  </h3>
                  {selectedNumbers.length > 0 && (
                    <button
                      onClick={() => setSelectedNumbers([])}
                      className="text-xs text-gray-400 hover:text-red-500 font-semibold transition"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-4 mb-6">
                  <div className="flex flex-col gap-2 text-sm dark:text-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="opacity-70 text-xs">Boletos elegidos:</span>
                      <span className="font-bold text-primary text-xs">
                        {selectedNumbers.length} {selectedNumbers.length === 1 ? 'boleto' : 'boletos'}
                      </span>
                    </div>

                    {selectedNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 py-1 custom-scrollbar">
                        {selectedNumbers.map((num) => (
                          <span
                            key={num}
                            onClick={() => handleNumberClick(num)}
                            className="bg-primary/15 text-primary px-2.5 py-1 rounded-lg text-xs font-black border border-primary/20 flex items-center gap-1.5 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                            title="Haz clic para quitar este número"
                          >
                            #{num} <X className="w-3 h-3 opacity-60" />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-xs">Ninguno seleccionado</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-olive-drab/10">
                    <span className="text-base sm:text-lg font-bold dark:text-white">Total</span>
                    <span className="text-xl sm:text-2xl font-black text-primary">
                      ${(selectedNumbers.length * (parseFloat(activeRifa?.precio) || 1000)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  disabled={selectedNumbers.length === 0}
                  onClick={() => {
                    setBuyerPhone("+569");
                    setShowModal(true);
                  }}
                  className="w-full bg-primary text-earthy-navy py-3.5 rounded-xl font-black uppercase tracking-wider hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 active:scale-[0.99] text-xs sm:text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {selectedNumbers.length > 1
                      ? `Reservar ${selectedNumbers.length} Boletos`
                      : 'Reservar Ahora'}
                  </span>
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* --- TÉRMINOS Y CONDICIONES (si están configurados) --- */}
        {activeRifa?.terminos && (
          <section className="py-12 border-t border-olive-drab/10" id="terminos">
            <div className="bg-white dark:bg-gray-800/60 p-6 sm:p-8 rounded-3xl border border-olive-drab/10 space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2.5 dark:text-white">
                <FileText className="w-5 h-5 text-primary" />
                <span>Términos y Condiciones del Sorteo</span>
              </h3>
              <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line dark:text-gray-300">
                {activeRifa.terminos}
              </p>
            </div>
          </section>
        )}

        {/* Barra Flotante para Móviles */}
        {selectedNumbers.length > 0 && !showModal && (
          <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-gray-900/95 text-white dark:bg-white/95 dark:text-gray-900 p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-700 dark:border-gray-200 backdrop-blur-md animate-fadeIn">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-bold text-primary truncate">
                {selectedNumbers.length} {selectedNumbers.length === 1 ? 'boleto' : 'boletos'} seleccionados
              </p>
              <p className="text-base font-black truncate">
                ${(selectedNumbers.length * (parseFloat(activeRifa?.precio) || 1000)).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setSelectedNumbers([])}
                className="p-2 text-xs font-medium text-white/60 dark:text-gray-500 hover:text-white dark:hover:text-gray-900"
                title="Limpiar selección"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setBuyerPhone("+569");
                  setShowModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-primary text-earthy-navy font-bold text-xs shadow-md flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Reservar</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL DE RESERVA --- */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-100 dark:border-gray-700 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            {/* Barra móvil */}
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold dark:text-white">
                  {selectedNumbers.length === 1
                    ? `Confirmar Reserva #${selectedNumbers[0]}`
                    : `Confirmar Reserva de ${selectedNumbers.length} Boletos`}
                </h3>
                <p className="text-xs text-primary font-bold mt-0.5">
                  Total: ${(selectedNumbers.length * (parseFloat(activeRifa?.precio) || 1000)).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-black/20 rounded-xl border border-olive-drab/10">
              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Boletos elegidos:</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                {selectedNumbers.map((num) => (
                  <span
                    key={num}
                    className="px-2 py-0.5 rounded-md font-bold text-xs bg-primary/20 text-primary border border-primary/30"
                  >
                    #{num}
                  </span>
                ))}
              </div>
            </div>

            <form onSubmit={handleReserve} className="flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" /> Tu Nombre *
                </label>
                <input required type="text" className="w-full rounded-xl bg-gray-100 dark:bg-black/20 border-none p-3 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary/30" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Ej. Juan Pérez" autoFocus />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> Teléfono / WhatsApp *
                </label>
                <input required type="tel" className="w-full rounded-xl bg-gray-100 dark:bg-black/20 border-none p-3 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="+56 9..." />
              </div>
              <div className="flex gap-2.5 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 text-xs">Cancelar</button>
                <button type="submit" disabled={isReserving} className="flex-1 py-3 rounded-xl font-bold bg-primary text-earthy-navy hover:opacity-90 text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95">
                  <Check className="w-4 h-4" />
                  <span>{isReserving ? 'Guardando...' : `Confirmar (${selectedNumbers.length})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE ALERTA PERSONALIZADO --- */}
      {alertModal.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-earthy-navy w-full max-w-md rounded-2xl shadow-2xl border border-olive-drab/20 p-6 text-center space-y-3">
            <div className="mb-2">
              {alertModal.type === 'success' ? (
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              ) : (
                <XCircle className="w-12 h-12 text-red-500 mx-auto" />
              )}
            </div>
            <h3 className="text-xl font-bold dark:text-white">{alertModal.title}</h3>
            <p className="text-sm opacity-80 dark:text-gray-300">{alertModal.message}</p>
            <button
              onClick={() => setAlertModal({ ...alertModal, show: false })}
              className="w-full py-3 rounded-xl font-bold bg-primary text-earthy-navy hover:opacity-90 active:scale-95 transition mt-2"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* --- FOOTER --- */}
      <footer className="bg-earthy-navy text-white/70 py-12 mt-20 border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 text-center md:text-left">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center p-1.5 shadow-sm border border-white/20">
                <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="text-sm text-primary font-bold tracking-tight uppercase">
                  {activeRifa ? activeRifa.titulo : "Sistema de Gestión de Rifas"}
                </h2>
                <p className="text-xs text-white/50">Plataforma Segura de Sorteos</p>
              </div>
            </div>
            <p className="text-xs max-w-md text-white/60">
              {activeRifa?.descripcion || "Participa seleccionando tus números de la suerte. El registro y la reserva se gestionan de forma transparente e inmediata."}
            </p>
          </div>
          <div className="pt-8 mt-8 border-t border-white/5 text-[11px] text-center text-white/40">
            Desarrollado y administrado con <span className="font-semibold text-white/70">Sistema de Gestión de Rifas</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;