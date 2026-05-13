const content=document.getElementById("content"),pageTitle=document.getElementById("pageTitle"),modal=document.getElementById("infoModal"),modalBody=document.getElementById("modalBody"),modalClose=document.getElementById("modalClose");

const details={
"chatgpt-nuevo":`<h2>Nuevo chat en ChatGPT</h2><p>Sirve para comenzar una conversación desde cero. Es útil cuando cambiás de tema, de objetivo o de destinatario.</p><h3>Uso recomendado</h3><ul><li>Usar un chat distinto para cada tema importante.</li><li>No mezclar tareas sin relación.</li><li>Nombrar o ubicar conversaciones relevantes en proyectos si el trabajo continúa.</li></ul>`,
"chatgpt-sidebar":`<h2>Barra lateral e historial</h2><p>Permite volver a conversaciones anteriores, continuar trabajos y recuperar instrucciones ya dadas.</p><h3>Buenas prácticas</h3><ul><li>Revisar el historial antes de repetir trabajo.</li><li>Usar nombres claros en chats importantes.</li><li>No guardar información sensible si no corresponde institucionalmente.</li></ul>`,
"chatgpt-input":`<h2>Cuadro de mensaje</h2><p>Es el espacio donde se escribe el prompt. Cuanto más claro sea el pedido, más útil será la respuesta.</p><h3>Debe incluir</h3><ul><li>Objetivo.</li><li>Contexto.</li><li>Formato esperado.</li><li>Nivel de detalle.</li><li>Restricciones o criterios de validación.</li></ul>`,
"chatgpt-archivos":`<h2>Adjuntar archivos</h2><p>Permite subir documentos para resumir, comparar, analizar o transformar información.</p><h3>Usos</h3><ul><li>Analizar PDFs, textos, planillas o consignas.</li><li>Extraer ideas principales.</li><li>Comparar documentos.</li><li>Generar preguntas, resúmenes o actividades.</li></ul><p><strong>Importante:</strong> revisar siempre que la interpretación sea correcta.</p>`,
"chatgpt-herramientas":`<h2>Herramientas y capacidades</h2><p>Según el plan y disponibilidad, ChatGPT puede trabajar con búsqueda, análisis de datos, imágenes, archivos, memoria, proyectos, canvas y otras herramientas.</p><h3>Regla de uso</h3><ul><li>Si se necesita actualidad, pedir búsqueda o fuentes.</li><li>Si se trabaja con datos, pedir análisis y validación.</li><li>Si se redacta o programa, usar iteraciones y revisiones.</li></ul>`,
"chatgpt-proyectos":`<h2>Proyectos</h2><p>Los proyectos agrupan chats, archivos e instrucciones relacionadas con un objetivo de trabajo continuo.</p><h3>Cuándo conviene</h3><ul><li>Capacitaciones.</li><li>Investigaciones.</li><li>Desarrollo de sistemas.</li><li>Materiales institucionales.</li></ul>`,
"chatgpt-canvas":`<h2>Canvas</h2><p>Es un espacio de trabajo para escribir, editar y revisar textos o código de manera más ordenada que en un chat común.</p><h3>Usos</h3><ul><li>Corregir documentos largos.</li><li>Editar código.</li><li>Reescribir partes específicas.</li><li>Trabajar con versiones.</li></ul>`,
"chatgpt-gpts":`<h2>GPTs personalizados</h2><p>Permiten usar asistentes configurados para tareas específicas. Pueden servir para roles concretos como tutor, corrector, generador de actividades o asistente técnico.</p><h3>Cuidado</h3><p>Antes de usar uno, revisar para qué fue diseñado y si cumple las condiciones institucionales.</p>`,

"claude-chat":`<h2>Chat principal en Claude</h2><p>Permite conversar, pedir análisis, redactar y revisar textos. Claude suele destacarse cuando el trabajo requiere lectura cuidadosa y producción textual extensa.</p>`,
"claude-files":`<h2>Archivos y documentos</h2><p>Claude es útil para analizar documentos largos, encontrar ideas centrales, comparar secciones y producir síntesis.</p><h3>Uso recomendado</h3><ul><li>Subir el documento.</li><li>Pedir primero resumen estructural.</li><li>Luego pedir análisis por criterios.</li><li>Finalmente validar conclusiones.</li></ul>`,
"claude-projects":`<h2>Proyectos</h2><p>Los proyectos ayudan a reunir documentos, instrucciones y conversaciones sobre un mismo trabajo.</p>`,
"claude-artifacts":`<h2>Artifacts</h2><p>Permiten trabajar con resultados más estructurados, como textos, esquemas, código o materiales que se pueden ir ajustando.</p>`,
"claude-style":`<h2>Estilo de respuesta</h2><p>Claude puede ser útil para reescribir, mejorar tono, ordenar argumentos y producir textos claros. Conviene indicar destinatario, extensión y tono.</p>`,

"gemini-prompt":`<h2>Prompt en Gemini</h2><p>Permite escribir o dictar instrucciones. Puede utilizar texto, voz, imágenes o cámara según dispositivo y disponibilidad.</p>`,
"gemini-apps":`<h2>Conexión con Google</h2><p>Gemini puede integrarse con servicios de Google como Gmail, Drive, Docs, Maps o Flights según cuenta, permisos y disponibilidad.</p><h3>Cuidado</h3><p>Revisar permisos y no compartir datos institucionales sin autorización.</p>`,
"gemini-files":`<h2>Archivos e imágenes</h2><p>Puede ayudar a analizar archivos, imágenes o capturas. Es útil para explicar una imagen, resumir documentos o generar ideas a partir de material visual.</p>`,
"gemini-canvas":`<h2>Canvas y creación</h2><p>Gemini incluye espacios para crear documentos, apps o materiales, además de funciones de aprendizaje, investigación y generación multimedia según plan.</p>`,
"gemini-research":`<h2>Investigación y aprendizaje</h2><p>Puede servir para explorar temas, crear explicaciones, esquemas, cuestionarios o materiales de estudio. La información debe validarse.</p>`,

"copilot-chat":`<h2>Copilot Chat</h2><p>Permite hacer preguntas, pedir borradores, resumir información y trabajar con contenido web o laboral según licencia y permisos.</p>`,
"copilot-office":`<h2>Word, Excel y PowerPoint</h2><p>Copilot puede ayudar a redactar documentos, analizar datos, crear presentaciones y resumir contenido dentro de Microsoft 365.</p>`,
"copilot-files":`<h2>Archivos y contenido de trabajo</h2><p>Con suscripción y permisos adecuados, Copilot puede usar correos, chats, documentos y archivos de Microsoft 365 como contexto.</p>`,
"copilot-notebooks":`<h2>Notebooks</h2><p>Los notebooks reúnen chats, archivos, notas, páginas y referencias para trabajar sobre un objetivo específico.</p>`,
"copilot-agents":`<h2>Agentes</h2><p>Los agentes ayudan a automatizar o asistir tareas específicas, como investigación, análisis, soporte o trabajo con documentos.</p>`
};

