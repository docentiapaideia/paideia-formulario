console.log("TABLERO REAL DESDE SUPABASE - VERSION 32 - CHECKLIST SEMANAL");

let columnasSistema = [];
let miembrosSistema = [];
let prioridadesSistema = [];
let etiquetasSistema = [];
let tareasTablero = [];
let checklistPorTarea = {};

/* =========================================================
   INICIO
========================================================= */

document.addEventListener("DOMContentLoaded", iniciarTablero);

async function iniciarTablero() {
  registrarEventos();
  await cargarCatalogosSistema();
  await cargarTablero();
}

/* =========================================================
   CATÁLOGOS
========================================================= */

async function cargarCatalogosSistema() {
  await Promise.all([
    cargarColumnasSistema(),
    cargarMiembrosSistema(),
    cargarPrioridadesSistema(),
    cargarEtiquetasSistema()
  ]);
}

async function cargarColumnasSistema() {
  const { data, error } = await supabaseClient
    .from("planner_columnas")
    .select("id, nombre, orden, tablero_id")
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error al cargar columnas:", error);
    columnasSistema = [];
    return;
  }

  columnasSistema = data || [];
}

async function cargarMiembrosSistema() {
  const { data, error } = await supabaseClient
    .from("planner_miembros")
    .select("id, nombre, email, rol, activo")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al cargar miembros:", error);
    miembrosSistema = [];
    return;
  }

  miembrosSistema = data || [];
}

async function cargarPrioridadesSistema() {
  const { data, error } = await supabaseClient
    .from("planner_prioridades")
    .select("id, nombre, orden")
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error al cargar prioridades:", error);
    prioridadesSistema = [];
    return;
  }

  prioridadesSistema = data || [];
}

async function cargarEtiquetasSistema() {
  const { data, error } = await supabaseClient
    .from("planner_etiquetas")
    .select("id, nombre, color")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al cargar etiquetas:", error);
    etiquetasSistema = [];
    return;
  }

  etiquetasSistema = data || [];
}

/* =========================================================
   TABLERO
========================================================= */

async function cargarTablero() {
  limpiarColumnasTablero();

  const { data, error } = await supabaseClient
    .from("planner_vista_kanban")
    .select("*")
    .order("columna_orden", { ascending: true })
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error al cargar tablero:", error);
    mostrarErrorTablero();
    return;
  }

  tareasTablero = data || [];
  console.log("Tareas reales cargadas desde Supabase:", tareasTablero);

  await cargarChecklistTareas(tareasTablero.map(tarea => tarea.id));

  poblarFiltrosDesdeTareas(tareasTablero);
  aplicarFiltros();
}

function limpiarColumnasTablero() {
  const columnas = document.querySelectorAll(".kanban-column");

  columnas.forEach(columna => {
    const cards = columna.querySelectorAll(".task-card");
    cards.forEach(card => card.remove());

    const span = columna.querySelector(".column-header span");
    if (span) {
      span.textContent = "0 tareas";
    }
  });
}

function renderizarTablero(tareas) {
  limpiarColumnasTablero();

  if (!tareas || tareas.length === 0) {
    mostrarTableroVacio();
    actualizarContadoresColumnas();
    return;
  }

  tareas.forEach(tarea => agregarTareaAColumna(tarea));
  actualizarContadoresColumnas();
}

