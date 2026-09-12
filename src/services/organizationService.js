import { supabase } from './supabase';
import { formatSlug } from '../utils/slugUtils';

/**
 * Crea una nueva organización y asigna al usuario actual como administrador.
 * Intenta primero mediante la función atómica RPC `create_organization`.
 *
 * @param {string} nombre - Nombre de la organización
 * @returns {Promise<Object>} Datos de la organización creada
 */
export const createOrganization = async (nombre) => {
  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre de la organización es obligatorio.');
  }

  const cleanName = nombre.trim();

  // 1. Intentar mediante RPC atómico
  try {
    const { data, error } = await supabase.rpc('create_organization', {
      org_nombre: cleanName,
    });

    if (!error && data?.org_id) {
      return data;
    }
  } catch (rpcErr) {
    console.warn('RPC create_organization no disponible, intentando inserción directa:', rpcErr);
  }

  // 2. Fallback de inserción directa
  const { data: orgData, error: orgError } = await supabase
    .from('organizaciones')
    .insert({ nombre: cleanName })
    .select()
    .single();

  if (orgError) {
    throw new Error(orgError.message || 'Error al registrar organización');
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (userId) {
    await supabase.from('miembros_organizacion').insert({
      org_id: orgData.id,
      user_id: userId,
      rol: 'admin',
    });
  }

  return {
    success: true,
    org_id: orgData.id,
    nombre: orgData.nombre,
    rol: 'admin',
  };
};

/**
 * Verifica si un slug está disponible o si ya está en uso por otra rifa.
 *
 * @param {string} slug - Slug a verificar
 * @param {string} [excludeRifaId=null] - ID de la rifa actual a excluir si se está editando
 * @returns {Promise<boolean>} true si está disponible, false si ya existe
 */
export const checkSlugAvailable = async (slug, excludeRifaId = null) => {
  if (!slug) return false;
  const clean = formatSlug(slug);
  if (!clean) return false;

  let query = supabase
    .from('rifas')
    .select('id')
    .eq('slug', clean);

  if (excludeRifaId) {
    query = query.neq('id', excludeRifaId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // Si la columna slug aún no ha sido creada en la base de datos de Supabase, no bloquear
    console.warn('Aviso comprobando disponibilidad de slug:', error);
    return true;
  }

  return !data;
};

/**
 * Obtiene las rifas pertenecientes a una organización.
 *
 * @param {string} orgId - UUID de la organización
 * @returns {Promise<Array>} Lista de rifas
 */
export const getOrganizationRifas = async (orgId) => {
  if (!orgId) return [];

  const { data, error } = await supabase
    .from('rifas')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener rifas de la organización:', error);
    throw new Error(error.message || 'Error al obtener rifas');
  }

  return data || [];
};

/**
 * Crea una nueva rifa y genera los boletos correspondientes.
 *
 * @param {string} orgId - UUID de la organización
 * @param {Object} rifaData - Datos de la rifa ({ titulo, slug, descripcion, total_boletos, precio, fecha_sorteo })
 * @returns {Promise<Object>} Rifa creada
 */
export const createRifaWithBoletos = async (orgId, rifaData) => {
  if (!orgId) throw new Error('Se requiere orgId para crear una rifa.');

  const total = parseInt(rifaData.total_boletos, 10) || 100;
  const calculatedSlug = formatSlug(rifaData.slug || rifaData.titulo) || null;

  // 1. Insertar la rifa
  const insertPayload = {
    org_id: orgId,
    titulo: rifaData.titulo,
    descripcion: rifaData.descripcion || '',
    total_boletos: total,
    precio: parseFloat(rifaData.precio) || 0,
    fecha_sorteo: rifaData.fecha_sorteo || null,
    estado: 'activa',
  };

  if (calculatedSlug) {
    insertPayload.slug = calculatedSlug;
  }

  const { data: rifa, error: rifaErr } = await supabase
    .from('rifas')
    .insert(insertPayload)
    .select()
    .single();

  if (rifaErr) {
    // Si falla por columna slug no existente, reintentar sin slug
    if (rifaErr.code === 'PGRST204' && insertPayload.slug) {
      delete insertPayload.slug;
      const { data: retryData, error: retryErr } = await supabase
        .from('rifas')
        .insert(insertPayload)
        .select()
        .single();
      if (retryErr) throw new Error(retryErr.message || 'No fue posible crear la rifa.');
      return retryData;
    }
    throw new Error(rifaErr.message || 'No fue posible crear la rifa.');
  }

  // 2. Generar boletos iniciales en lotes
  const boletosToInsert = [];
  for (let i = 1; i <= total; i++) {
    boletosToInsert.push({
      rifa_id: rifa.id,
      numero: i,
      estado: 'disponible',
    });
  }

  // Insertar en fragmentos de 250 para evitar exceder límites de payload
  const chunkSize = 250;
  for (let i = 0; i < boletosToInsert.length; i += chunkSize) {
    const chunk = boletosToInsert.slice(i, i + chunkSize);
    const { error: chunkErr } = await supabase.from('boletos').insert(chunk);
    if (chunkErr) {
      console.warn('Advertencia al insertar lote de boletos:', chunkErr);
    }
  }

  return rifa;
};

