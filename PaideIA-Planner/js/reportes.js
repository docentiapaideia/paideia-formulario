console.log("Reportes PaideIA Planner conectado a Supabase v2");

let tareasReporte = [];
let tareasReporteFiltradas = [];

document.addEventListener("DOMContentLoaded", iniciarReportes);

async function iniciarReportes() {
  configurarSemanaActual();
  await cargarDatosReporte();
}

function configurarSemanaActual() {
  const desde = document.getElementById("filtroDesde");
  const hasta = document.getElementById("filtroHasta");
  if (!desde || !hasta) return;

  const hoy = new Date();
  const dia = hoy.getDay() || 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - dia + 1);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  desde.value = fechaInput(lunes);
  hasta.value = fechaInput(domingo);
}

async function cargarDatosReporte() {
  const preview = document.getElementById("reportPreview");
  if (preview) preview.innerHTML = '<div class="report-empty">Cargando datos reales desde Supabase...</div>';

  if (!window.supabaseClient) {
    if (preview) preview.innerHTML = '<div class="report-empty">No se encontró supabaseClient. Revisá que js/supabase.js esté cargado antes de reportes.js.</div>';
    return;
  }

  let data = [];
  let error = null;

  const intentoKanban = await supabaseClient
    .from("planner_vista_kanban")
    .select("*");

  if (intentoKanban.error) {
    console.warn("No se pudo leer planner_vista_kanban. Intentando planner_vista_gantt:", intentoKanban.error.message);
    const intentoGantt = await supabaseClient
      .from("planner_vista_gantt")
      .select("*");
    data = intentoGantt.data || [];
    error = intentoGantt.error;
  } else {
    data = intentoKanban.data || [];
  }

  if (error) {
    console.error("Error al cargar reportes:", error);
    if (preview) preview.innerHTML = `<div class="report-empty">No se pudieron cargar los datos: ${escaparHTML(error.message)}</div>`;
    return;
  }

  tareasReporte = (data || []).map(normalizarTareaReporte);
  poblarFiltrosReporte(tareasReporte);
  generarReporte();
}

function normalizarTareaReporte(t) {
  const titulo = t.titulo || t.nombre || t.tarea || t.title || "Sin título";
  const responsables = t.responsables || t.responsable || t.miembros || t.asignados || "Sin responsable";
  const etiqueta = t.etiqueta || t.etiquetas || t.proyecto || t.nombre_etiqueta || t.tablero || t.categoria || "Sin proyecto";
  const prioridad = t.prioridad || t.nombre_prioridad || "Sin prioridad";
  const estado = t.estado_gantt || t.estado || t.progreso || t.columna || t.nombre_columna || "Sin estado";
  const fechaInicio = t.fecha_inicio || t.inicio || t.start_date || t.created_at || "";
  const fechaLimite = t.fecha_limite || t.fecha_fin || t.vencimiento || t.due_date || t.updated_at || "";
  const avance = Number(t.porcentaje_avance ?? t.avance ?? t.progress ?? 0) || 0;

  return {
    raw: t,
    titulo,
    responsables,
    etiqueta,
    prioridad,
    estado,
    fechaInicio,
    fechaLimite,
    avance,
    descripcion: t.descripcion || t.description || "",
    created_at: t.created_at || "",
    updated_at: t.updated_at || ""
  };
}

function poblarFiltrosReporte(tareas) {
  poblarSelect("filtroEtiqueta", obtenerUnicos(tareas.map(t => t.etiqueta)), "Todos");
  poblarSelect("filtroResponsable", obtenerResponsablesUnicos(tareas), "Todos");
}

function obtenerUnicos(items) {
  return [...new Set(items.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, "es"));
}