function agregarTareaAColumna(tarea) {
  const nombreColumna = tarea.columna || "Nuevo";
  const columnaDestino = buscarColumnaPorNombre(nombreColumna);

  if (!columnaDestino) {
    console.warn("No se encontró columna para:", nombreColumna, tarea);
    return;
  }

  const prioridad = tarea.prioridad || "Media";
  const etiqueta = tarea.etiquetas || "Sin etiqueta";
  const responsables = tarea.responsables || "Sin responsable";
  const fecha = tarea.fecha_limite || "Sin fecha";
  const avance = normalizarAvance(tarea.porcentaje_avance ?? 0);

  const card = document.createElement("div");
  card.className = "task-card";

  if (tarea.es_final || avance >= 100) {
    card.classList.add("done");
  }

  card.innerHTML = `
    <div class="task-top">
      <span class="tag ${obtenerClaseEtiqueta(etiqueta)}">${escaparHTML(limitarTexto(etiqueta, 24))}</span>
      <span class="priority ${obtenerClasePrioridad(prioridad)}">${escaparHTML(prioridad)}</span>
    </div>

    <h4>${escaparHTML(tarea.titulo || "Sin título")}</h4>

    <p>${escaparHTML(tarea.descripcion || "Sin descripción.")}</p>

    <div class="task-meta">
      <span>👤 ${escaparHTML(limitarTexto(responsables, 28))}</span>
      <span>📅 ${escaparHTML(fecha)}</span>
    </div>

    <div class="task-progress">
      <div class="progress-line small">
        <div class="progress-fill ${obtenerClaseAvance(tarea, avance)}" style="width: ${avance}%;"></div>
      </div>
      <small>${avance}%</small>
    </div>
  `;

  card.addEventListener("click", () => abrirModalEditarTarea(tarea));
  columnaDestino.appendChild(card);
}

function buscarColumnaPorNombre(nombre) {
  const columnas = document.querySelectorAll(".kanban-column");
  let encontrada = null;

  columnas.forEach(columna => {
    const titulo = columna.querySelector(".column-header h3");

    if (titulo && normalizarTexto(titulo.textContent) === normalizarTexto(nombre)) {
      encontrada = columna;
    }
  });

  return encontrada;
}

function actualizarContadoresColumnas() {
  document.querySelectorAll(".kanban-column").forEach(columna => {
    const cantidad = columna.querySelectorAll(".task-card").length;
    const span = columna.querySelector(".column-header span");

    if (span) {
      span.textContent = cantidad === 1 ? "1 tarea" : cantidad + " tareas";
    }
  });
}

function mostrarTableroVacio() {
  const primeraColumna = document.querySelector(".kanban-column");
  if (!primeraColumna) return;

  const aviso = document.createElement("div");
  aviso.className = "task-card";
  aviso.innerHTML = `
    <h4>No hay tareas para mostrar</h4>
    <p>No hay tareas reales en la base o los filtros no tienen coincidencias.</p>
  `;

  primeraColumna.appendChild(aviso);
}

function mostrarErrorTablero() {
  const primeraColumna = document.querySelector(".kanban-column");
  if (!primeraColumna) return;

  const aviso = document.createElement("div");
  aviso.className = "task-card";
  aviso.innerHTML = `
    <h4>Error al cargar tareas</h4>
    <p>Revisar consola y confirmar que existe la vista planner_vista_kanban.</p>
  `;

  primeraColumna.appendChild(aviso);
}

/* =========================================================
   FILTROS
========================================================= */

function poblarFiltrosDesdeTareas(tareas) {
  const valorResp = document.getElementById("filtroResponsable")?.value || "todos";
  const valorPrio = document.getElementById("filtroPrioridad")?.value || "todas";
  const valorEtiq = document.getElementById("filtroEtiqueta")?.value || "todas";

  const responsables = new Set();
  const prioridades = new Set();
  const etiquetas = new Set();

  tareas.forEach(tarea => {
    separarValores(tarea.responsables).forEach(v => responsables.add(v));

    if (tarea.prioridad) {
      prioridades.add(tarea.prioridad);
    }

    separarValores(tarea.etiquetas).forEach(v => etiquetas.add(v));
  });

  poblarSelect("filtroResponsable", "todos", "Todos", responsables, valorResp);
  poblarSelect("filtroPrioridad", "todas", "Todas", prioridades, valorPrio);
  poblarSelect("filtroEtiqueta", "todas", "Todas", etiquetas, valorEtiq);
}

