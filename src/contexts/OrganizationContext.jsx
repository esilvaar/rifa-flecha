import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const ACTIVE_ORG_STORAGE_KEY = 'active_org_id';

export const OrganizationContext = createContext({
  organizations: [],
  activeOrg: null,
  role: null,
  loading: true,
  error: null,
  switchOrg: () => {},
  refreshOrganizations: async () => {},
});

export const OrganizationProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Consulta las organizaciones a las que pertenece el usuario autenticado
   * junto con el rol asignado en cada una.
   */
  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setActiveOrg(null);
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('miembros_organizacion')
        .select(`
          id,
          rol,
          org_id,
          created_at,
          organizaciones (
            id,
            nombre,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (queryError) {
        throw queryError;
      }

      // Mapear los datos uniendo la membresía y la organización
      const orgList = (data || [])
        .filter((item) => Boolean(item.organizaciones))
        .map((item) => ({
          id: item.organizaciones.id,
          nombre: item.organizaciones.nombre,
          rol: item.rol,
          membershipId: item.id,
          createdAt: item.organizaciones.created_at,
        }));

      setOrganizations(orgList);

      if (orgList.length > 0) {
        // Recuperar última organización activa guardada en localStorage o seleccionar la primera
        const storedOrgId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
        const matchedOrg = orgList.find((org) => org.id === storedOrgId);
        const currentOrg = matchedOrg || orgList[0];

        setActiveOrg(currentOrg);
        setRole(currentOrg.rol);
        localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, currentOrg.id);
      } else {
        setActiveOrg(null);
        setRole(null);
        localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Error al consultar organizaciones del usuario:', err);
      setError(err.message || 'Error al obtener organizaciones');
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Permite cambiar la organización activa en tiempo real.
   */
  const switchOrg = useCallback(
    (orgId) => {
      const targetOrg = organizations.find((org) => org.id === orgId);
      if (!targetOrg) {
        console.warn(`No se encontró la organización con id: ${orgId}`);
        return;
      }

      setActiveOrg(targetOrg);
      setRole(targetOrg.rol);
      localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, targetOrg.id);
    },
    [organizations]
  );

  useEffect(() => {
    if (!authLoading) {
      fetchOrganizations();
    }
  }, [authLoading, fetchOrganizations]);

  const value = {
    organizations,
    activeOrg,
    role,
    loading: authLoading || loading,
    error,
    switchOrg,
    refreshOrganizations: fetchOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export default OrganizationProvider;