const baseModals={
objetivo:`<h2>🎯 Objetivo claro</h2><p>El objetivo es la parte más importante del prompt. La IA necesita saber qué resultado esperás obtener.</p><ul><li>Usá verbos concretos: redactá, resumí, compará, explicá, corregí, analizá, diseñá.</li><li>Evitá pedidos ambiguos.</li><li>Indicá el producto final esperado.</li></ul>`,
contexto:`<h2>📚 Contexto</h2><p>El contexto explica la situación, destinatario y propósito.</p><ul><li>Quién lo usará.</li><li>Para qué se necesita.</li><li>Nivel de profundidad.</li><li>Tono esperado.</li></ul>`,
formato:`<h2>🧱 Formato esperado</h2><p>Indicar formato evita respuestas desordenadas.</p><ul><li>Tabla.</li><li>Informe.</li><li>Guía paso a paso.</li><li>Lista de verificación.</li><li>Código.</li></ul>`,
validacion:`<h2>⚠ Validación</h2><p>La IA puede equivocarse. Antes de usar una respuesta hay que revisar datos, fuentes, fechas, normativa y coherencia.</p>`
};

const modalInfo={...baseModals,...details};

function feature(key,title,text){return `<div class="card"><h3>${title}</h3><p>${text}</p><button onclick="openModal('${key}')">Ver detalle</button></div>`}

