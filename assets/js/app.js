
/*
 * =====================================================
 * PLATAFORMA IoT
 * CONTROL 4.1 + MONITOREO 4.2
 * =====================================================
 *
 * Backend: FastAPI - AWS EC2
 * Base de datos: Amazon RDS MySQL
 * Comunicación: HTTPS / WSS
 *
 * Administración 4.3 gestiona la navegación
 * y los permisos de los usuarios.
 *
 * CATÁLOGO:
 * 1  Avanzar
 * 2  Retroceder
 * 3  Girar cabina izquierda
 * 4  Girar cabina derecha
 * 5  Foco
 * 6  Sonido
 * 7  Velocidad
 * 8  Power
 * 9  Subir garra
 * 10 Bajar garra
 * 11 Girar carrito derecha
 * 12 Girar carrito izquierda
 * 14 Apagar todo
 */

"use strict";

// =====================================================
// ELEMENTOS DE LA INTERFAZ
// =====================================================

const ui = {
    wss: document.getElementById("status-wss"),
    api: document.getElementById("status-api"),
    rds: document.getElementById("status-rds"),

    liveText: document.getElementById("live-action-text"),

    selectDemo: document.getElementById("select-demo"),

    botonDemo: document.getElementById("btn-play-demo"),

    botonApagar: document.getElementById("btn-detener"),

    toggles: Array.from(
        document.querySelectorAll(".btn-toggle-girly")
    ),

    ultimoComando: document.getElementById("um-comando"),

    ultimaFecha: document.getElementById("um-fecha"),

    ultimaHora: document.getElementById("um-hora"),

    tablaHistorial: document.getElementById("tabla-historial")
};

// =====================================================
// VARIABLES
// =====================================================

let ws = null;

let enDemo = false;

let fueEmergencia = false;

let reconexionWS = null;

let inicializado = false;

// Evita repetir la orden de apagado cuando
// el joystick ya está liberado.
let traccionActiva = false;

let herramientaActiva = false;

// =====================================================
// FUNCIONES GENERALES
// =====================================================

function showLiveAction(texto) {
    if (ui.liveText) {
        ui.liveText.textContent = texto;
    }
}

function marcarIndicador(elemento, estado, icono) {
    if (!elemento) return;

    elemento.className =
        "status-indicator " + estado;

    elemento.innerHTML =
        '<i class="fa-solid fa-' + icono + '"></i>';
}

function obtenerMensajeError(datos, codigo) {
    if (typeof datos?.detail === "string") {
        return datos.detail;
    }

    if (Array.isArray(datos?.detail)) {
        return datos.detail
            .map(item => item.msg || "Dato inválido")
            .join("; ");
    }

    if (codigo === 401) {
        return "Debes iniciar sesión.";
    }

    if (codigo === 403) {
        return "No tienes permiso para esta operación.";
    }

    return "Error HTTP " + codigo;
}

async function leerRespuesta(respuesta) {
    let datos = {};

    try {
        datos = await respuesta.json();
    } catch (error) {
        datos = {};
    }

    if (!respuesta.ok) {
        throw new Error(
            obtenerMensajeError(
                datos,
                respuesta.status
            )
        );
    }

    return datos;
}

function obtenerHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };

    if (
        window.IOT43 &&
        typeof window.IOT43.headers === "function"
    ) {
        Object.assign(
            headers,
            window.IOT43.headers()
        );
    }

    return headers;
}

function puedeControlar() {
    return (
        window.IOT43 &&
        typeof window.IOT43.canControl === "function" &&
        window.IOT43.canControl()
    );
}

function puedeEjecutarDemo() {
    return (
        window.IOT43 &&
        typeof window.IOT43.canDemo === "function" &&
        window.IOT43.canDemo()
    );
}

function mostrarRechazo() {
    showLiveAction(
        "⚠️ ACCESO DENEGADO: REVISA TU SESIÓN"
    );

    if (
        window.IOT43 &&
        typeof window.IOT43.reject === "function"
    ) {
        window.IOT43.reject();
    }
}

// =====================================================
// ENVÍO DE COMANDOS A FASTAPI
// =====================================================

