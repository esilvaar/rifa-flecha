import { supabase } from './supabase';

/**
 * Crea una nueva invitación para una organización específica.
 * El token y la fecha de expiración se generan automáticamente en la base de datos.
 *
 * @param {string} orgId - UUID de la organización
 * @param {'vendedor' | 'admin'} [rolAsignado='vendedor'] - Rol asignado en la invitación
 * @returns {Promise<Object>} Datos de la invitación creada
 */
export const createInvitation = async (orgId, rolAsignado = 'vendedor') => {
  if (!orgId) {
    throw new Error('El id de la organización es obligatorio para generar una invitación.');
  }

  const { data, error } = await supabase
    .from('invitaciones')
    .insert({
      org_id: orgId,
      rol_asignado: rolAsignado,
    })
    .select(`
      id,
      org_id,
      token,
      estado,
      rol_asignado,
      expires_at,
      created_at
    `)
    .single();

  if (error) {
    console.error('Error al crear invitación en Supabase:', error);
    throw new Error(error.message || 'No se pudo generar la invitación');
  }

  return data;
};

/**
 * Consulta la información pública de una invitación mediante su token.
 *
 * @param {string} token - Token alfanumérico de la invitación
 * @returns {Promise<Object|null>} Metadatos de la invitación y la organización vinculada
 */
export const getInvitationByToken = async (token) => {
  if (!token) {
    return null;
  }

  const { data, error } = await supabase
    .from('invitaciones')
    .select(`
      id,
      org_id,
      token,
      estado,
      rol_asignado,
      expires_at,
      created_at,
      organizaciones (
        id,
        nombre
      )
    `)
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('Error al consultar invitación por token:', error);
    throw new Error(error.message || 'Error al validar la invitación');
  }

  return data;
};

/**
 * Canjea una invitación ejecutando el procedimiento almacenado atómico `accept_invitation` vía RPC.
 *
 * @param {string} token - Token de la invitación a aceptar
 * @returns {Promise<Object>} Objeto con el resultado del RPC ({ success, org_id, rol, message })
 */
export const acceptInvitation = async (token) => {
  if (!token) {
    throw new Error('El token de invitación es requerido.');
  }

  const { data, error } = await supabase.rpc('accept_invitation', {
    invite_token: token,
  });

  if (error) {
    console.error('Error al canjear invitación vía RPC:', error);
    throw new Error(error.message || 'No fue posible aceptar la invitación.');
  }

  return data;
};
