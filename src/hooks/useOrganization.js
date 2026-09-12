import { useContext } from 'react';
import { OrganizationContext } from '../contexts/OrganizationContext';

/**
 * Hook para acceder a la organización activa, el rol del usuario logueado
 * y funciones de cambio de organización en un entorno multi-tenant.
 *
 * @returns {{
 *   activeOrg: { id: string, nombre: string, rol: string, membershipId: string } | null,
 *   role: 'admin' | 'vendedor' | null,
 *   isAdmin: boolean,
 *   isVendedor: boolean,
 *   loading: boolean,
 *   organizations: Array<Object>,
 *   error: string | null,
 *   switchOrg: (orgId: string) => void,
 *   refreshOrganizations: () => Promise<void>
 * }}
 */
export const useOrganization = () => {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error('useOrganization debe ser utilizado dentro de un OrganizationProvider');
  }

  const {
    activeOrg,
    role,
    loading,
    organizations,
    error,
    switchOrg,
    refreshOrganizations,
  } = context;

  return {
    activeOrg,
    role,
    isAdmin: role === 'admin',
    isVendedor: role === 'vendedor',
    loading,
    organizations,
    error,
    switchOrg,
    refreshOrganizations,
  };
};

export default useOrganization;
