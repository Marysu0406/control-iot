async function checkApiHealth() {
    try {
        const res = await fetch(CONFIG.ENDPOINTS.DEMOS);
        if (res.ok) return true;
    } catch (e) {
        console.error("Error contactando la API de AWS:", e);
    }
    return false;
}

async function cargarDemosEnSelector() {
    try {
        const response = await fetch(CONFIG.ENDPOINTS.DEMOS);
        if (response.ok) {
            const listaDemos = await response.json();
            const select = document.getElementById('select-demo');
            select.innerHTML = '<option value="">✨ Selecciona una DEMO ✨</option>';
            
            listaDemos.forEach(demo => {
                const opcion = document.createElement('option');
                opcion.value = demo.id || demo.id_demo || demo.ID; 
                opcion.text = demo.nombre || demo.nombre_demo || `Demo #${opcion.value}`; 
                select.appendChild(opcion);
            });
        }
    } catch(e) {
        const select = document.getElementById('select-demo');
        select.innerHTML = '<option value="">⚠️ Error cargando demos</option>';
    }
}


// Extrae Fecha (DD/MM/YYYY) y Hora de una cadena ISO (Ej. 2026-11-09T18:16:28)
// Extrae Fecha y Hora compensando la zona horaria local
function formatearFechaHora(isoString) {
    if (!isoString) return { fecha: "--/--/----", hora: "--:--:--" };
    
    // Al añadir 'Z' obligamos al navegador a convertir la hora del servidor (UTC) a tu hora local
    const fechaObj = new Date(isoString + 'Z');
    
    // Extraemos la fecha 
    const dia = String(fechaObj.getDate()).padStart(2, '0');
    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const anio = fechaObj.getFullYear();
    
    // Extraemos la hora
    const horas = String(fechaObj.getHours()).padStart(2, '0');
    const minutos = String(fechaObj.getMinutes()).padStart(2, '0');
    const segundos = String(fechaObj.getSeconds()).padStart(2, '0');

    return {
        fecha: `${dia}/${mes}/${anio}`,
        hora: `${horas}:${minutos}:${segundos}`
    };
}

// Consulta el Último Movimiento
async function cargarUltimoEstado() {
    try {
        const res = await fetch(CONFIG.ENDPOINTS.ESTADO);
        if (res.ok) {
            const estado = await res.json();
            document.getElementById('um-comando').innerText = estado.comando || "DESCONOCIDO";
            
            // Usamos "fecha_actualizacion" tal cual nos la dio tu JSON
            const fh = formatearFechaHora(estado.fecha_actualizacion);
            document.getElementById('um-fecha').innerText = fh.fecha;
            document.getElementById('um-hora').innerText = fh.hora;
        } else {
            document.getElementById('um-comando').innerText = "SIN DATOS";
        }
    } catch (e) {
        console.error("Error al cargar último estado:", e);
        document.getElementById('um-comando').innerText = "ERROR DE CONEXIÓN";
    }
}

// Consulta los últimos 10 movimientos del Historial
async function cargarHistorial() {
    try {
        const res = await fetch(CONFIG.ENDPOINTS.HISTORIAL);
        const tbody = document.getElementById('tabla-historial');
        
        if (res.ok) {
            const historial = await res.json();
            tbody.innerHTML = ""; 
            
            if (historial.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Sin registros</td></tr>';
                return;
            }

            // Limitamos a los primeros 10 como marca la regla de negocio
historial.slice(0, 10).forEach((mov, index) => {
    // Usamos "fecha_hora" tal cual viene en tu JSON
    const fh = formatearFechaHora(mov.fecha_hora);
    const tr = document.createElement('tr');
    
    // Limpiar el texto del comando (reemplaza guiones bajos por espacios si existen)
    const nombreLimpio = mov.comando ? mov.comando.replace(/_/g, ' ') : "DESCONOCIDO";

    tr.innerHTML = `
        <td>${index + 1}</td>
        <td class="fw-bold">${nombreLimpio}</td>
        <td>${fh.fecha}</td>
        <td>${fh.hora}</td>
    `;
    tbody.appendChild(tr);
});
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Error al cargar historial</td></tr>';
        }
    } catch (e) {
        console.error("Error al cargar historial:", e);
        document.getElementById('tabla-historial').innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Error de red</td></tr>';
    }
}