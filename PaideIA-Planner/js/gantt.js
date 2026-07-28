console.log("Gantt PaideIA Planner conectado a Supabase v16");

let tareasGantt = [];
let tareasGanttFiltradas = [];
let escalaGantt = null;

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
      .select("id, tarea_madre_id, eliminada, descripcion")
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
  const tareasBasePorId = new Map(
    (tareasBase || []).map(tarea => [String(tarea.id), tarea])
  );

  tareasGantt = (data || [])
    .filter(tarea => idsTareasVisibles.has(String(tarea.id)))
    .map(tarea => ({
      ...tarea,
      descripcion: tarea.descripcion || tareasBasePorId.get(String(tarea.id))?.descripcion || ""
    }))
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
    descripcion: t.descripcion || "",
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

  escalaGantt = calcularEscalaGantt(tareas);
  actualizarPeriodoGantt(escalaGantt);
  wrapper.innerHTML = crearCabeceraGantt();
  renderizarTablaDetalleGantt(tareas);

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

function renderizarTablaDetalleGantt(tareas) {
  const cuerpo = document.getElementById("ganttDetalleBody");
  if (!cuerpo) return;

  if (!tareas || tareas.length === 0) {
    cuerpo.innerHTML = `
      <tr>
        <td colspan="4" class="gantt-detail-empty">No hay tareas para mostrar.</td>
      </tr>
    `;
    return;
  }

  cuerpo.innerHTML = tareas.map(tarea => `
    <tr>
      <td><strong>${escaparHTML(tarea.titulo || "Sin título")}</strong></td>
      <td>${escaparHTML(tarea.descripcion || "Sin descripción cargada")}</td>
      <td>${escaparHTML(formatearFechaTablaGantt(tarea.fecha_inicio))}</td>
      <td>${escaparHTML(formatearFechaTablaGantt(tarea.fecha_limite))}</td>
    </tr>
  `).join("");
}

function formatearFechaTablaGantt(valor) {
  const fecha = parsearFechaGantt(valor);
  return fecha ? fecha.toLocaleDateString("es-AR") : "Sin fecha";
}

function crearCabeceraGantt() {
  const etiquetas = escalaGantt?.etiquetas || ["01", "04", "07", "10", "13", "16", "19", "22", "25", "28"];

  return `
    <div class="gantt-grid gantt-head">
      <div class="gantt-task-head">Tarea</div>
      ${etiquetas.map(etiqueta => `<div class="gantt-date">${escaparHTML(etiqueta)}</div>`).join("")}
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
  const izquierda = 300 + ((posicion.inicio - 2) * 90) + 8;
  const ancho = Math.max(50, ((posicion.fin - posicion.inicio) * 90) - 16);

  return `
    <div class="gantt-grid gantt-row">
      <div class="gantt-task-info">
        <strong>${titulo}</strong>
        <span>${responsables}${escaparHTML(etiqueta)}</span>
      </div>

      ${crearCeldasVacias()}

      <div class="gantt-bar ${claseBarra}" style="left:${izquierda}px; width:${ancho}px;">
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

  const inicio = convertirFechaASlot(fechaInicio, escalaGantt);
  const fin = convertirFechaASlot(fechaFin, escalaGantt);

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

function convertirFechaASlot(fechaTexto, escala) {
  const fecha = parsearFechaGantt(fechaTexto);
  if (!fecha || !escala) return 1;

  const proporcion = (fecha.getTime() - escala.inicio.getTime()) / escala.duracion;
  return Math.max(1, Math.min(10, Math.floor(proporcion * 10) + 1));
}

function calcularEscalaGantt(tareas) {
  const fechas = tareas
    .flatMap(tarea => [parsearFechaGantt(tarea.fecha_inicio), parsearFechaGantt(tarea.fecha_limite)])
    .filter(Boolean)
    .sort((a, b) => a - b);

  let inicio;
  let fin;

  if (fechas.length === 0) {
    inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    fin = new Date(inicio);
    fin.setDate(fin.getDate() + 30);
  } else {
    inicio = new Date(fechas[0]);
    fin = new Date(fechas[fechas.length - 1]);
    if (fin.getTime() === inicio.getTime()) {
      fin.setDate(fin.getDate() + 1);
    }
  }

  const duracion = Math.max(86400000, fin.getTime() - inicio.getTime());
  const etiquetas = Array.from({ length: 10 }, (_, indice) => {
    const fecha = new Date(inicio.getTime() + (duracion * indice / 9));
    return formatearFechaCortaGantt(fecha);
  });

  return { inicio, fin, duracion, etiquetas };
}

function parsearFechaGantt(valor) {
  if (!valor) return null;
  const fecha = new Date(String(valor).slice(0, 10) + "T00:00:00");
  return isNaN(fecha.getTime()) ? null : fecha;
}

function formatearFechaCortaGantt(fecha) {
  return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function actualizarPeriodoGantt(escala) {
  const badge = document.getElementById("ganttPeriodo");
  if (!badge || !escala) return;

  const formato = { month: "long", year: "numeric" };
  const desde = escala.inicio.toLocaleDateString("es-AR", formato);
  const hasta = escala.fin.toLocaleDateString("es-AR", formato);
  badge.textContent = `${desde} – ${hasta}`;
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

async function descargarGanttPDF() {
  const element = document.querySelector(".gantt-panel");
  if (!element) return;

  if (window.html2pdf) {
    const escenarioPDF = document.createElement("div");
    const copiaPDF = element.cloneNode(true);

    escenarioPDF.style.position = "fixed";
    escenarioPDF.style.left = "0";
    escenarioPDF.style.top = "0";
    escenarioPDF.style.width = "1280px";
    escenarioPDF.style.margin = "0";
    escenarioPDF.style.padding = "0";
    escenarioPDF.style.overflow = "visible";
    escenarioPDF.style.background = "#ffffff";
    escenarioPDF.style.zIndex = "-10000";
    escenarioPDF.style.pointerEvents = "none";

    copiaPDF.classList.add("gantt-pdf-export");
    copiaPDF.style.position = "relative";
    copiaPDF.style.left = "0";
    copiaPDF.style.margin = "0";
    copiaPDF.style.width = "1280px";
    copiaPDF.style.transform = "none";
    escenarioPDF.appendChild(copiaPDF);
    document.body.appendChild(escenarioPDF);

    try {
      await html2pdf().set({
        margin: [8, 8, 10, 8],
        filename: "gantt_paideia.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          width: 1280,
          windowWidth: 1280
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".gantt-row"] }
      }).from(copiaPDF).save();
    } finally {
      escenarioPDF.remove();
    }
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
        <span>No fue posible cargar la información del cronograma.</span>
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
