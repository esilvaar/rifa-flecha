import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../hooks/useOrganization';
import { createOrganization } from '../services/organizationService';

/**
 * Componente Onboarding que permite al usuario crear su primera organización
 * o cerrar sesión si está a la espera de un enlace de invitación.
 */
const CreateOrgModal = () => {
  const { logout } = useAuth();
  const { refreshOrganizations } = useOrganization();

  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Por favor ingresa un nombre para tu organización.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createOrganization(orgName);
      await refreshOrganizations();
    } catch (err) {
      console.error('Error al crear organización:', err);
      setError(err.message || 'No fue posible crear la organización.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700 animate-fadeIn">
        {/* Encabezado */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl shadow-inner">
            🏢
          </div>
          <h2 className="text-2xl font-bold">Crea tu Organización</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            Para comenzar a gestionar rifas y administrar vendedores, define el nombre de tu organización.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Nombre de la Organización
            </label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ej. Rifas San José, Club Deportivo..."
              disabled={loading}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-medium text-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creando Organización...</span>
              </>
            ) : (
              <span>✨ Crear Organización y Empezar</span>
            )}
          </button>
        </form>

        {/* Separador e información para invitados */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 text-center space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ¿Fuiste invitado como vendedor? Pide a tu administrador el enlace de invitación para unirte.
          </p>

          <button
            type="button"
            onClick={() => logout()}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition underline"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateOrgModal;
