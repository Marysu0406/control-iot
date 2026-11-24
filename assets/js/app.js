
/*
=========================================================
PLATAFORMA IoT
CONTROL 4.1 + MONITOREO 4.2
=========================================================

Vehículos dinámicos y permisos individuales.

ADMINISTRADOR:
    Control de sus unidades seleccionadas.

USUARIO:
    Control de su vehículo según permisos RDS.

INVITADO:
    Control temporal de la unidad reservada.

Los permisos definitivos se verifican en FastAPI.
=========================================================
*/

"use strict";


// =====================================================
// ELEMENTOS DE LA INTERFAZ
// =====================================================

const ui = {
    wss: document.getElementById("status-wss"),
    api: document.getElementById("status-api"),
    rds: document.getElementById("status-rds"),

    vehiculoInfo: document.getElementById("vehiculo-info"),
    liveText: document.getElementById("live-action-text"),

    selectDemo: document.getElementById("select-demo"),
    botonDemo: document.getElementById("btn-play-demo"),
    botonApagar: document.getElementById("btn-detener"),

    toggles: Array.from(
        document.querySelectorAll(".btn-toggle-girly")
    ),

    joystickTraccion:
        document.getElementById("joystick-traccion"),

    joystickHerramienta:
        document.getElementById("joystick-herramienta"),

    ultimoComando: document.getElementById("um-comando"),
    ultimaFecha: document.getElementById("um-fecha"),
    ultimaHora: document.getElementById("um-hora"),
    tablaHistorial: document.getElementById("tabla-historial")
};


// =====================================================
// ESTADO DEL SISTEMA
// =====================================================

let ws = null;
let wsVehiculoId = null;
let reconexionWS = null;

let vehiculoActivoId = null;
let generacionVehiculo = 0;

let enDemo = false;
let enviandoDemo = false;
let fueEmergencia = false;
let inicializado = false;

let traccionActiva = false;
let herramientaActiva = false;


// =====================================================
// CATÁLOGO DEFINITIVO
// =====================================================

const NOMBRES_COMANDOS = {
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

const COMANDOS_VALIDOS = new Set(
    Object.keys(NOMBRES_COMANDOS).map(Number)
);


// =====================================================
// SESIÓN Y PERMISOS
// =====================================================

function obtenerRol() {
    if (
        window.IOT43 &&
        typeof window.IOT43.getRole === "function"
    ) {
        return window.IOT43.getRole();
    }

    return "SIN_SESION";
}

function validarId(valor) {
    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return null;
    }

    const numero = Number(valor);

    if (
        !Number.isSafeInteger(numero) ||
        numero <= 0
    ) {
        return null;
    }

    return numero;
}

function obtenerVehiculoSesion() {
    if (
        !window.IOT43 ||
        typeof window.IOT43.getVehicle !== "function"
    ) {
        return null;
    }

    if (obtenerRol() === "SIN_SESION") {
        return null;
    }

    return validarId(
        window.IOT43.getVehicle()
    );
}

function obtenerVehiculoActivo() {
    return validarId(vehiculoActivoId);
}

function puedeEnviarComando(comando) {
    /*
     * Se comprueba el permiso individual.
     *
     * No basta con que canControl() sea true.
     *
     * Ejemplo:
     * Mary puede utilizar FOCO pero no POWER.
     */

    if (
        !window.IOT43 ||
        typeof window.IOT43.canCommand !== "function"
    ) {
        return false;
    }

    const idVehiculo = obtenerVehiculoActivo();

    if (!idVehiculo) return false;

    if (obtenerVehiculoSesion() !== idVehiculo) {
        return false;
    }

    return Boolean(
        window.IOT43.canCommand(Number(comando))
    );
}

function puedeEjecutarDemo() {
    if (
        !window.IOT43 ||
        typeof window.IOT43.canDemo !== "function"
    ) {
        return false;
    }

    return Boolean(
        obtenerVehiculoActivo() &&
        obtenerVehiculoSesion() ===
            obtenerVehiculoActivo() &&
        window.IOT43.canDemo()
    );
}

