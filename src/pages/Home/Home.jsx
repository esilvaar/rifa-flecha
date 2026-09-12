import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../services/supabase";
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';
import RifaGrid from "../../components/Rifa/RifaGrid";
import { TOTAL_NUMBERS, TOTAL_PAGES } from "../../config";
import { isUUID, formatSlug } from "../../utils/slugUtils";

const Home = () => {
  const { rifaId } = useParams();
  const { user } = useAuth();
  const { role, activeOrg } = useOrganization();
  const [soldNumbers, setSoldNumbers] = useState([]);
  const [pendingNumbers, setPendingNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
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
    setSelectedNumber(selectedNumber === number ? null : number);
  };

  const handleReserve = async (e) => {
    e.preventDefault();
    if (!selectedNumber || !buyerName.trim() || !buyerPhone.trim()) return;

    setIsReserving(true);
    try {
      if (activeRifa?.id) {
        // Intentar RPC atómico para reservar
        const { error: rpcErr } = await supabase.rpc('reserve_boleto', {
          p_rifa_id: activeRifa.id,
          p_numero: selectedNumber,
          p_nombre: buyerName.trim(),
          p_telefono: buyerPhone.trim(),
        });

        if (rpcErr) {
          // Fallback a actualización directa si el RPC aún no fue aplicado
          const { error: updateErr } = await supabase
            .from('boletos')
            .update({
              nombre_comprador: buyerName.trim(),
              telefono_comprador: buyerPhone.trim(),
              estado: 'reservado',
            })
            .eq('rifa_id', activeRifa.id)
            .eq('numero', selectedNumber);

          if (updateErr) throw updateErr;
        }
      } else {
        const { error } = await supabase.from('vendidos').insert({
          id: selectedNumber,
          nombre: buyerName,
          telefono: buyerPhone,
          status: 'pending',
        });
        if (error) throw error;
      }

      setShowModal(false);
      setAlertModal({
        show: true,
        title: '¡Reserva Realizada!',
        message: `¡El número ${selectedNumber} ha sido reservado correctamente! Espera la confirmación del organizador.`,
        type: 'success',
      });
      setSelectedNumber(null);
      setBuyerName("");
      setBuyerPhone("");
      await fetchBoletosData();
    } catch (error) {
      console.error("Error reservando:", error);
      setAlertModal({
        show: true,
        title: 'Número no Disponible',
        message: error.message || 'Lo sentimos, este número ya fue reservado o comprado por otra persona.',
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
                className="bg-primary text-white px-5 py-2 rounded-xl font-bold text-xs hover:opacity-90 transition shadow-md shadow-primary/20 flex items-center gap-2"
              >
                <span>{role === 'admin' ? '⚙️ Panel Admin' : '🎟️ Portal Vendedor'}</span>
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
        <section className="py-12">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex flex-col gap-6 flex-1">
              <div className="flex flex-col gap-4">
                <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tighter uppercase dark:text-white">
                  {activeRifa ? (
                    <span>{activeRifa.titulo}</span>
                  ) : (
                    <>Gran Rifa <br /><span className="text-primary">A Beneficio</span></>
                  )}
                </h1>
                <p className="text-lg opacity-90 leading-relaxed dark:text-gray-300">
                  {activeRifa?.descripcion || "Participa para ganar increíbles premios. Apoya reservando tu número online de forma rápida y segura."}
                </p>
                {activeRifa && (
                  <div className="flex items-center gap-3 text-sm font-semibold flex-wrap">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-xl">
                      Valor: ${parseFloat(activeRifa.precio).toLocaleString()} por boleto
                    </span>
                    <span className="text-gray-500">
                      Total: {activeRifa.total_boletos} números
                    </span>
                    {activeRifa.fecha_sorteo && (
                      <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl">
                        📅 Sorteo: {new Date(activeRifa.fecha_sorteo).toLocaleDateString()}
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
        <section className="py-16 border-t border-olive-drab/10" id="premios">
          <div className="flex items-center justify-between mb-10 px-4">
            <h2 className="text-3xl font-black uppercase tracking-tight dark:text-white">Nuestros Premios</h2>
            <span className="material-symbols-outlined text-primary text-3xl">redeem</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
            {prizes.map((prize, idx) => (
              <div key={idx} className="group cursor-pointer">
                <div className="aspect-square bg-white dark:bg-gray-800 rounded-xl mb-4 p-4 flex items-center justify-center border border-olive-drab/10 transition-all duration-500 group-hover:border-primary/50">
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
        <section className="py-16 border-t border-olive-drab/10" id="comprar">
          <div className="flex flex-col lg:flex-row gap-12">

            {/* Lado Izquierdo: Grilla */}
            <div className="flex-1">
              <div className="mb-8">
                <h2 className="text-3xl font-black uppercase mb-2 dark:text-white">Elige tu número</h2>
                <p className="opacity-70 dark:text-gray-400">Haz clic en los números disponibles. <span className="font-bold text-primary">Valor: ${activeRifa ? parseFloat(activeRifa.precio).toLocaleString() : '1.000'}</span></p>
              </div>

              {/* Leyenda */}
              <div className="flex gap-6 mb-8 text-xs font-bold uppercase tracking-wider dark:text-gray-300 flex-wrap">
                <div className="flex items-center gap-2"><div className="size-4 rounded border border-olive-drab/30"></div> <span>Libre</span></div>
                <div className="flex items-center gap-2"><div className="size-4 rounded bg-primary"></div> <span>Tu Selección</span></div>
                <div className="flex items-center gap-2"><div className="size-4 rounded bg-yellow-400"></div> <span>Reservado</span></div>
                <div className="flex items-center gap-2"><div className="size-4 rounded bg-red-300 dark:bg-red-700"></div> <span>Vendido</span></div>
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
                      currentNumber={selectedNumber}
                      onNumberClick={handleNumberClick}
                      pageIndex={pageIndex}
                      totalNumbers={totalHomeNumbers}
                    />

                    {/* Paginación */}
                    <div className="flex items-center justify-between mt-6 bg-white dark:bg-earthy-navy/30 p-4 rounded-xl border border-olive-drab/10">
                      <button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary/10 disabled:opacity-30 dark:text-white">
                        <span className="material-symbols-outlined">arrow_back</span> Anterior
                      </button>
                      <span className="text-sm font-bold dark:text-gray-300">
                        Página {pageIndex + 1} de {totalHomePages} ({totalHomeNumbers} números)
                      </span>
                      <button onClick={() => setPageIndex((p) => Math.min(totalHomePages - 1, p + 1))} disabled={pageIndex >= totalHomePages - 1} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary/10 disabled:opacity-30 dark:text-white">
                        Siguiente <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Lado Derecho: Resumen */}
            <aside className="w-full lg:w-[350px]">
              <div className="sticky top-24 bg-white dark:bg-earthy-navy/40 p-8 rounded-2xl border border-olive-drab/20 shadow-xl backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 dark:text-white">
                  <span className="material-symbols-outlined text-primary">shopping_cart</span>
                  Resumen
                </h3>

                <div className="flex flex-col gap-4 mb-8">
                  <div className="flex justify-between items-center text-sm dark:text-gray-300">
                    <span className="opacity-70">Número elegido:</span>
                    {selectedNumber !== null ? (
                      <span className="bg-primary/20 text-primary px-3 py-1 rounded-md text-sm font-black">#{selectedNumber}</span>
                    ) : (
                      <span className="text-gray-400 italic">Ninguno</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-olive-drab/10">
                    <span className="text-lg font-bold dark:text-white">Total</span>
                    <span className="text-2xl font-black text-primary">
                      {selectedNumber !== null ? (activeRifa ? `$${parseFloat(activeRifa.precio).toLocaleString()}` : "$1.000") : "$0"}
                    </span>
                  </div>
                </div>

                <button
                  disabled={selectedNumber === null}
                  onClick={() => {
                    setBuyerPhone("+569");
                    setShowModal(true);
                  }}
                  className="w-full bg-primary text-earthy-navy py-4 rounded-xl font-black uppercase tracking-wider hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reservar Ahora
                  <span className="material-symbols-outlined">edit_calendar</span>
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* --- TÉRMINOS Y CONDICIONES (si están configurados) --- */}
        {activeRifa?.terminos && (
          <section className="py-12 border-t border-olive-drab/10" id="terminos">
            <div className="bg-white dark:bg-gray-800/60 p-8 rounded-3xl border border-olive-drab/10 space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                <span className="text-primary">📋</span> Términos y Condiciones del Sorteo
              </h3>
              <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line dark:text-gray-300">
                {activeRifa.terminos}
              </p>
            </div>
          </section>
        )}
      </main>

      {/* --- MODAL DE RESERVA --- */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-earthy-navy w-full max-w-md rounded-2xl shadow-2xl border border-olive-drab/20 p-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">Confirmar Reserva #{selectedNumber}</h3>
            <form onSubmit={handleReserve} className="flex flex-col gap-4">
              <div>
                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Tu Nombre</label>
                <input required type="text" className="w-full rounded-lg bg-gray-100 dark:bg-black/20 border-none p-3 dark:text-white" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Ej. Juan Pérez" />
              </div>
              <div>
                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Teléfono / WhatsApp</label>
                <input required type="tel" className="w-full rounded-lg bg-gray-100 dark:bg-black/20 border-none p-3 dark:text-white" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="+56 9..." />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5">Cancelar</button>
                <button type="submit" disabled={isReserving} className="flex-1 py-3 rounded-xl font-bold bg-primary text-earthy-navy hover:opacity-90">
                  {isReserving ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE ALERTA PERSONALIZADO --- */}
      {alertModal.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-earthy-navy w-full max-w-md rounded-2xl shadow-2xl border border-olive-drab/20 p-6 text-center">
            <span className="text-4xl mb-4 block">
              {alertModal.type === 'success' ? '✅' : '❌'}
            </span>
            <h3 className="text-xl font-bold mb-2 dark:text-white">{alertModal.title}</h3>
            <p className="text-sm opacity-80 mb-6 dark:text-gray-300">{alertModal.message}</p>
            <button
              onClick={() => setAlertModal({ ...alertModal, show: false })}
              className="w-full py-3 rounded-xl font-bold bg-primary text-earthy-navy hover:opacity-90"
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