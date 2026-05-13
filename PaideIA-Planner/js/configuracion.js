console.log("Configuración PaideIA Planner cargada.");

async function cargarEtiquetas() {
  const contenedor = document.getElementById("contenedorEtiquetas");

  if (!contenedor) {
    console.error("No se encontró el contenedor de etiquetas.");
    return;
  }

  contenedor.innerHTML = `
    <div class="tag-config blue">
      <strong>Cargando etiquetas...</strong>
      <span>Conectando con Supabase.</span>
    </div>
  `;

  const { data, error } = await supabaseClient
    .from("planner_etiquetas")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al cargar etiquetas:", error);

    contenedor.innerHTML = `
      <div class="tag-config gray">
        <strong>Error al cargar etiquetas</strong>
        <span>Revisar consola y permisos de Supabase.</span>
      </div>
    `;

    return;
  }

  if (!data || data.length === 0) {
    contenedor.innerHTML = `
      <div class="tag-config gray">
        <strong>No hay etiquetas cargadas</strong>
        <span>Usá el botón + para crear una nueva.</span>
      </div>
    `;

    return;
  }

  contenedor.innerHTML = "";

  data.forEach(etiqueta => {
    const div = document.createElement("div");
    div.className = "tag-config " + obtenerClaseEtiqueta(etiqueta.nombre);

    div.innerHTML = `
      <strong>${etiqueta.nombre}</strong>
      <span>Color: ${etiqueta.color || "Sin color definido"}</span>

      <div class="tag-actions">
        <button onclick="editarEtiqueta('${etiqueta.id}', '${escaparTexto(etiqueta.nombre)}', '${etiqueta.color || ""}')">
          Editar
        </button>
        <button onclick="eliminarEtiqueta('${etiqueta.id}', '${escaparTexto(etiqueta.nombre)}')" class="danger">
          Eliminar
        </button>
      </div>
    `;

    contenedor.appendChild(div);
  });
}

async function crearEtiqueta() {
  const nombre = prompt("Nombre de la nueva etiqueta:");

  if (!nombre || nombre.trim() === "") {
    return;
  }

  const color = prompt("Color en formato HEX. Ejemplo: #1e88e5", "#1e88e5");

  const { error } = await supabaseClient
    .from("planner_etiquetas")
    .insert({
      nombre: nombre.trim(),
      color: color || "#1e88e5"
    });

  if (error) {
    console.error("Error al crear etiqueta:", error);
    alert("No se pudo crear la etiqueta. Revisá la consola.");
    return;
  }

  cargarEtiquetas();
}

async function editarEtiqueta(id, nombreActual, colorActual) {
  const nuevoNombre = prompt("Editar nombre de etiqueta:", nombreActual);

  if (!nuevoNombre || nuevoNombre.trim() === "") {
    return;
  }

  const nuevoColor = prompt("Editar color HEX:", colorActual || "#1e88e5");

  const { error } = await supabaseClient
    .from("planner_etiquetas")
    .update({
      nombre: nuevoNombre.trim(),
      color: nuevoColor || "#1e88e5"
    })
    .eq("id", id);

  if (error) {
    console.error("Error al editar etiqueta:", error);
    alert("No se pudo editar la etiqueta. Revisá la consola.");
    return;
  }

  cargarEtiquetas();
}

async function eliminarEtiqueta(id, nombre) {
  const confirmar = confirm("¿Seguro que querés eliminar la etiqueta '" + nombre + "'?");

  if (!confirmar) {
    return;
  }

  const { error } = await supabaseClient
    .from("planner_etiquetas")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error al eliminar etiqueta:", error);
    alert("No se pudo eliminar. Puede estar vinculada a tareas.");
    return;
  }

  cargarEtiquetas();
}

function obtenerClaseEtiqueta(nombre) {
  const n = nombre.toLowerCase();

  if (n.includes("capacit")) return "blue";
  if (n.includes("evento") || n.includes("congreso")) return "green";
  if (n.includes("flep") || n.includes("proyecto")) return "orange";
  if (n.includes("app") || n.includes("campus") || n.includes("ia")) return "purple";
  if (n.includes("material")) return "gray";

  return "blue";
}

function escaparTexto(texto) {
  if (!texto) {
    return "";
  }

  return texto
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', "&quot;");
}

const btnNuevaEtiqueta = document.getElementById("btnNuevaEtiqueta");

if (btnNuevaEtiqueta) {
  btnNuevaEtiqueta.addEventListener("click", crearEtiqueta);
}

cargarEtiquetas();