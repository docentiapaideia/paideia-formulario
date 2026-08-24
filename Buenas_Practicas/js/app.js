const $ = s => document.querySelector(s);
const cfg = window.PAIDEIA_CONFIG || {};
const supabaseClient = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

let registros = [];
let archivoActual = null;
let hashArchivoActual = null;
let usuarioActual = null;
let origenRegistros = null; // 'SUPABASE' o 'EXCEL'
let idsPendientes = [];

function norm(v){return String(v ?? '').replace(/\s+/g,' ').trim();}
function canon(s){return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function vacio(v){const x=norm(v).toLowerCase();return !x || x==='no informado';}
function emailValidoSimple(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(v));}
function extraerEmails(v){return norm(v).split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean);}
function emailUtilizable(v){const mails=extraerEmails(v);return mails.length>0 && mails.every(emailValidoSimple);}
function extraerUrl(v){
  const texto=norm(v);
  if(!texto)return '';
  const matchHttp=texto.match(/https?:\/\/[^\s]+/i);
  if(matchHttp)return matchHttp[0].replace(/[),.;]+$/,'');
  const regexDominio=/(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/ig;
  let matchDominio;
  while((matchDominio=regexDominio.exec(texto))!==null){
    // Evita interpretar el dominio de una dirección de correo como evidencia web.
    if(matchDominio.index>0 && texto[matchDominio.index-1]==='@')continue;
    return 'https://' + matchDominio[0].replace(/[),.;]+$/,'');
  }
  return '';
}
function urlValida(v){
  const encontrada=extraerUrl(v);
  if(!encontrada)return false;
  try{const u=new URL(encontrada);return ['http:','https:'].includes(u.protocol) && u.hostname.includes('.');}catch{return false;}
}
async function sha(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function esc(s){return norm(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function mapearFila(row, headers, fila){
  const obj={fila_origen:fila};
  headers.forEach((h,i)=>obj[canon(h)]=row[i]);
  const get=(...nombres)=>{for(const n of nombres){const v=obj[canon(n)];if(v!==undefined)return v;}return null;};
  return {
    fila_origen:fila,timestamp_origen:norm(get('Timestamp')),nombre:norm(get('Nombre')),
    email:norm(get('Email','Email ')),institucion:norm(get('Institución','Institucion','Institución ')),
    jurisdiccion:norm(get('Jurisdicción','Jurisdiccion')),nivel:norm(get('Nivel')),area:norm(get('Área','Area')),
    equipo:norm(get('Equipo')),nombres_equipo:norm(get('Nombres equipo')),titulo:norm(get('Título','Titulo')),
    anio:norm(get('Año','Ano')),herramientas:norm(get('Herramientas')),ejes:norm(get('Ejes')),
    descripcion:norm(get('Descripción','Descripcion')),rol_ia:norm(get('Rol IA')),enlace:norm(get('Enlace','Enlace ')),
    p1_proposito:norm(get('P1 Propósito')),p2_por_que_ia:norm(get('P2 Por qué IA')),
    p3_mirada_critica:norm(get('P3 Mirada crítica')),p4_oportunidades:norm(get('P4 Oportunidades')),
    p5_innovacion:norm(get('P5 Innovación')),p6_ajustes:norm(get('P6 Ajustes','P6 Ajustes ')),
    p7_transferencia:norm(get('P7 Transferencia')),estado_origen:norm(get('Estado'))
  };
}

function evaluarRegistro(r){
  const obs=[];
  const obligatorios={
    'Nombre':r.nombre,'Institución':r.institucion,'Jurisdicción':r.jurisdiccion,'Nivel':r.nivel,
    'Área':r.area,'Título':r.titulo,'Año':r.anio,'Herramientas':r.herramientas,'Ejes':r.ejes,
    'Descripción':r.descripcion,'Rol IA':r.rol_ia,'Enlace':r.enlace,'P1 Propósito':r.p1_proposito,
    'P2 Por qué IA':r.p2_por_que_ia,'P3 Mirada crítica':r.p3_mirada_critica,'P4 Oportunidades':r.p4_oportunidades,
    'P5 Innovación':r.p5_innovacion,'P6 Ajustes':r.p6_ajustes,'P7 Transferencia':r.p7_transferencia
  };
  for(const [k,v] of Object.entries(obligatorios))if(vacio(v))obs.push(k);
  if(r.enlace && !urlValida(r.enlace))obs.push('Enlace válido/evidencia verificable');
  if(r.equipo.toLowerCase().startsWith('sí') && vacio(r.nombres_equipo))obs.push('Nombres del equipo');

  const alertasContacto=[];
  if(!r.email)alertasContacto.push('Correo faltante');
  else if(!emailUtilizable(r.email))alertasContacto.push('Correo inválido o requiere corrección');

  return {
    ...r,
    enlace_normalizado:extraerUrl(r.enlace),
    observaciones:[...new Set(obs)],
    alertas_contacto:alertasContacto,
    requiere_revision_manual:alertasContacto.length>0,
    estado_curaduria:obs.length?'OBSERVADO':'APTO'
  };
}

function puntajeCompletitud(r){
  const campos=['nombre','email','institucion','jurisdiccion','nivel','area','titulo','anio','herramientas','ejes','descripcion','rol_ia','enlace','p1_proposito','p2_por_que_ia','p3_mirada_critica','p4_oportunidades','p5_innovacion','p6_ajustes','p7_transferencia'];
  let score=campos.reduce((n,k)=>n+(vacio(r[k])?0:1),0);
  if(urlValida(r.enlace))score+=3;
  if(emailUtilizable(r.email))score+=1;
  return score;
}

function resolverDuplicados(lista){
  const grupos=new Map();
  for(const r of lista){
    const key=canon(r.email)+'|'+canon(r.titulo);
    if(!grupos.has(key))grupos.set(key,[]);
    grupos.get(key).push(r);
  }
  for(const grupo of grupos.values()){
    if(grupo.length<2)continue;
    const ordenado=[...grupo].sort((a,b)=>puntajeCompletitud(b)-puntajeCompletitud(a) || b.fila_origen-a.fila_origen);
    const conservar=ordenado[0];
    for(const r of grupo){
      if(r===conservar)continue;
      r.estado_curaduria='DUPLICADO';
      r.observaciones=[`Carga repetida del mismo correo y título. Se conservó la fila original ${conservar.fila_origen} por ser la más completa.`];
    }
  }
  return lista;
}

async function procesarArchivo(file){
  origenRegistros='EXCEL';
  archivoActual=file;
  const data=await file.arrayBuffer();
  hashArchivoActual=await sha(new Uint8Array(data).join(','));
  const wb=XLSX.read(data,{type:'array'});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false});
  if(rows.length<2)throw new Error('El archivo no contiene registros.');
  const headers=rows[0].map(norm);
  registros=[];
  for(let i=1;i<rows.length;i++){
    if(rows[i].every(v=>v===null||norm(v)===''))continue;
    const r=evaluarRegistro(mapearFila(rows[i],headers,i+1));
    r.clave_registro=await sha([canon(r.email),canon(r.titulo),canon(r.institucion),canon(r.timestamp_origen)].join('|'));
    const contenido={...r};delete contenido.hash_contenido;delete contenido.clave_registro;
    r.hash_contenido=await sha(JSON.stringify(contenido));
    registros.push(r);
  }
  resolverDuplicados(registros);
  mostrar();
  $('#exportar').disabled=false;
  actualizarBotonGuardar();
}


function mapearExperienciaSupabase(e, posicion){
  return {
    id:e.id,
    fila_origen:posicion,
    timestamp_origen:e.fecha_presentacion||e.created_at||'',
    nombre:norm(e.nombre),email:norm(e.email),institucion:norm(e.institucion),
    jurisdiccion:norm(e.jurisdiccion),nivel:norm(e.nivel),area:norm(e.area),
    equipo:norm(e.equipo),nombres_equipo:norm(e.equipo_nombres),titulo:norm(e.titulo),
    anio:norm(e.anio),herramientas:norm(e.herramientas),
    ejes:Array.isArray(e.ejes)?e.ejes.join(', '):norm(e.ejes),
    descripcion:norm(e.descripcion),rol_ia:norm(e.rol_ia),enlace:norm(e.enlace),
    p1_proposito:norm(e.q1),p2_por_que_ia:norm(e.q2),p3_mirada_critica:norm(e.q3),
    p4_oportunidades:norm(e.q4),p5_innovacion:norm(e.q5),p6_ajustes:norm(e.q6),
    p7_transferencia:norm(e.q7),estado_origen:norm(e.estado_presentacion),
    estado_anterior:norm(e.estado_curaduria),updated_at:e.updated_at||'',
    _original:e
  };
}

async function cargarPendientesSupabase(){
  if(!supabaseClient||!usuarioActual)throw new Error('Primero iniciá sesión.');
  $('#estado').className='status';
  $('#estado').textContent='Cargando experiencias nuevas y corregidas…';

  const {data:all,error}=await supabaseClient.from('bp_experiencias')
    .select('*').eq('activo',true).order('updated_at',{ascending:true});
  if(error)throw error;

  const todas=(all||[]).map((e,i)=>evaluarRegistro(mapearExperienciaSupabase(e,i+1)));
  const pendientes=todas.filter(r=>
    r._original.estado_curaduria==='PENDIENTE' ||
    r._original.estado_presentacion==='CORREGIDA'
  );

  // Los duplicados se determinan contra toda la base activa, no solo contra el lote pendiente.
  resolverDuplicados(todas);
  const estadosGlobales=new Map(todas.map(r=>[r.id,r]));
  registros=pendientes.map(r=>estadosGlobales.get(r.id)||r);
  idsPendientes=registros.map(r=>r.id);
  origenRegistros='SUPABASE';
  archivoActual=null;
  hashArchivoActual=null;

  mostrar();
  $('#exportar').disabled=!registros.length;
  $('#aplicarCuraduria').disabled=!registros.length;
  $('#guardarSupabase').disabled=true;
  $('#cambios').textContent=registros.length;

  if(!registros.length){
    $('#resultados').classList.add('hidden');
    $('#estado').className='status ok';
    $('#estado').textContent='No hay experiencias pendientes.';
  }else{
    $('#estado').className='status ok';
    $('#estado').textContent=`Se cargaron ${registros.length} experiencias pendientes.`;
  }
}

async function aplicarCuraduriaSupabase(){
  if(!supabaseClient||!usuarioActual)throw new Error('Primero iniciá sesión.');
  if(origenRegistros!=='SUPABASE'||!registros.length)throw new Error('Primero cargá las experiencias pendientes.');
  const confirmar=confirm(`Se actualizarán ${registros.length} experiencias con el resultado de la curaduría. ¿Continuar?`);
  if(!confirmar)return;

  $('#aplicarCuraduria').disabled=true;
  $('#estado').className='status';
  $('#estado').textContent='Aplicando curaduría…';

  let ok=0;
  const errores=[];
  for(const r of registros){
    const estadoPresentacion = r.estado_curaduria==='APTO' ? 'APTA'
      : r.estado_curaduria==='DUPLICADO' ? 'RECHAZADA' : 'OBSERVADA';
    const detalle=[...r.observaciones,...r.alertas_contacto].join('; ');
    const {error}=await supabaseClient.from('bp_experiencias').update({
      estado_curaduria:r.estado_curaduria,
      estado_presentacion:estadoPresentacion,
      estado_publicacion:'PENDIENTE',
      observaciones_curaduria:detalle||null,
      fecha_curaduria:new Date().toISOString(),
      correo_notificacion_enviado:false
    }).eq('id',r.id);
    if(error)errores.push(`${r.titulo}: ${error.message}`); else ok++;
  }

  if(errores.length){
    $('#estado').className='status error';
    $('#estado').textContent=`Se actualizaron ${ok} registros y hubo ${errores.length} errores. ${errores[0]}`;
    $('#aplicarCuraduria').disabled=false;
    return;
  }

  $('#estado').className='status ok';
  $('#estado').textContent=`Curaduría aplicada correctamente a ${ok} experiencias. Los observados ya están disponibles para la gestión de correos.`;
  registros=[];idsPendientes=[];
  $('#aplicarCuraduria').disabled=true;
  $('#exportar').disabled=true;
  $('#resultados').classList.add('hidden');
}

function registrosFiltrados(){const f=$('#filtroEstado').value;return f==='TODOS'?registros:registros.filter(r=>r.estado_curaduria===f);}
function mostrar(){
  const counts={APTO:0,OBSERVADO:0,DUPLICADO:0};
  registros.forEach(r=>counts[r.estado_curaduria]=(counts[r.estado_curaduria]||0)+1);
  $('#total').textContent=registros.length;
  $('#apto').textContent=counts.APTO||0;
  $('#observado').textContent=counts.OBSERVADO||0;
  $('#duplicado').textContent=counts.DUPLICADO||0;
  $('#correos').textContent=registros.filter(r=>r.estado_curaduria==='OBSERVADO'&&emailUtilizable(r.email)).length;
  $('#tablaBody').innerHTML=registrosFiltrados().map(r=>{
    const detalle=[...r.observaciones,...r.alertas_contacto.map(x=>'Contacto: '+x)].join('; ');
    const ref=origenRegistros==='SUPABASE'?`<span class="source-pill">SUPABASE</span><br><small>${esc(String(r.id||'').slice(0,8))}</small>`:r.fila_origen;
    return `<tr><td>${ref}</td><td>${esc(r.nombre)}</td><td>${esc(r.email)}</td><td>${esc(r.titulo)}</td><td><span class="badge ${r.estado_curaduria}">${r.estado_curaduria}</span></td><td>${esc(detalle)}</td></tr>`;
  }).join('');
  $('#resultados').classList.remove('hidden');
  $('#estado').className='status ok';
  $('#estado').textContent=`Curaduría terminada: ${registros.length} registros procesados.`;
}

async function iniciarSesion(){
  if(!supabaseClient)throw new Error('Falta la configuración del sistema.');
  const email=norm($('#loginEmail').value);const password=$('#loginPassword').value;
  if(!email||!password)throw new Error('Ingresá correo y contraseña.');
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error)throw error;
  usuarioActual=data.user;mostrarSesion();
}
async function cerrarSesion(){if(supabaseClient)await supabaseClient.auth.signOut();usuarioActual=null;mostrarSesion();}
function mostrarSesion(){
  const activo=!!usuarioActual;
  $('#sesionActual').textContent=activo?usuarioActual.email:'Sin sesión';
  $('#cerrarSesion').classList.toggle('hidden',!activo);
  $('#iniciarSesion').classList.toggle('hidden',activo);
  $('#estadoSesion').className='status '+(activo?'ok':'');
  $('#estadoSesion').textContent=activo?'Sesión iniciada.':'Iniciá sesión para continuar.';
  actualizarBotonGuardar();
}
function actualizarBotonGuardar(){
  $('#guardarSupabase').disabled=!(usuarioActual&&registros.length&&archivoActual&&origenRegistros==='EXCEL');
  const cargar=$('#cargarPendientes');if(cargar)cargar.disabled=!usuarioActual;
  const aplicar=$('#aplicarCuraduria');if(aplicar&&origenRegistros!=='SUPABASE')aplicar.disabled=true;
}

