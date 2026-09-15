-- ==============================================================================
-- MIGRACIÓN SUPABASE: ARQUITECTURA MULTI-TENANT CON RBAC (POSTGRESQL + RLS)
-- Archivo: supabase/migrations/20260911_multitenant_rbac.sql
-- ==============================================================================

-- 0. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ESTRUCTURA DE TABLAS (DDL)
-- ==============================================================================

-- 1.1. Tabla: organizaciones
CREATE TABLE IF NOT EXISTS public.organizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.2. Tabla: miembros_organizacion
CREATE TABLE IF NOT EXISTS public.miembros_organizacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'vendedor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_org_user UNIQUE (org_id, user_id)
);

-- 1.3. Tabla: invitaciones
CREATE TABLE IF NOT EXISTS public.invitaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'expirada', 'cancelada')),
    rol_asignado TEXT NOT NULL DEFAULT 'vendedor' CHECK (rol_asignado IN ('admin', 'vendedor')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.4. Tabla: rifas (Creación base o alteración para multi-tenancy)
CREATE TABLE IF NOT EXISTS public.rifas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    total_boletos INTEGER NOT NULL DEFAULT 100,
    precio NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fecha_sorteo TIMESTAMPTZ,
    estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pausada', 'finalizada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Si la tabla rifas ya existía previamente, asegurar la columna org_id y FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'rifas' 
          AND column_name = 'org_id'
    ) THEN
        ALTER TABLE public.rifas 
        ADD COLUMN org_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 1.5. Tabla: boletos (Creación base o alteración para vendedor_id)
CREATE TABLE IF NOT EXISTS public.boletos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rifa_id UUID NOT NULL REFERENCES public.rifas(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nombre_comprador TEXT,
    telefono_comprador TEXT,
    estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'reservado', 'pagado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_rifa_numero UNIQUE (rifa_id, numero)
);

-- Si la tabla boletos ya existía previamente, asegurar la columna vendedor_id y FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'boletos' 
          AND column_name = 'vendedor_id'
    ) THEN
        ALTER TABLE public.boletos 
        ADD COLUMN vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==============================================================================