function toolModule(id,logo,title,intro,features,map){
 return `<h1 class="module-title">${title}</h1>
 <p class="module-text">${intro}</p>
 <h2 class="module-subtitle">Mapa general de la pantalla</h2>
 <div class="screen-map">
  <div class="screen-block"><h3>Zona izquierda</h3><ul>${map.left.map(x=>`<li>${x}</li>`).join("")}</ul></div>
  <div class="screen-block"><h3>Zona central</h3><ul>${map.center.map(x=>`<li>${x}</li>`).join("")}</ul></div>
  <div class="screen-block"><h3>Zona superior / herramientas</h3><ul>${map.top.map(x=>`<li>${x}</li>`).join("")}</ul></div>
 </div>
 <h2 class="module-subtitle">Funcionalidades principales</h2>
 <div class="cards">${features.join("")}</div>
 <h2 class="module-subtitle">Uso recomendado en PaideIA</h2>
 <div class="feature-grid">
  <div class="feature"><h4>1. Definir el objetivo</h4><p>Antes de escribir, decidir qué resultado se necesita y para quién.</p></div>
  <div class="feature"><h4>2. Pedir formato</h4><p>Solicitar tabla, guía, informe, actividad, resumen o código.</p></div>
  <div class="feature"><h4>3. Revisar resultado</h4><p>Confirmar que los datos cumplen las condiciones y no contienen errores.</p></div>
  <div class="feature"><h4>4. Ajustar por iteración</h4><p>Si la respuesta no sirve, corregir el prompt y pedir una nueva versión.</p></div>
 </div>`;
}

