const $ = s => document.querySelector(s);
let registros = [];

const campos = [
  'Timestamp','Nombre','Email','Institución','Jurisdicción','Nivel','Área','Equipo','Nombres equipo','Título','Año','Herramientas','Ejes','Descripción','Rol IA','Enlace','P1 Propósito','P2 Por qué IA','P3 Mirada crítica','P4 Oportunidades','P5 Innovación','P6 Ajustes','P7 Transferencia','Estado'
];

function norm(v){return String(v ?? '').replace(/\s+/g,' ').trim();}
function canon(s){return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function vacio(v){const x=norm(v).toLowerCase();return !x || ['no informado','ninguna','ninguno','no corresponde','-','..','...','.'].includes(x);}
function emailValido(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(v));}
function urlValida(v){try{const u=new URL(norm(v));return ['http:','https:'].includes(u.protocol);}catch{return false;}}
async function sha(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}

function mapearFila(row, headers, fila){
  const obj={fila_origen:fila};
  headers.forEach((h,i)=>obj[canon(h)]=row[i]);
  const get = (...nombres) => {for(const n of nombres){const v=obj[canon(n)];if(v!==undefined)return v;}return null};
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

function curar(r, vistos){
  const obs=[];
  const obligatorios={
    'Nombre':r.nombre,'Email':r.email,'Institución':r.institucion,'Jurisdicción':r.jurisdiccion,'Nivel':r.nivel,
    'Área':r.area,'Título':r.titulo,'Año':r.anio,'Herramientas':r.herramientas,'Ejes':r.ejes,
    'Descripción':r.descripcion,'Rol IA':r.rol_ia,'Enlace':r.enlace,'P1 Propósito':r.p1_proposito,
    'P2 Por qué IA':r.p2_por_que_ia,'P3 Mirada crítica':r.p3_mirada_critica,'P4 Oportunidades':r.p4_oportunidades,
    'P5 Innovación':r.p5_innovacion,'P6 Ajustes':r.p6_ajustes,'P7 Transferencia':r.p7_transferencia
  };
  for(const [k,v] of Object.entries(obligatorios)) if(vacio(v)) obs.push(k);
  if(r.email && !emailValido(r.email)) obs.push('Correo inválido');
  if(r.enlace && !urlValida(r.enlace)) obs.push('Enlace válido/evidencia verificable');
  if(r.equipo.toLowerCase().startsWith('sí') && vacio(r.nombres_equipo)) obs.push('Nombres del equipo');
  const dupKey=canon(r.email)+'|'+canon(r.titulo)+'|'+canon(r.institucion);
  const duplicado=vistos.has(dupKey); vistos.add(dupKey);
  let estado=duplicado?'DUPLICADO':obs.length?'OBSERVADO':'APTO';
  return {...r,estado_curaduria:estado,observaciones:[...new Set(obs)],requiere_revision_manual:obs.includes('Correo inválido')};
}

async function procesarArchivo(file){
  const data=await file.arrayBuffer();
  const wb=XLSX.read(data,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  if(rows.length<2) throw new Error('El archivo no contiene registros.');
  const headers=rows[0].map(norm); const vistos=new Set();
  registros=[];
  for(let i=1;i<rows.length;i++){
    if(rows[i].every(v=>v===null||norm(v)===''))continue;
    let r=curar(mapearFila(rows[i],headers,i+1),vistos);
    r.clave_registro=await sha([canon(r.email),canon(r.titulo),canon(r.institucion),canon(r.timestamp_origen)].join('|'));
    r.hash_contenido=await sha(JSON.stringify(r)); registros.push(r);
  }
  mostrar();
}

function mostrar(){
  const counts={APTO:0,OBSERVADO:0,DUPLICADO:0,PENDIENTE:0}; registros.forEach(r=>counts[r.estado_curaduria]++);
  $('#total').textContent=registros.length; Object.keys(counts).forEach(k=>$('#'+k.toLowerCase()).textContent=counts[k]);
  $('#correos').textContent=registros.filter(r=>r.estado_curaduria==='OBSERVADO'&&emailValido(r.email)).length;
  $('#tablaBody').innerHTML=registros.map(r=>`<tr><td>${r.fila_origen}</td><td>${esc(r.nombre)}</td><td>${esc(r.email)}</td><td>${esc(r.titulo)}</td><td><span class="badge ${r.estado_curaduria}">${r.estado_curaduria}</span></td><td>${esc(r.observaciones.join('; '))}</td></tr>`).join('');
  $('#resultados').classList.remove('hidden'); $('#estado').textContent=`Curaduría terminada: ${registros.length} registros procesados.`;
}
function esc(s){return norm(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

$('#archivo').addEventListener('change',async e=>{try{$('#estado').textContent='Procesando archivo…';await procesarArchivo(e.target.files[0]);}catch(err){$('#estado').textContent='Error: '+err.message;}});
$('#exportar').addEventListener('click',()=>{
  const rows=registros.map(r=>({...r,observaciones:r.observaciones.join('; ')}));
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Curaduría'); XLSX.writeFile(wb,'Buenas_Practicas_Curadas_App.xlsx');
});
