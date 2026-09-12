import React, { useState } from 'react';
import { useOrganization } from '../../../hooks/useOrganization';
import { createInvitation } from '../../../services/invitationService';

/**
 * Modal para que administradores generen y compartan enlaces de invitación para su organización.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Estado de apertura del modal
 * @param {() => void} props.onClose - Función de cierre
 */
const InviteMemberModal = ({ isOpen, onClose }) => {
  const { activeOrg } = useOrganization();
  const [role, setRole] = useState('vendedor');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleGenerateLink = async (e) => {
    e.preventDefault();
    if (!activeOrg?.id) {
      setError('Debes tener una organización activa seleccionada para generar invitaciones.');
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const invitation = await createInvitation(activeOrg.id, role);

      // Detectar si la aplicación utiliza HashRouter o BrowserRouter
      const isHashRouting = window.location.hash.startsWith('#') || window.location.href.includes('/#/');
      const baseUrl = `${window.location.origin}${isHashRouting ? '/#' : ''}`;
      const generatedUrl = `${baseUrl}/invitacion?token=${invitation.token}`;

      setInviteLink(generatedUrl);
    } catch (err) {
      setError(err.message || 'Error al generar el enlace de invitación.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  const handleClose = () => {
    setInviteLink('');
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Invitar Miembro
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Organización: <span className="font-semibold text-primary">{activeOrg?.nombre || 'Activa'}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Formulario de selección de rol */}
          <form onSubmit={handleGenerateLink} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                Rol a asignar
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              >
                <option value="vendedor">Vendedor (Catálogo y venta de boletos)</option>
                <option value="admin">Administrador (Gestión total de rifas y miembros)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-primary text-white font-medium text-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generando invitación...</span>
                </>
              ) : (
                <>
                  <span>🔗 Generar Enlace de Invitación</span>
                </>
              )}
            </button>
          </form>

          {/* Enlace generado */}
          {inviteLink && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2 animate-fadeIn">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Enlace generado (Vigente por 7 días)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-600 dark:text-gray-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-4 py-2.5 rounded-xl font-medium text-xs transition flex items-center gap-1.5 shadow-sm ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white'
                  }`}
                >
                  {copied ? '✓ ¡Copiado!' : '📋 Copiar'}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Comparte este enlace con la persona a quien deseas incorporar como {role}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteMemberModal;