function obtenerResponsablesUnicos(tareas) {
  const set = new Set();
  tareas.forEach(t => separarValores(t.responsables).forEach(r => set.add(r)));
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

function poblarSelect(id, opciones, labelTodos) {
  const select = document.getElementById(id);
  if (!select) return;
  const valorActual = select.value;
  select.innerHTML = `<option value="">${labelTodos}</option>` + opciones.map(op => `<option value="${escaparAttr(op)}">${escaparHTML(op)}</option>`).join("");
  if ([...select.options].some(o => o.value === valorActual)) select.value = valorActual;
}

function generarReporte() {
  const tipo = document.getElementById("tipoInforme")?.value || "semanal_paideia";
  const tareas = filtrarTareasReporte();
  tareasReporteFiltradas = tareas;
  actualizarKpisReporte(tareas);

  const heroTitle = document.getElementById("reportHeroTitle");
  const heroText = document.getElementById("reportHeroText");

  if (tipo === "semanal_paideia") {
    if (heroTitle) heroTitle.textContent = "Informe semanal PAIDEIA";
    if (heroText) heroText.textContent = "Formato institucional con objetivo, objetivos específicos, metas, hitos y acciones realizadas.";
    renderInformeSemanalPaideia(tareas);
  } else {
    if (heroTitle) heroTitle.textContent = "Reporte general PAIDEIA";
    if (heroText) heroText.textContent = "Reporte operativo filtrado por etiqueta, responsable, estado y período.";
    renderReporteOperativo(tareas, tipo);
  }
}

function filtrarTareasReporte() {
  const desde = document.getElementById("filtroDesde")?.value || "";
  const hasta = document.getElementById("filtroHasta")?.value || "";
  const etiqueta = document.getElementById("filtroEtiqueta")?.value || "";
  const responsable = document.getElementById("filtroResponsable")?.value || "";
  const estado = normalizarTexto(document.getElementById("filtroEstado")?.value || "");
  const busqueda = normalizarTexto(document.getElementById("filtroBusqueda")?.value || "");

  return tareasReporte.filter(t => {
    const fechaBase = t.fechaLimite || t.fechaInicio || t.updated_at || t.created_at;
    const cumpleFecha = cumpleRango(fechaBase, desde, hasta);
    const cumpleEtiqueta = !etiqueta || t.etiqueta === etiqueta;
    const cumpleResponsable = !responsable || separarValores(t.responsables).includes(responsable);
    const estadoTexto = normalizarTexto(`${t.estado} ${t.avance >= 100 ? "finalizada" : ""}`);
    const cumpleEstado = !estado || estadoTexto.includes(estado) || (estado === "proceso" && (estadoTexto.includes("curso") || estadoTexto.includes("proceso")));
    const texto = normalizarTexto([t.titulo, t.responsables, t.etiqueta, t.prioridad, t.estado, t.descripcion].join(" "));
    const cumpleBusqueda = !busqueda || texto.includes(busqueda);
    return cumpleFecha && cumpleEtiqueta && cumpleResponsable && cumpleEstado && cumpleBusqueda;
  });
}

function actualizarKpisReporte(tareas) {
  const total = tareas.length;
  const finalizadas = tareas.filter(esFinalizada).length;
  const atrasadas = tareas.filter(esAtrasada).length;
  const enProceso = tareas.filter(t => !esFinalizada(t) && !esAtrasada(t)).length;
  setText("kpiTotal", total);
  setText("kpiFinalizadas", finalizadas);
  setText("kpiProceso", enProceso);
  setText("kpiAtrasadas", atrasadas);
}

function renderInformeSemanalPaideia(tareas) {
  const preview = document.getElementById("reportPreview");
  if (!preview) return;
  const desde = formatearFecha(document.getElementById("filtroDesde")?.value);
  const hasta = formatearFecha(document.getElementById("filtroHasta")?.value);

  preview.innerHTML = `
    ${membreteHTML()}
    <h3>7. PAIDEIA</h3>
    <p><strong>Período informado:</strong> ${escaparHTML(desde)} al ${escaparHTML(hasta)}</p>

    <h4>Objetivo</h4>
    <p>Promover la integración pedagógica y crítica de la inteligencia artificial (IA) en el sistema educativo nacional, fortaleciendo la formación docente, la alfabetización digital, y la producción de conocimientos que acompañen los procesos de enseñanza y aprendizaje con tecnologías emergentes. <em>(No cambia)</em></p>

    <h4>Objetivos específicos <em>(no cambia)</em></h4>
    <ul>
      <li><strong>Acompañar a estudiantes en el uso de las IA.</strong> Como eje transversal sobre los estudiantes, buscamos que el uso de las inteligencias artificiales por parte de estudiantes se integre de forma potenciadora de sus trayectorias educativas, promoviendo autonomía, comprensión tecnológica y pensamiento reflexivo.</li>
      <li><strong>Desarrollar competencias docentes para enseñar IA.</strong> Como eje transversal sobre la docencia, promovemos el desarrollo de competencias para enseñar y trabajar con inteligencias artificiales, integrándolas de manera pedagógica, innovadora y contextual en las prácticas de enseñanza.</li>
      <li><strong>Generar contenidos específicos de IA para las currículas.</strong> Como eje transversal vinculado con la inserción curricular impulsamos la creación de contenidos específicos sobre inteligencias artificiales para ser incorporados en los diseños curriculares, promoviendo enfoques actualizados, interdisciplinarios y adecuados a cada nivel educativo.</li>
      <li><strong>Integrar las IA en los sistemas de gestión.</strong> Como eje transversal en la gestión de datos educativos, promovemos la integración de las inteligencias artificiales en los sistemas, para optimizar procesos, mejorar el análisis de datos y fortalecer la toma de decisiones basada en información contextualizada.</li>
    </ul>

    <h4>Metas <em>(no cambia salvo algún avance específico)</em></h4>
    <ul>
      <li>Mesa Federal de Educación Técnico Profesional (ETP) armado de reunión Febrero. <strong>(en proceso)</strong></li>
      <li>Adhesión de las jurisdicciones al proyecto FLEP mediados de Enero. <strong>(en proceso)</strong></li>
      <li>Aprobación de la resolución de creación de FLEP <strong>(en proceso)</strong></li>
      <li>Firma de actas de las jurisdicciones durante enero <strong>(en proceso)</strong></li>
      <li>Armado de resolución de PAIDEIA <strong>(en proceso)</strong></li>
    </ul>

    <h4>Hitos <em>(colocar estado del hito también)</em></h4>
    <ul>
      <li>Evaluación de propuestas para la organización Congreso Internacional PaideIA. <strong>(en proceso)</strong></li>
      <li>Continuidad del ciclo de webinars de formación y actualización docente. <strong>(en proceso)</strong></li>
      <li>Realización de encuentros regionales de formación de referentes jurisdiccionales para escuelas pioneras. <strong>(en proceso)</strong></li>
      <li>Actualización del Repositorio Nacional de herramientas con IA y experiencias escolares. <strong>(en proceso)</strong></li>
    </ul>

    <h4>Acciones realizadas <em>(actividades concretas realizadas en la semana)</em></h4>
    ${accionesRealizadasHTML(tareas)}

    <div class="report-print-footer">Secretaría de Educación</div>
  `;
}

function renderReporteOperativo(tareas, tipo) {
  const preview = document.getElementById("reportPreview");
  if (!preview) return;
  const grupos = agruparTareas(tareas, tipo === "responsable" ? "responsables" : "etiqueta");
  const desde = formatearFecha(document.getElementById("filtroDesde")?.value);
  const hasta = formatearFecha(document.getElementById("filtroHasta")?.value);

  preview.innerHTML = `
    ${membreteHTML()}
    <h3>Reporte operativo PAIDEIA</h3>
    <p><strong>Período:</strong> ${escaparHTML(desde)} al ${escaparHTML(hasta)}</p>
    <h4>Resumen general</h4>
    <div class="report-kpis">
      <div><strong>${tareas.length}</strong><span>Total de tareas</span></div>
      <div><strong>${tareas.filter(esFinalizada).length}</strong><span>Finalizadas</span></div>
      <div><strong>${tareas.filter(esAtrasada).length}</strong><span>Atrasadas</span></div>
      <div><strong>${porcentaje(tareas.filter(esFinalizada).length, tareas.length)}%</strong><span>Completado</span></div>
    </div>
    <h4>Detalle por ${tipo === "responsable" ? "responsable" : "proyecto / etiqueta"}</h4>
    ${Object.keys(grupos).length ? Object.entries(grupos).map(([grupo, items]) => grupoHTML(grupo, items)).join("") : '<div class="report-empty">No hay tareas para los filtros seleccionados.</div>'}
    <div class="report-print-footer">Secretaría de Educación</div>
  `;
}

function accionesRealizadasHTML(tareas) {
  if (!tareas.length) return '<div class="report-empty">No hay acciones registradas para el período y filtros seleccionados.</div>';
  return `<ul>${tareas.map(t => `<li><strong>${escaparHTML(t.titulo)}</strong>${t.responsables ? ` — Responsables: ${escaparHTML(t.responsables)}` : ""}${t.estado ? ` — Estado: ${escaparHTML(t.estado)}` : ""}</li>`).join("")}</ul>`;
}

function grupoHTML(grupo, items) {
  const finalizadas = items.filter(esFinalizada).length;
  const pct = porcentaje(finalizadas, items.length);
  const pillClass = pct >= 100 ? "green" : pct > 0 ? "blue" : "orange";
  return `
    <div class="report-section-card">
      <div class="report-section-header">
        <div><h5>📁 ${escaparHTML(grupo)}</h5><p>Total: ${items.length} tarea${items.length === 1 ? "" : "s"} | Finalizadas: ${finalizadas} | En proceso: ${items.length - finalizadas}</p></div>
        <span class="status-pill ${pillClass}">${pct}%</span>
      </div>
      ${items.map(t => `
        <div class="report-task ${esFinalizada(t) ? "done" : "pending"}">
          <strong>${escaparHTML(t.titulo)}</strong>
          <p>Responsables: ${escaparHTML(t.responsables || "Sin responsable")}</p>
          <small>📅 ${escaparHTML(formatearFecha(t.fechaInicio) || "---")} → ${escaparHTML(formatearFecha(t.fechaLimite) || "---")} | Progreso: ${escaparHTML(t.estado)} | ${esAtrasada(t) ? "⚠️ Atrasada" : "En plazo"}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function agruparTareas(tareas, campo) {
  const grupos = {};
  tareas.forEach(t => {
    if (campo === "responsables") {
      separarValores(t.responsables).forEach(r => {
        if (!grupos[r]) grupos[r] = [];
        grupos[r].push(t);
      });
    } else {
      const key = t[campo] || "Sin proyecto";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(t);
    }
  });
  return grupos;
}

function membreteHTML() {
  return `
    <div class="report-membrete">
      <div class="m-left">“2026 - Año de la Grandeza Argentina”</div>
      <div class="m-right"><strong>Programa PAIDEIA</strong><br>Secretaría de Educación</div>
    </div>
  `;
}

function exportarReportePDF() {
  const element = document.getElementById("reportPreview");
  if (!element) return;
  const nombre = (document.getElementById("tipoInforme")?.value || "reporte") + "_paideia.pdf";

  if (window.html2pdf) {
    html2pdf().set({
      margin: 10,
      filename: nombre,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(element).save();
  } else {
    window.print();
  }
}

function resetearFiltrosReporte() {
  document.getElementById("filtroEtiqueta").value = "";
  document.getElementById("filtroResponsable").value = "";
  document.getElementById("filtroEstado").value = "";
  document.getElementById("filtroBusqueda").value = "";
  configurarSemanaActual();
  generarReporte();
}

function esFinalizada(t) {
  const estado = normalizarTexto(t.estado);
  return estado.includes("finalizada") || estado.includes("completada") || Number(t.avance) >= 100;
}

function esAtrasada(t) {
  const estado = normalizarTexto(t.estado);
  if (estado.includes("atrasada") || estado.includes("vencida")) return true;
  if (esFinalizada(t) || !t.fechaLimite) return false;
  const limite = new Date(String(t.fechaLimite).slice(0, 10) + "T23:59:59");
  return !isNaN(limite.getTime()) && limite < new Date();
}

function cumpleRango(fechaTexto, desde, hasta) {
  if (!desde && !hasta) return true;
  if (!fechaTexto) return true;
  const f = new Date(String(fechaTexto).slice(0, 10) + "T00:00:00");
  if (isNaN(f.getTime())) return true;
  if (desde && f < new Date(desde + "T00:00:00")) return false;
  if (hasta && f > new Date(hasta + "T23:59:59")) return false;
  return true;
}

function separarValores(texto) {
  return String(texto || "")
    .split(/;|,|·|\n/)
    .map(x => x.trim())
    .filter(Boolean);
}

function fechaInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatearFecha(value) {
  if (!value) return "";
  const f = new Date(String(value).slice(0, 10) + "T00:00:00");
  if (isNaN(f.getTime())) return value;
  return f.toLocaleDateString("es-AR");
}

function porcentaje(parte, total) {
  return total ? Math.round((parte / total) * 100) : 0;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function normalizarTexto(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparAttr(texto) {
  return escaparHTML(texto).replaceAll("`", "&#096;");
}