const modules={
inicio:`<div class="hero"><div class="hero-panel"><h1>Uso inteligente de IA generativa</h1><p>Este campus presenta una guía práctica para comprender cómo dialogar con herramientas de Inteligencia Artificial, cómo escribir prompts útiles y cómo revisar críticamente los resultados antes de usarlos.</p></div><div class="hero-side"><h3>Idea central</h3><ul><li>La IA no reemplaza el criterio humano.</li><li>Un buen prompt mejora la respuesta.</li><li>Validar evita errores.</li><li>El resultado debe revisarse antes de guardarse o difundirse.</li></ul></div></div><h1 class="module-title">¿Qué es un Prompt?</h1><p class="module-text">Un prompt es la instrucción, pregunta o pedido que una persona realiza a una IA para obtener una respuesta. No es solamente “preguntar algo”: es construir una consigna clara, con contexto, objetivo, formato, límites y criterios de validación.</p><div class="flow"><div class="flow-step">1. Necesidad</div><div class="flow-step">2. Prompt</div><div class="flow-step">3. Respuesta IA</div><div class="flow-step">4. Validación</div><div class="flow-step">5. Uso responsable</div></div><div class="cards">${feature("objetivo","🎯 Objetivo claro","Indicar exactamente qué se necesita obtener.")}${feature("contexto","📚 Contexto","Explicar para qué, para quién y en qué situación se usará.")}${feature("formato","🧱 Formato esperado","Pedir tabla, informe, guía, lista, código o actividad.")}${feature("validacion","⚠ Validación","Revisar si la información es correcta antes de usarla.")}</div><h2 class="module-subtitle">Ejemplo</h2><div class="example bad"><strong>❌ Prompt poco específico:</strong><p>“Haceme un trabajo”</p></div><div class="example good"><strong>✅ Prompt correcto:</strong><p>“Redactá un informe académico de 3 páginas sobre evaluación educativa, con lenguaje formal, subtítulos claros y formato APA. Está destinado a estudiantes de posgrado. Indicá si algún dato requiere verificación.”</p></div>`,
chatgpt:toolModule("chatgpt","chatgpt.png","ChatGPT","ChatGPT funciona como un asistente conversacional. Permite iniciar chats, trabajar con archivos, organizar proyectos, redactar, programar, buscar información, generar imágenes o revisar textos según disponibilidad de herramientas y plan.",[
feature("chatgpt-nuevo","➕ Nuevo chat","Comenzar una conversación desde cero."),
feature("chatgpt-sidebar","📚 Historial y barra lateral","Volver a conversaciones anteriores."),
feature("chatgpt-input","⌨️ Cuadro de mensaje","Escribir el prompt con contexto y formato."),
feature("chatgpt-archivos","📎 Adjuntar archivos","Subir documentos para analizar o transformar."),
feature("chatgpt-herramientas","🧰 Herramientas","Usar búsqueda, análisis, imágenes o datos."),
feature("chatgpt-proyectos","🗂️ Proyectos","Agrupar chats, archivos e instrucciones."),
feature("chatgpt-canvas","📝 Canvas","Editar textos o código en un espacio de trabajo."),
feature("chatgpt-gpts","🤖 GPTs","Usar asistentes personalizados.")
],{left:["Nuevo chat","Historial de conversaciones","Proyectos","GPTs o accesos guardados"],center:["Conversación principal","Respuestas de la IA","Archivos o resultados","Continuidad del diálogo"],top:["Selector de modelo","Herramientas disponibles","Configuración de cuenta","Opciones de compartir o exportar"]}),
claude:toolModule("claude","claude.png","Claude","Claude es una herramienta conversacional orientada al análisis, escritura y comprensión de textos. Suele ser útil para documentos largos, revisión de ideas, síntesis, redacción cuidada y trabajo con artefactos.",[
feature("claude-chat","💬 Chat principal","Conversar, analizar y redactar."),
feature("claude-files","📄 Documentos","Trabajar con archivos y textos extensos."),
feature("claude-projects","🗂️ Proyectos","Organizar trabajos con contexto común."),
feature("claude-artifacts","🧩 Artifacts","Crear resultados editables o estructurados."),
feature("claude-style","✍️ Estilo","Ajustar tono, claridad y estructura.")
],{left:["Nuevo chat","Historial","Proyectos","Espacios de trabajo"],center:["Conversación","Análisis de documentos","Resultados escritos","Artifacts cuando corresponda"],top:["Modelo disponible","Opciones de cuenta","Herramientas según plan","Configuración"]}),
gemini:toolModule("gemini","gemini.png","Gemini","Gemini es la IA del ecosistema Google. Puede trabajar con texto, voz, imágenes y herramientas conectadas de Google según cuenta, permisos y disponibilidad.",[
feature("gemini-prompt","⌨️ Escribir o hablar","Ingresar prompts por texto o voz."),
feature("gemini-apps","🔗 Apps conectadas","Usar servicios de Google cuando estén habilitados."),
feature("gemini-files","📎 Archivos e imágenes","Analizar archivos, fotos o capturas."),
feature("gemini-canvas","🧱 Canvas y creación","Crear documentos, apps o materiales."),
feature("gemini-research","🔎 Investigación","Explorar temas, aprender y resumir.")
],{left:["Chats recientes","Accesos a funciones","Apps conectadas","Configuración"],center:["Respuesta principal","Prompt del usuario","Imágenes o archivos","Resultados generados"],top:["Modelo o versión","Cuenta Google","Herramientas disponibles","Extensiones o apps conectadas"]}),
copilot:toolModule("copilot","copilot.png","Copilot","Copilot es la IA de Microsoft orientada a productividad, documentos, análisis, presentaciones y trabajo con contenido de Microsoft 365 según licencia y permisos.",[
feature("copilot-chat","💬 Copilot Chat","Preguntar, redactar y resumir."),
feature("copilot-office","📑 Word, Excel y PowerPoint","Asistir en documentos, datos y presentaciones."),
feature("copilot-files","📂 Archivos laborales","Usar contenido de Microsoft 365 como contexto."),
feature("copilot-notebooks","📓 Notebooks","Reunir chats, archivos y referencias."),
feature("copilot-agents","🤖 Agentes","Automatizar o asistir tareas específicas.")
],{left:["Chat","Historial","Notebooks","Agentes o aplicaciones"],center:["Conversación","Borradores","Resúmenes","Análisis de contenido"],top:["Cuenta Microsoft","Modo web o trabajo","Apps de Microsoft 365","Opciones de compartir"]}),
laboratorio:`<h1 class="module-title">Laboratorio de Prompts</h1><p class="module-text">Escribí un prompt y revisá si contiene objetivo, contexto, formato, detalle y criterios de validación.</p><textarea id="promptInput" placeholder="Escribí tu prompt aquí..."></textarea><button class="more-btn" onclick="analizarPrompt()">Analizar Prompt</button><div class="result" id="resultadoPrompt">Esperando análisis...</div>`
};

