console.log("Gantt PaideIA Planner conectado a Supabase v10");

let tareasGantt = [];

document.addEventListener("DOMContentLoaded", cargarGantt);

async function cargarGantt() {
  const { data, error } = await supabaseClient
    .from("planner_vista_gantt")
    .select("*")
    .order("fecha_inicio", { ascending: true, nullsFirst: false })
    .order("fecha_limite", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error al cargar Gantt:", error);
    mostrarErrorGantt();
    return;
  }

  tareasGantt = data || [];

  console.log("Tareas Gantt reales:", tareasGantt);

  actualizarResumenGantt(tareasGantt);
  renderizarGantt(tareasGantt);
}

function actualizarResumenGantt(tareas) {
  const total = tareas.length;

  const enCurso = tareas.filter(t => {
    const estado = (t.estado_gantt || "").toLowerCase();
    return estado.includes("plazo") || estado.includes("curso");
  }).length;

  const atrasadas = tareas.filter(t => {
    const estado = (t.estado_gantt || "").toLowerCase();
    return estado.includes("atrasada");
  }).length;

  const finalizadas = tareas.filter(t => {
    const estado = (t.estado_gantt || "").toLowerCase();
    return estado.includes("finalizada") || Number(t.porcentaje_avance) >= 100;
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
          <span>Cargá tareas con fecha de inicio o fecha límite desde el tablero.</span>
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

  const claseBarra = obtenerClaseBarra(tarea);
  const posicion = calcularPosicionBarra(tarea);

  return `
    <div class="gantt-grid gantt-row">
      <div class="gantt-task-info">
        <strong>${titulo}</strong>
        <span>${responsables}</span>
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

  const fecha = new Date(fechaTexto + "T00:00:00");

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

  if (estado.includes("finalizada") || avance >= 100) {
    return "gantt-green";
  }

  if (estado.includes("atrasada")) {
    return "gantt-red";
  }

  if (estado.includes("curso") || avance > 0) {
    return "gantt-orange";
  }

  return "gantt-blue";
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

function escaparHTML(texto) {
  if (!texto) return "";

  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}