/**
 * Obtiene los boletos de una rifa específica con información de comprador y vendedor.
 *
 * @param {string} rifaId - UUID de la rifa
 * @returns {Promise<Array>} Lista de boletos
 */
export const getBoletosByRifa = async (rifaId) => {
  if (!rifaId) return [];

  const { data, error } = await supabase
    .from('boletos')
    .select('*')
    .eq('rifa_id', rifaId)
    .order('numero', { ascending: true });

  if (error) {
    console.error('Error al obtener boletos:', error);
    throw new Error(error.message || 'Error al obtener boletos');
  }

  return data || [];
};

/**
 * Registra o reserva un boleto a nombre del comprador y asigna el vendedor.
 *
 * @param {string} boletoId - UUID del boleto
 * @param {Object} saleData - { nombre_comprador, telefono_comprador, vendedor_id, estado }
 * @returns {Promise<Object>} Boleto actualizado
 */
export const updateBoletoVenta = async (boletoId, saleData) => {
  const { data, error } = await supabase
    .from('boletos')
    .update({
      nombre_comprador: saleData.nombre_comprador,
      telefono_comprador: saleData.telefono_comprador,
      vendedor_id: saleData.vendedor_id,
      estado: saleData.estado || 'reservado',
    })
    .eq('id', boletoId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Error al actualizar boleto');
  }

  return data;
};

/**
 * Actualiza la información y personalización de una rifa (título, descripción, imagen, premios, términos).
 *
 * @param {string} rifaId - UUID de la rifa
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<Object>} Rifa actualizada
 */
export const updateRifa = async (rifaId, updates) => {
  if (!rifaId) throw new Error('Se requiere el ID de la rifa para actualizar.');

  const { data, error } = await supabase
    .from('rifas')
    .update(updates)
    .eq('id', rifaId)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar rifa:', error);
    throw new Error(error.message || 'Error al guardar los cambios de la rifa');
  }

  return data;
};

/**
 * Sube una imagen a Supabase Storage en el bucket 'rifas-media' asociada a la organización.
 *
 * @param {File} file - Archivo de imagen seleccionado por el usuario
 * @param {string} orgId - ID de la organización para agrupar todas sus imágenes
 * @returns {Promise<{ url: string, name: string }>} URL pública y nombre del archivo
 */
export const uploadRifaImage = async (file, orgId = 'general') => {
  if (!file) throw new Error('No se ha seleccionado ningún archivo.');

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen no debe superar los 5MB.');
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `${orgId}/${cleanName}`;

  const { error: uploadError } = await supabase.storage
    .from('rifas-media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error en Supabase Storage:', uploadError);
    if (uploadError.message?.toLowerCase().includes('bucket') || uploadError.message?.toLowerCase().includes('not found')) {
      throw new Error('El bucket "rifas-media" aún no ha sido creado en Supabase Storage como público.');
    }
    throw new Error(uploadError.message || 'Error al subir la imagen.');
  }

  const { data } = supabase.storage
    .from('rifas-media')
    .getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    name: cleanName,
  };
};

/**
 * Obtiene la lista de todas las imágenes subidas por la organización en Supabase Storage.
 *
 * @param {string} orgId - UUID de la organización
 * @returns {Promise<Array<{ name: string, url: string, created_at: string }>>}
 */
export const getOrgUploadedImages = async (orgId) => {
  if (!orgId) return [];

  try {
    const { data, error } = await supabase.storage
      .from('rifas-media')
      .list(orgId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.warn('Advertencia al consultar galería de la organización:', error);
      return [];
    }

    return (data || [])
      .filter((item) => item.name && !item.name.startsWith('.'))
      .map((item) => {
        const { data: urlData } = supabase.storage
          .from('rifas-media')
          .getPublicUrl(`${orgId}/${item.name}`);

        return {
          name: item.name,
          created_at: item.created_at,
          url: urlData.publicUrl,
        };
      });
  } catch (err) {
    console.warn('Error al cargar imágenes de la organización:', err);
    return [];
  }
};

/**
 * Elimina una imagen de la galería de la organización en Supabase Storage.
 *
 * @param {string} orgId - UUID de la organización
 * @param {string} fileName - Nombre del archivo dentro de la carpeta de la organización
 */
export const deleteOrgImage = async (orgId, fileName) => {
  if (!orgId || !fileName) return;

  const { error } = await supabase.storage
    .from('rifas-media')
    .remove([`${orgId}/${fileName}`]);

  if (error) {
    console.error('Error al eliminar imagen de Storage:', error);
    throw new Error(error.message || 'Error al eliminar la imagen.');
  }
};
