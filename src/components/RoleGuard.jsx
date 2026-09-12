import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../hooks/useOrganization';
import CreateOrgModal from './CreateOrgModal';

/**
 * Componente guardián para proteger rutas según el rol del usuario en la organización activa.
 *
 * @param {Object} props
 * @param {string[]} props.allowedRoles - Lista de roles permitidos (ej. ['admin'] o ['vendedor'])
 * @param {React.ReactNode} props.children - Componentes hijos a renderizar si el rol es válido
 */
const RoleGuard = ({ allowedRoles = [], children }) => {
  const { user, loading: authLoading, logout } = useAuth();
  const { role, loading: orgLoading, organizations } = useOrganization();
  const location = useLocation();

  const isLoading = authLoading || orgLoading;

  // 1. Estado de carga visual unificado
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark text-earthy-navy dark:text-white transition-colors duration-300">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide text-gray-600 dark:text-gray-300">
          Verificando permisos de organización...
        </p>
      </div>
    );
  }

  // 2. Redirección si no hay sesión activa
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Caso especial: Usuario sin organización asignada -> Onboarding para crear la primera
  if (organizations.length === 0) {
    return <CreateOrgModal />;
  }

  // 4. Verificación de permisos según roles permitidos
  const hasAllowedRole = allowedRoles.length === 0 || (role && allowedRoles.includes(role));

  if (!hasAllowedRole) {
    // Redirección inteligente basada en el rol actual del usuario
    if (role === 'vendedor') {
      return <Navigate to="/vendedor" replace />;
    }

    if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return children;
};

export default RoleGuard;