function puedeMonitorear() {
    if (
        !window.IOT43 ||
        typeof window.IOT43.canMonitor !== "function"
    ) {
        return false;
    }

    return Boolean(
        obtenerVehiculoActivo() &&
        window.IOT43.canMonitor()
    );
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


// =====================================================
// MENSAJES Y ESTADOS
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

function nombreComando(numero) {
    return NOMBRES_COMANDOS[Number(numero)] || "";
}

function mostrarRechazo(comando = null) {
    const nombre = comando
        ? nombreComando(comando)
        : "OPERACIÓN";

    showLiveAction(
        "⚠️ SIN PERMISO PARA " + nombre
    );

    console.warn(
        "[PERMISOS] Operación rechazada:",
        nombre
    );

    if (
        window.IOT43 &&
        typeof window.IOT43.reject === "function"
    ) {
        window.IOT43.reject();
    }
}


// =====================================================
// ACTIVAR Y DESACTIVAR CONTROLES VISUALES
// =====================================================

function actualizarControlesVisuales() {
    /*
     * Estos cambios son visuales.
     * FastAPI realiza la autorización definitiva.
     */

    ui.toggles.forEach(boton => {
        const comando = Number(
            boton.dataset.comando
        );

        const autorizado =
            puedeEnviarComando(comando);

        boton.disabled = !autorizado;

        boton.setAttribute(
            "aria-disabled",
            String(!autorizado)
        );

        if (!autorizado) {
            boton.classList.remove("active");
        }
    });

    if (ui.botonApagar) {
        const autorizado =
            puedeEnviarComando(14);

        ui.botonApagar.disabled = !autorizado;

        ui.botonApagar.setAttribute(
            "aria-disabled",
            String(!autorizado)
        );
    }

    if (ui.botonDemo) {
        ui.botonDemo.disabled =
            !puedeEjecutarDemo() ||
            enviandoDemo;
    }

    const joystickAutorizado =
        puedeEnviarComando(1);

    [
        ui.joystickTraccion,
        ui.joystickHerramienta
    ].forEach(joystick => {
        if (!joystick) return;

        joystick.setAttribute(
            "aria-disabled",
            String(!joystickAutorizado)
        );

        joystick.style.opacity =
            joystickAutorizado ? "1" : "0.35";
    });

    const tabMonitoreo =
        document.getElementById("tab-monitoreo");

    if (tabMonitoreo) {
        const autorizado = puedeMonitorear();

        tabMonitoreo.hidden = !autorizado;
        tabMonitoreo.style.display =
            autorizado ? "" : "none";
    }
}


// =====================================================
// RESPUESTAS DE FASTAPI
// =====================================================

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
        return "No tienes permiso para esta función.";
    }

    if (codigo === 409) {
        return "El vehículo está ocupado.";
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


// =====================================================
// ENVÍO DE COMANDOS
// =====================================================

async function sendCommand(
    idComando,
    isDemo = false
) {
    if (isDemo) return false;

    const comando = Number(idComando);

    if (!COMANDOS_VALIDOS.has(comando)) {
        showLiveAction(
            "⚠️ COMANDO NO DEFINIDO: " + idComando
        );

        return false;
    }

    /*
     * VALIDACIÓN INDIVIDUAL
     *
     * Foco      = 5
     * Sonido    = 6
     * Velocidad = 7
     * Power     = 8
     *
     * Joysticks = 1-4, 9-12
     *
     * Apagar todo = 14
     */

    if (!puedeEnviarComando(comando)) {
        mostrarRechazo(comando);
        return false;
    }

    const idVehiculo = obtenerVehiculoActivo();

    if (!idVehiculo) {
        mostrarRechazo(comando);
        return false;
    }

    const url =
        `https://${CONFIG.API_URL_BASE}/api/movimiento`;

    try {
        const respuesta = await fetch(url, {
            method: "POST",
            headers: obtenerHeaders(),
            body: JSON.stringify({
                id_vehiculo: idVehiculo,
                id_comando: comando,
                origen: "WEB"
            })
        });

        await leerRespuesta(respuesta);

        console.log(
            "[CONTROL]",
            "Vehículo:", idVehiculo,
            "Comando:", comando
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

async function apagarTodoSistema(
    origen = "BOTON"
) {
    /*
     * APAGAR TODO debe estar permitido para
     * el propietario autorizado del vehículo.
     *
     * No depende de tener habilitados
     * Foco, Sonido o Velocidad.
     */

    if (!puedeEnviarComando(14)) {
        mostrarRechazo(14);
        return false;
    }

    const correcto = await sendCommand(
        CONFIG.COMANDOS.APAGAR_TODO
    );

    if (correcto) {
        fueEmergencia =
            origen === "BOTON";

        traccionActiva = false;
        herramientaActiva = false;

        ui.toggles.forEach(boton => {
            boton.classList.remove("active");
        });

        showLiveAction(
            "🛑 ORDEN APAGAR TODO ENVIADA"
        );
    }

    return correcto;
}


// =====================================================
// LIMPIAR DATOS AL CAMBIAR VEHÍCULO
// =====================================================

function limpiarDatosVehiculo() {
    traccionActiva = false;
    herramientaActiva = false;
    enDemo = false;
    fueEmergencia = false;

    ui.toggles.forEach(boton => {
        boton.classList.remove("active");
    });

    if (ui.ultimoComando) {
        ui.ultimoComando.textContent =
            "SIN DATOS";
    }

    if (ui.ultimaFecha) {
        ui.ultimaFecha.textContent =
            "--/--/----";
    }

    if (ui.ultimaHora) {
        ui.ultimaHora.textContent =
            "--:--:--";
    }

    if (ui.tablaHistorial) {
        ui.tablaHistorial.replaceChildren();

        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 4;
        celda.textContent =
            "Sin datos del vehículo seleccionado.";

        fila.append(celda);
        ui.tablaHistorial.append(fila);
    }

    if (ui.selectDemo) {
        ui.selectDemo.replaceChildren();

        const opcion = document.createElement("option");
        opcion.value = "";
        opcion.textContent =
            "✨ Selecciona una DEMO ✨";

        ui.selectDemo.append(opcion);
    }
}


// =====================================================
// WEBSOCKET
// =====================================================

function cerrarWebSocket() {
    if (reconexionWS !== null) {
        clearTimeout(reconexionWS);
        reconexionWS = null;
    }

    const anterior = ws;

    ws = null;
    wsVehiculoId = null;

    if (!anterior) return;

    anterior.onopen = null;
    anterior.onmessage = null;
    anterior.onerror = null;
    anterior.onclose = null;

    if (
        anterior.readyState === WebSocket.OPEN ||
        anterior.readyState === WebSocket.CONNECTING
    ) {
        anterior.close();
    }
}


function initWebSocket() {
    const idVehiculo = obtenerVehiculoActivo();

    if (!idVehiculo) return;

    if (
        ws &&
        wsVehiculoId === idVehiculo &&
        (
            ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    cerrarWebSocket();

    const generacion = generacionVehiculo;

    const direccion =
        `wss://${CONFIG.API_URL_BASE}` +
        `/ws/vehiculo/${idVehiculo}`;

    /*
     * Tomamos las credenciales del sistema
     * de sesiones existente en admin43.js.
     *
     * No colocamos tokens en la URL.
     */
    const headers = obtenerHeaders();

    const authorization =
        headers.Authorization ||
        headers.authorization ||
        "";

    const guestToken =
        headers["X-Guest-Token"] ||
        headers["x-guest-token"] ||
        "";

    let mensajeAuth = null;

    if (
        typeof authorization === "string" &&
        authorization.startsWith("Bearer ")
    ) {
        const token = authorization.slice(7).trim();

        if (token) {
            mensajeAuth = {
                tipo: "AUTH",
                token: token
            };
        }

    } else if (
        typeof guestToken === "string" &&
        guestToken.trim()
    ) {
        mensajeAuth = {
            tipo: "AUTH",
            guest_token: guestToken.trim()
        };
    }

    if (!mensajeAuth) {
        marcarIndicador(
            ui.wss,
            "warning",
            "link-slash"
        );

        console.warn(
            "[WSS] No hay una sesión o reserva válida."
        );

        return;
    }

    try {
        const conexion = new WebSocket(direccion);

        ws = conexion;
        wsVehiculoId = idVehiculo;

        let autenticado = false;

        marcarIndicador(
            ui.wss,
            "warning",
            "link"
        );

        conexion.onopen = () => {
            if (
                ws !== conexion ||
                generacion !== generacionVehiculo
            ) {
                return;
            }

            /*
             * El servidor acepta inicialmente
             * la conexión para recibir AUTH.
             *
             * Todavía no consideramos que
             * esté autenticada.
             */
            try {
                conexion.send(
                    JSON.stringify(mensajeAuth)
                );

                console.log(
                    "[WSS] Autenticación enviada."
                );

            } catch (error) {
                console.error(
                    "[WSS] Error enviando autenticación:",
                    error
                );

                conexion.close();
            }
        };

        conexion.onmessage = mensaje => {
            if (
                ws !== conexion ||
                generacion !== generacionVehiculo
            ) {
                return;
            }

            let data;

            try {
                data = JSON.parse(mensaje.data);
            } catch (error) {
                return;
            }

            if (
                data.vehiculo !== undefined &&
                data.vehiculo !== null &&
                Number(data.vehiculo) !== idVehiculo
            ) {
                return;
            }

            const evento = String(
                data.event || data.evento || ""
            ).toUpperCase();

            /*
             * Solo mostramos WSS conectado
             * cuando FastAPI confirma AUTH.
             */
            if (evento === "CONECTADO") {
                autenticado = true;

                marcarIndicador(
                    ui.wss,
                    "success",
                    "bolt"
                );

                showLiveAction(
                    "✨ WEBSOCKET AUTENTICADO ✨"
                );

                console.log(
                    "[WSS] Conexión autenticada.",
                    "Vehículo:",
                    idVehiculo
                );

                return;
            }

            /*
             * No procesamos eventos de CONTROL
             * antes de la confirmación del servidor.
             */
            if (!autenticado) return;

            procesarEventoWebSocket(data);
        };

        conexion.onerror = error => {
            console.error(
                "[WSS] Error de conexión:",
                error
            );

            marcarIndicador(
                ui.wss,
                "danger",
                "triangle-exclamation"
            );
        };

        conexion.onclose = evento => {
            if (
                ws !== conexion ||
                generacion !== generacionVehiculo
            ) {
                return;
            }

            ws = null;
            wsVehiculoId = null;

            marcarIndicador(
                ui.wss,
                "danger",
                "link-slash"
            );

            console.warn(
                "[WSS] Conexión cerrada.",
                "Código:",
                evento.code
            );

            /*
             * Código 1008:
             * FastAPI rechazó la autenticación
             * o el acceso al vehículo.
             *
             * No reintentamos automáticamente
             * con esas mismas credenciales.
             */
            if (evento.code === 1008) {
                showLiveAction(
                    "⚠️ WEBSOCKET NO AUTORIZADO"
                );

                return;
            }

            reconexionWS = setTimeout(() => {
                reconexionWS = null;

                if (
                    obtenerVehiculoActivo() === idVehiculo &&
                    obtenerVehiculoSesion() === idVehiculo
                ) {
                    initWebSocket();
                }

            }, 5000);
        };

    } catch (error) {
        console.error(
            "[WSS] No fue posible conectar:",
            error
        );

        marcarIndicador(
            ui.wss,
            "danger",
            "link-slash"
        );
    }
}



// =====================================================
// EVENTOS WEBSOCKET
// =====================================================

function procesarEventoWebSocket(data) {
    const evento = String(
        data.event || data.evento || ""
    ).toUpperCase();

    if (evento === "CONECTADO") {
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
            nombreComando(
                data.comando ?? data.id_comando
            )
        ).toUpperCase();

        if (!accion) return;

        showLiveAction(accion);

        const esApagado =
            Number(
                data.comando ?? data.id_comando
            ) === 14 ||
            accion === "APAGAR TODO";

        if (!esApagado || fueEmergencia) {
            actualizarTarjetaLocal(
                enDemo
                    ? "DEMO: " + accion
                    : accion
            );
        }

        fueEmergencia = false;

        actualizarHistorialSeguro();
    }
}


// =====================================================
// TARJETA DE ÚLTIMO MOVIMIENTO
// =====================================================

function actualizarTarjetaLocal(accion) {
    if (ui.ultimoComando) {
        ui.ultimoComando.textContent = accion;
    }

    const ahora = new Date();

    const fecha = ahora.toLocaleDateString(
        "es-MX",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

    const hora = ahora.toLocaleTimeString(
        "es-MX",
        {
            hour12: false
        }
    );

    if (ui.ultimaFecha) {
        ui.ultimaFecha.textContent = fecha;
    }

    if (ui.ultimaHora) {
        ui.ultimaHora.textContent = hora;
    }
}


// =====================================================
// MONITOREO
// =====================================================

function puedeUsarMonitoreoActual() {
    return puedeMonitorear();
}

async function actualizarUltimoEstadoSeguro() {
    if (!puedeUsarMonitoreoActual()) {
        return;
    }

    try {
        if (
            typeof cargarUltimoEstado === "function"
        ) {
            await cargarUltimoEstado();
        }
    } catch (error) {
        console.error(
            "[MONITOREO] Estado:",
            error
        );
    }
}

async function actualizarHistorialSeguro() {
    if (!puedeUsarMonitoreoActual()) {
        return;
    }

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

async function actualizarMonitoreo() {
    if (!puedeMonitorear()) {
        return;
    }

    await Promise.allSettled([
        actualizarUltimoEstadoSeguro(),
        actualizarHistorialSeguro()
    ]);
}


// =====================================================
// DEMOSTRACIONES
// =====================================================

async function actualizarDemosSeguro() {
    const idVehiculo = obtenerVehiculoActivo();

    if (!idVehiculo || !ui.selectDemo) {
        return;
    }

    const generacion = generacionVehiculo;

    try {
        const respuesta = await fetch(
            `https://${CONFIG.API_URL_BASE}` +
            `/api/vehiculos/${idVehiculo}/demos`,
            {
                method: "GET",
                headers: obtenerHeaders()
            }
        );

        const demos = await leerRespuesta(respuesta);

        if (
            generacion !== generacionVehiculo ||
            !Array.isArray(demos)
        ) {
            return;
        }

        ui.selectDemo.replaceChildren();

        const inicial = document.createElement("option");
        inicial.value = "";
        inicial.textContent =
            "✨ Selecciona una DEMO ✨";

        ui.selectDemo.append(inicial);

        demos.forEach(demo => {
            if (
                demo.id_demo === undefined ||
                demo.id_demo === null
            ) {
                return;
            }

            const opcion = document.createElement("option");

            opcion.value = String(demo.id_demo);

            opcion.textContent =
                String(
                    demo.nombre ||
                    `Demo ${demo.id_demo}`
                );

            ui.selectDemo.append(opcion);
        });

    } catch (error) {
        console.error(
            "[DEMOS] No se pudieron cargar:",
            error
        );
    }
}


// =====================================================
// SINCRONIZAR VEHÍCULO Y PERMISOS
// =====================================================

async function sincronizarVehiculo() {
    const nuevoId = obtenerVehiculoSesion();

    /*
     * Aunque el vehículo no haya cambiado,
     * sus permisos pueden haberse actualizado.
     */

    if (nuevoId === vehiculoActivoId) {
        actualizarControlesVisuales();
        return;
    }

    generacionVehiculo += 1;

    cerrarWebSocket();

    vehiculoActivoId = nuevoId;

    limpiarDatosVehiculo();

    if (ui.vehiculoInfo) {
        ui.vehiculoInfo.textContent = nuevoId
            ? "🚗 Vehículo " + nuevoId
            : "🚗 Sin vehículo seleccionado";
    }

    actualizarControlesVisuales();

    if (!nuevoId) {
        marcarIndicador(
            ui.wss,
            "warning",
            "link-slash"
        );

        showLiveAction(
            "⚠️ ESPERANDO VEHÍCULO AUTORIZADO"
        );

        return;
    }

    initWebSocket();

    await actualizarDemosSeguro();
    await actualizarMonitoreo();

    actualizarControlesVisuales();
}


// =====================================================
// JOYSTICK DE DESPLAZAMIENTO
// =====================================================

const joystickTraccion = new VirtualJoystick(
    "joystick-traccion",
    direction => {
        if (direction === null) {
            if (traccionActiva) {
                traccionActiva = false;

                apagarTodoSistema("JOYSTICK");
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

        if (comando === null) return;

        if (!puedeEnviarComando(comando)) {
            mostrarRechazo(comando);
            return;
        }

        traccionActiva = true;
        sendCommand(comando);
    }
);


// =====================================================
// JOYSTICK DE CABINA / GARRA
// =====================================================

const joystickHerramienta = new VirtualJoystick(
    "joystick-herramienta",
    direction => {
        if (direction === null) {
            if (herramientaActiva) {
                herramientaActiva = false;

                apagarTodoSistema("JOYSTICK");
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

        if (comando === null) return;

        if (!puedeEnviarComando(comando)) {
            mostrarRechazo(comando);
            return;
        }

        herramientaActiva = true;
        sendCommand(comando);
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

            if (!puedeEnviarComando(comando)) {
                mostrarRechazo(comando);
                return;
            }

            const correcto = await sendCommand(
                comando
            );

            if (correcto) {
                this.classList.toggle("active");
            }
        }
    );
});


// =====================================================
// BOTÓN APAGAR TODO
// =====================================================

if (ui.botonApagar) {
    ui.botonApagar.addEventListener(
        "click",
        async () => {
            await apagarTodoSistema("BOTON");
        }
    );
}


// =====================================================
// EJECUTAR DEMOSTRACIONES
// =====================================================

if (ui.botonDemo) {
    ui.botonDemo.addEventListener(
        "click",
        async () => {
            if (enviandoDemo) return;

            const idVehiculo = obtenerVehiculoActivo();
            const idDemo = ui.selectDemo?.value || "";

            if (!idDemo) {
                showLiveAction(
                    "SELECCIONA UNA DEMOSTRACIÓN"
                );

                return;
            }

            if (!puedeEjecutarDemo()) {
                mostrarRechazo();
                return;
            }

            enviandoDemo = true;
            ui.botonDemo.disabled = true;

            const url =
                `https://${CONFIG.API_URL_BASE}` +
                `/api/vehiculos/${idVehiculo}` +
                `/demos/${encodeURIComponent(idDemo)}/ejecutar`;

            try {
                const respuesta = await fetch(url, {
                    method: "POST",
                    headers: obtenerHeaders()
                });

                await leerRespuesta(respuesta);

                showLiveAction(
                    "🤖 DEMOSTRACIÓN FINALIZADA"
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
                enviandoDemo = false;
                actualizarControlesVisuales();
            }
        }
    );
}


// =====================================================
// ESTADO DE API Y RDS
// =====================================================


async function verificarServicios() {

    // ==========================================
    // 1. COMPROBAR FASTAPI
    // ==========================================

    try {
        const apiOk = await checkApiHealth();

        marcarIndicador(
            ui.api,
            apiOk ? "success" : "danger",
            apiOk ? "check" : "xmark"
        );

    } catch (error) {
        console.error(
            "[API] Error verificando servidor:",
            error
        );

        marcarIndicador(
            ui.api,
            "danger",
            "xmark"
        );
    }

    // ==========================================
    // 2. COMPROBAR AMAZON RDS
    // ==========================================

    try {
        const respuesta = await fetch(
            `https://${CONFIG.API_URL_BASE}/api/health/rds`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!respuesta.ok) {
            throw new Error(
                `HTTP ${respuesta.status}`
            );
        }

        const datos = await respuesta.json();

        const rdsConectado =
            datos.status === "ok" &&
            datos.rds === "connected";

        marcarIndicador(
            ui.rds,
            rdsConectado ? "success" : "danger",
            rdsConectado ? "database" : "xmark"
        );

        console.log(
            "[RDS]",
            rdsConectado
                ? "Amazon RDS conectado correctamente."
                : "Amazon RDS no disponible."
        );

    } catch (error) {
        console.error(
            "[RDS] Error de conexión:",
            error
        );

        marcarIndicador(
            ui.rds,
            "danger",
            "xmark"
        );
    }
}



// =====================================================
// COMUNICACIÓN CON ADMIN43.JS
// =====================================================

window.IOT_CONTROL = {
    refreshVehicle: sincronizarVehiculo,
    refreshPermissions: actualizarControlesVisuales,
    refreshMonitoring: actualizarMonitoreo,
    refreshDemos: actualizarDemosSeguro,

    getVehicle: obtenerVehiculoActivo
};

window.addEventListener(
    "iot:vehiculo-cambiado",
    () => {
        sincronizarVehiculo().catch(
            error => console.error(
                "[CONTROL] Cambio de vehículo:",
                error
            )
        );
    }
);

window.addEventListener(
    "iot:sesion-cambiada",
    () => {
        sincronizarVehiculo().catch(
            error => console.error(
                "[CONTROL] Cambio de sesión:",
                error
            )
        );
    }
);


// =====================================================
// INICIALIZACIÓN
// =====================================================

async function arrancarSistema() {
    if (inicializado) return;

    inicializado = true;

    console.log(
        "[IoT] Iniciando CONTROL 4.1 y MONITOREO 4.2"
    );

    showLiveAction(
        "INICIANDO PLATAFORMA IoT..."
    );

    await verificarServicios();
    await sincronizarVehiculo();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        arrancarSistema
    );
} else {
    arrancarSistema();
}