function payloadRegistro(r,importacionId){
  return {
    clave_registro:r.clave_registro,fila_origen:r.fila_origen,timestamp_origen:r.timestamp_origen,nombre:r.nombre,email:r.email,
    institucion:r.institucion,jurisdiccion:r.jurisdiccion,nivel:r.nivel,area:r.area,equipo:r.equipo,nombres_equipo:r.nombres_equipo,
    titulo:r.titulo,anio:r.anio,herramientas:r.herramientas,ejes:r.ejes,descripcion:r.descripcion,rol_ia:r.rol_ia,enlace:r.enlace,
    p1_proposito:r.p1_proposito,p2_por_que_ia:r.p2_por_que_ia,p3_mirada_critica:r.p3_mirada_critica,p4_oportunidades:r.p4_oportunidades,
    p5_innovacion:r.p5_innovacion,p6_ajustes:r.p6_ajustes,p7_transferencia:r.p7_transferencia,estado_origen:r.estado_origen,
    estado_curaduria:r.estado_curaduria,observaciones:[...r.observaciones,...r.alertas_contacto],requiere_revision_manual:r.requiere_revision_manual,
    hash_contenido:r.hash_contenido,ultima_importacion_id:importacionId,fecha_ultima_revision:new Date().toISOString(),activo:true
  };
}