function poblarSelect(id, valorInicial, textoInicial, valores, valorActual) {
  const select = document.getElementById(id);
  if (!select) return;

  select.innerHTML = "";

  const inicial = document.createElement("option");
  inicial.value = valorInicial;
  inicial.textContent = textoInicial;
  select.appendChild(inicial);

  Array.from(valores)
    .filter(v => v && String(v).trim() !== "")
    .sort((a, b) => String(a).localeCompare(String(b)))
    .forEach(valor => {
      const option = document.createElement("option");
      option.value = valor;
      option.textContent = valor;
      select.appendChild(option);
    });

  const existe = Array.from(select.options).some(op => op.value === valorActual);
  select.value = existe ? valorActual : valorInicial;
}

function aplicarFiltros() {
  const filtroResponsable = normalizarTexto(document.getElementById("filtroResponsable")?.value || "todos");
  const filtroPrioridad = normalizarTexto(document.getElementById("filtroPrioridad")?.value || "todas");
  const filtroEtiqueta = normalizarTexto(document.getElementById("filtroEtiqueta")?.value || "todas");
  const filtroBusqueda = normalizarTexto(document.getElementById("filtroBusqueda")?.value || "");

  const filtradas = tareasTablero.filter(tarea => {
    const titulo = normalizarTexto(tarea.titulo || "");
    const descripcion = normalizarTexto(tarea.descripcion || "");
    const responsables = normalizarTexto(tarea.responsables || "");
    const prioridad = normalizarTexto(tarea.prioridad || "");
    const etiquetas = normalizarTexto(tarea.etiquetas || "");

    const okResponsable =
      filtroResponsable === "todos" ||
      filtroResponsable === "" ||
      responsables.includes(filtroResponsable);

    const okPrioridad =
      filtroPrioridad === "todas" ||
      filtroPrioridad === "" ||
      prioridad === filtroPrioridad;

    const okEtiqueta =
      filtroEtiqueta === "todas" ||
      filtroEtiqueta === "" ||
      etiquetas.includes(filtroEtiqueta);

    const okBusqueda =
      filtroBusqueda === "" ||
      titulo.includes(filtroBusqueda) ||
      descripcion.includes(filtroBusqueda);

    return okResponsable && okPrioridad && okEtiqueta && okBusqueda;
  });

  renderizarTablero(filtradas);
  renderizarPanelSemanal(filtradas);
}

function limpiarFiltros() {
  setValor("filtroResponsable", "todos");
  setValor("filtroPrioridad", "todas");
  setValor("filtroEtiqueta", "todas");
  setValor("filtroBusqueda", "");

  aplicarFiltros();
}

/* =========================================================
   CONTROL DE SCROLL DE MODALES
========================================================= */

function bloquearScrollFondo() {
  document.body.classList.add("modal-open");
}

function desbloquearScrollFondoSiCorresponde() {
  const hayModalActivo = document.querySelector(".modal-overlay.active");

  if (!hayModalActivo) {
    document.body.classList.remove("modal-open");
  }
}

/* =========================================================
   MODAL EDITAR
========================================================= */

async function abrirModalEditarTarea(tarea) {
  const modal = document.getElementById("modalEditarTarea");

  if (!modal) {
    console.error("No se encontró modalEditarTarea.");
    return;
  }

  setValor("editTareaId", tarea.id);
  setValor("editTitulo", tarea.titulo || "");
  setValor("editDescripcion", tarea.descripcion || "");
  setValor("editChecklist", obtenerTextoChecklist(tarea.id));
  setValor("editAvance", normalizarAvance(tarea.porcentaje_avance ?? 0));
  setValor("editFechaInicio", tarea.fecha_inicio || "");
  setValor("editFechaLimite", tarea.fecha_limite || "");

  cargarSelectColumnas(document.getElementById("editColumna"), tarea.columna_id, tarea.columna);
  await cargarSelectResponsables(document.getElementById("editResponsable"), tarea.id);
  cargarSelectPrioridades(document.getElementById("editPrioridad"), tarea.prioridad_id, tarea.prioridad);
  await cargarSelectEtiquetas(document.getElementById("editEtiqueta"), tarea.id);

  modal.classList.add("active");
  bloquearScrollFondo();
}

