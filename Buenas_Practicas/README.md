# PAIDEIA · Curaduría de Buenas Prácticas

Repositorio previsto: `https://github.com/docentiapaideia/paideia-formulario`

## Primera puesta en marcha

1. Abrir Supabase > **SQL Editor**.
2. Crear una consulta nueva.
3. Copiar y ejecutar todo el contenido de `sql/01_esquema.sql`.
4. En el repositorio, crear una carpeta `buenas-practicas`.
5. Subir dentro de esa carpeta el contenido de este proyecto.
6. Publicar GitHub Pages desde la rama y carpeta que ya utiliza el sitio.
7. Abrir la URL pública y probar con `Buenas_Practicas.xlsx`.

## Configuración ya incorporada

- Proyecto Supabase: `mhwcnlkrwylloyxpmmqu`.
- URL base configurada en `js/config.js`.
- Clave pública anon configurada en `js/config.js`.

La clave anon es pública y puede utilizarse en el navegador. No debe agregarse nunca la clave `service_role` al repositorio.

## Estado actual

- Carga local de Excel.
- Normalización básica de encabezados.
- Validación de campos obligatorios.
- Validación de correo y URL.
- Detección inicial de duplicados.
- Clasificación APTO / OBSERVADO / DUPLICADO.
- Exportación del resultado.
- Esquema SQL preparado para registros, importaciones, historial y correos.

## Próxima etapa

Después de ejecutar el SQL:

- agregar acceso de administrador;
- guardar cada importación en Supabase;
- comparar registros nuevos, modificados y sin cambios;
- reproducir exactamente la curaduría de referencia;
- preparar selección y envío directo de correos mediante Gmail API.
