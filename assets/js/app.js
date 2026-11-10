const ui = {
    wss: document.getElementById('status-wss'),
    api: document.getElementById('status-api'),
    rds: document.getElementById('status-rds'),
    liveText: document.getElementById('live-action-text'),
    selectDemo: document.getElementById('select-demo'),
    toggles: Array.from(document.querySelectorAll('.btn-toggle-girly')),
    // Elementos para Navegación SPA
    tabControl: document.getElementById('tab-control'),
    tabMonitoreo: document.getElementById('tab-monitoreo'),
    viewControl: document.getElementById('view-control'),
    viewMonitoreo: document.getElementById('view-monitoreo')
};

let ws = null;
let fueEmergencia = false; // 🔥 Bandera para saber si se presionó el botón rojo

// ==========================================
// LÓGICA DE NAVEGACIÓN SPA
// ==========================================
ui.tabControl.addEventListener('click', () => {
    ui.tabControl.classList.add('active');
    ui.tabMonitoreo.classList.remove('active');
    ui.viewControl.style.display = 'flex';
    ui.viewMonitoreo.style.display = 'none';
});

ui.tabMonitoreo.addEventListener('click', () => {
    ui.tabMonitoreo.classList.add('active');
    ui.tabControl.classList.remove('active');
    ui.viewControl.style.display = 'none';
    ui.viewMonitoreo.style.display = 'flex';
});

function showLiveAction(text) {
    ui.liveText.innerText = text;
}

// ==========================================
// EL GRAN CAMBIO: Usar REST POST para que AWS guarde en MySQL
// ==========================================
async function sendCommand(idComando, isDemo = false) {
    if (isDemo) return; // Las demos usan su propio fetch en su botón
    
    try {
        const url = `https://${CONFIG.API_URL_BASE}/api/movimiento`;
        await fetch(url, {
            method: 'POST', // Esto asegura que AWS ejecute el Stored Procedure y guarde la hora real
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_vehiculo: CONFIG.VEHICULO_ID,
                id_comando: parseInt(idComando),
                origen: "WEB"
            })
        });
    } catch (error) {
        console.error("Error de red al enviar comando:", error);
        showLiveAction("⚠️ ERROR DE RED");
    }
}

// ==========================================
// CONTROL DE WEBSOCKET Y SINCRONIZACIÓN
// ==========================================
function initWebSocket() {
    showLiveAction("INTENTANDO CONECTAR WSS...");
    try {
        ws = new WebSocket(CONFIG.ENDPOINTS.WS);

        ws.onopen = () => {
            ui.wss.innerHTML = '<i class="fa-solid fa-bolt"></i>';
            ui.wss.className = 'status-indicator success';
            showLiveAction("✨ WEBSOCKET CONECTADO ✨");
            
            cargarUltimoEstado();
            cargarHistorial();
        };

        ws.onmessage = (mensaje) => {
            const data = JSON.parse(mensaje.data);
            
            if (data.accion) {
                const accionStr = data.accion.toUpperCase();
                showLiveAction(`${accionStr}`);
                
                // Magia para ignorar el DETENER del joystick:
                // Solo actualiza la tarjeta si NO es detener, o si presionaste el botón de emergencia
                if (accionStr !== "DETENER SISTEMA" || fueEmergencia) {
                    document.getElementById('um-comando').innerText = accionStr;
                    
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, '0');
                    const mm = String(now.getMinutes()).padStart(2, '0');
                    const ss = String(now.getSeconds()).padStart(2, '0');
                    document.getElementById('um-hora').innerText = `${hh}:${mm}:${ss}`;
                    
                    // Nos aseguramos de tener la fecha correcta de hoy
                    const dia = String(now.getDate()).padStart(2, '0');
                    const mes = String(now.getMonth() + 1).padStart(2, '0');
                    const anio = now.getFullYear();
                    document.getElementById('um-fecha').innerText = `${dia}/${mes}/${anio}`;
                    
                    fueEmergencia = false; // Resetear la bandera
                }
                
                // Siempre actualizamos la tabla para que lea los 10 movimientos persistidos reales en RDS
                cargarHistorial();
            }
            
            if (data.evento === "DEMO_INICIADA") {
                showLiveAction("🤖 EJECUTANDO SECUENCIA AUTOMÁTICA...");
            }
            
            if (data.evento === "DEMO_FINALIZADA") {
                showLiveAction("✅ DEMO FINALIZADA");
            }
        };

        ws.onclose = () => {
            ui.wss.innerHTML = '<i class="fa-solid fa-link-slash"></i>';
            ui.wss.className = 'status-indicator danger';
            showLiveAction("SE PERDIÓ CONEXIÓN AL SERVIDOR. RECONECTANDO...");
            setTimeout(initWebSocket, 5000);
        };
    } catch (e) {
        console.error("Fallo al crear socket:", e);
    }
}