async function guardarEnSupabase(){
  if(!supabaseClient||!usuarioActual)throw new Error('Primero iniciá sesión.');
  if(!registros.length)throw new Error('Primero cargá un archivo.');
  $('#guardarSupabase').disabled=true;
  $('#estado').className='status';$('#estado').textContent='Comparando y guardando la importación…';

  const {data:existentes,error:errorExistentes}=await supabaseClient.from('bp_registros').select('id,clave_registro,hash_contenido,estado_curaduria,primera_importacion_id');
  if(errorExistentes)throw errorExistentes;
  const mapa=new Map((existentes||[]).map(x=>[x.clave_registro,x]));
  let nuevos=0,actualizados=0,sinCambios=0;
  for(const r of registros){const e=mapa.get(r.clave_registro);if(!e)nuevos++;else if(e.hash_contenido!==r.hash_contenido)actualizados++;else sinCambios++;}

  const resumen={APTO:registros.filter(r=>r.estado_curaduria==='APTO').length,OBSERVADO:registros.filter(r=>r.estado_curaduria==='OBSERVADO').length,DUPLICADO:registros.filter(r=>r.estado_curaduria==='DUPLICADO').length};
  const {data:imp,error:errorImp}=await supabaseClient.from('bp_importaciones').insert({
    nombre_archivo:archivoActual.name,hash_archivo:hashArchivoActual,total_registros:registros.length,nuevos,actualizados,sin_cambios:sinCambios,
    errores:0,usuario_id:usuarioActual.id,resumen
  }).select('id').single();
  if(errorImp)throw errorImp;

  const lote=registros.map(r=>{
    const p=payloadRegistro(r,imp.id);const e=mapa.get(r.clave_registro);
    if(!e){p.primera_importacion_id=imp.id;p.fecha_primera_revision=new Date().toISOString();}
    return p;
  });
  const {data:guardados,error:errorUpsert}=await supabaseClient.from('bp_registros').upsert(lote,{onConflict:'clave_registro'}).select('id,clave_registro,estado_curaduria');
  if(errorUpsert)throw errorUpsert;

  const guardadosMapa=new Map((guardados||[]).map(x=>[x.clave_registro,x]));
  const historial=[];
  for(const r of registros){
    const e=mapa.get(r.clave_registro);const g=guardadosMapa.get(r.clave_registro);
    if(!g)continue;
    if(!e)historial.push({registro_id:g.id,importacion_id:imp.id,usuario_id:usuarioActual.id,accion:'REGISTRO_NUEVO',estado_nuevo:r.estado_curaduria,detalle:{fila:r.fila_origen}});
    else if(e.hash_contenido!==r.hash_contenido)historial.push({registro_id:g.id,importacion_id:imp.id,usuario_id:usuarioActual.id,accion:'REGISTRO_ACTUALIZADO',estado_anterior:e.estado_curaduria,estado_nuevo:r.estado_curaduria,detalle:{fila:r.fila_origen}});
  }
  if(historial.length){const {error:errorHist}=await supabaseClient.from('bp_historial').insert(historial);if(errorHist)throw errorHist;}

  $('#cambios').textContent=nuevos+actualizados;
  $('#estado').className='status ok';
  $('#estado').textContent=`Importación guardada: ${nuevos} nuevos, ${actualizados} actualizados y ${sinCambios} sin cambios.`;
  actualizarBotonGuardar();
}

