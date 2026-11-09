// js/app.js
import { CONFIG } from './config.js';
import { checkApiHealth, getDemos, enviarMovimiento, ejecutarDemo } from './api.js';
import { initJoystick } from './joystick.js';

const ui = {
    wss: document.getElementById('status-wss'),
    api: document.getElementById('status-api'),
    lastAction: document.getElementById('last-action'),
    vehiculoInfo: document.getElementById('vehiculo-info'),
    selectDemo: document.getElementById('select-demo'),
    btnEjecutarDemo: document.getElementById('btn-ejecutar-demo'),
    btnDetener: document.getElementById('btn-detener'),
    botones: document.querySelectorAll('.btn-comando')
};

let ws;

// ... [mantén tus imports y variables igual]

function updateAction(text) {
    // Hace un pequeño parpadeo visual para que se note la actualización en el display
    ui.lastAction.style.opacity = '0.3';
    setTimeout(() => {
        ui.lastAction.textContent = `> ${text.toUpperCase()}`;
        ui.lastAction.style.opacity = '1';
    }, 100);
}

async function initHealthCheck() {
    const isApiOk = await checkApiHealth();
    if (isApiOk) {
        ui.api.innerHTML = '<i class="fa-solid fa-check me-1"></i>Disponible';
        ui.api.className = 'status-indicator success';
        ui.vehiculoInfo.innerHTML = `<i class="fa-solid fa-car me-2"></i>Vehículo ${CONFIG.VEHICULO_ID}`;
    } else {
        ui.api.innerHTML = '<i class="fa-solid fa-xmark me-1"></i>Fallo';
        ui.api.className = 'status-indicator danger';
    }
}

function initWebSocket() {
    ws = new WebSocket(CONFIG.WS_URL);
    
    ws.onopen = () => {
        ui.wss.innerHTML = '<i class="fa-solid fa-bolt me-1"></i>En línea';
        ui.wss.className = 'status-indicator success';
    };
    
    ws.onclose = () => {
        ui.wss.innerHTML = '<i class="fa-solid fa-link-slash me-1"></i>Caído';
        ui.wss.className = 'status-indicator danger';
        setTimeout(initWebSocket, 5000);
    };
    
    ws.onerror = () => {
        ui.wss.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>Error';
        ui.wss.className = 'status-indicator danger';
    };
}

// ... [el resto del archivo js/app.js se queda exactamente igual]
async function loadDemos() {
    const demos = await getDemos();
    ui.selectDemo.innerHTML = '<option value="" selected disabled>Selecciona una DEMO</option>';
    demos.forEach(demo => {
        const option = document.createElement('option');
        option.value = demo.id_demo;
        option.textContent = demo.nombre;
        ui.selectDemo.appendChild(option);
    });
}

function bindEvents() {
    initJoystick(
        (cmd) => { 
            enviarMovimiento(cmd); 
            updateAction(`Comando ${cmd} enviado`); 
        },
        (cmd) => { 
            enviarMovimiento(cmd); 
            updateAction('DETENER'); 
        }
    );

    ui.btnDetener.addEventListener('click', () => {
        enviarMovimiento(13);
        updateAction('DETENER (Botón prioritario)');
    });

    ui.botones.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cmd = e.currentTarget.getAttribute('data-comando');
            enviarMovimiento(cmd);
            updateAction(`Comando ${cmd} enviado`);
        });
    });

    ui.btnEjecutarDemo.addEventListener('click', () => {
        const idDemo = ui.selectDemo.value;
        if (idDemo) {
            ejecutarDemo(idDemo);
            updateAction(`DEMO ${idDemo} iniciada`);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initHealthCheck();
    initWebSocket();
    loadDemos();
    bindEvents();
});