function cerrarModalEditarTarea() {
  document.getElementById("modalEditarTarea")?.classList.remove("active");
  desbloquearScrollFondoSiCorresponde();
}

async function guardarEdicionTarea(event) {
  event.preventDefault();

  const id = getValor("editTareaId");
  const titulo = getValor("editTitulo").trim();

  if (!id) {
    alert("No se encontró la tarea a editar.");
    return;
  }

  if (!titulo) {
    alert("El título no puede estar vacío.");
    return;
  }

  const datosActualizar = {
    titulo: titulo,
    descripcion: getValor("editDescripcion"),
    porcentaje_avance: normalizarAvance(getValor("editAvance")),
    columna_id: getValor("editColumna"),
    prioridad_id: getValor("editPrioridad") || null,
    fecha_inicio: getValor("editFechaInicio") || null,
    fecha_limite: getValor("editFechaLimite") || null
  };

  const { error } = await supabaseClient
    .from("planner_tareas")
    .update(datosActualizar)
    .eq("id", id);

  if (error) {
    console.error("Error al guardar tarea:", error);
    alert("No se pudo guardar la tarea. Revisá la consola.");
    return;
  }

  await actualizarResponsableTarea(id, getValor("editResponsable"));
  await actualizarEtiquetaTarea(id, getValor("editEtiqueta"));
  await guardarChecklistDesdeTextarea(id, getValor("editChecklist"));

  cerrarModalEditarTarea();
  await cargarTablero();
}

function limpiarFechasModal() {
  setValor("editFechaInicio", "");
  setValor("editFechaLimite", "");
}

/* =========================================================
   MODAL NUEVA TAREA
========================================================= */

async function abrirModalNuevaTarea(columnaNombre = "Nuevo") {
  await cargarCatalogosSistema();

  setValor("newTitulo", "");
  setValor("newDescripcion", "");
  setValor("newChecklist", "");
  setValor("newAvance", 0);
  setValor("newFechaInicio", "");
  setValor("newFechaLimite", "");

  cargarSelectColumnas(document.getElementById("newColumna"), null, columnaNombre || "Nuevo");
  cargarSelectResponsablesNueva(document.getElementById("newResponsable"));
  cargarSelectPrioridades(document.getElementById("newPrioridad"), null, "Media");
  cargarSelectEtiquetasNueva(document.getElementById("newEtiqueta"));

  document.getElementById("modalNuevaTarea")?.classList.add("active");
  bloquearScrollFondo();
}

function cerrarModalNuevaTarea() {
  document.getElementById("modalNuevaTarea")?.classList.remove("active");
  desbloquearScrollFondoSiCorresponde();
}

function limpiarFormularioNuevaTarea() {
  setValor("newTitulo", "");
  setValor("newDescripcion", "");
  setValor("newChecklist", "");
  setValor("newAvance", 0);
  setValor("newFechaInicio", "");
  setValor("newFechaLimite", "");
}

async function guardarNuevaTarea(event) {
  event.preventDefault();

  const titulo = getValor("newTitulo").trim();
  const columnaId = getValor("newColumna");

  if (!titulo) {
    alert("El título no puede estar vacío.");
    return;
  }

  const columnaSeleccionada = columnasSistema.find(c => c.id === columnaId);

  if (!columnaSeleccionada) {
    alert("Debe seleccionar una columna válida.");
    return;
  }

  const nuevaTarea = {
    tablero_id: columnaSeleccionada.tablero_id,
    columna_id: columnaId,
    titulo: titulo,
    descripcion: getValor("newDescripcion"),
    prioridad_id: getValor("newPrioridad") || obtenerPrioridadMediaId(),
    fecha_inicio: getValor("newFechaInicio") || null,
    fecha_limite: getValor("newFechaLimite") || null,
    porcentaje_avance: normalizarAvance(getValor("newAvance"))
  };

  const { data, error } = await supabaseClient
    .from("planner_tareas")
    .insert(nuevaTarea)
    .select()
    .single();

  if (error) {
    console.error("Error al crear tarea:", error);
    alert("No se pudo crear la tarea. Revisá la consola.");
    return;
  }

  const tareaId = data.id;

  await actualizarResponsableTarea(tareaId, getValor("newResponsable"));
  await actualizarEtiquetaTarea(tareaId, getValor("newEtiqueta"));
  await guardarChecklistDesdeTextarea(tareaId, getValor("newChecklist"));

  cerrarModalNuevaTarea();
  limpiarFormularioNuevaTarea();
  await cargarTablero();
}

