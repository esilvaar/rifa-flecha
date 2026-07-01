import React, { useState, useEffect } from "react";
import { supabase } from "../../services/supabase";
import { useNavigate } from 'react-router-dom';
import RifaGrid from "../../components/Rifa/RifaGrid";
import { TOTAL_NUMBERS, TOTAL_PAGES } from "../../config";

const Home = () => {
  const [soldNumbers, setSoldNumbers] = useState([]);
  const [pendingNumbers, setPendingNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);

  // Estado para el formulario de reserva y alertas
  const [showModal, setShowModal] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [isReserving, setIsReserving] = useState(false);
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const navigate = useNavigate();

  // Configuración de premios
  const prizes = [
    { title: "1er: Mecedora de madera", desc: "100% Artesanal", img: `${process.env.PUBLIC_URL}/assets/silla.jpeg` },
    { title: "2do: Torta para 20 personas", desc: "Sabor sin definir", img: `${process.env.PUBLIC_URL}/assets/torta.jpeg` },
    { title: "3er: Premio sorpresa", desc: "", img: `${process.env.PUBLIC_URL}/assets/sorpresa.jpeg` }
  ];

  // Escuchar cambios en tiempo real (Vendidos y Pendientes)
  useEffect(() => {
    const processVendidos = (data) => {
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
      .channel('vendidos-changes')
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

  const handleNumberClick = (number) => {
    setSelectedNumber(selectedNumber === number ? null : number);
  };

  const handleReserve = async (e) => {
    e.preventDefault();
    if (!selectedNumber || !buyerName || !buyerPhone) return;

    setIsReserving(true);
    try {
      const { error } = await supabase.from('vendidos').insert({
        id: selectedNumber,
        nombre: buyerName,
        telefono: buyerPhone,
        status: 'pending' // Se guarda como pendiente para revisión del admin
      });
      if (error) throw error;

      setShowModal(false);
      setAlertModal({
        show: true,
        title: '¡Reserva Realizada!',
        message: `¡El número ${selectedNumber} ha sido reservado correctamente! Por favor, espera la confirmación del administrador.`,
        type: 'success'
      });
      setSelectedNumber(null);
      setBuyerName("");
      setBuyerPhone("");
    } catch (error) {
      console.error("Error reservando:", error);
      setAlertModal({
        show: true,
        title: 'Número no Disponible',
        message: 'Lo sentimos, este número ya fue reservado o comprado por otra persona.',
        type: 'error'
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
            <div className="text-primary">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="h-10 w-auto" />
            </div>
            <h2 className="text-xl font-bold tracking-tight hidden sm:block">RIFA <span className="text-primary uppercase">Club Deportivo Flecha</span></h2>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#premios" className="text-sm font-semibold hover:text-primary transition-colors">Premios</a>
            <a href="#comprar" className="text-sm font-semibold hover:text-primary transition-colors">Comprar</a>
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/login')} className="bg-primary text-white px-6 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-transform">
              Iniciar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-10">

        {/* --- HERO SECTION (Principal) --- */}
        <section className="py-12">
          <div className="flex flex-col gap-10 md:flex-row items-center">
            <div className="flex flex-col gap-6 flex-1">
              <div className="flex flex-col gap-4">
                <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tighter uppercase dark:text-white">
                  Gran Rifa <br /><span className="text-primary">A Beneficio</span>
                </h1>
                <p className="text-lg opacity-90 leading-relaxed dark:text-gray-300">
                  Participa para ganar increíbles premios artesanales. Apoya a nuestro club reservando tu número online de forma rápida y segura.
                </p>
              </div>
            </div>
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
                  <img src={prize.img} alt={prize.title} className="max-h-full max-w-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
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
                <p className="opacity-70 dark:text-gray-400">Haz clic en los números disponibles. <span className="font-bold text-primary">Valor: $1.000</span></p>
              </div>

              {/* Leyenda */}
              <div className="flex gap-6 mb-8 text-xs font-bold uppercase tracking-wider dark:text-gray-300 flex-wrap">
                <div className="flex items-center gap-2"><div className="size-4 rounded border border-olive-drab/30"></div> <span>Libre</span></div>
                <div className="flex items-center gap-2"><div className="size-4 rounded bg-primary"></div> <span>Tu Selección</span></div>
                <div className="flex items-center gap-2"><div className="size-4 rounded bg-yellow-400"></div> <span>Reservado</span></div>
                <div className="flex items-center gap-2"><div className="size-4 rounded bg-red-300 dark:bg-red-700"></div> <span>Vendido</span></div>
              </div>

              {/* Grilla */}
              <RifaGrid
                soldNumbers={soldNumbers}
                pendingNumbers={pendingNumbers}
                currentNumber={selectedNumber}
                onNumberClick={handleNumberClick}
                pageIndex={pageIndex}
              />

              {/* Paginación */}
              <div className="flex items-center justify-between mt-6 bg-white dark:bg-earthy-navy/30 p-4 rounded-xl border border-olive-drab/10">
                <button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary/10 disabled:opacity-30 dark:text-white">
                  <span className="material-symbols-outlined">arrow_back</span> Anterior
                </button>
                <span className="text-sm font-bold dark:text-gray-300">Página {pageIndex + 1} de {TOTAL_PAGES}</span>
                <button onClick={() => setPageIndex((p) => Math.min(TOTAL_PAGES - 1, p + 1))} disabled={pageIndex === TOTAL_PAGES - 1} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary/10 disabled:opacity-30 dark:text-white">
                  Siguiente <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
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
                    <span className="text-2xl font-black text-primary">{selectedNumber !== null ? "$1.000" : "$0"}</span>
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
      <footer className="bg-earthy-navy text-white/60 py-12 mt-20 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 text-center md:text-left">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 text-white">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="h-12 w-auto grayscale opacity-80" />
              <div>
                <h2 className="text-sm text-primary font-bold tracking-tight uppercase">Club Deportivo Flecha</h2>
                <p className="text-xs ">Nueva Toltén</p>
              </div>
            </div>
            <p className="text-xs max-w-md">
              Esta actividad se realiza a beneficio de nuestro club para asegurar su adecuada planificación y continuidad.
            </p>
          </div>
          <div className="pt-8 mt-8 border-t border-white/5 text-[10px] uppercase font-bold tracking-widest text-center">
            © 2026 Club Deportivo Flecha - Todos los derechos reservados
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;