async function sendCommand(idComando, isDemo = false) {
    if (isDemo) {
        return false;
    }

    const comando = Number(idComando);

    const comandosPermitidos = [
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        14
    ];

    if (!comandosPermitidos.includes(comando)) {
        showLiveAction(
            "⚠️ COMANDO NO DEFINIDO: " + idComando
        );

        console.error(
            "Comando no permitido:",
            idComando
        );

        return false;
    }

    if (!puedeControlar()) {
        mostrarRechazo();
        return false;
    }

    const url =
        `https://${CONFIG.API_URL_BASE}/api/movimiento`;

    try {
        const respuesta = await fetch(url, {
            method: "POST",

            headers: obtenerHeaders(),

            body: JSON.stringify({
                id_vehiculo: CONFIG.VEHICULO_ID,
                id_comando: comando,
                origen: "WEB"
            })
        });

        await leerRespuesta(respuesta);

        console.log(
            "[CONTROL] Comando enviado:",
            comando
        );

        return true;

    } catch (error) {
        console.error(
            "[CONTROL] Error:",
            error
        );

        showLiveAction(
            "⚠️ " + error.message
        );

        return false;
    }
}

// =====================================================
// APAGAR TODO
// =====================================================

async function apagarTodoSistema(origen = "BOTON") {
    if (!puedeControlar()) {
        mostrarRechazo();
        return false;
    }

    const correcto = await sendCommand(
        CONFIG.COMANDOS.APAGAR_TODO
    );

    if (correcto) {
        fueEmergencia = origen === "BOTON";

        traccionActiva = false;
        herramientaActiva = false;

        ui.toggles.forEach(boton => {
            boton.classList.remove("active");
        });

        showLiveAction(
            "🛑 TODAS LAS SALIDAS DESACTIVADAS"
        );
    }

    return correcto;
}

// =====================================================
// WEBSOCKET
// =====================================================

function initWebSocket() {
    if (
        ws &&
        (
            ws.readyState === WebSocket.CONNECTING ||
            ws.readyState === WebSocket.OPEN
        )
    ) {
        return;
    }

    showLiveAction(
        "CONECTANDO WEBSOCKET..."
    );

    try {
        ws = new WebSocket(
            CONFIG.ENDPOINTS.WS
        );

        ws.onopen = () => {
            marcarIndicador(
                ui.wss,
                "success",
                "bolt"
            );

            showLiveAction(
                "✨ WEBSOCKET CONECTADO ✨"
            );

            console.log(
                "[WSS] Conectado al servidor"
            );

            actualizarMonitoreo();
        };

        ws.onmessage = async mensaje => {
            let data;

            try {
                data = JSON.parse(
                    mensaje.data
                );
            } catch (error) {
                console.warn(
                    "[WSS] Mensaje no JSON:",
                    mensaje.data
                );

                return;
            }

            console.log(
                "[WSS] Mensaje recibido:",
                data
            );

            procesarEventoWebSocket(data);
        };

        ws.onerror = error => {
            console.error(
                "[WSS] Error de conexión",
                error
            );

            marcarIndicador(
                ui.wss,
                "danger",
                "triangle-exclamation"
            );
        };

        ws.onclose = () => {
            marcarIndicador(
                ui.wss,
                "danger",
                "link-slash"
            );

            showLiveAction(
                "WEBSOCKET DESCONECTADO. RECONECTANDO..."
            );

            ws = null;

            if (reconexionWS !== null) {
                clearTimeout(reconexionWS);
            }

            reconexionWS = setTimeout(() => {
                reconexionWS = null;
                initWebSocket();
            }, 5000);
        };

    } catch (error) {
        console.error(
            "[WSS] No se pudo iniciar:",
            error
        );

        marcarIndicador(
            ui.wss,
            "danger",
            "link-slash"
        );

        if (reconexionWS !== null) {
            clearTimeout(reconexionWS);
        }

        reconexionWS = setTimeout(() => {
            reconexionWS = null;
            initWebSocket();
        }, 5000);
    }
}

// =====================================================
// INTERPRETACIÓN DE EVENTOS WSS
// =====================================================

function procesarEventoWebSocket(data) {
    const evento = String(
        data.event || data.evento || ""
    ).toUpperCase();

    if (evento === "CONECTADO") {
        console.log(
            "[WSS] Conexión confirmada"
        );
        return;
    }

    if (evento === "DEMO_INICIADA") {
        enDemo = true;

        showLiveAction(
            "🤖 EJECUTANDO DEMOSTRACIÓN..."
        );

        return;
    }

    if (evento === "DEMO_FINALIZADA") {
        enDemo = false;

        showLiveAction(
            "✅ DEMOSTRACIÓN FINALIZADA"
        );

        actualizarMonitoreo();

        return;
    }

    if (
        evento === "MOVIMIENTO_INDIVIDUAL" ||
        evento === "EJECUTANDO_MOVIMIENTO" ||
        data.accion
    ) {
        const accion = String(
            data.accion ||
            nombreComando(data.comando ?? data.id_comando)
        ).toUpperCase();

        if (accion) {
            showLiveAction(accion);

            const esApagado =
                Number(
                    data.comando ?? data.id_comando
                ) === 14 ||
                accion === "APAGAR TODO" ||
                accion === "DETENER SISTEMA";

            if (
                !esApagado ||
                fueEmergencia
            ) {
                actualizarTarjetaLocal(
                    enDemo
                        ? "DEMO: " + accion
                        : accion
                );
            }

            fueEmergencia = false;
        }

        actualizarHistorialSeguro();
    }
}

