console.log("Gantt PaideIA Planner conectado a Supabase v23");

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
  if (!tareasGanttFiltradas.length) {
    alert("No hay tareas para exportar con los filtros seleccionados.");
    return;
  }

  if (window.html2canvas && window.jspdf?.jsPDF) {
    const escenarioPDF = document.createElement("div");
    const mascaraPDF = crearMascaraGenerandoPDF();
    const documentoPDF = document.createElement("div");
    documentoPDF.className = "gantt-pdf-document";

    escenarioPDF.style.position = "absolute";
    escenarioPDF.style.left = "0";
    escenarioPDF.style.top = "0";
    escenarioPDF.style.width = "1248px";
    escenarioPDF.style.margin = "0";
    escenarioPDF.style.padding = "0";
    escenarioPDF.style.overflow = "visible";
    escenarioPDF.style.background = "#ffffff";
    escenarioPDF.style.zIndex = "1";
    escenarioPDF.style.pointerEvents = "none";

    escenarioPDF.appendChild(documentoPDF);
    document.body.appendChild(escenarioPDF);
    document.body.appendChild(mascaraPDF);
    construirDocumentoPDFGantt(documentoPDF, tareasGanttFiltradas);

    try {
      await generarPDFPorPaginas(documentoPDF);
    } catch (error) {
      console.error("No se pudo generar el PDF del Gantt:", error);
      alert("No se pudo generar el PDF. Revisá la consola para ver el detalle.");
    } finally {
      escenarioPDF.remove();
      mascaraPDF.remove();
    }
  } else {
    window.print();
  }
}

function crearMascaraGenerandoPDF() {
  const mascara = document.createElement("div");
  mascara.style.position = "fixed";
  mascara.style.inset = "0";
  mascara.style.zIndex = "999999";
  mascara.style.display = "flex";
  mascara.style.alignItems = "center";
  mascara.style.justifyContent = "center";
  mascara.style.background = "rgba(244, 248, 251, 0.98)";
  mascara.style.color = "#0b2545";
  mascara.style.fontFamily = '"Segoe UI", Arial, sans-serif';
  mascara.innerHTML = `
    <div style="background:#fff;border:1px solid #dce6ef;border-radius:20px;padding:24px 32px;box-shadow:0 18px 45px rgba(11,37,69,.12);text-align:center;">
      <strong style="display:block;font-size:20px;margin-bottom:7px;">Generando PDF...</strong>
      <span style="font-size:14px;color:#637381;">Preparando el cronograma y el detalle de tareas.</span>
    </div>
  `;
  return mascara;
}

async function generarPDFPorPaginas(documentoPDF) {
  const paginas = [...documentoPDF.querySelectorAll(".gantt-pdf-page")];
  if (!paginas.length) {
    throw new Error("No se generaron páginas para exportar.");
  }

  const pdf = new window.jspdf.jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const anchoPagina = pdf.internal.pageSize.getWidth();
  const altoPagina = pdf.internal.pageSize.getHeight();
  const margen = 7;
  const anchoUtil = anchoPagina - (margen * 2);
  const altoUtil = altoPagina - (margen * 2);

  for (let indice = 0; indice < paginas.length; indice++) {
    const canvas = await window.html2canvas(paginas[indice], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      logging: false,
      onclone: documentoClonado => {
        documentoClonado.querySelectorAll(".gantt-pdf-page").forEach(pagina => {
          pagina.style.position = "relative";
          pagina.style.left = "0";
          pagina.style.margin = "0";
          pagina.style.transform = "none";
        });
      }
    });

    const escala = Math.min(
      anchoUtil / canvas.width,
      altoUtil / canvas.height
    );
    const anchoImagen = canvas.width * escala;
    const altoImagen = canvas.height * escala;
    const posicionX = (anchoPagina - anchoImagen) / 2;
    const posicionY = (altoPagina - altoImagen) / 2;

    if (indice > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.98),
      "JPEG",
      posicionX,
      posicionY,
      anchoImagen,
      altoImagen,
      undefined,
      "FAST"
    );
  }

  pdf.save("gantt_paideia.pdf");
}

