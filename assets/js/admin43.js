/* Administración 4.3: interfaz integrada, sin dependencias nuevas. */
(() => {
  const base = `https://${CONFIG.API_URL_BASE}`;
  const el = id => document.getElementById(id);
  const state = { token: sessionStorage.getItem('iot43_token') || '', guest: '', perfil: null,
                  flota: [], modelos: [], usuarios: [], vehiculos: [], demos: [] };
  const msg = (txt, error=false) => { const e=el('admin-msg');e.textContent=txt;e.style.color=error?'#b42335':'#256c47'; };
  const val = id => el(id)?.value?.trim() || '';
  const safe = v => String(v ?? '—');
  const opt = (value,label) => { const o=document.createElement('option');o.value=value;o.textContent=label;return o; };
  function updateSelect(id, values, blankLabel, labelFn) {
    const s=el(id);s.replaceChildren(opt('',blankLabel));values.forEach(v=>s.append(opt(v.id, labelFn(v))));
  }
  async function api(path,method='GET',body,guest=false) {
    const headers={};if(body !== undefined)headers['Content-Type']='application/json';
    if(state.token && !guest)headers['Authorization']=`Bearer ${state.token}`;
    if(guest && state.guest)headers['X-Guest-Token']=state.guest;
    const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    let data;try{data=await r.json()}catch{data={detail:'Respuesta no válida del servidor'};}
    if(!r.ok)throw new Error(typeof data.detail==='string'?data.detail:`Error HTTP ${r.status}`);
    return data;
  }
  async function fetchAll(){
    state.usuarios=await api('/api/admin/usuarios');
    state.modelos=await api('/api/admin/modelos');
    state.vehiculos=await api('/api/admin/vehiculos');
    state.demos=await api('/api/admin/demos');
    renderData();
  }
  function fillTable(id, headings, rows, fn) {
    const tbl=el(id);tbl.replaceChildren();
    const thead=document.createElement('thead'),tr=document.createElement('tr');
    headings.forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th)});thead.append(tr);tbl.append(thead);
    const tbody=document.createElement('tbody');rows.forEach(row=>{const tr=document.createElement('tr');fn(row).forEach(text=>{
      const td=document.createElement('td');td.textContent=safe(text);tr.append(td);
    });tbody.append(tr);});tbl.append(tbody);
  }
  function renderData(){
    fillTable('adm-tabla-usuarios',['ID','Nombre','Correo','Rol','Activo'],state.usuarios,
      u=>[u.id_usuario,u.nombre,u.correo,u.rol,u.activo?'Sí':'No']);
    fillTable('adm-tabla-modelos',['ID','Modelo','Descripción','Activo'],state.modelos,
      m=>[m.id_modelo,m.nombre,m.descripcion,m.activo?'Sí':'No']);
    fillTable('adm-tabla-vehiculos',['ID','Unidad','Modelo','Propietario','Estado','Serie'],state.vehiculos,
      v=>[v.id_vehiculo,v.nombre,v.nombre_modelo,v.propietario,v.estado_comercial,v.numero_serie]);
    fillTable('adm-tabla-demos',['ID','Nombre','Vehículo','Tipo'],state.demos,
      d=>[d.id_demo,d.nombre,d.id_vehiculo,d.tipo_demo]);
    updateSelect('adm-vehiculo',state.vehiculos.map(v=>({id:v.id_vehiculo,nombre:`#${v.id_vehiculo} ${v.nombre}`})),'Seleccionar unidad',v=>v.nombre);
    updateSelect('adm-modelo',state.modelos.map(m=>({id:m.id_modelo,nombre:m.nombre})),'Sin modelo',m=>m.nombre);
    updateSelect('adm-propietario',state.usuarios.filter(u=>u.rol==='USUARIO'&&u.activo).map(u=>({id:u.id_usuario,nombre:u.nombre})),'Sin propietario',u=>u.nombre);
    updateSelect('adm-crear-demo-unidad',state.vehiculos.map(v=>({id:v.id_vehiculo,nombre:v.nombre})),'Seleccionar unidad',v=>v.nombre);
    updateSelect('adm-mov-demo-id',state.demos.map(d=>({id:d.id_demo,nombre:d.nombre})),'Seleccionar demo',d=>d.nombre);
    updateSelect('adm-demo',state.demos.map(d=>({id:d.id_demo,nombre:d.nombre})),'Seleccionar demo',d=>d.nombre);
    updateSelect('adm-edit-usuario',state.usuarios.filter(u=>u.rol==='USUARIO').map(u=>({id:u.id_usuario,nombre:u.nombre})),'Seleccionar comprador',u=>u.nombre);
    updateSelect('adm-edit-modelo',state.modelos.map(m=>({id:m.id_modelo,nombre:m.nombre})),'Seleccionar modelo',m=>m.nombre);
  }
  function view(tab){
    for(const [btn,section] of [['tab-control','view-control'],['tab-monitoreo','view-monitoreo'],['tab-administracion','view-administracion']]){
      el(btn).classList.toggle('active',btn===tab);el(section).style.display=btn===tab?'flex':'none';
    }
    if(tab==='tab-administracion'&&state.perfil?.rol==='ADMINISTRADOR')fetchAll().catch(e=>msg(e.message,true));
  }
  function redraw(){
    const rol=state.perfil?.rol;
    el('admin-identidad').textContent=rol?`${state.perfil.nombre} · ${rol}`:(state.guest?'INVITADO · reserva temporal':'Sin sesión');
    el('admin-login').hidden=!!rol;
    el('admin-logout').hidden=!rol;
    el('admin-panel').hidden=rol!=='ADMINISTRADOR';
    el('admin-flota').hidden=!rol||rol==='ADMINISTRADOR';
    el('admin-invitado').hidden=!!rol;
    el('tab-administracion').hidden=false;
    const permitido=!!rol&&(rol==='ADMINISTRADOR'||state.flota.some(v=>Number(v.id_vehiculo)===Number(CONFIG.VEHICULO_ID)));
    el('admin-aviso-control').textContent=permitido?'Control habilitado para su cuenta.':'Control manual: requiere administrador o propietario del vehículo.';
    el('admin-aviso-control').hidden=permitido;
    for (const id of ['btn-foco','btn-sonido','btn-velocidad','btn-detener']) el(id).disabled=!permitido;
    el('btn-play-demo').disabled=!(permitido||state.guest);
    el('admin-mi-flota').textContent=state.flota.length?state.flota.map(v=>`#${v.id_vehiculo} ${v.nombre}`).join(' · '):'No hay vehículos asignados';
  }
  async function loadMe(){
    if(!state.token){state.perfil=null;state.flota=[];redraw();return;}
    try {state.perfil=await api('/api/auth/me');state.flota=await api('/api/admin/mi-flota');}
    catch(e){state.token='';sessionStorage.removeItem('iot43_token');state.perfil=null;state.flota=[];msg(e.message,true);}
    redraw();
  }
  const run = async (f) => {try{await f();}catch(e){msg(e.message,true);}};
  el('tab-administracion').addEventListener('click',()=>view('tab-administracion'));
  // Unificar la navegación del SPA existente
  for(const tab of ['tab-control','tab-monitoreo'])el(tab).addEventListener('click',()=>view(tab));
  el('adm-login-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const result=await api('/api/auth/login','POST',{correo:val('adm-correo'),password:el('adm-password').value});
    state.token=result.token;sessionStorage.setItem('iot43_token',result.token);
    el('adm-password').value='';await loadMe();msg('Sesión iniciada correctamente.');
  });});
  el('admin-logout').addEventListener('click',()=>run(async()=>{
    await api('/api/auth/logout','POST');state.token='';sessionStorage.removeItem('iot43_token');
    await loadMe();msg('Sesión cerrada.');
  }));
  el('adm-crear-usuario').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    await api('/api/admin/usuarios','POST',{nombre:val('adm-nombre-usuario'),correo:val('adm-correo-usuario'),
      password:el('adm-clave-usuario').value,rol:'USUARIO'});
    el('adm-clave-usuario').value='';await fetchAll();msg('Comprador registrado.');
  });});
  el('adm-editar-usuario').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const id=Number(val('adm-edit-usuario'));const u=state.usuarios.find(x=>x.id_usuario===id);
    if(!u)throw Error('Seleccione un comprador.');
    await api(`/api/admin/usuarios/${id}`,'PATCH',{nombre:val('adm-edit-nombre')||u.nombre,activo:el('adm-edit-activo').checked});
    await fetchAll();msg('Comprador actualizado.');
  });});
  el('adm-crear-modelo').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    let capacidades={};const c=val('adm-capacidades');if(c)capacidades=JSON.parse(c);
    await api('/api/admin/modelos','POST',{nombre:val('adm-nombre-modelo'),descripcion:val('adm-desc-modelo'),capacidades});
    await fetchAll();msg('Modelo registrado.');
  });});
  el('adm-editar-modelo').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const id=Number(val('adm-edit-modelo'));const anterior=state.modelos.find(m=>m.id_modelo===id);
    if(!anterior)throw Error('Seleccione un modelo.');
    await api(`/api/admin/modelos/${id}`,'PUT',{
      nombre:val('adm-edit-nombre-modelo')||anterior.nombre,
      descripcion:val('adm-edit-desc-modelo')||anterior.descripcion||'',
      capacidades:anterior.capacidades_json?(typeof anterior.capacidades_json==='string'?JSON.parse(anterior.capacidades_json):anterior.capacidades_json):{},
      activo:el('adm-edit-modelo-activo').checked});await fetchAll();msg('Modelo actualizado.');
  });});
  el('adm-nueva-unidad').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    await api('/api/admin/vehiculos','POST',{nombre:val('adm-unidad-nombre'),descripcion:val('adm-unidad-desc'),
       ip_asignada:val('adm-unidad-ip'),estado_comercial:'DISPONIBLE'});
    await fetchAll();msg('Unidad creada. Ahora asigne modelo, serie y propietario en el formulario siguiente.');
  });});
  el('adm-guardar-unidad').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const id=Number(val('adm-vehiculo'));if(!id)throw Error('Seleccione una unidad.');
    await api(`/api/admin/vehiculos/${id}`,'PATCH',{
      id_modelo:val('adm-modelo')?Number(val('adm-modelo')):null,
      id_propietario:val('adm-propietario')?Number(val('adm-propietario')):null,
      estado_comercial:val('adm-estado-comercial'),numero_serie:val('adm-serie')||null});
    await fetchAll();msg('Asignación comercial guardada.');
  });});
  el('adm-crear-demo').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const unidad=Number(val('adm-crear-demo-unidad'));if(!unidad)throw Error('Seleccione unidad.');
    await api('/api/demos','POST',{id_vehiculo:unidad,nombre:val('adm-nombre-demo'),descripcion:val('adm-desc-demo')});
    await fetchAll();msg('Demo creada. Clasifíquela como FABRICA para la exhibición.');
  });});
  el('adm-mov-demo').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const id=Number(val('adm-mov-demo-id'));if(!id)throw Error('Seleccione demo.');
    await api('/api/demos/movimientos','POST',{id_demo:id,id_comando:Number(val('adm-mov-comando')),
      orden:Number(val('adm-mov-orden')),duracion_ms:Number(val('adm-mov-duracion')),
      pausa_ms:Number(val('adm-mov-pausa'))});
    msg('Movimiento agregado a la secuencia.');
  });});
  el('adm-eliminar-mov').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const id=Number(val('adm-eliminar-mov-id'));if(!id)throw Error('Indique ID de movimiento.');
    if(!confirm('¿Eliminar movimiento de la demo?'))return;
    await api(`/api/demos/movimientos/${id}`,'DELETE');msg('Movimiento eliminado.');
  });});
  el('adm-cargar-movs').addEventListener('click',()=>run(async()=>{
    const id=Number(val('adm-mov-demo-id'));if(!id)throw Error('Seleccione una demo.');
    const rows=await api(`/api/demos/${id}/movimientos`);
    fillTable('adm-tabla-movs',['ID','Comando','Orden','Duración ms','Pausa ms'],rows,
      m=>[m.id_movimiento_demo,m.id_comando,m.orden,m.duracion_ms,m.pausa_ms]);
    msg('Movimientos actualizados.');
  }));
  el('adm-guardar-demo').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
    const id=Number(val('adm-demo'));if(!id)throw Error('Seleccione una demostración.');
    await api(`/api/admin/demos/${id}`,'PATCH',{tipo_demo:val('adm-tipo-demo')});
    await fetchAll();msg('Clasificación de demostración guardada.');
  });});
  el('adm-cargar-auditoria').addEventListener('click',()=>run(async()=>{
    const a=await api('/api/admin/auditoria');
    fillTable('adm-tabla-auditoria',['Fecha','Acción','Usuario','Vehículo'],a,
       r=>[r.fecha_hora,r.accion,r.id_usuario,r.id_vehiculo]);msg('Auditoría actualizada.');
  }));
  el('adm-cargar-exhibicion').addEventListener('click',()=>run(async()=>{
    const vs=(await api('/api/invitados/exhibicion')).filter(v=>Number(v.id_vehiculo)===Number(CONFIG.VEHICULO_ID));
    updateSelect('adm-select-invitado',vs.map(v=>({id:v.id_vehiculo,nombre:v.nombre})),'Seleccionar vehículo',v=>v.nombre);
    msg(`${vs.length} vehículo(s) disponible(s) para exhibición.`);
  }));
  el('adm-reservar').addEventListener('click',()=>run(async()=>{
    const id=Number(val('adm-select-invitado'));if(!id)throw Error('Seleccione un vehículo de exhibición.');
    const r=await api('/api/invitados/reservar','POST',{id_vehiculo:id});
    state.guest=r.token_invitado;redraw();msg('Reserva temporal exclusiva activa por 10 minutos. Solo demos de fábrica.');
  }));
  el('adm-finalizar-reserva').addEventListener('click',()=>run(async()=>{
    await api('/api/invitados/finalizar','POST',undefined,true);state.guest='';redraw();msg('Reserva finalizada.');
  }));
  window.IOT43={
    canControl:()=>!!state.perfil&&(state.perfil.rol==='ADMINISTRADOR'||state.flota.some(v=>Number(v.id_vehiculo)===Number(CONFIG.VEHICULO_ID))),
    canDemo:()=>!!state.guest||window.IOT43.canControl(),
    headers:()=>state.guest&&!window.IOT43.canControl()?{'X-Guest-Token':state.guest}:state.token?{'Authorization':`Bearer ${state.token}`}:{},
    reject:()=>msg('Acceso denegado. Inicia sesión como propietario o administrador.',true)
  };
  loadMe();
})();
