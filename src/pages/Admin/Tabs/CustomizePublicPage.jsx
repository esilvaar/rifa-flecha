import React, { useState, useEffect, useCallback } from 'react';
import {
  updateRifa,
  uploadRifaImage,
  getOrgUploadedImages,
  deleteOrgImage,
  checkSlugAvailable,
} from '../../../services/organizationService';
import { formatSlug } from '../../../utils/slugUtils';

const DEFAULT_PRESETS = [
  { title: "Premio Principal", desc: "Gran premio del sorteo", img: `${process.env.PUBLIC_URL}/assets/mecedora.png` },
  { title: "Segundo Premio", desc: "Segundo lugar", img: `${process.env.PUBLIC_URL}/assets/torta.png` },
  { title: "Tercer Premio", desc: "Tercer lugar sorpresa", img: `${process.env.PUBLIC_URL}/assets/regalo.png` }
];

// Utilidades para serializar/deserializar ajustes de imagen en la URL
const parseImageConfig = (raw) => {
  if (!raw) return { url: '', fit: 'cover', pos: 'center' };
  const [url, hash] = raw.split('#');
  const params = new URLSearchParams(hash || '');
  return {
    url: url || '',
    fit: params.get('fit') || 'cover',
    pos: params.get('pos') || 'center',
  };
};

const serializeImageConfig = (url, fit, pos) => {
  if (!url || !url.trim()) return null;
  const [cleanUrl] = url.trim().split('#');
  if (!cleanUrl) return null;
  return `${cleanUrl}#fit=${fit}&pos=${pos}`;
};