function exportarResultado(){
  const wb=XLSX.utils.book_new();
  const resumen=[['Indicador','Cantidad'],['Registros originales',registros.length],['Registros aptos',registros.filter(r=>r.estado_curaduria==='APTO').length],['Registros observados',registros.filter(r=>r.estado_curaduria==='OBSERVADO').length],['Duplicados descartados',registros.filter(r=>r.estado_curaduria==='DUPLICADO').length]];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(resumen),'Resumen curaduría');
  const preparar=lista=>lista.map(r=>({
    Timestamp:r.timestamp_origen,Nombre:r.nombre,Email:r.email,'Institución':r.institucion,'Jurisdicción':r.jurisdiccion,Nivel:r.nivel,'Área':r.area,
    Equipo:r.equipo,'Nombres equipo':r.nombres_equipo,'Título':r.titulo,'Año':r.anio,Herramientas:r.herramientas,Ejes:r.ejes,'Descripción':r.descripcion,
    'Rol IA':r.rol_ia,Enlace:r.enlace,'P1 Propósito':r.p1_proposito,'P2 Por qué IA':r.p2_por_que_ia,'P3 Mirada crítica':r.p3_mirada_critica,
    'P4 Oportunidades':r.p4_oportunidades,'P5 Innovación':r.p5_innovacion,'P6 Ajustes':r.p6_ajustes,'P7 Transferencia':r.p7_transferencia,
    Estado:r.estado_origen,'Fila original':r.fila_origen,'Resultado de curaduría':r.estado_curaduria,'Observaciones':[...r.observaciones,...r.alertas_contacto].join('; ')
  }));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(preparar(registros.filter(r=>r.estado_curaduria==='APTO'))),'Registros curados');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(preparar(registros.filter(r=>r.estado_curaduria==='OBSERVADO'))),'Observados incompletos');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(preparar(registros.filter(r=>r.estado_curaduria==='DUPLICADO'))),'Duplicados descartados');
  XLSX.writeFile(wb,'Buenas_Practicas_Curadas_App.xlsx');
}