function openModal(key){modalBody.innerHTML=modalInfo[key]||"<h2>Información no disponible</h2>";modal.classList.add("show")}
function closeModal(){modal.classList.remove("show")}
modalClose.addEventListener("click",closeModal);
modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

function loadModule(name){
 content.innerHTML=modules[name];
 const titles={inicio:"Inicio",chatgpt:"ChatGPT",claude:"Claude",gemini:"Gemini",copilot:"Copilot",laboratorio:"Laboratorio"};
 pageTitle.textContent=titles[name]||"Campus IA";
 document.querySelectorAll(".nav-btn").forEach(btn=>{btn.classList.remove("active");if(btn.dataset.module===name)btn.classList.add("active")});
}
document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>loadModule(btn.dataset.module)));

function analizarPrompt(){
 const text=document.getElementById("promptInput").value.trim(),resultBox=document.getElementById("resultadoPrompt");
 let score=0,result="";
 if(text.length>=40){score+=2;result+="✅ Tiene una extensión inicial adecuada.<br>"}else result+="⚠ Es demasiado corto. Conviene agregar más información.<br>";
 if(/(redact|resum|explic|compar|analiz|diseñ|cre|correg|gener|elabor)/i.test(text)){score+=2;result+="✅ Tiene un objetivo o acción clara.<br>"}else result+="⚠ Falta una acción clara.<br>";
 if(/para|destinado|dirigido|contexto|alumnos|docentes|familias|usuarios/i.test(text)){score+=2;result+="✅ Incluye contexto o destinatario.<br>"}else result+="⚠ Falta contexto: para quién o para qué se necesita.<br>";
 if(/tabla|lista|informe|guía|paso a paso|formato|html|pdf|presentación|correo/i.test(text)){score+=2;result+="✅ Indica un formato esperado.<br>"}else result+="⚠ No define formato de salida.<br>";
 if(/verific|fuente|actual|norma|valid|cita|no inventes|revis/i.test(text)){score+=2;result+="✅ Incluye criterio de validación o control.<br>"}else result+="⚠ Podés pedir verificación o indicar que no invente fuentes.<br>";
 let label="Básico"; if(score>=8)label="Muy bueno"; else if(score>=5)label="Intermedio";
 resultBox.innerHTML=`<span class="score">Puntaje: ${score}/10 · ${label}</span><br>${result}`;
}
loadModule("inicio");