/* =========================================================
   SELECTS
========================================================= */

function cargarSelectColumnas(select, columnaIdActual, columnaNombreActual) {
  if (!select) return;

  select.innerHTML = "";

  columnasSistema.forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.nombre;

    if (
      columnaIdActual === c.id ||
      normalizarTexto(columnaNombreActual || "") === normalizarTexto(c.nombre)
    ) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

async function cargarSelectResponsables(select, tareaId) {
  if (!select) return;

  cargarSelectResponsablesNueva(select);

  const { data, error } = await supabaseClient
    .from("planner_tarea_responsables")
    .select("miembro_id")
    .eq("tarea_id", tareaId);

  if (error) {
    console.error("Error al cargar responsable actual:", error);
    return;
  }

  if (data && data.length > 0) {
    select.value = data[0].miembro_id;
  }
}

function cargarSelectResponsablesNueva(select) {
  if (!select) return;

  select.innerHTML = "";

  const optionVacio = document.createElement("option");
  optionVacio.value = "";
  optionVacio.textContent = "Sin responsable";
  select.appendChild(optionVacio);

  miembrosSistema.forEach(m => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.nombre;
    select.appendChild(option);
  });
}

function cargarSelectPrioridades(select, prioridadIdActual, prioridadNombreActual) {
  if (!select) return;

  select.innerHTML = "";

  prioridadesSistema.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.nombre;

    if (
      prioridadIdActual === p.id ||
      normalizarTexto(prioridadNombreActual || "") === normalizarTexto(p.nombre)
    ) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

async function cargarSelectEtiquetas(select, tareaId) {
  if (!select) return;

  cargarSelectEtiquetasNueva(select);

  const { data, error } = await supabaseClient
    .from("planner_tarea_etiquetas")
    .select("etiqueta_id")
    .eq("tarea_id", tareaId);

  if (error) {
    console.error("Error al cargar etiqueta actual:", error);
    return;
  }

  if (data && data.length > 0) {
    select.value = data[0].etiqueta_id;
  }
}

function cargarSelectEtiquetasNueva(select) {
  if (!select) return;

  select.innerHTML = "";

  const optionVacio = document.createElement("option");
  optionVacio.value = "";
  optionVacio.textContent = "Sin etiqueta";
  select.appendChild(optionVacio);

  etiquetasSistema.forEach(e => {
    const option = document.createElement("option");
    option.value = e.id;
    option.textContent = e.nombre;
    select.appendChild(option);
  });
}

/* =========================================================
   RELACIONES
========================================================= */

async function actualizarResponsableTarea(tareaId, responsableId) {
  const { error: errorDelete } = await supabaseClient
    .from("planner_tarea_responsables")
    .delete()
    .eq("tarea_id", tareaId);

  if (errorDelete) {
    console.error("Error al limpiar responsables:", errorDelete);
    return;
  }

  if (!responsableId) return;

  const { error: errorInsert } = await supabaseClient
    .from("planner_tarea_responsables")
    .insert({
      tarea_id: tareaId,
      miembro_id: responsableId
    });

  if (errorInsert) {
    console.error("Error al asignar responsable:", errorInsert);
  }
}

async function actualizarEtiquetaTarea(tareaId, etiquetaId) {
  const { error: errorDelete } = await supabaseClient
    .from("planner_tarea_etiquetas")
    .delete()
    .eq("tarea_id", tareaId);

  if (errorDelete) {
    console.error("Error al limpiar etiquetas:", errorDelete);
    return;
  }

  if (!etiquetaId) return;

  const { error: errorInsert } = await supabaseClient
    .from("planner_tarea_etiquetas")
    .insert({
      tarea_id: tareaId,
      etiqueta_id: etiquetaId
    });

  if (errorInsert) {
    console.error("Error al asignar etiqueta:", errorInsert);
  }
}



/* =========================================================
   CHECKLIST Y VISTA SEMANAL
========================================================= */

async function cargarChecklistTareas(tareaIds) {
  checklistPorTarea = {};

  const ids = (tareaIds || []).filter(Boolean);
  if (ids.length === 0) return;

  const { data, error } = await supabaseClient
    .from("planner_checklist")
    .select("id, tarea_id, texto, completado, orden, creado_en")
    .in("tarea_id", ids)
    .order("orden", { ascending: true })
    .order("creado_en", { ascending: true });

  if (error) {
    console.error("Error al cargar checklist:", error);
    checklistPorTarea = {};
    return;
  }

  (data || []).forEach(item => {
    if (!checklistPorTarea[item.tarea_id]) {
      checklistPorTarea[item.tarea_id] = [];
    }

    checklistPorTarea[item.tarea_id].push(item);
  });
}

function renderizarPanelSemanal(tareas) {
  const contenedor = document.getElementById("weeklyTasksContainer");
  const titulo = document.getElementById("weeklyTitle");

  if (!contenedor) return;

  contenedor.innerHTML = "";

  const tareasConChecklist = (tareas || []).filter(tarea => {
    const items = checklistPorTarea[tarea.id] || [];
    return items.length > 0;
  });

  if (tareasConChecklist.length === 0) {
    if (titulo) titulo.textContent = "Tareas por semana";
    contenedor.innerHTML = `
      <div class="weekly-empty">
        Todavía no hay subtareas cargadas. Abrí una tarea, agregá el checklist y se va a mostrar acá.
      </div>
    `;
    return;
  }

  const semana = obtenerSemanaPrincipal(tareasConChecklist);
  if (titulo) titulo.textContent = `Semana del ${formatearFechaCorta(semana.inicio)} al ${formatearFechaCorta(semana.fin)}`;

  tareasConChecklist
    .sort((a, b) => obtenerFechaReferencia(a) - obtenerFechaReferencia(b))
    .forEach(tarea => {
      contenedor.appendChild(crearTarjetaSemanal(tarea));
    });
}

function crearTarjetaSemanal(tarea) {
  const items = checklistPorTarea[tarea.id] || [];
  const total = items.length;
  const completadas = items.filter(item => item.completado).length;
  const avance = total > 0 ? Math.round((completadas / total) * 100) : 0;

  const card = document.createElement("article");
  card.className = "weekly-task-card";
  card.addEventListener("click", () => abrirModalEditarTarea(tarea));

  const lista = items.map(item => `
    <label class="weekly-subtask" data-check-id="${escaparHTML(item.id)}">
      <input type="checkbox" ${item.completado ? "checked" : ""} data-check-id="${escaparHTML(item.id)}">
      <span>${escaparHTML(item.texto)}</span>
    </label>
  `).join("");

  card.innerHTML = `
    <div class="weekly-card-accent"></div>
    <div class="weekly-main-row">
      <button type="button" class="weekly-task-circle" aria-label="Marcar tarea"></button>
      <div class="weekly-task-content">
        <div class="weekly-task-title-row">
          <h4>${escaparHTML(tarea.titulo || "Sin título")}</h4>
          <span class="weekly-task-date">${escaparHTML(tarea.fecha_limite || "Sin fecha")}</span>
        </div>
        <div class="weekly-subtasks">${lista}</div>
        <div class="weekly-footer">
          <span class="weekly-count">☑ ${completadas} / ${total}</span>
          <div class="weekly-progress"><span style="width:${avance}%"></span></div>
        </div>
      </div>
    </div>
  `;

  card.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.addEventListener("click", event => event.stopPropagation());
    input.addEventListener("change", async event => {
      event.stopPropagation();
      await alternarChecklist(input.dataset.checkId, input.checked);
    });
  });

  return card;
}