// ==========================================
// CONTROLES DE HARDWARE
// ==========================================
new VirtualJoystick('joystick-traccion', (direction) => {
    if (direction === null) {
        sendCommand(CONFIG.COMANDOS.DETENER);
        showLiveAction("TRACCIÓN DETENIDA");
        return;
    }
    let cmd = null; 
    if (direction === 'UP') cmd = CONFIG.COMANDOS.ADELANTE;
    else if (direction === 'DOWN') cmd = CONFIG.COMANDOS.ATRAS;
    else if (direction === 'LEFT') cmd = CONFIG.COMANDOS.IZQUIERDA;
    else if (direction === 'RIGHT') cmd = CONFIG.COMANDOS.DERECHA;
    
    if (cmd !== null) sendCommand(cmd);
});

new VirtualJoystick('joystick-herramienta', (direction) => {
    if (direction === null) {
        sendCommand(CONFIG.COMANDOS.DETENER);
        showLiveAction("HERRAMIENTA DETENIDA");
        return;
    }
    let cmd = null; 
    if (direction === 'UP') cmd = CONFIG.COMANDOS.SUBIR_PALA;
    else if (direction === 'DOWN') cmd = CONFIG.COMANDOS.BAJAR_PALA;
    else if (direction === 'LEFT') cmd = CONFIG.COMANDOS.CABINA_IZQ;
    else if (direction === 'RIGHT') cmd = CONFIG.COMANDOS.CABINA_DER;
    
    if (cmd !== null) sendCommand(cmd);
});

ui.toggles.forEach(btn => {
    btn.addEventListener('click', function() {
        this.classList.toggle('active');
        sendCommand(this.getAttribute('data-comando'));
    });
});

document.getElementById('btn-detener').addEventListener('click', () => {
    fueEmergencia = true; // Avisamos que fue intencional para que la tarjeta se actualice
    sendCommand(CONFIG.COMANDOS.DETENER);
    showLiveAction("SISTEMA DETENIDO POR EMERGENCIA");
    ui.toggles.forEach(btn => btn.classList.remove('active'));
});

document.getElementById('btn-play-demo').addEventListener('click', async () => {
    const demoId = ui.selectDemo.value;
    if (demoId) {
        showLiveAction(`INICIANDO DEMO...`);
        try {
            const url = `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/demos/${demoId}/ejecutar`;
            const res = await fetch(url, { method: 'POST' });
            if (!res.ok) showLiveAction("⚠️ ERROR AL INICIAR DEMO");
        } catch (error) {
            console.error(error);
            showLiveAction("⚠️ ERROR DE RED CON AWS");
        }
    } else {
        showLiveAction("POR FAVOR SELECCIONA UNA DEMO");
    }
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
async function arrancarSistema() {
    const estadoOk = await checkApiHealth();
    if (estadoOk) {
        ui.api.innerHTML = '<i class="fa-solid fa-check"></i>';
        ui.api.className = 'status-indicator success';
        ui.rds.innerHTML = '<i class="fa-solid fa-database"></i>';
        ui.rds.className = 'status-indicator success';
        
        await cargarDemosEnSelector();
        await cargarUltimoEstado();
        await cargarHistorial();
    } else {
        ui.api.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        ui.api.className = 'status-indicator danger';
        ui.rds.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        ui.rds.className = 'status-indicator danger';
    }
    initWebSocket();
}

document.addEventListener('DOMContentLoaded', arrancarSistema);