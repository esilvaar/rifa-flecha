/**
 * Utilidades para formateo, sanitización y validación de slugs y URLs amigables.
 */

/**
 * Convierte un texto cualquiera en un slug limpio y seguro para URLs:
 * - Pasa a minúsculas
 * - Remueve acentos y diacríticos
 * - Reemplaza caracteres no alfanuméricos por guiones
 * - Colapsa guiones repetidos y recorta extremos
 *
 * @param {string} text - Texto de entrada (ej: "Rifa de Pancho #2026!")
 * @returns {string} - Slug formateado (ej: "rifa-de-pancho-2026")
 */
export const formatSlug = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Separa caracteres base de sus acentos
    .replace(/[\u0300-\u036f]/g, '') // Elimina los acentos
    .replace(/[^a-z0-9\s-]/g, '') // Elimina caracteres especiales salvo espacios y guiones
    .replace(/[\s_]+/g, '-') // Convierte espacios y guiones bajos a guión medio
    .replace(/-+/g, '-') // Colapsa múltiples guiones a uno solo
    .replace(/^-+|-+$/g, ''); // Elimina guiones iniciales o finales
};

/**
 * Valida si un slug cumple con el estándar alfanumérico para URLs.
 * Mínimo 3 caracteres, máximo 60 caracteres.
 *
 * @param {string} slug - Slug a validar
 * @returns {boolean}
 */
export const isValidSlug = (slug) => {
  if (!slug || typeof slug !== 'string') return false;
  const clean = slug.trim();
  if (clean.length < 3 || clean.length > 60) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean);
};

/**
 * Determina si una cadena dada corresponde a un identificador UUID estándar v4/v1.
 *
 * @param {string} str - Cadena a comprobar
 * @returns {boolean}
 */
export const isUUID = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
};