// =====================================================
// CATÁLOGO DE NOMBRES
// =====================================================

function nombreComando(numero) {
    const nombres = {
        1: "AVANZAR",
        2: "RETROCEDER",
        3: "GIRAR CABINA IZQUIERDA",
        4: "GIRAR CABINA DERECHA",
        5: "FOCO",
        6: "SONIDO",
        7: "VELOCIDAD",
        8: "POWER",
        9: "SUBIR GARRA",
        10: "BAJAR GARRA",
        11: "GIRAR CARRITO DERECHA",
        12: "GIRAR CARRITO IZQUIERDA",
        14: "APAGAR TODO"
    };

    return nombres[Number(numero)] || "";
}

// =====================================================
// ACTUALIZACIÓN DE TARJETA LOCAL
// =====================================================

function actualizarTarjetaLocal(accion) {
    if (ui.ultimoComando) {
        ui.ultimoComando.textContent =
            accion;
    }

    const ahora = new Date();

    const hora = ahora.toLocaleTimeString(
        "es-MX",
        { hour12: false }
    );

    const fecha = ahora.toLocaleDateString(
        "es-MX",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

    if (ui.ultimaFecha) {
        ui.ultimaFecha.textContent =
            fecha;
    }

    if (ui.ultimaHora) {
        ui.ultimaHora.textContent =
            hora;
    }
}

// =====================================================
// MONITOREO
// =====================================================

async function actualizarMonitoreo() {
    await Promise.allSettled([
        actualizarUltimoEstadoSeguro(),
        actualizarHistorialSeguro()
    ]);
}

async function actualizarUltimoEstadoSeguro() {
    try {
        if (
            typeof cargarUltimoEstado === "function"
        ) {
            await cargarUltimoEstado();
        }
    } catch (error) {
        console.error(
            "[MONITOREO] Último estado:",
            error
        );
    }
}

async function actualizarHistorialSeguro() {
    try {
        if (
            typeof cargarHistorial === "function"
        ) {
            await cargarHistorial();
        }
    } catch (error) {
        console.error(
            "[MONITOREO] Historial:",
            error
        );
    }
}

// =====================================================
// JOYSTICK 1: DESPLAZAMIENTO
// =====================================================

const joystickTraccion = new VirtualJoystick(
    "joystick-traccion",
    direction => {

        if (direction === null) {
            if (traccionActiva) {
                traccionActiva = false;

                apagarTodoSistema(
                    "JOYSTICK"
                );
            }

            return;
        }

        let comando = null;

        switch (direction) {
            case "UP":
                comando = CONFIG.COMANDOS.ADELANTE;
                break;

            case "DOWN":
                comando = CONFIG.COMANDOS.ATRAS;
                break;

            case "LEFT":
                comando = CONFIG.COMANDOS.IZQUIERDA;
                break;

            case "RIGHT":
                comando = CONFIG.COMANDOS.DERECHA;
                break;
        }

        if (comando !== null) {
            traccionActiva = true;

            sendCommand(comando);
        }
    }
);

// =====================================================
// JOYSTICK 2: CABINA Y GARRA
// =====================================================

const joystickHerramienta = new VirtualJoystick(
    "joystick-herramienta",
    direction => {

        if (direction === null) {
            if (herramientaActiva) {
                herramientaActiva = false;

                apagarTodoSistema(
                    "JOYSTICK"
                );
            }

            return;
        }

        let comando = null;

        switch (direction) {
            case "UP":
                comando = CONFIG.COMANDOS.SUBIR_PALA;
                break;

            case "DOWN":
                comando = CONFIG.COMANDOS.BAJAR_PALA;
                break;

            case "LEFT":
                comando = CONFIG.COMANDOS.CABINA_IZQ;
                break;

            case "RIGHT":
                comando = CONFIG.COMANDOS.CABINA_DER;
                break;
        }

        if (comando !== null) {
            herramientaActiva = true;

            sendCommand(comando);
        }
    }
);

// =====================================================
// BOTONES FOCO / SONIDO / VELOCIDAD
// =====================================================

ui.toggles.forEach(boton => {
    boton.addEventListener(
        "click",
        async function () {

            const comando = Number(
                this.dataset.comando
            );

            const correcto = await sendCommand(
                comando
            );

            if (correcto) {
                this.classList.toggle(
                    "active"
                );
            }
        }
    );
});

// =====================================================
// BOTÓN ROJO: APAGAR TODO
// =====================================================

if (ui.botonApagar) {
    ui.botonApagar.addEventListener(
        "click",
        async () => {
            await apagarTodoSistema(
                "BOTON"
            );
        }
    );
}

// =====================================================
// DEMOSTRACIONES AUTOMÁTICAS
// =====================================================

if (ui.botonDemo) {
    ui.botonDemo.addEventListener(
        "click",
        async () => {

            const demoId =
                ui.selectDemo?.value || "";

            if (!demoId) {
                showLiveAction(
                    "SELECCIONA UNA DEMOSTRACIÓN"
                );

                return;
            }

            if (!puedeEjecutarDemo()) {
                mostrarRechazo();
                return;
            }

            const url =
                `https://${CONFIG.API_URL_BASE}` +
                `/api/vehiculos/${CONFIG.VEHICULO_ID}` +
                `/demos/${encodeURIComponent(demoId)}/ejecutar`;

            showLiveAction(
                "INICIANDO DEMOSTRACIÓN..."
            );

            ui.botonDemo.disabled = true;

            try {
                const respuesta = await fetch(
                    url,
                    {
                        method: "POST",
                        headers: obtenerHeaders()
                    }
                );

                await leerRespuesta(
                    respuesta
                );

                showLiveAction(
                    "🤖 DEMOSTRACIÓN SOLICITADA"
                );

            } catch (error) {
                console.error(
                    "[DEMOS] Error:",
                    error
                );

                showLiveAction(
                    "⚠️ " + error.message
                );

            } finally {
                ui.botonDemo.disabled = false;
            }
        }
    );
}

// =====================================================
// VERIFICAR CONEXIONES API Y RDS
// =====================================================

async function verificarServicios() {
    try {
        const estadoOk =
            await checkApiHealth();

        if (estadoOk) {
            marcarIndicador(
                ui.api,
                "success",
                "check"
            );

            // Este indicador conserva la
            // comprobación que hace api.js.
            // La salud de API no necesariamente
            // verifica RDS por separado.
            marcarIndicador(
                ui.rds,
                "warning",
                "database"
            );

            return true;
        }

        marcarIndicador(
            ui.api,
            "danger",
            "xmark"
        );

        marcarIndicador(
            ui.rds,
            "warning",
            "database"
        );

        return false;

    } catch (error) {
        console.error(
            "[API] Error de conexión:",
            error
        );

        marcarIndicador(
            ui.api,
            "danger",
            "xmark"
        );

        marcarIndicador(
            ui.rds,
            "warning",
            "database"
        );

        return false;
    }
}

// =====================================================
// CARGAR DEMOSTRACIONES
// =====================================================

async function actualizarDemosSeguro() {
    try {
        if (
            typeof cargarDemosEnSelector === "function"
        ) {
            await cargarDemosEnSelector();
        }
    } catch (error) {
        console.error(
            "[DEMOS] No se pudieron cargar:",
            error
        );

        if (ui.selectDemo) {
            ui.selectDemo.innerHTML =
                '<option value="">Error al cargar demos</option>';
        }
    }
}

// =====================================================
// INICIALIZACIÓN PRINCIPAL
// =====================================================

async function arrancarSistema() {
    if (inicializado) {
        return;
    }

    inicializado = true;

    console.log(
        "[IoT] Iniciando CONTROL 4.1 y MONITOREO 4.2"
    );

    showLiveAction(
        "INICIANDO PLATAFORMA IoT..."
    );

    // La conexión WSS se realiza
    // independientemente del estado de API.
    initWebSocket();

    const apiCorrecta =
        await verificarServicios();

    if (apiCorrecta) {
        await actualizarDemosSeguro();

        await actualizarMonitoreo();
    } else {
        showLiveAction(
            "⚠️ API NO DISPONIBLE"
        );
    }
}

// =====================================================
// INICIO
// =====================================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        arrancarSistema
    );
} else {
    arrancarSistema();
}