async function alternarChecklist(checkId, completado) {
  if (!checkId) return;

  const { error } = await supabaseClient
    .from("planner_checklist")
    .update({ completado })
    .eq("id", checkId);

  if (error) {
    console.error("Error al actualizar subtarea:", error);
    alert("No se pudo actualizar la subtarea. Revisá permisos/RLS en planner_checklist.");
    return;
  }

  Object.keys(checklistPorTarea).forEach(tareaId => {
    checklistPorTarea[tareaId] = checklistPorTarea[tareaId].map(item => {
      if (item.id === checkId) {
        return { ...item, completado };
      }
      return item;
    });
  });

  aplicarFiltros();
}

function obtenerTextoChecklist(tareaId) {
  const items = checklistPorTarea[tareaId] || [];
  return items.map(item => item.texto).join("\n");
}

function obtenerLineasChecklist(texto) {
  return String(texto || "")
    .split("\n")
    .map(linea => linea.trim())
    .filter(linea => linea !== "");
}

async function guardarChecklistDesdeTextarea(tareaId, texto) {
  const lineas = obtenerLineasChecklist(texto);
  const existentes = checklistPorTarea[tareaId] || [];

  const completadoPorTexto = new Map();
  existentes.forEach(item => {
    completadoPorTexto.set(normalizarTexto(item.texto), !!item.completado);
  });

  const { error: errorDelete } = await supabaseClient
    .from("planner_checklist")
    .delete()
    .eq("tarea_id", tareaId);

  if (errorDelete) {
    console.error("Error al limpiar checklist:", errorDelete);
    alert("La tarea se guardó, pero no se pudo actualizar el checklist.");
    return;
  }

  if (lineas.length === 0) {
    checklistPorTarea[tareaId] = [];
    return;
  }

  const registros = lineas.map((linea, index) => ({
    tarea_id: tareaId,
    texto: linea,
    completado: completadoPorTexto.get(normalizarTexto(linea)) || false,
    orden: index + 1
  }));

  const { error: errorInsert } = await supabaseClient
    .from("planner_checklist")
    .insert(registros);

  if (errorInsert) {
    console.error("Error al insertar checklist:", errorInsert);
    alert("La tarea se guardó, pero no se pudieron crear las subtareas.");
  }
}