-- 2. ÍNDICES DE RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_miembros_org_user ON public.miembros_organizacion(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_miembros_user_id ON public.miembros_organizacion(user_id);
CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON public.invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_invitaciones_org_id ON public.invitaciones(org_id);
CREATE INDEX IF NOT EXISTS idx_rifas_org_id ON public.rifas(org_id);
CREATE INDEX IF NOT EXISTS idx_boletos_rifa_id ON public.boletos(rifa_id);
CREATE INDEX IF NOT EXISTS idx_boletos_vendedor_id ON public.boletos(vendedor_id);

-- ==============================================================================
-- 3. FUNCIONES SECURITY DEFINER (PREVENCIÓN DE RECURSIÓN INFINITA EN RLS)
-- ==============================================================================

-- 3.1. Obtener todas las organizaciones a las que pertenece el usuario autenticado
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT org_id
    FROM public.miembros_organizacion
    WHERE user_id = auth.uid();
$$;

-- 3.2. Verificar si el usuario autenticado es administrador de una organización específica
CREATE OR REPLACE FUNCTION public.is_org_admin(org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.miembros_organizacion
        WHERE org_id = org_uuid
          AND user_id = auth.uid()
          AND rol = 'admin'
    );
$$;

-- Comentarios de documentación en funciones
COMMENT ON FUNCTION public.get_user_org_ids IS 'Retorna el conjunto de org_id asociadas al usuario actual sin disparar recursión en RLS.';
COMMENT ON FUNCTION public.is_org_admin IS 'Verifica si el usuario actual posee rol admin en la organización indicada con permisos SECURITY DEFINER.';

-- ==============================================================================
-- 4. PROCEDIMIENTO ALMACENADO / RPC: CANJE DE INVITACIONES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_invitacion RECORD;
    v_result JSONB;
BEGIN
    -- 1. Validar usuario autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado. Inicie sesión para aceptar la invitación.'
            USING ERRCODE = '28000';
    END IF;

    -- 2. Buscar invitación válida con bloqueo FOR UPDATE para evitar condiciones de carrera
    SELECT id, org_id, rol_asignado, estado, expires_at
    INTO v_invitacion
    FROM public.invitaciones
    WHERE token = invite_token
    FOR UPDATE;

    -- Validaciones de existencia y vigencia
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitación no encontrada con el token provisto.'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_invitacion.estado <> 'pendiente' THEN
        RAISE EXCEPTION 'La invitación no está disponible (Estado: %).', v_invitacion.estado
            USING ERRCODE = '22023';
    END IF;

    IF v_invitacion.expires_at < timezone('utc'::text, now()) THEN
        -- Marcar como expirada si superó la fecha
        UPDATE public.invitaciones 
        SET estado = 'expirada' 
        WHERE id = v_invitacion.id;
        
        RAISE EXCEPTION 'La invitación ha expirado.'
            USING ERRCODE = '22023';
    END IF;

    -- 3. Vincular al usuario en miembros_organizacion
    INSERT INTO public.miembros_organizacion (org_id, user_id, rol)
    VALUES (v_invitacion.org_id, v_user_id, v_invitacion.rol_asignado)
    ON CONFLICT (org_id, user_id) 
    DO UPDATE SET rol = EXCLUDED.rol;

    -- 4. Marcar invitación como aceptada
    UPDATE public.invitaciones
    SET estado = 'aceptada'
    WHERE id = v_invitacion.id;

    -- 5. Retornar payload de confirmación
    v_result := jsonb_build_object(
        'success', true,
        'org_id', v_invitacion.org_id,
        'rol', v_invitacion.rol_asignado,
        'user_id', v_user_id,
        'message', 'Invitación aceptada exitosamente.'
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.accept_invitation IS 'Valida un token de invitación y vincula de forma atómica al usuario actual a la organización.';

-- 4.2. Creación atómica de organización con asignación de rol admin al creador
CREATE OR REPLACE FUNCTION public.create_organization(org_nombre TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado. Inicie sesión para crear una organización.'
            USING ERRCODE = '28000';
    END IF;

    IF trim(org_nombre) = '' THEN
        RAISE EXCEPTION 'El nombre de la organización no puede estar vacío.'
            USING ERRCODE = '22023';
    END IF;

    -- 1. Crear organización
    INSERT INTO public.organizaciones (nombre)
    VALUES (trim(org_nombre))
    RETURNING id INTO v_org_id;

    -- 2. Asignar al creador como 'admin'
    INSERT INTO public.miembros_organizacion (org_id, user_id, rol)
    VALUES (v_org_id, v_user_id, 'admin');

    RETURN jsonb_build_object(
        'success', true,
        'org_id', v_org_id,
        'nombre', trim(org_nombre),
        'rol', 'admin',
        'message', 'Organización creada exitosamente.'
    );
END;
$$;

COMMENT ON FUNCTION public.create_organization IS 'Crea una organización y asigna automáticamente al usuario actual como admin de forma atómica.';

-- ==============================================================================
-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. POLÍTICAS ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Limpieza preventiva de políticas preexistentes
DROP POLICY IF EXISTS "Miembros pueden ver sus organizaciones" ON public.organizaciones;
DROP POLICY IF EXISTS "Admins pueden actualizar su organizacion" ON public.organizaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear organizaciones" ON public.organizaciones;

DROP POLICY IF EXISTS "Miembros pueden ver otros miembros de su organizacion" ON public.miembros_organizacion;
DROP POLICY IF EXISTS "Admins tienen control total de miembros" ON public.miembros_organizacion;

DROP POLICY IF EXISTS "Admins tienen control total de invitaciones" ON public.invitaciones;
DROP POLICY IF EXISTS "Publico puede consultar invitaciones vigentes" ON public.invitaciones;

DROP POLICY IF EXISTS "Miembros pueden consultar rifas de su organizacion" ON public.rifas;
DROP POLICY IF EXISTS "Admins tienen control total de rifas" ON public.rifas;

DROP POLICY IF EXISTS "Miembros pueden ver boletos de su organizacion" ON public.boletos;
DROP POLICY IF EXISTS "Admins pueden insertar boletos" ON public.boletos;
DROP POLICY IF EXISTS "Vendedores pueden registrar boletos a su nombre" ON public.boletos;
DROP POLICY IF EXISTS "Admins pueden actualizar cualquier boleto" ON public.boletos;
DROP POLICY IF EXISTS "Vendedores pueden actualizar sus boletos asignados" ON public.boletos;

--------------------------------------------------------------------------------
-- 6.1. Políticas: organizaciones
--------------------------------------------------------------------------------
-- SELECT: Solo miembros pueden ver las organizaciones a las que pertenecen
CREATE POLICY "Miembros pueden ver sus organizaciones"
    ON public.organizaciones
    FOR SELECT
    TO authenticated
    USING (id IN (SELECT public.get_user_org_ids()));

-- UPDATE: Solo administradores de la organización
CREATE POLICY "Admins pueden actualizar su organizacion"
    ON public.organizaciones
    FOR UPDATE
    TO authenticated
    USING (public.is_org_admin(id))
    WITH CHECK (public.is_org_admin(id));

-- INSERT: Usuarios autenticados pueden registrar una nueva organización
CREATE POLICY "Usuarios autenticados pueden crear organizaciones"
    ON public.organizaciones
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

--------------------------------------------------------------------------------
-- 6.2. Políticas: miembros_organizacion
--------------------------------------------------------------------------------
-- SELECT: Los miembros pueden ver a los otros miembros de su misma organización
CREATE POLICY "Miembros pueden ver otros miembros de su organizacion"
    ON public.miembros_organizacion
    FOR SELECT
    TO authenticated
    USING (org_id IN (SELECT public.get_user_org_ids()));

-- ALL: Los administradores tienen permisos completos (INSERT, UPDATE, DELETE) en su org
CREATE POLICY "Admins tienen control total de miembros"
    ON public.miembros_organizacion
    FOR ALL
    TO authenticated
    USING (public.is_org_admin(org_id))
    WITH CHECK (public.is_org_admin(org_id));

--------------------------------------------------------------------------------
-- 6.3. Políticas: invitaciones
--------------------------------------------------------------------------------
-- ALL: Los administradores pueden ver, crear, actualizar y cancelar invitaciones en su org
CREATE POLICY "Admins tienen control total de invitaciones"
    ON public.invitaciones
    FOR ALL
    TO authenticated
    USING (public.is_org_admin(org_id))
    WITH CHECK (public.is_org_admin(org_id));

-- SELECT: Acceso para cualquier usuario (anónimo o autenticado) que posea un token pendiente y vigente
CREATE POLICY "Publico puede consultar invitaciones vigentes"
    ON public.invitaciones
    FOR SELECT
    TO public
    USING (
        estado = 'pendiente' 
        AND expires_at > timezone('utc'::text, now())
    );

--------------------------------------------------------------------------------
-- 6.4. Políticas: rifas
--------------------------------------------------------------------------------
-- SELECT: Cualquier miembro de la organización puede ver sus rifas
CREATE POLICY "Miembros pueden consultar rifas de su organizacion"
    ON public.rifas
    FOR SELECT
    TO authenticated
    USING (org_id IN (SELECT public.get_user_org_ids()));

-- SELECT: Acceso público para ver rifas activas
CREATE POLICY "Publico puede ver rifas activas"
    ON public.rifas
    FOR SELECT
    TO public
    USING (estado = 'activa');

-- ALL: Solo los administradores pueden crear, modificar y eliminar rifas
CREATE POLICY "Admins tienen control total de rifas"
    ON public.rifas
    FOR ALL
    TO authenticated
    USING (public.is_org_admin(org_id))
    WITH CHECK (public.is_org_admin(org_id));

--------------------------------------------------------------------------------
-- 6.5. Políticas: boletos
--------------------------------------------------------------------------------
-- SELECT: Miembros de la organización de la rifa asociada pueden ver los boletos
CREATE POLICY "Miembros pueden ver boletos de su organizacion"
    ON public.boletos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND r.org_id IN (SELECT public.get_user_org_ids())
        )
    );

-- SELECT: Acceso público para ver los números de rifas activas
CREATE POLICY "Publico puede ver boletos de rifas activas"
    ON public.boletos
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND r.estado = 'activa'
        )
    );

