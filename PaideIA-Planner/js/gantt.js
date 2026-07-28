console.log("Gantt PaideIA Planner conectado a Supabase v13");

let tareasGantt = [];
let tareasGanttFiltradas = [];

document.addEventListener("DOMContentLoaded", cargarGantt);

async function cargarGantt() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    console.error("No se encontró supabaseClient. Revisá que js/supabase.js esté cargado antes de gantt.js.");
    mostrarErrorGantt();
    return;
  }

  const [
    { data, error },
    { data: tareasBase, error: errorTareasBase }
  ] = await Promise.all([
    supabaseClient
      .from("planner_vista_gantt")
      .select("*")
      .order("fecha_inicio", { ascending: true, nullsFirst: false })
      .order("fecha_limite", { ascending: true, nullsFirst: false }),
    supabaseClient
      .from("planner_tareas")
      .select("id, tarea_madre_id, eliminada")
  ]);

  if (error) {
    console.error("Error al cargar Gantt:", error);
    mostrarErrorGantt();
    return;
  }

  if (errorTareasBase) {
    console.error("No se pudo verificar el borrado lógico de las tareas:", errorTareasBase);
    mostrarErrorGantt();
    return;
  }

  const idsTareasVisibles = obtenerIdsTareasVisibles(tareasBase || []);

  tareasGantt = (data || [])
    .filter(tarea => idsTareasVisibles.has(String(tarea.id)))
    .map(normalizarTareaGantt);
  console.log("Tareas Gantt reales:", tareasGantt);

  poblarFiltrosGantt(tareasGantt);
  aplicarFiltrosGantt();
}

function obtenerIdsTareasVisibles(tareas) {
  const tareasPorId = new Map(
    tareas.map(tarea => [String(tarea.id), tarea])
  );

  return new Set(
    tareas
      .filter(tarea => {
        if (tarea.eliminada === true) return false;
        if (!tarea.tarea_madre_id) return true;

        const tareaMadre = tareasPorId.get(String(tarea.tarea_madre_id));
        return !tareaMadre || tareaMadre.eliminada !== true;
      })
      .map(tarea => String(tarea.id))
  );
}

function normalizarTareaGantt(t) {
  return {
    ...t,
    titulo: t.titulo || t.nombre || t.tarea || "Sin título",
    responsables: t.responsables || t.responsable || t.asignados || "Sin responsable",
    prioridad: t.prioridad || t.nombre_prioridad || "Sin prioridad",
    etiqueta: t.etiqueta || t.etiquetas || t.proyecto || t.nombre_etiqueta || t.tablero || "Sin etiqueta",
    estado_gantt: t.estado_gantt || t.estado || t.progreso || t.columna || "Sin fecha",
    fecha_inicio: t.fecha_inicio || t.inicio || t.start_date || "",
    fecha_limite: t.fecha_limite || t.fecha_fin || t.vencimiento || t.due_date || "",
    porcentaje_avance: Number(t.porcentaje_avance ?? t.avance ?? t.progress ?? 0) || 0
  };
}

function poblarFiltrosGantt(tareas) {
  poblarSelectGantt("ganttFiltroResponsable", obtenerResponsablesGantt(tareas), "Todos");
  poblarSelectGantt("ganttFiltroPrioridad", obtenerUnicosGantt(tareas.map(t => t.prioridad)), "Todas");
  poblarSelectGantt("ganttFiltroEtiqueta", obtenerUnicosGantt(tareas.map(t => t.etiqueta)), "Todas");
}

function poblarSelectGantt(id, opciones, label) {
  const select = document.getElementById(id);
  if (!select) return;
  const valor = select.value;
  select.innerHTML = `<option value="">${label}</option>` + opciones.map(op => `<option value="${escaparHTML(op)}">${escaparHTML(op)}</option>`).join("");
  if ([...select.options].some(o => o.value === valor)) select.value = valor;
}

function obtenerUnicosGantt(items) {
  return [...new Set(items.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, "es"));
}