function obtenerSemanaPrincipal(tareas) {
  const fechas = (tareas || [])
    .map(obtenerFechaReferencia)
    .filter(fecha => fecha instanceof Date && !isNaN(fecha));

  const base = fechas.length > 0 ? fechas[0] : new Date();
  return obtenerSemanaDeFecha(base);
}

function obtenerFechaReferencia(tarea) {
  const valor = tarea.fecha_limite || tarea.fecha_inicio || tarea.creado_en;
  if (!valor) return new Date();

  const fecha = new Date(valor + (String(valor).length === 10 ? "T00:00:00" : ""));
  return isNaN(fecha) ? new Date() : fecha;
}

function obtenerSemanaDeFecha(fecha) {
  const f = new Date(fecha);
  const dia = f.getDay();
  const diferenciaLunes = dia === 0 ? -6 : 1 - dia;

  const inicio = new Date(f);
  inicio.setDate(f.getDate() + diferenciaLunes);

  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 4);

  return { inicio, fin };
}

function formatearFechaCorta(fecha) {
  const d = String(fecha.getDate()).padStart(2, "0");
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
}

/* =========================================================
   EVENTOS
========================================================= */

function registrarEventos() {
  document.getElementById("formEditarTarea")?.addEventListener("submit", guardarEdicionTarea);
  document.getElementById("btnCerrarModal")?.addEventListener("click", cerrarModalEditarTarea);
  document.getElementById("btnCancelarModal")?.addEventListener("click", cerrarModalEditarTarea);
  document.getElementById("btnLimpiarFechas")?.addEventListener("click", limpiarFechasModal);

  document.getElementById("modalEditarTarea")?.addEventListener("click", function(event) {
    if (event.target.id === "modalEditarTarea") {
      cerrarModalEditarTarea();
    }
  });

  document.getElementById("btnNuevaTarea")?.addEventListener("click", function() {
    abrirModalNuevaTarea("Nuevo");
  });

  document.getElementById("btnAgregarTareaSemana")?.addEventListener("click", function() {
    abrirModalNuevaTarea("Nuevo");
  });

  document.getElementById("btnRecargarSemana")?.addEventListener("click", cargarTablero);

  document.querySelectorAll(".btnColNuevaTarea").forEach(btn => {
    btn.addEventListener("click", function() {
      abrirModalNuevaTarea(btn.dataset.columna || "Nuevo");
    });
  });

  document.getElementById("formNuevaTarea")?.addEventListener("submit", guardarNuevaTarea);
  document.getElementById("btnCerrarModalNueva")?.addEventListener("click", cerrarModalNuevaTarea);
  document.getElementById("btnCancelarModalNueva")?.addEventListener("click", cerrarModalNuevaTarea);
  document.getElementById("btnLimpiarNuevaTarea")?.addEventListener("click", limpiarFormularioNuevaTarea);

  document.getElementById("modalNuevaTarea")?.addEventListener("click", function(event) {
    if (event.target.id === "modalNuevaTarea") {
      cerrarModalNuevaTarea();
    }
  });

  document.getElementById("filtroResponsable")?.addEventListener("change", aplicarFiltros);
  document.getElementById("filtroPrioridad")?.addEventListener("change", aplicarFiltros);
  document.getElementById("filtroEtiqueta")?.addEventListener("change", aplicarFiltros);
  document.getElementById("filtroBusqueda")?.addEventListener("input", aplicarFiltros);

  document.getElementById("btnLimpiarFiltros")?.addEventListener("click", limpiarFiltros);
  document.getElementById("btnRecargar")?.addEventListener("click", cargarTablero);
}