$('#cargarPendientes').addEventListener('click',async()=>{try{await cargarPendientesSupabase();}catch(err){$('#estado').className='status error';$('#estado').textContent='Error: '+err.message;}});
$('#aplicarCuraduria').addEventListener('click',async()=>{try{await aplicarCuraduriaSupabase();}catch(err){$('#estado').className='status error';$('#estado').textContent='Error: '+err.message;$('#aplicarCuraduria').disabled=false;}});
$('#archivo').addEventListener('change',async e=>{try{origenRegistros='EXCEL';$('#estado').className='status';$('#estado').textContent='Procesando archivo…';await procesarArchivo(e.target.files[0]);}catch(err){$('#estado').className='status error';$('#estado').textContent='Error: '+err.message;}});
$('#exportar').addEventListener('click',exportarResultado);
$('#guardarSupabase').addEventListener('click',async()=>{try{await guardarEnSupabase();}catch(err){$('#estado').className='status error';$('#estado').textContent='Error al guardar: '+err.message;actualizarBotonGuardar();}});
$('#filtroEstado').addEventListener('change',mostrar);
$('#iniciarSesion').addEventListener('click',async()=>{try{await iniciarSesion();}catch(err){$('#estadoSesion').className='status error';$('#estadoSesion').textContent='Error de acceso: '+err.message;}});
$('#cerrarSesion').addEventListener('click',cerrarSesion);