const CustomizePublicPage = ({ selectedRifa, activeOrg, onRifaUpdated, showNotification }) => {
  const [titulo, setTitulo] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState({ state: 'idle', message: '' }); // 'idle' | 'checking' | 'available' | 'taken'
  const [descripcion, setDescripcion] = useState('');

  // Estados de la Foto Principal (con ajuste de posición y encuadre)
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [mainImageFit, setMainImageFit] = useState('cover'); // 'cover' | 'contain'
  const [mainImagePos, setMainImagePos] = useState('center'); // 'center' | 'top' | 'bottom'

  const [fechaSorteo, setFechaSorteo] = useState('');
  const [terminos, setTerminos] = useState('');
  const [premios, setPremios] = useState([]);
  const [saving, setSaving] = useState(false);

  // Estados de carga de archivos y galería
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingPrizeIndex, setUploadingPrizeIndex] = useState(null);
  const [orgGallery, setOrgGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Modal de Galería de la Organización
  // galleryTarget: 'main' | number (index del premio)
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState('main');

  // Cargar galería de imágenes de la organización
  const loadGallery = useCallback(async () => {
    if (!activeOrg?.id) return;
    setLoadingGallery(true);
    try {
      const images = await getOrgUploadedImages(activeOrg.id);
      setOrgGallery(images);
    } catch (err) {
      console.warn("No se pudo cargar la galería:", err);
    } finally {
      setLoadingGallery(false);
    }
  }, [activeOrg?.id]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // Sincronizar formulario al cambiar la rifa seleccionada
  useEffect(() => {
    if (selectedRifa) {
      setTitulo(selectedRifa.titulo || '');
      setSlug(selectedRifa.slug || formatSlug(selectedRifa.titulo) || '');
      setSlugStatus({ state: selectedRifa.slug ? 'available' : 'idle', message: '' });
      setDescripcion(selectedRifa.descripcion || '');

      const parsedImg = parseImageConfig(selectedRifa.imagen_url);
      setMainImageUrl(parsedImg.url);
      setMainImageFit(parsedImg.fit);
      setMainImagePos(parsedImg.pos);

      setFechaSorteo(selectedRifa.fecha_sorteo ? selectedRifa.fecha_sorteo.split('T')[0] : '');
      setTerminos(selectedRifa.terminos || '');

      if (Array.isArray(selectedRifa.premios) && selectedRifa.premios.length > 0) {
        setPremios(selectedRifa.premios);
      } else {
        setPremios(DEFAULT_PRESETS);
      }
    }
  }, [selectedRifa]);

  // Verificación en tiempo real de disponibilidad del slug
  useEffect(() => {
    if (!slug.trim() || !selectedRifa?.id) {
      setSlugStatus({ state: 'idle', message: '' });
      return;
    }

    const clean = formatSlug(slug);
    if (selectedRifa.slug && clean === selectedRifa.slug) {
      setSlugStatus({ state: 'available', message: 'Slug actual de esta rifa' });
      return;
    }

    setSlugStatus({ state: 'checking', message: 'Comprobando...' });
    const timer = setTimeout(async () => {
      try {
        const isAvailable = await checkSlugAvailable(clean, selectedRifa.id);
        if (isAvailable) {
          setSlugStatus({ state: 'available', message: '¡Disponible!' });
        } else {
          setSlugStatus({ state: 'taken', message: 'Ya en uso por otra rifa' });
        }
      } catch (err) {
        setSlugStatus({ state: 'idle', message: '' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, selectedRifa?.id, selectedRifa?.slug]);

  // Subir imagen para la portada / banner principal
  const handleUploadMainImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrg?.id) return;

    setUploadingMain(true);
    try {
      const { url, name } = await uploadRifaImage(file, activeOrg.id);
      setMainImageUrl(url);
      setOrgGallery(prev => [{ name, url, created_at: new Date().toISOString() }, ...prev]);
      showNotification('¡Imagen principal subida y agregada a tu galería!', 'success');
    } catch (err) {
      showNotification(err.message || 'Error al subir la imagen', 'error');
    } finally {
      setUploadingMain(false);
      e.target.value = '';
    }
  };

  // Subir imagen para un premio específico
  const handleUploadPrizeImage = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrg?.id) return;

    setUploadingPrizeIndex(index);
    try {
      const { url, name } = await uploadRifaImage(file, activeOrg.id);
      handlePrizeChange(index, 'img', url);
      setOrgGallery(prev => [{ name, url, created_at: new Date().toISOString() }, ...prev]);
      showNotification(`¡Imagen del premio #${index + 1} subida a tu galería!`, 'success');
    } catch (err) {
      showNotification(err.message || 'Error al subir la imagen', 'error');
    } finally {
      setUploadingPrizeIndex(null);
      e.target.value = '';
    }
  };

  // Abrir galería para seleccionar imagen
  const openGalleryFor = (target) => {
    setGalleryTarget(target);
    setGalleryModalOpen(true);
    loadGallery();
  };

  // Aplicar imagen seleccionada de la galería
  const handleSelectFromGallery = (url) => {
    if (galleryTarget === 'main') {
      setMainImageUrl(url);
      showNotification('Imagen principal seleccionada desde la galería', 'info');
    } else if (typeof galleryTarget === 'number') {
      handlePrizeChange(galleryTarget, 'img', url);
      showNotification(`Imagen del premio #${galleryTarget + 1} actualizada`, 'info');
    }
    setGalleryModalOpen(false);
  };

  // Eliminar / Quitar la foto principal
  const handleRemoveMainImage = () => {
    setMainImageUrl('');
    showNotification('Foto principal removida (presiona Guardar para confirmar)', 'info');
  };

  // Mantener / Restaurar la foto principal al valor guardado en la base de datos
  const handleRestoreMainImage = () => {
    const parsed = parseImageConfig(selectedRifa?.imagen_url);
    setMainImageUrl(parsed.url);
    setMainImageFit(parsed.fit);
    setMainImagePos(parsed.pos);
    showNotification('Foto principal restaurada a su estado guardado', 'info');
  };

  // Eliminar imagen permanentemente de la galería de la organización
  const handleDeleteFromGallery = async (fileName) => {
    if (!activeOrg?.id || !fileName) return;
    if (!window.confirm('¿Deseas eliminar esta imagen de tu galería permanentemente?')) return;

    try {
      await deleteOrgImage(activeOrg.id, fileName);
      setOrgGallery(prev => prev.filter(img => img.name !== fileName));
      showNotification('Imagen eliminada de la galería', 'info');
    } catch (err) {
      showNotification(err.message || 'Error al eliminar imagen', 'error');
    }
  };

  // Manejo de la lista de premios
  const handlePrizeChange = (index, field, value) => {
    const updated = [...premios];
    updated[index] = { ...updated[index], [field]: value };
    setPremios(updated);
  };

  const handleAddPrize = () => {
    setPremios([
      ...premios,
      {
        title: `Premio #${premios.length + 1}`,
        desc: "Descripción del premio",
        img: `${process.env.PUBLIC_URL}/assets/regalo.png`
      }
    ]);
  };

  const handleRemovePrize = (index) => {
    if (premios.length <= 1) {
      showNotification('Debes mantener al menos un premio en la lista.', 'info');
      return;
    }
    const updated = premios.filter((_, idx) => idx !== index);
    setPremios(updated);
  };

  // Guardar cambios en la rifa
  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedRifa?.id) return;

    if (!titulo.trim()) {
      showNotification('El título de la rifa es obligatorio.', 'error');
      return;
    }

    const cleanSlug = formatSlug(slug);
    if (slugStatus.state === 'taken') {
      showNotification(`El alias o enlace "${cleanSlug}" ya está en uso por otra rifa. Elige otro diferente.`, 'error');
      return;
    }

    setSaving(true);
    try {
      const finalImageUrl = serializeImageConfig(mainImageUrl, mainImageFit, mainImagePos);

      const updates = {
        titulo: titulo.trim(),
        slug: cleanSlug || null,
        descripcion: descripcion.trim(),
        imagen_url: finalImageUrl,
        fecha_sorteo: fechaSorteo ? new Date(fechaSorteo).toISOString() : null,
        terminos: terminos.trim() || null,
        premios: premios
      };

      const updated = await updateRifa(selectedRifa.id, updates);
      if (onRifaUpdated) {
        onRifaUpdated(updated);
      }
      showNotification('¡Página pública actualizada con éxito!', 'success');
    } catch (err) {
      showNotification(err.message || 'Error al guardar los cambios', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedRifa) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700">
        <p className="text-gray-500">Selecciona o crea una rifa primero para personalizar su contenido.</p>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/#/rifa/${slug || selectedRifa.slug || selectedRifa.id}`;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Barra de cabecera con botón de vista en vivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Personalizar Página Pública</h2>
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold">
              {activeOrg?.nombre || 'Organización'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configura los textos, imágenes y condiciones que verán tus clientes. Todas las fotos quedan guardadas en la biblioteca de tu organización.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openGalleryFor('main')}
            className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs font-semibold transition flex items-center gap-1.5"
            title="Ver todas las fotos subidas por tu organización"
          >
            <span>🖼️ Biblioteca ({orgGallery.length})</span>
          </button>

          <button
            type="button"
            onClick={() => window.open(publicUrl, '_blank')}
            className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition flex items-center justify-center gap-2"
          >
            <span>👁️ Ver en Vivo</span>
            <span className="text-[10px] opacity-70">↗</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Formulario de edición */}
        <div className="lg:col-span-2 space-y-6">

          {/* Bloque 1: Textos Principales y Banner */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>📝</span> Textos Principales y Foto Destacada
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Título de la Rifa *
              </label>
              <input
                type="text"
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Gran Rifa Anual Bomberos Voluntarios"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Enlace Amigable (Slug / Alias corto)
                </label>
                {slugStatus.state === 'checking' && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <span className="animate-spin text-xs">⏳</span> Comprobando...
                  </span>
                )}
                {slugStatus.state === 'available' && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    ✓ Disponible
                  </span>
                )}
                {slugStatus.state === 'taken' && (
                  <span className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                    ✕ Ya en uso por otra rifa
                  </span>
                )}
              </div>
              <div className="flex items-center rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
                <span className="px-3 text-[11px] text-gray-400 font-mono select-none bg-gray-100/70 dark:bg-gray-800/60 border-r border-gray-200 dark:border-gray-600 py-2.5">
                  /#/rifa/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(formatSlug(e.target.value))}
                  placeholder="ej. pancho, gran-sorteo-2026"
                  className="w-full px-3 py-2.5 text-xs bg-transparent outline-none font-mono font-medium dark:text-white"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Enlace para tus compradores: <strong className="text-gray-600 dark:text-gray-300 font-mono">{window.location.origin}/#/rifa/{slug || selectedRifa.id}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Descripción / Motivo del Sorteo
              </label>
              <textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe el propósito del sorteo, la causa o los beneficios de participar..."
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Fecha del Sorteo (Opcional)
                </label>
                <input
                  type="date"
                  value={fechaSorteo}
                  onChange={(e) => setFechaSorteo(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              {/* FOTO PRINCIPAL / PREMIO CON OPCIONES DE ELIMINAR, MANTENER Y MOVER */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Foto Principal / Premio
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openGalleryFor('main')}
                      className="text-[11px] font-bold text-gray-500 hover:text-primary flex items-center gap-0.5"
                      title="Seleccionar de la biblioteca"
                    >
                      <span>🖼️ Elegir</span>
                    </button>
                    <label className="cursor-pointer text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
                      <span>{uploadingMain ? '⏳ Subiendo...' : '📁 Subir foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingMain}
                        onChange={handleUploadMainImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <input
                  type="url"
                  value={mainImageUrl}
                  onChange={(e) => setMainImageUrl(e.target.value)}
                  placeholder="https://... o presiona 'Subir foto' o 'Elegir'"
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                />

                {/* Controles interactivos cuando hay una foto seleccionada */}
                {mainImageUrl && (
                  <div className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-gray-700/40 border border-gray-200/80 dark:border-gray-600 space-y-3 animate-fadeIn">
                    {/* Botones de acción: Mantener original y Eliminar foto */}
                    <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-gray-600/60 pb-2">
                      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                        <span>⚙️</span> Opciones de la Imagen
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedRifa?.imagen_url && (
                          <button
                            type="button"
                            onClick={handleRestoreMainImage}
                            className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                            title="Deshacer cambios y volver a la foto guardada"
                          >
                            <span>↺ Mantener guardada</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRemoveMainImage}
                          className="text-[10px] font-semibold text-red-500 hover:underline flex items-center gap-0.5"
                          title="Eliminar esta foto del banner"
                        >
                          <span>✕ Eliminar foto</span>
                        </button>
                      </div>
                    </div>

                    {/* Mover y Ajustar visualización */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Modo de Ajuste */}
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                          Ajuste (Cómo se ve)
                        </span>
                        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 gap-1">
                          <button
                            type="button"
                            onClick={() => setMainImageFit('cover')}
                            className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition ${
                              mainImageFit === 'cover'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                            }`}
                            title="Llenar todo el marco"
                          >
                            🖼️ Llenar
                          </button>
                          <button
                            type="button"
                            onClick={() => setMainImageFit('contain')}
                            className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition ${
                              mainImageFit === 'contain'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                            }`}
                            title="Ver foto entera sin recortes"
                          >
                            🔍 Completa
                          </button>
                        </div>
                      </div>

                      {/* Mover Posición Vertical */}
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                          Mover Enfoque
                        </span>
                        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 gap-1">
                          <button
                            type="button"
                            onClick={() => setMainImagePos('top')}
                            className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition ${
                              mainImagePos === 'top'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                            }`}
                            title="Enfocar parte superior"
                          >
                            ⬆️ Arriba
                          </button>
                          <button
                            type="button"
                            onClick={() => setMainImagePos('center')}
                            className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition ${
                              mainImagePos === 'center'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                            }`}
                            title="Centrar"
                          >
                            ⏺️ Centro
                          </button>
                          <button
                            type="button"
                            onClick={() => setMainImagePos('bottom')}
                            className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition ${
                              mainImagePos === 'bottom'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                            }`}
                            title="Enfocar parte inferior"
                          >
                            ⬇️ Abajo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bloque 2: Lista de Premios */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>🎁</span> Premios a Sortear ({premios.length})
              </h3>
              <button
                type="button"
                onClick={handleAddPrize}
                className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition flex items-center gap-1"
              >
                <span>➕ Agregar Premio</span>
              </button>
            </div>

            <div className="space-y-4">
              {premios.map((prize, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">
                      Lugar / Categoría #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePrize(idx)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold p-1"
                      title="Eliminar este premio"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Nombre del Premio</label>
                      <input
                        type="text"
                        value={prize.title}
                        onChange={(e) => handlePrizeChange(idx, 'title', e.target.value)}
                        placeholder="Ej. Smart TV 55 Pulgadas"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-gray-500">Imagen del Premio</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openGalleryFor(idx)}
                            className="text-[10px] font-bold text-gray-500 hover:text-primary flex items-center gap-0.5"
                          >
                            <span>🖼️ Elegir</span>
                          </button>
                          <label className="cursor-pointer text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
                            <span>{uploadingPrizeIndex === idx ? '⏳...' : '📁 Subir foto'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingPrizeIndex === idx}
                              onChange={(e) => handleUploadPrizeImage(idx, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={prize.img}
                        onChange={(e) => handlePrizeChange(idx, 'img', e.target.value)}
                        placeholder="https://... o presiona 'Subir foto'"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Detalle o Marca</label>
                    <input
                      type="text"
                      value={prize.desc}
                      onChange={(e) => handlePrizeChange(idx, 'desc', e.target.value)}
                      placeholder="Ej. Modelo 4K UHD con garantía oficial"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bloque 3: Términos y Condiciones */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>📋</span> Términos, Entrega y Condiciones
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Información de contacto, retiro y condiciones del sorteo
              </label>
              <textarea
                rows={3}
                value={terminos}
                onChange={(e) => setTerminos(e.target.value)}
                placeholder="Ej. El sorteo se realizará en vivo por Instagram. Los ganadores tienen 15 días hábiles para retirar sus premios con su comprobante..."
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              />
            </div>
          </div>

          {/* Botón de Guardado Principal */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-2xl bg-primary text-white font-bold text-xs hover:opacity-90 transition shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
            >
              <span>{saving ? 'Guardando Cambios...' : '💾 Guardar y Publicar Cambios'}</span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Vista Previa en Tiempo Real */}
        <div className="space-y-6">
          <div className="sticky top-24 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                📱 Vista Previa Cliente
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                Online
              </span>
            </div>

            {/* Mockup de la cabecera */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900/50 p-4 space-y-4">
              {mainImageUrl && (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                  <img
                    src={mainImageUrl}
                    alt="Premio Principal"
                    style={{ objectFit: mainImageFit, objectPosition: mainImagePos }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                    className="w-full h-full transition-all duration-300"
                  />
                </div>
              )}

              <div>
                <h4 className="font-black text-sm uppercase leading-snug">
                  {titulo || 'Título de tu Rifa'}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {descripcion || 'Aquí se mostrará la descripción detallada de tu rifa para todos los compradores.'}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-primary">
                  ${parseFloat(selectedRifa.precio || 0).toLocaleString()} / boleto
                </span>
                <span className="text-gray-400">
                  {selectedRifa.total_boletos} números
                </span>
              </div>

              {fechaSorteo && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg text-center">
                  📅 Sorteo: {new Date(fechaSorteo).toLocaleDateString()}
                </div>
              )}

              {/* Muestra de premios */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Premios configurados:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {premios.slice(0, 3).map((p, i) => (
                    <div key={i} className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="w-8 h-8 mx-auto mb-1 flex items-center justify-center">
                        <img
                          src={p.img}
                          alt={p.title}
                          onError={(e) => { e.target.src = `${process.env.PUBLIC_URL}/assets/regalo.png`; }}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p className="text-[9px] font-bold truncate">{p.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.open(publicUrl, '_blank')}
              className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold transition text-center"
            >
              Abrir enlace público ↗
            </button>
          </div>
        </div>
      </form>

      {/* --- MODAL GALERÍA DE LA ORGANIZACIÓN --- */}
      {galleryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-2xl w-full p-6 border border-gray-100 dark:border-gray-700 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>🖼️</span> Galería de {activeOrg?.nombre || 'la Organización'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {galleryTarget === 'main'
                    ? 'Selecciona una imagen para la foto principal'
                    : `Selecciona una imagen para el Premio #${galleryTarget + 1}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Contenido de la Galería */}
            <div className="flex-1 overflow-y-auto pr-1">
              {loadingGallery ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  Cargando fotos de tu organización...
                </div>
              ) : orgGallery.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-3xl">📂</div>
                  <p className="text-xs font-bold text-gray-500">Aún no has subido fotos en esta organización.</p>
                  <p className="text-[11px] text-gray-400">Usa el botón "Subir foto" para agregar imágenes a tu biblioteca permanente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {orgGallery.map((imgItem) => (
                    <div
                      key={imgItem.name}
                      className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-black/5 flex items-center justify-center p-2">
                        <img
                          src={imgItem.url}
                          alt={imgItem.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div className="p-2 space-y-1.5 border-t border-gray-100 dark:border-gray-700 text-center">
                        <button
                          type="button"
                          onClick={() => handleSelectFromGallery(imgItem.url)}
                          className="w-full py-1.5 rounded-xl bg-primary text-white text-[11px] font-bold hover:opacity-90 transition shadow-sm"
                        >
                          Usar esta foto
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFromGallery(imgItem.name)}
                          className="text-[10px] text-red-500 hover:underline block mx-auto pt-0.5"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500">
              <span>{orgGallery.length} fotos guardadas en la biblioteca</span>
              <button
                type="button"
                onClick={() => setGalleryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomizePublicPage;
