const ui = {
    wss: document.getElementById('status-wss'),
    api: document.getElementById('status-api'),
    rds: document.getElementById('status-rds'),
    liveText: document.getElementById('live-action-text'),
    selectDemo: document.getElementById('select-demo'),
    // Actualizado al selector correcto de la clase girly
    toggles: Array.from(document.querySelectorAll('.btn-toggle-girly')) 
};

let ws = null;

function showLiveAction(text) {
    ui.liveText.innerText = text;
}

function sendCommand(idComando, isDemo = false) {
    if (ws && ws.readyState === 1) {
        const payload = isDemo ? { "id_demo": parseInt(idComando) } : { "comando": parseInt(idComando) };
        ws.send(JSON.stringify(payload));
    } else {
        showLiveAction("ERROR: WEBSOCKET NO CONECTADO");
    }
}

function initWebSocket() {
    showLiveAction("INTENTANDO CONECTAR WSS...");
    try {
        ws = new WebSocket(CONFIG.ENDPOINTS.WS);

        ws.onopen = () => {
            ui.wss.innerHTML = '<i class="fa-solid fa-bolt"></i>';
            ui.wss.className = 'status-indicator success';
            showLiveAction("✨ WEBSOCKET CONECTADO ✨");
        };

        ws.onclose = () => {
            ui.wss.innerHTML = '<i class="fa-solid fa-link-slash"></i>';
            ui.wss.className = 'status-indicator danger';
            showLiveAction("SE PERDIÓ CONEXIÓN AL SERVIDOR. RECONECTANDO...");
            setTimeout(initWebSocket, 5000);
        };
        ws.onmessage = (mensaje) => {
            const data = JSON.parse(mensaje.data);
            
            // Cuando Python envía un movimiento individual (con su nombre en texto)
            if (data.event === "MOVIMIENTO_INDIVIDUAL" && data.accion) {
                showLiveAction(`DEMO: ${data.accion.toUpperCase()}`);
            }
            
            // Cuando Python avisa que arranca la demo
            if (data.evento === "DEMO_INICIADA") {
                showLiveAction("🤖 EJECUTANDO SECUENCIA AUTOMÁTICA...");
            }
            
            // Cuando Python avisa que terminó la demo
            if (data.evento === "DEMO_FINALIZADA") {
                showLiveAction("✅ DEMO FINALIZADA");
            }
        };
    } catch (e) {
        console.error("Fallo al crear socket:", e);
    }
}

new VirtualJoystick('joystick-traccion', (direction) => {
    if (direction === null) {
        sendCommand(CONFIG.COMANDOS.DETENER);
        showLiveAction("SIN MOVIMIENTO");
        return;
    }
    let cmd = null; let actionText = "";
    if (direction === 'UP') { cmd = CONFIG.COMANDOS.ADELANTE; actionText = "AVANZANDO"; }
    else if (direction === 'DOWN') { cmd = CONFIG.COMANDOS.ATRAS; actionText = "RETROCEDIENDO"; }
    else if (direction === 'LEFT') { cmd = CONFIG.COMANDOS.IZQUIERDA; actionText = "GIRANDO A LA IZQUIERDA"; }
    else if (direction === 'RIGHT') { cmd = CONFIG.COMANDOS.DERECHA; actionText = "GIRANDO A LA DERECHA"; }
    
    if (cmd !== null) {
        sendCommand(cmd);
        showLiveAction(`${actionText}`);
    }
});

new VirtualJoystick('joystick-herramienta', (direction) => {
    if (direction === null) {
        sendCommand(CONFIG.COMANDOS.DETENER);
        showLiveAction("HERRAMIENTA DETENIDA");
        return;
    }
    let cmd = null; let actionText = "";
    if (direction === 'UP') { cmd = CONFIG.COMANDOS.SUBIR_PALA; actionText = "SUBIENDO PALA"; }
    else if (direction === 'DOWN') { cmd = CONFIG.COMANDOS.BAJAR_PALA; actionText = "BAJANDO PALA"; }
    else if (direction === 'LEFT') { cmd = CONFIG.COMANDOS.CABINA_IZQ; actionText = "GIRANDO CABINA IZQUIERDA"; }
    else if (direction === 'RIGHT') { cmd = CONFIG.COMANDOS.CABINA_DER; actionText = "GIRANDO CABINA DERECHA"; }
    
    if (cmd !== null) {
        sendCommand(cmd);
        showLiveAction(` ${actionText}`);
    }
});

ui.toggles.forEach(btn => {
    btn.addEventListener('click', function() {
        this.classList.toggle('active');
        const numComando = this.getAttribute('data-comando');
        const nombreBoton = this.innerText.trim();
        const estaPrendido = this.classList.contains('active');
        
        const estadoTexto = estaPrendido ? "ENCENDIDO" : "APAGADO";
        showLiveAction(`${nombreBoton.toUpperCase()} ${estadoTexto}`);
        sendCommand(numComando);
    });
});

document.getElementById('btn-detener').addEventListener('click', () => {
    sendCommand(CONFIG.COMANDOS.DETENER);
    showLiveAction("SISTEMA DETENIDO");
    ui.toggles.forEach(btn => btn.classList.remove('active'));
});

document.getElementById('btn-play-demo').addEventListener('click', async () => {
    const demoId = ui.selectDemo.value;
    if (demoId) {
        const demoNombre = ui.selectDemo.options[ui.selectDemo.selectedIndex].text;
        showLiveAction(`INICIANDO DEMO: ${demoNombre}`);

        try {
            // Llamar al endpoint HTTP POST para arrancar el ciclo en Python
            const url = `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/demos/${demoId}/ejecutar`;
            const res = await fetch(url, { method: 'POST' });
            
            if (!res.ok) {
                showLiveAction("⚠️ ERROR AL INICIAR DEMO");
            }
        } catch (error) {
            console.error(error);
            showLiveAction("⚠️ ERROR DE RED CON AWS");
        }
    } else {
        showLiveAction("POR FAVOR SELECCIONA UNA DEMO");
    }
});

async function arrancarSistema() {
    const estadoOk = await checkApiHealth();
    if (estadoOk) {
        ui.api.innerHTML = '<i class="fa-solid fa-check"></i>';
        ui.api.className = 'status-indicator success';
        ui.rds.innerHTML = '<i class="fa-solid fa-database"></i>';
        ui.rds.className = 'status-indicator success';
        
        await cargarDemosEnSelector();
    } else {
        ui.api.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        ui.api.className = 'status-indicator danger';
        ui.rds.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        ui.rds.className = 'status-indicator danger';
    }
    initWebSocket();
}

document.addEventListener('DOMContentLoaded', arrancarSistema);