(async()=>{if(supabaseClient){const {data}=await supabaseClient.auth.getSession();usuarioActual=data.session?.user||null;}mostrarSesion();})();

// ===== Gestión de correos =====
let registrosCorreo = [];
let seleccionCorreos = new Set();

function observacionCorreo(r){
  const obs=Array.isArray(r.observaciones)
    ? r.observaciones
    : (r.observaciones?[String(r.observaciones)]:[]);
  return obs.filter(x=>!String(x).toLowerCase().startsWith('correo ')).join('; ') || 'La presentación requiere completar o corregir información.';
}
function estadoUltimoCorreo(r){
  if(!r.ultimo_correo)return 'PENDIENTE';
  return r.ultimo_correo.estado||'PENDIENTE';
}
function fechaLegible(v){
  if(!v)return 'Sin envío';
  try{return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch{return v;}
}
function construirAsunto(){return 'Solicitud de regularización de evidencia – Buenas Prácticas PAIDEIA';}
function construirCuerpo(r){
  const nombre=norm(r.nombre)||'participante';
  const titulo=norm(r.titulo)||'la experiencia presentada';
  const detalle=observacionCorreo(r);
  return `Hola, ${nombre}:\n\nNos comunicamos desde el Programa PAIDEIA en relación con la experiencia presentada bajo el título “${titulo}”.\n\nDurante el proceso de revisión y curaduría se detectó la siguiente situación:\n\n${detalle}\n\nPara poder continuar con la evaluación de la propuesta, necesitamos que complete o corrija la información señalada. En caso de haber incorporado un enlace de Google Drive, asegúrese de que el archivo o la carpeta estén configurados con acceso para cualquier persona que posea el enlace.\n\nIngresá nuevamente al portal, abrí “Mis experiencias” y editá la misma presentación. Al guardar, volverá automáticamente a la cola de curaduría.\n\nAgradecemos su participación y el trabajo realizado.\n\nSaludos cordiales,\nEquipo PAIDEIA`;
}

async function cargarRegistrosCorreo(){
  if(!supabaseClient||!usuarioActual)throw new Error('Primero iniciá sesión.');
  $('#estadoCorreos').className='status';
  $('#estadoCorreos').textContent='Buscando experiencias observadas…';

  // Las presentaciones nuevas viven en bp_experiencias, mientras que las
  // importaciones históricas del Excel se guardan en bp_registros. La bandeja
  // debe reunir ambos orígenes para no mostrar cero cuando la curaduría visible
  // proviene de una importación.
  const {data:experiencias,error:errorExperiencias}=await supabaseClient.from('bp_experiencias')
    .select('id,nombre,email,institucion,jurisdiccion,titulo,observaciones_curaduria,estado_curaduria,updated_at,correo_notificacion_enviado,fecha_ultimo_correo')
    .eq('activo',true).eq('estado_curaduria','OBSERVADO').order('nombre');
  if(errorExperiencias)throw errorExperiencias;

  const {data:importados,error:errorImportados}=await supabaseClient.from('bp_registros')
    .select('*').eq('activo',true).eq('estado_curaduria','OBSERVADO').order('nombre');
  if(errorImportados)throw errorImportados;

  const desdeExperiencias=(experiencias||[]).map(r=>({
    ...r,
    origen_tabla:'bp_experiencias',
    observaciones:r.observaciones_curaduria?[r.observaciones_curaduria]:[],
    ultimo_correo:r.correo_notificacion_enviado?{
      estado:'ENVIADO',fecha_envio:r.fecha_ultimo_correo
    }:null
  }));
  const desdeImportados=(importados||[]).map(r=>({
    ...r,
    origen_tabla:'bp_registros',
    observaciones:Array.isArray(r.observaciones)
      ? r.observaciones
      : (r.observaciones?[String(r.observaciones)]:[]),
    ultimo_correo:r.correo_notificacion_enviado?{
      estado:'ENVIADO',fecha_envio:r.fecha_ultimo_correo
    }:null
  }));
  registrosCorreo=[...desdeExperiencias,...desdeImportados];
  seleccionCorreos.clear();
  mostrarCorreos();
  $('#estadoCorreos').className='status ok';
  $('#estadoCorreos').textContent=`Se cargaron ${registrosCorreo.length} experiencias observadas (${desdeExperiencias.length} presentadas en línea y ${desdeImportados.length} importadas).`;
}
function correosFiltrados(){
  const filtro=$('#filtroCorreo').value;
  const q=canon($('#buscarCorreo').value);
  return registrosCorreo.filter(r=>{
    const estado=estadoUltimoCorreo(r);
    const coincideEstado=filtro==='TODOS'||estado===filtro;
    const texto=canon([r.nombre,r.email,r.institucion,r.titulo,observacionCorreo(r)].join(' '));
    return coincideEstado&&(!q||texto.includes(q));
  });
}
function mostrarCorreos(){
  const visibles=correosFiltrados();
  $('#tablaCorreosBody').innerHTML=visibles.length?visibles.map(r=>{
    const estado=estadoUltimoCorreo(r);
    const valido=emailUtilizable(r.email);
    const checked=seleccionCorreos.has(r.id)?'checked':'';
    const disabled=!valido||estado==='ENVIADO'?'disabled':'';
    const clase=disabled?'row-disabled':'';
    const envio=r.ultimo_correo?`${estado} · ${fechaLegible(r.ultimo_correo.fecha_envio||r.ultimo_correo.fecha_creacion)}`:'PENDIENTE';
    return `<tr class="${clase}"><td class="checkbox-cell"><input class="mail-check" type="checkbox" data-id="${r.id}" ${checked} ${disabled}></td><td>${esc(r.nombre)}</td><td>${esc(r.email)}${valido?'':'<br><small class="muted">Correo no utilizable</small>'}</td><td>${esc(r.titulo)}</td><td>${esc(observacionCorreo(r))}</td><td><span class="mail-status ${estado}">${esc(envio)}</span>${r.ultimo_correo?.error?`<br><small>${esc(r.ultimo_correo.error)}</small>`:''}</td></tr>`;
  }).join(''):'<tr><td colspan="6" class="muted">No hay registros para este filtro.</td></tr>';
  document.querySelectorAll('.mail-check').forEach(c=>c.addEventListener('change',e=>{
    const id=e.target.dataset.id;
    if(e.target.checked)seleccionCorreos.add(id);else seleccionCorreos.delete(id);
    actualizarBotonesCorreo();
  }));
  actualizarBotonesCorreo();
}
function actualizarBotonesCorreo(){
  const activo=!!usuarioActual;
  $('#cargarCorreos').disabled=!activo;
  $('#seleccionarVisibles').disabled=!activo||!registrosCorreo.length;
  $('#limpiarSeleccion').disabled=!seleccionCorreos.size;
  $('#previsualizarCorreo').disabled=!seleccionCorreos.size;
}
function seleccionarVisibles(){
  for(const r of correosFiltrados()){
    if(emailUtilizable(r.email)&&estadoUltimoCorreo(r)!=='ENVIADO')seleccionCorreos.add(r.id);
  }
  mostrarCorreos();
}
let referentesCorreoCache=null;

async function cargarReferentesCorreo(){
  if(Array.isArray(referentesCorreoCache))return referentesCorreoCache;
  const {data,error}=await supabaseClient.from('contacts')
    .select('email,full_name,jurisdiccion');
  if(error){
    console.error('No se pudo cargar la base de referentes jurisdiccionales:',error);
    throw new Error('No se pudo consultar el correo del referente jurisdiccional.');
  }
  referentesCorreoCache=(data||[]).filter(c=>emailUtilizable(c.email));
  return referentesCorreoCache;
}

async function destinatariosDeExperiencia(r){
  const principales=extraerEmails(r.email);
  const jurisdiccion=canon(r.jurisdiccion);
  let referentes=[];
  if(jurisdiccion){
    const contactos=await cargarReferentesCorreo();
    referentes=contactos
      .filter(c=>canon(c.jurisdiccion)===jurisdiccion)
      .flatMap(c=>extraerEmails(c.email));
  }
  const todos=[...principales,...referentes]
    .map(x=>x.trim())
    .filter(emailValidoSimple);
  return [...new Map(todos.map(x=>[x.toLowerCase(),x])).values()];
}

async function resumenDestinatarios(r){
  const todos=await destinatariosDeExperiencia(r);
  const principales=extraerEmails(r.email).map(x=>x.toLowerCase());
  const referentes=todos.filter(x=>!principales.includes(x.toLowerCase()));
  const principal=`Destinatario principal: ${r.nombre} <${extraerEmails(r.email).join(', ')}>`;
  const ref=referentes.length
    ? `Referente jurisdiccional: ${referentes.join(', ')}`
    : `Referente jurisdiccional: sin correo encontrado para ${r.jurisdiccion||'la jurisdicción indicada'}`;
  return `${principal} · ${ref}`;
}

async function abrirPrevisualizacion(){
  const elegidos=registrosCorreo.filter(r=>seleccionCorreos.has(r.id));
  if(!elegidos.length)return;
  const primero=elegidos[0];
  $('#correoAsunto').value=construirAsunto();
  $('#correoCuerpo').value=construirCuerpo(primero);
  try{
    $('#resumenSeleccion').textContent=elegidos.length===1
      ? await resumenDestinatarios(primero)
      : `${elegidos.length} experiencias seleccionadas. Cada informe se enviará al correo de la experiencia y también al/los referente(s) de su jurisdicción.`;
  }catch(err){
    $('#resumenSeleccion').textContent=`Destinatario principal: ${primero.nombre} <${primero.email}> · No se pudo consultar el referente jurisdiccional.`;
    console.error(err);
  }
  $('#estadoEnvio').className='status';
  $('#estadoEnvio').textContent='Revisá el contenido antes de enviar.';
  $('#modalCorreo').showModal();
}
async function enviarUnCorreo(r,asuntoBase,cuerpoEditado,esMultiple){
  const asunto=asuntoBase;
  const cuerpo=esMultiple?construirCuerpo(r):cuerpoEditado;
  const destinatarios=await destinatariosDeExperiencia(r);
  if(!destinatarios.length)throw new Error('La experiencia no tiene destinatarios válidos.');
  const {data,error}=await supabaseClient.functions.invoke('enviar-correo',{body:{
    experiencia_id:r.id,registro_id:r.id,origen:r.origen_tabla,
    destinatario:destinatarios.join(','),asunto,cuerpo,tipo:'OBSERVACION'
  }});
  if(error)throw new Error(error.message||'Falló la Edge Function.');
  if(data?.error)throw new Error(data.error);
  return data;
}
async function enviarSeleccionados(){
  const elegidos=registrosCorreo.filter(r=>seleccionCorreos.has(r.id));
  if(!elegidos.length)return;
  const confirmacion=confirm(`Se enviarán ${elegidos.length} correo(s) reales desde docentiapaideia@gmail.com. ¿Continuar?`);
  if(!confirmacion)return;
  $('#enviarSeleccionados').disabled=true;
  const asunto=norm($('#correoAsunto').value);
  const cuerpo=$('#correoCuerpo').value.trim();
  if(!asunto||!cuerpo){alert('El asunto y el cuerpo no pueden estar vacíos.');$('#enviarSeleccionados').disabled=false;return;}
  let enviados=0,errores=0;
  for(let i=0;i<elegidos.length;i++){
    const r=elegidos[i];
    $('#estadoEnvio').className='status';
    $('#estadoEnvio').textContent=`Enviando ${i+1} de ${elegidos.length}: ${r.nombre}…`;
    try{
      await enviarUnCorreo(r,asunto,cuerpo,elegidos.length>1);
      const tabla=r.origen_tabla==='bp_registros'?'bp_registros':'bp_experiencias';
      await supabaseClient.from(tabla).update({correo_notificacion_enviado:true,fecha_ultimo_correo:new Date().toISOString()}).eq('id',r.id);
      enviados++;
    }
    catch(err){errores++;console.error('Error enviando a',r.email,err);}
  }
  $('#estadoEnvio').className='status '+(errores?'error':'ok');
  $('#estadoEnvio').textContent=`Proceso terminado: ${enviados} enviados y ${errores} con error.`;
  $('#enviarSeleccionados').disabled=false;
  seleccionCorreos.clear();
  await cargarRegistrosCorreo();
}

$('#cargarCorreos').addEventListener('click',async()=>{try{await cargarRegistrosCorreo();}catch(err){ $('#estadoCorreos').className='status error';$('#estadoCorreos').textContent='Error: '+err.message; }});
$('#filtroCorreo').addEventListener('change',mostrarCorreos);
$('#buscarCorreo').addEventListener('input',mostrarCorreos);
$('#seleccionarVisibles').addEventListener('click',seleccionarVisibles);
$('#limpiarSeleccion').addEventListener('click',()=>{seleccionCorreos.clear();mostrarCorreos();});
$('#previsualizarCorreo').addEventListener('click',abrirPrevisualizacion);
$('#enviarSeleccionados').addEventListener('click',enviarSeleccionados);

const mostrarSesionOriginal=mostrarSesion;
mostrarSesion=function(){mostrarSesionOriginal();actualizarBotonesCorreo();if(!usuarioActual){registrosCorreo=[];seleccionCorreos.clear();mostrarCorreos();}};
actualizarBotonesCorreo();
