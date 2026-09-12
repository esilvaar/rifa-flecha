import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  // Determinar la ruta de retorno si viene de una invitación u otra página protegida
  const returnTo = searchParams.get('returnTo') || (sessionStorage.getItem('pending_invite_token') ? `/invitacion?token=${sessionStorage.getItem('pending_invite_token')}` : null);

  useEffect(() => {
    if (user) {
      if (returnTo) {
        sessionStorage.removeItem('pending_invite_token');
        navigate(returnTo, { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    }
  }, [user, navigate, returnTo]);

  /**
   * Traduce mensajes de error comunes de Supabase a español amigable
   */
  const formatAuthError = (err) => {
    const msg = err?.message?.toLowerCase() || '';
    if (msg.includes('invalid login credentials')) {
      return 'Correo electrónico o contraseña incorrectos.';
    }
    if (msg.includes('user already registered')) {
      return 'Ya existe un usuario registrado con este correo.';
    }
    if (msg.includes('password should be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (msg.includes('rate limit')) {
      return 'Demasiados intentos. Espera unos momentos antes de reintentar.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Debes confirmar tu correo antes de ingresar, o desactivar "Confirm email" en Supabase.';
    }
    return err?.message || 'Ocurrió un error inesperado al autenticarse.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!nombre.trim()) {
          throw new Error('Por favor ingresa tu nombre completo.');
        }
        if (password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }

        const data = await registerWithEmail(email, password, nombre);

        // Si Supabase requiere confirmación por email y no devuelve sesión inmediata:
        if (data?.user && !data?.session) {
          setInfoMessage('¡Cuenta creada con éxito! Revisa tu correo electrónico para confirmar tu registro.');
          setLoading(false);
          return;
        }

        // Si la sesión fue creada de inmediato, useEffect redirigirá
      } else {
        await loginWithEmail(email, password);
        // useEffect se encargará de la redirección al detectar user
      }
    } catch (err) {
      setError(formatAuthError(err));
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      sessionStorage.setItem('logging_in', 'true');
      await loginWithGoogle();
    } catch (err) {
      sessionStorage.removeItem('logging_in');
      setError(formatAuthError(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 p-8 transition-all">
        {/* Encabezado */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl font-bold">
            🎟️
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isRegister
              ? 'Regístrate con tu correo para acceder al sistema'
              : 'Ingresa tus credenciales de Supabase para continuar'}
          </p>
        </div>

        {/* Pestañas Conmutadoras */}
        <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              !isRegister
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              isRegister
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Mensajes de Alerta */}
        {error && (
          <div className="mb-4 p-3.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 animate-fadeIn">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 p-3.5 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-fadeIn">
            {infoMessage}
          </div>
        )}

        {/* Formulario Email + Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Nombre Completo
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez"
                disabled={loading}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              disabled={loading}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-medium text-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition flex items-center justify-center gap-2 shadow-lg shadow-primary/25 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <span>{isRegister ? 'Crear Cuenta' : 'Entrar'}</span>
            )}
          </button>
        </form>

        {/* Divisor */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700" />
          </div>
          <span className="relative bg-white dark:bg-gray-800 px-3 text-xs text-gray-400">
            o también
          </span>
        </div>

        {/* Botón Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 px-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium text-xs transition flex items-center justify-center gap-3 shadow-sm"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-4 h-4"
          />
          <span>Continuar con Google</span>
        </button>

        {/* Enlace Volver */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← Volver a la página principal
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;