function obtenerResponsablesGantt(tareas) {
  const set = new Set();
  tareas.forEach(t => separarValoresGantt(t.responsables).forEach(r => set.add(r)));
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

function aplicarFiltrosGantt() {
  const responsable = document.getElementById("ganttFiltroResponsable")?.value || "";
  const prioridad = document.getElementById("ganttFiltroPrioridad")?.value || "";
  const etiqueta = document.getElementById("ganttFiltroEtiqueta")?.value || "";
  const estado = normalizarTextoGantt(document.getElementById("ganttFiltroEstado")?.value || "");
  const busqueda = normalizarTextoGantt(document.getElementById("ganttFiltroBusqueda")?.value || "");

  tareasGanttFiltradas = tareasGantt.filter(t => {
    const cumpleResponsable = !responsable || separarValoresGantt(t.responsables).includes(responsable);
    const cumplePrioridad = !prioridad || t.prioridad === prioridad;
    const cumpleEtiqueta = !etiqueta || t.etiqueta === etiqueta;
    const estadoTexto = normalizarTextoGantt(`${t.estado_gantt} ${t.porcentaje_avance >= 100 ? "finalizada" : ""}`);
    const cumpleEstado = !estado || estadoTexto.includes(estado) || (estado === "curso" && estadoTexto.includes("proceso"));
    const texto = normalizarTextoGantt([t.titulo, t.responsables, t.prioridad, t.etiqueta, t.estado_gantt].join(" "));
    const cumpleBusqueda = !busqueda || texto.includes(busqueda);
    return cumpleResponsable && cumplePrioridad && cumpleEtiqueta && cumpleEstado && cumpleBusqueda;
  });

  actualizarResumenGantt(tareasGanttFiltradas);
  renderizarGantt(tareasGanttFiltradas);
}

function resetearFiltrosGantt() {
  ["ganttFiltroResponsable", "ganttFiltroPrioridad", "ganttFiltroEtiqueta", "ganttFiltroEstado", "ganttFiltroBusqueda"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  aplicarFiltrosGantt();
}

function actualizarResumenGantt(tareas) {
  const total = tareas.length;

  const enCurso = tareas.filter(t => {
    const estado = (t.estado_gantt || "").toLowerCase();
    return estado.includes("plazo") || estado.includes("curso") || estado.includes("proceso");
  }).length;

  const atrasadas = tareas.filter(t => {
    const estado = (t.estado_gantt || "").toLowerCase();
    return estado.includes("atrasada") || estado.includes("vencida");
  }).length;

  const finalizadas = tareas.filter(t => {
    const estado = (t.estado_gantt || "").toLowerCase();
    return estado.includes("finalizada") || estado.includes("completada") || Number(t.porcentaje_avance) >= 100;
  }).length;

  const cards = document.querySelectorAll(".gantt-summary .stat-card h3");

  if (cards[0]) cards[0].textContent = total;
  if (cards[1]) cards[1].textContent = enCurso;
  if (cards[2]) cards[2].textContent = atrasadas;
  if (cards[3]) cards[3].textContent = finalizadas;
}

function renderizarGantt(tareas) {
  const wrapper = document.querySelector(".gantt-wrapper");

  if (!wrapper) {
    console.error("No se encontró .gantt-wrapper");
    return;
  }

  wrapper.innerHTML = crearCabeceraGantt();

  if (!tareas || tareas.length === 0) {
    wrapper.innerHTML += `
      <div class="gantt-grid gantt-row">
        <div class="gantt-task-info">
          <strong>No hay tareas planificadas</strong>
          <span>No hay resultados para los filtros seleccionados.</span>
        </div>

        ${crearCeldasVacias()}
      </div>
    `;
    return;
  }

  tareas.forEach(tarea => {
    wrapper.innerHTML += crearFilaGantt(tarea);
  });
}

function crearCabeceraGantt() {
  return `
    <div class="gantt-grid gantt-head">
      <div class="gantt-task-head">Tarea</div>
      <div class="gantt-date">01</div>
      <div class="gantt-date">04</div>
      <div class="gantt-date">07</div>
      <div class="gantt-date">10</div>
      <div class="gantt-date">13</div>
      <div class="gantt-date">16</div>
      <div class="gantt-date">19</div>
      <div class="gantt-date">22</div>
      <div class="gantt-date">25</div>
      <div class="gantt-date">28</div>
    </div>
  `;
}

function crearFilaGantt(tarea) {
  const titulo = escaparHTML(tarea.titulo || "Sin título");
  const responsables = escaparHTML(tarea.responsables || "Sin responsable");
  const avance = Number(tarea.porcentaje_avance) || 0;
  const estado = tarea.estado_gantt || "Sin fecha";
  const etiqueta = tarea.etiqueta && tarea.etiqueta !== "Sin etiqueta" ? ` · ${tarea.etiqueta}` : "";

  const claseBarra = obtenerClaseBarra(tarea);
  const posicion = calcularPosicionBarra(tarea);

  return `
    <div class="gantt-grid gantt-row">
      <div class="gantt-task-info">
        <strong>${titulo}</strong>
        <span>${responsables}${escaparHTML(etiqueta)}</span>
      </div>

      ${crearCeldasVacias()}

      <div class="gantt-bar ${claseBarra}" style="grid-column: ${posicion.inicio} / ${posicion.fin};">
        <span>${escaparHTML(estado)} · ${avance}%</span>
      </div>
    </div>
  `;
}

function crearCeldasVacias() {
  let html = "";

  for (let i = 0; i < 10; i++) {
    html += `<div class="gantt-cell"></div>`;
  }

  return html;
}

function calcularPosicionBarra(tarea) {
  const fechaInicio = tarea.fecha_inicio || tarea.fecha_limite;
  const fechaFin = tarea.fecha_limite || tarea.fecha_inicio;

  if (!fechaInicio && !fechaFin) {
    return {
      inicio: 2,
      fin: 4
    };
  }

  const inicio = convertirFechaASlot(fechaInicio);
  const fin = convertirFechaASlot(fechaFin);

  let columnaInicio = inicio + 1;
  let columnaFin = fin + 2;

  if (columnaFin <= columnaInicio) {
    columnaFin = columnaInicio + 1;
  }

  if (columnaInicio < 2) columnaInicio = 2;
  if (columnaInicio > 11) columnaInicio = 11;

  if (columnaFin < 3) columnaFin = 3;
  if (columnaFin > 12) columnaFin = 12;

  return {
    inicio: columnaInicio,
    fin: columnaFin
  };
}

function convertirFechaASlot(fechaTexto) {
  if (!fechaTexto) {
    return 1;
  }

  const fecha = new Date(String(fechaTexto).slice(0, 10) + "T00:00:00");

  if (isNaN(fecha.getTime())) {
    return 1;
  }

  const dia = fecha.getDate();

  if (dia <= 3) return 1;
  if (dia <= 6) return 2;
  if (dia <= 9) return 3;
  if (dia <= 12) return 4;
  if (dia <= 15) return 5;
  if (dia <= 18) return 6;
  if (dia <= 21) return 7;
  if (dia <= 24) return 8;
  if (dia <= 27) return 9;

  return 10;
}

function obtenerClaseBarra(tarea) {
  const estado = (tarea.estado_gantt || "").toLowerCase();
  const avance = Number(tarea.porcentaje_avance) || 0;

  if (estado.includes("finalizada") || estado.includes("completada") || avance >= 100) {
    return "gantt-green";
  }

  if (estado.includes("atrasada") || estado.includes("vencida")) {
    return "gantt-red";
  }

  if (estado.includes("curso") || estado.includes("proceso") || avance > 0) {
    return "gantt-orange";
  }

  return "gantt-blue";
}

function descargarGanttPDF() {
  const element = document.querySelector(".gantt-panel");
  if (!element) return;
  if (window.html2pdf) {
    html2pdf().set({
      margin: 8,
      filename: "gantt_paideia.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
    }).from(element).save();
  } else {
    window.print();
  }
}

function mostrarErrorGantt() {
  const wrapper = document.querySelector(".gantt-wrapper");

  if (!wrapper) {
    return;
  }

  wrapper.innerHTML = `
    <div class="gantt-grid gantt-head">
      <div class="gantt-task-head">Tarea</div>
      <div class="gantt-date">Error</div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
      <div class="gantt-date"></div>
    </div>

    <div class="gantt-grid gantt-row">
      <div class="gantt-task-info">
        <strong>Error al cargar datos</strong>
        <span>Revisar consola y confirmar que existe planner_vista_gantt.</span>
      </div>

      ${crearCeldasVacias()}
    </div>
  `;
}

function separarValoresGantt(texto) {
  return String(texto || "")
    .split(/;|,|·|\n/)
    .map(x => x.trim())
    .filter(Boolean);
}

function normalizarTextoGantt(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escaparHTML(texto) {
  if (!texto) return "";

  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