/* =========================================================
   UTILIDADES
========================================================= */

function separarValores(texto) {
  if (!texto) return [];

  return String(texto)
    .split(";")
    .map(v => v.trim())
    .filter(v => v !== "");
}

function getValor(id) {
  return document.getElementById(id)?.value || "";
}

function setValor(id, valor) {
  const el = document.getElementById(id);

  if (el) {
    el.value = valor;
  }
}

function obtenerPrioridadMediaId() {
  const prioridadMedia = prioridadesSistema.find(p => normalizarTexto(p.nombre) === "media");

  if (prioridadMedia) {
    return prioridadMedia.id;
  }

  if (prioridadesSistema.length > 0) {
    return prioridadesSistema[0].id;
  }

  return null;
}

function normalizarAvance(valor) {
  let avance = Number(valor);

  if (isNaN(avance)) avance = 0;
  if (avance < 0) avance = 0;
  if (avance > 100) avance = 100;

  return avance;
}

function normalizarTexto(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function limitarTexto(texto, max) {
  if (!texto) return "";

  if (texto.length <= max) {
    return texto;
  }

  return texto.substring(0, max) + "...";
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

function obtenerClasePrioridad(prioridad) {
  const p = normalizarTexto(prioridad || "");

  if (p.includes("baja")) return "low";
  if (p.includes("media")) return "medium";
  if (p.includes("alta")) return "high";
  if (p.includes("urgente") || p.includes("critica")) return "urgent";

  return "medium";
}

function obtenerClaseEtiqueta(etiqueta) {
  const e = normalizarTexto(etiqueta || "");

  if (e.includes("capacitacion")) return "blue";
  if (e.includes("evento") || e.includes("congreso")) return "green";
  if (e.includes("proyecto") || e.includes("flep")) return "orange";
  if (e.includes("app") || e.includes("campus") || e.includes("ia")) return "purple";
  if (e.includes("material") || e.includes("sin")) return "gray";

  return "blue";
}

function obtenerClaseAvance(tarea, avance) {
  if (tarea.es_final || avance >= 100) return "green";
  if (avance > 0 && avance < 100) return "orange";

  return "blue";
}