-- INSERT: Admins pueden crear cualquier boleto en su organización
CREATE POLICY "Admins pueden insertar boletos"
    ON public.boletos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND public.is_org_admin(r.org_id)
        )
    );

-- INSERT: Vendedores pueden registrar boletos asignándolos estrictamente a su nombre (vendedor_id = auth.uid())
CREATE POLICY "Vendedores pueden registrar boletos a su nombre"
    ON public.boletos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        vendedor_id = auth.uid()
        AND EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND r.org_id IN (SELECT public.get_user_org_ids())
        )
    );

-- UPDATE: Admins pueden modificar cualquier boleto en su organización
CREATE POLICY "Admins pueden actualizar cualquier boleto"
    ON public.boletos
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND public.is_org_admin(r.org_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND public.is_org_admin(r.org_id)
        )
    );

-- UPDATE: Vendedores solo pueden modificar boletos donde ellos sean el vendedor asignado
CREATE POLICY "Vendedores pueden actualizar sus boletos asignados"
    ON public.boletos
    FOR UPDATE
    TO authenticated
    USING (
        vendedor_id = auth.uid()
        AND EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND r.org_id IN (SELECT public.get_user_org_ids())
        )
    )
    WITH CHECK (
        vendedor_id = auth.uid()
        AND EXISTS (
            SELECT 1 
            FROM public.rifas r
            WHERE r.id = boletos.rifa_id
              AND r.org_id IN (SELECT public.get_user_org_ids())
        )
    );
