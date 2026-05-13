console.log("Dashboard PaideIA Planner cargado.");

async function cargarDashboard() {
  const { data, error } = await supabaseClient
    .from("planner_dashboard_general")
    .select("*")
    .single();

  if (error) {
    console.error("Error al cargar dashboard:", error);
    mostrarErrorDashboard();
    return;
  }

  if (!data) {
    console.warn("No hay datos para mostrar en el dashboard.");
    return;
  }

  actualizarTexto("totalTareas", data.total_tareas);
  actualizarTexto("tareasFinalizadas", data.tareas_finalizadas);
  actualizarTexto("tareasProceso", data.tareas_en_proceso);
  actualizarTexto("tareasAtrasadas", data.tareas_atrasadas);

  actualizarAvanceGeneral(data.total_tareas, data.tareas_finalizadas);
}

function actualizarTexto(id, valor) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valor ?? 0;
  }
}

function actualizarAvanceGeneral(total, finalizadas) {
  const totalNum = Number(total) || 0;
  const finalizadasNum = Number(finalizadas) || 0;

  let porcentaje = 0;

  if (totalNum > 0) {
    porcentaje = Math.round((finalizadasNum / totalNum) * 100);
  }

  const badge = document.querySelector(".panel-badge");
  const circleText = document.querySelector(".progress-circle span");
  const circle = document.querySelector(".progress-circle");
  const progressFill = document.querySelector(".progress-fill");

  if (badge) {
    badge.textContent = porcentaje + "%";
  }

  if (circleText) {
    circleText.textContent = porcentaje + "%";
  }

  if (circle) {
    circle.style.background = `conic-gradient(var(--azul-medio) 0% ${porcentaje}%, #e8eef5 ${porcentaje}% 100%)`;
  }

  if (progressFill) {
    progressFill.style.width = porcentaje + "%";
  }
}

function mostrarErrorDashboard() {
  actualizarTexto("totalTareas", "Error");
  actualizarTexto("tareasFinalizadas", "-");
  actualizarTexto("tareasProceso", "-");
  actualizarTexto("tareasAtrasadas", "-");
}

cargarDashboard();