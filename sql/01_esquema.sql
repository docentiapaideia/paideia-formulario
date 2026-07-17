-- PAIDEIA · Buenas Prácticas
-- Ejecutar en Supabase > SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.bp_importaciones (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  hash_archivo text,
  fecha_importacion timestamptz not null default now(),
  total_registros integer not null default 0,
  nuevos integer not null default 0,
  actualizados integer not null default 0,
  sin_cambios integer not null default 0,
  errores integer not null default 0,
  usuario_id uuid references auth.users(id),
  resumen jsonb not null default '{}'::jsonb
);

create table if not exists public.bp_registros (
  id uuid primary key default gen_random_uuid(),
  clave_registro text not null unique,
  fila_origen integer,
  timestamp_origen text,
  nombre text,
  email text,
  institucion text,
  jurisdiccion text,
  nivel text,
  area text,
  equipo text,
  nombres_equipo text,
  titulo text,
  anio text,
  herramientas text,
  ejes text,
  descripcion text,
  rol_ia text,
  enlace text,
  p1_proposito text,
  p2_por_que_ia text,
  p3_mirada_critica text,
  p4_oportunidades text,
  p5_innovacion text,
  p6_ajustes text,
  p7_transferencia text,
  estado_origen text,
  estado_curaduria text not null default 'PENDIENTE',
  observaciones text[] not null default '{}',
  requiere_revision_manual boolean not null default false,
  hash_contenido text not null,
  primera_importacion_id uuid references public.bp_importaciones(id),
  ultima_importacion_id uuid references public.bp_importaciones(id),
  fecha_primera_revision timestamptz,
  fecha_ultima_revision timestamptz,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  activo boolean not null default true
);

create index if not exists bp_registros_estado_idx on public.bp_registros(estado_curaduria);
create index if not exists bp_registros_email_idx on public.bp_registros(lower(email));
create index if not exists bp_registros_importacion_idx on public.bp_registros(ultima_importacion_id);

create table if not exists public.bp_historial (
  id bigint generated always as identity primary key,
  registro_id uuid references public.bp_registros(id) on delete cascade,
  importacion_id uuid references public.bp_importaciones(id) on delete set null,
  fecha timestamptz not null default now(),
  usuario_id uuid references auth.users(id),
  accion text not null,
  estado_anterior text,
  estado_nuevo text,
  detalle jsonb not null default '{}'::jsonb
);

create table if not exists public.bp_correos (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.bp_registros(id) on delete cascade,
  destinatario text not null,
  asunto text not null,
  cuerpo text not null,
  tipo text not null default 'OBSERVACION',
  estado text not null default 'PENDIENTE',
  proveedor text default 'GMAIL_API',
  proveedor_id text,
  fecha_creacion timestamptz not null default now(),
  fecha_envio timestamptz,
  usuario_id uuid references auth.users(id),
  error text
);

create table if not exists public.bp_configuracion (
  clave text primary key,
  valor jsonb not null,
  fecha_actualizacion timestamptz not null default now(),
  usuario_id uuid references auth.users(id)
);

create or replace function public.bp_actualizar_fecha()
returns trigger language plpgsql as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists bp_registros_actualizar_fecha on public.bp_registros;
create trigger bp_registros_actualizar_fecha
before update on public.bp_registros
for each row execute function public.bp_actualizar_fecha();

alter table public.bp_importaciones enable row level security;
alter table public.bp_registros enable row level security;
alter table public.bp_historial enable row level security;
alter table public.bp_correos enable row level security;
alter table public.bp_configuracion enable row level security;

-- Primera versión: cualquier usuario autenticado puede operar.
-- Después podemos restringir por perfil administrador/revisor.
create policy "bp_importaciones_auth" on public.bp_importaciones for all to authenticated using (true) with check (true);
create policy "bp_registros_auth" on public.bp_registros for all to authenticated using (true) with check (true);
create policy "bp_historial_auth" on public.bp_historial for all to authenticated using (true) with check (true);
create policy "bp_correos_auth" on public.bp_correos for all to authenticated using (true) with check (true);
create policy "bp_configuracion_auth" on public.bp_configuracion for all to authenticated using (true) with check (true);