function construirDocumentoPDFGantt(documento, tareas) {
  const paginasGantt = construirPaginasGanttPDF(documento, tareas);
  numerarPaginasPDF(paginasGantt, "Cronograma");

  const paginasDetalle = construirPaginasDetallePDF(documento, tareas);
  numerarPaginasPDF(paginasDetalle, "Detalle");
}

function construirPaginasGanttPDF(documento, tareas) {
  const paginas = [];
  let pagina = crearPaginaGanttPDF();
  documento.appendChild(pagina);
  paginas.push(pagina);

  for (const tarea of tareas) {
    let wrapper = pagina.querySelector(".gantt-wrapper");
    const fila = crearElementoDesdeHTML(crearFilaGantt(tarea));
    wrapper.appendChild(fila);

    if (pagina.scrollHeight > pagina.clientHeight) {
      fila.remove();
      pagina = crearPaginaGanttPDF();
      documento.appendChild(pagina);
      paginas.push(pagina);
      wrapper = pagina.querySelector(".gantt-wrapper");
      wrapper.appendChild(fila);
    }
  }

  return paginas;
}

function construirPaginasDetallePDF(documento, tareas) {
  const paginas = [];
  let pagina = crearPaginaDetallePDF();
  documento.appendChild(pagina);
  paginas.push(pagina);

  for (const tarea of tareas) {
    let cuerpo = pagina.querySelector("tbody");
    const fila = crearElementoDesdeHTML(crearFilasDetalleGantt([tarea]));
    cuerpo.appendChild(fila);

    if (pagina.scrollHeight > pagina.clientHeight) {
      fila.remove();
      pagina = crearPaginaDetallePDF();
      documento.appendChild(pagina);
      paginas.push(pagina);
      cuerpo = pagina.querySelector("tbody");
      cuerpo.appendChild(fila);
    }
  }

  return paginas;
}

function crearPaginaGanttPDF() {
  const pagina = document.createElement("section");
  pagina.className = "gantt-pdf-page gantt-pdf-chart-page";
  pagina.innerHTML = `
    ${crearEncabezadoPaginaPDF("Cronograma de tareas")}
    <div class="gantt-wrapper">
      ${crearCabeceraGantt()}
    </div>
  `;
  return pagina;
}

function crearPaginaDetallePDF() {
  const pagina = document.createElement("section");
  pagina.className = "gantt-pdf-page gantt-pdf-detail-page";
  pagina.innerHTML = `
    ${crearEncabezadoPaginaPDF("Detalle de tareas")}
    <table class="gantt-task-table">
      <thead>
        <tr>
          <th>Tarea</th>
          <th>Descripción</th>
          <th>Fecha de inicio</th>
          <th>Fecha de finalización</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  return pagina;
}

function crearEncabezadoPaginaPDF(titulo) {
  const periodo = document.getElementById("ganttPeriodo")?.textContent || "Período del cronograma";
  return `
    <header class="gantt-pdf-page-header">
      <div>
        <h2>${escaparHTML(titulo)}</h2>
        <p>Planificación general de tareas y períodos de ejecución.</p>
      </div>
      <div class="gantt-pdf-page-meta">
        <strong>${escaparHTML(periodo)}</strong>
        <span class="gantt-pdf-page-number"></span>
      </div>
    </header>
  `;
}

function crearFilasDetalleGantt(tareas) {
  return tareas.map(tarea => `
    <tr>
      <td><strong>${escaparHTML(tarea.titulo || "Sin título")}</strong></td>
      <td>${escaparHTML(tarea.descripcion || "Sin descripción cargada")}</td>
      <td>${escaparHTML(formatearFechaTablaGantt(tarea.fecha_inicio))}</td>
      <td>${escaparHTML(formatearFechaTablaGantt(tarea.fecha_limite))}</td>
    </tr>
  `).join("");
}

function numerarPaginasPDF(paginas, seccion) {
  paginas.forEach((pagina, indice) => {
    const numero = pagina.querySelector(".gantt-pdf-page-number");
    if (numero) {
      numero.textContent = `${seccion} ${indice + 1} de ${paginas.length}`;
    }
  });
}

function crearElementoDesdeHTML(html) {
  const plantilla = document.createElement("template");
  plantilla.innerHTML = html.trim();
  return plantilla.content.firstElementChild;
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
