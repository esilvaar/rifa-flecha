import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';
import { getInvitationByToken, acceptInvitation } from '../../services/invitationService';

/**
 * Vista para validar y aceptar invitaciones a organizaciones mediante un token en la URL.
 */
const AceptarInvitacion = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refreshOrganizations, switchOrg } = useOrganization();

  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState(null);
  const [fetchingInvite, setFetchingInvite] = useState(true);
  const [processingAccept, setProcessingAccept] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Carga los metadatos públicos de la invitación (nombre de org, rol asignado, vigencia)
   */
  const loadInvitation = useCallback(async () => {
    if (!token) {
      setError('Enlace incompleto: no se proporcionó ningún token de invitación en la URL.');
      setFetchingInvite(false);
      return;
    }

    setFetchingInvite(true);
    setError(null);

    try {
      const data = await getInvitationByToken(token);

      if (!data) {
        setError('La invitación no existe o ya no está disponible.');
        return;
      }

      if (data.estado !== 'pendiente') {
        setError(`Esta invitación ya ha sido ${data.estado}.`);
        return;
      }

      const isExpired = new Date(data.expires_at) < new Date();
      if (isExpired) {
        setError('Esta invitación ha expirado. Solicita un nuevo enlace al administrador.');
        return;
      }

      setInvitation(data);
    } catch (err) {
      console.error('Error al cargar datos de la invitación:', err);
      setError(err.message || 'No fue posible validar la invitación.');
    } finally {
      setFetchingInvite(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  /**
   * Ejecuta el canje de la invitación vía RPC y redirige al dashboard correspondiente
   */
  const handleAccept = async () => {
    if (!token || !user) return;

    setProcessingAccept(true);
    setError(null);

    try {
      const result = await acceptInvitation(token);

      setSuccessMessage('¡Te has unido exitosamente a la organización!');

      // Actualizar el estado global de organizaciones del usuario
      await refreshOrganizations();

      if (result?.org_id) {
        switchOrg(result.org_id);
      }

      // Redirigir según el rol retornado por la función RPC
      setTimeout(() => {
        if (result?.rol === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/vendedor', { replace: true });
        }
      }, 1200);
    } catch (err) {
      console.error('Error al aceptar invitación:', err);
      setError(err.message || 'Ocurrió un error al procesar la invitación. Por favor intenta de nuevo.');
      setProcessingAccept(false);
    }
  };

  const isLoading = authLoading || fetchingInvite;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 p-8 text-center animate-fadeIn">
        {/* Ícono de encabezado */}
        <div className="w-16 h-16 mx-auto mb-5 bg-primary/10 text-primary dark:bg-primary/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
          ✉️
        </div>

        <h1 className="text-2xl font-bold mb-2">Invitación a Organización</h1>

        {/* 1. Estado de carga inicial */}
        {isLoading && (
          <div className="py-8 space-y-3">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Validando información de la invitación...
            </p>
          </div>
        )}

        {/* 2. Mensaje de error si la invitación no es válida */}
        {!isLoading && error && (
          <div className="my-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-left">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
              No fue posible procesar la invitación
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
            <div className="mt-4 pt-3 border-t border-red-200/60 dark:border-red-800/60 flex justify-center">
              <Link
                to="/"
                className="text-xs font-semibold text-primary hover:underline"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        )}

        {/* 3. Mensaje de éxito tras aceptar */}
        {!isLoading && successMessage && (
          <div className="my-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {successMessage}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              Redirigiendo a tu espacio de trabajo...
            </p>
          </div>
        )}

        {/* 4. Invitación válida y pendiente */}
        {!isLoading && !error && !successMessage && invitation && (
          <div className="space-y-6 mt-4">
            <div className="bg-gray-50 dark:bg-gray-700/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 text-left space-y-2">
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span>Organización:</span>
                <span className="font-bold text-gray-900 dark:text-white text-sm">
                  {invitation.organizaciones?.nombre || 'Organización'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span>Rol asignado:</span>
                <span className="font-semibold uppercase tracking-wider text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary">
                  {invitation.rol_asignado}
                </span>
              </div>
            </div>

            {/* A) Usuario no autenticado: invitar a iniciar sesión */}
            {!user ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Para aceptar esta invitación y comenzar a trabajar, inicia sesión o crea una cuenta con tu correo electrónico.
                </p>
                <Link
                  to={`/login?returnTo=${encodeURIComponent(`/invitacion?token=${token}`)}`}
                  onClick={() => {
                    // Guardar token temporalmente en sessionStorage por si se usa OAuth (Google)
                    sessionStorage.setItem('pending_invite_token', token);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-medium text-sm hover:opacity-90 active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-lg shadow-primary/25 block"
                >
                  Iniciar Sesión para Aceptar
                </Link>
              </div>
            ) : (
              /* B) Usuario autenticado: botón directo para unirse */
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Has iniciado sesión como <span className="font-semibold text-gray-800 dark:text-gray-200">{user.email}</span>
                </p>

                <button
                  onClick={handleAccept}
                  disabled={processingAccept}
                  className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-medium text-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                >
                  {processingAccept ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Procesando unión...</span>
                    </>
                  ) : (
                    <span>Aceptar Invitación y Unirse</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AceptarInvitacion;
