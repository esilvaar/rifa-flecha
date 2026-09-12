import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';

const SaasHome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useOrganization();
  const [raffleSearchInput, setRaffleSearchInput] = useState('');
  const [demoSelectedNumber, setDemoSelectedNumber] = useState(7);

  // Manejo de búsqueda rápida de rifa
  const handleSearchRaffle = (e) => {
    e.preventDefault();
    if (!raffleSearchInput.trim()) return;

    let targetId = raffleSearchInput.trim();
    // Si pegaron una URL completa tipo https://.../#/rifa/UUID extraer solo el UUID
    if (targetId.includes('/rifa/')) {
      targetId = targetId.split('/rifa/')[1].split(/[?#]/)[0];
    }

    navigate(`/rifa/${targetId}`);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white font-sans transition-colors duration-300">
      {/* --- NAVBAR SAAS --- */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/70 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center p-1.5 shadow-sm border border-gray-200 dark:border-gray-700">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight uppercase leading-tight block">
                Sistema de Gestión de Rifas
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                Plataforma SaaS Multi-Tenant
              </span>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-gray-600 dark:text-gray-300">
            <a href="#beneficios" className="hover:text-primary transition-colors">Beneficios</a>
            <a href="#caracteristicas" className="hover:text-primary transition-colors">Características</a>
            <a href="#como-funciona" className="hover:text-primary transition-colors">Cómo Funciona</a>
            <a href="#buscar" className="hover:text-primary transition-colors">Buscar Rifa</a>
          </nav>

          {/* Acciones de Usuario */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                id="btn-nav-panel"
                onClick={() => navigate(role === 'admin' ? '/admin' : '/vendedor')}
                className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 transition shadow-md shadow-primary/20 flex items-center gap-2"
              >
                <span>{role === 'admin' ? '⚙️ Mi Panel Admin' : '🎟️ Portal Vendedor'}</span>
              </button>
            ) : (
              <>
                <button
                  id="btn-nav-login"
                  onClick={() => navigate('/login')}
                  className="hidden sm:block text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary px-3 py-2 transition"
                >
                  Iniciar Sesión
                </button>
                <button
                  id="btn-nav-register"
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 transition shadow-md shadow-primary/20"
                >
                  Comenzar Gratis
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* --- HERO SECTION --- */}
        <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32">
          {/* Luces de fondo decorativas */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 dark:bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 animate-fadeIn">
                <span>✨</span>
                <span>La plataforma definitiva para rifas y sorteos transparentes</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-black tracking-tight uppercase leading-[1.1] dark:text-white">
                Crea, Comparte y Gestiona tus Rifas <span className="text-primary">100% Online</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
                Despídete de los talonarios de papel y las hojas de cálculo. Ofrece a tus compradores una grilla interactiva para elegir sus números favoritos, coordina a tus vendedores y aprueba pagos en tiempo real.
              </p>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button
                  id="btn-hero-start"
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-wider hover:opacity-95 hover:scale-105 transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
                >
                  <span>🚀 Crear mi Primera Rifa</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>

                <a
                  href="#buscar"
                  className="w-full sm:w-auto px-6 py-4 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-xs font-bold uppercase tracking-wider hover:bg-white dark:hover:bg-gray-800 transition flex items-center justify-center gap-2"
                >
                  <span>🔍 Ingresar a una Rifa</span>
                </a>
              </div>

              {/* Métricas destacadas */}
              <div className="grid grid-cols-3 gap-4 pt-12 max-w-lg mx-auto text-center border-t border-gray-200 dark:border-gray-800/80">
                <div>
                  <p className="text-2xl font-black text-primary">100%</p>
                  <p className="text-[11px] text-gray-500 font-semibold uppercase">Digital y Seguro</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-primary">0</p>
                  <p className="text-[11px] text-gray-500 font-semibold uppercase">Duplicados</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-primary">24/7</p>
                  <p className="text-[11px] text-gray-500 font-semibold uppercase">Acceso Móvil</p>
                </div>
              </div>
            </div>

            {/* --- MOCKUP INTERACTIVO EN VIVO --- */}
            <div className="mt-16 max-w-4xl mx-auto rounded-3xl p-3 sm:p-4 bg-gradient-to-b from-gray-200 via-gray-100 to-transparent dark:from-gray-700 dark:via-gray-800 dark:to-transparent shadow-2xl border border-gray-200/80 dark:border-gray-700">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-inner border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-xs text-gray-400 font-mono ml-2">demorifa.com/#/rifa/ejemplo</span>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                    ● Vista del Comprador
                  </span>
                </div>

                <div className="text-center mb-6">
                  <h3 className="text-xl font-black uppercase">Gran Sorteo Anual Pro-Fondos</h3>
                  <p className="text-xs text-gray-500 mt-1">Haz clic en un número libre para probar la selección interactiva:</p>
                </div>

                {/* Mini grilla interactiva de demostración */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-w-md mx-auto mb-6">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
                    const isSold = [3, 9, 14, 18].includes(num);
                    const isPending = [5, 12].includes(num);
                    const isSelected = demoSelectedNumber === num;

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => !isSold && setDemoSelectedNumber(num)}
                        disabled={isSold}
                        className={`aspect-square rounded-xl font-black text-xs flex items-center justify-center transition-all ${
                          isSold
                            ? 'bg-red-200 dark:bg-red-900/40 text-red-500 cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2'
                            : isPending
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-primary/20 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center gap-6 text-[11px] font-bold text-gray-500 uppercase">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-700" /> Disponible</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Tu Selección</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Reservado</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Pagado</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- BUSCADOR DIRECTO DE RIFAS --- */}
        <section id="buscar" className="py-12 bg-white dark:bg-gray-800/40 border-y border-gray-200/80 dark:border-gray-800">
          <div className="max-w-3xl mx-auto px-4 sm:px-8 text-center space-y-4">
            <h2 className="text-xl font-black uppercase">¿Vienes a participar en una rifa?</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pega el enlace o el identificador único que te compartió el organizador para elegir tu número de inmediato:
            </p>
            <form onSubmit={handleSearchRaffle} className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto">
              <input
                type="text"
                required
                value={raffleSearchInput}
                onChange={(e) => setRaffleSearchInput(e.target.value)}
                placeholder="Pega el link o ID de la rifa..."
                className="flex-1 px-4 py-3 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                <span>Ir a la Rifa</span>
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </button>
            </form>
          </div>
        </section>

        {/* --- CARACTERÍSTICAS PRINCIPALES --- */}
        <section id="caracteristicas" className="py-20 max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-black uppercase tracking-tight">Todo lo que necesitas para tu Sorteo</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Diseñado tanto para administradores que dirigen la campaña como para vendedores y compradores.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                📱
              </div>
              <h3 className="font-bold text-base">Página Pública Interactiva</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Tus clientes eligen sus números favoritos desde cualquier celular o computador. Reservan con su nombre y WhatsApp sin necesidad de registrarse.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                👥
              </div>
              <h3 className="font-bold text-base">Equipo de Vendedores (RBAC)</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Invita colaboradores mediante enlaces únicos. Cada vendedor tiene su propio portal protegido para registrar cobros y supervisar su cuota asignada.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                🖼️
              </div>
              <h3 className="font-bold text-base">Biblioteca Multimedia</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Sube las fotos de tus premios directamente a la nube de tu organización. Controla el encuadre (arriba, centro, abajo) y reutilízalas en futuros sorteos.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                💬
              </div>
              <h3 className="font-bold text-base">Compartir por WhatsApp</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Botón integrado para generar un mensaje prediseñado con el enlace directo de tu rifa y enviarlo a listas de difusión y grupos en 1 segundo.
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                📊
              </div>
              <h3 className="font-bold text-base">Métricas y Exportación CSV</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Monitorea en tiempo real los montos recaudados, boletos vendidos y pendientes. Descarga listas en Excel/CSV listas para el sorteo.
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-8 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                🔒
              </div>
              <h3 className="font-bold text-base">Seguridad Concurrente</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Bloqueo atómico de boletos a nivel de base de datos PostgreSQL. Es imposible que dos personas compren o reserven el mismo número por error.
              </p>
            </div>
          </div>
        </section>

        {/* --- CÓMO FUNCIONA --- */}
        <section id="como-funciona" className="py-20 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200/80 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 space-y-16">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-black uppercase tracking-tight">Comienza en 3 Simples Pasos</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sin configuraciones técnicas complejas. Tu rifa lista para vender en minutos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
              {/* Paso 1 */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white font-black text-base mx-auto flex items-center justify-center shadow-lg shadow-primary/30">
                  1
                </div>
                <h3 className="font-bold text-base">Crea tu Organización</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Regístrate con tu correo y nombra a tu club, fundación, colegio o causa solidaria.
                </p>
              </div>

              {/* Paso 2 */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white font-black text-base mx-auto flex items-center justify-center shadow-lg shadow-primary/30">
                  2
                </div>
                <h3 className="font-bold text-base">Configura tus Premios</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Establece la cantidad de números (100, 200, 500, etc.), el valor de cada boleto y sube las imágenes.
                </p>
              </div>

              {/* Paso 3 */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white font-black text-base mx-auto flex items-center justify-center shadow-lg shadow-primary/30">
                  3
                </div>
                <h3 className="font-bold text-base">Comparte y Recauda</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Envía el enlace público a tus clientes o invita vendedores a colaborar en la venta.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- BANNER CTA FINAL --- */}
        <section className="py-20 max-w-5xl mx-auto px-4 sm:px-8">
          <div className="bg-primary text-white p-10 sm:p-14 rounded-3xl text-center space-y-6 shadow-2xl shadow-primary/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
              ¿Listo para modernizar tu próxima rifa?
            </h2>
            <p className="text-white/80 text-sm max-w-xl mx-auto leading-relaxed">
              Únete a las organizaciones que gestionan sus sorteos con transparencia, rapidez y cero errores manuales.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 rounded-2xl bg-white text-primary font-black text-xs uppercase tracking-wider hover:bg-white/90 hover:scale-105 transition-all shadow-xl"
              >
                Crear Cuenta y Empezar
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER SAAS --- */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center p-1 shadow-sm border border-gray-200 dark:border-gray-700">
              <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-tight">Sistema de Gestión de Rifas</p>
              <p className="text-[11px] text-gray-400">Plataforma SaaS para Sorteos Online</p>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            © 2026 Sistema de Gestión de Rifas - Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SaasHome;
