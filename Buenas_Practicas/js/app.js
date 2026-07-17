const $ = s => document.querySelector(s);
const cfg = window.PAIDEIA_CONFIG || {};
const supabaseClient = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

let registros = [];
let archivoActual = null;
let hashArchivoActual = null;
let usuarioActual = null;

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
  const matchDominio=texto.match(/(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/i);
  return matchDominio ? ('https://' + matchDominio[0].replace(/[),.;]+$/,'')) : '';
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
    return `<tr><td>${r.fila_origen}</td><td>${esc(r.nombre)}</td><td>${esc(r.email)}</td><td>${esc(r.titulo)}</td><td><span class="badge ${r.estado_curaduria}">${r.estado_curaduria}</span></td><td>${esc(detalle)}</td></tr>`;
  }).join('');
  $('#resultados').classList.remove('hidden');
  $('#estado').className='status ok';
  $('#estado').textContent=`Curaduría terminada: ${registros.length} registros procesados.`;
}

async function iniciarSesion(){
  if(!supabaseClient)throw new Error('Falta la configuración de Supabase.');
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
  $('#estadoSesion').textContent=activo?'Sesión iniciada. Ya podés guardar importaciones en Supabase.':'Podés curar y exportar sin iniciar sesión. Para guardar en Supabase, el acceso es obligatorio.';
  actualizarBotonGuardar();
}
function actualizarBotonGuardar(){$('#guardarSupabase').disabled=!(usuarioActual&&registros.length&&archivoActual);}

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

$('#archivo').addEventListener('change',async e=>{try{$('#estado').className='status';$('#estado').textContent='Procesando archivo…';await procesarArchivo(e.target.files[0]);}catch(err){$('#estado').className='status error';$('#estado').textContent='Error: '+err.message;}});
$('#exportar').addEventListener('click',exportarResultado);
$('#guardarSupabase').addEventListener('click',async()=>{try{await guardarEnSupabase();}catch(err){$('#estado').className='status error';$('#estado').textContent='Error al guardar: '+err.message;actualizarBotonGuardar();}});
$('#filtroEstado').addEventListener('change',mostrar);
$('#iniciarSesion').addEventListener('click',async()=>{try{await iniciarSesion();}catch(err){$('#estadoSesion').className='status error';$('#estadoSesion').textContent='Error de acceso: '+err.message;}});
$('#cerrarSesion').addEventListener('click',cerrarSesion);

(async()=>{if(supabaseClient){const {data}=await supabaseClient.auth.getSession();usuarioActual=data.session?.user||null;}mostrarSesion();})();
