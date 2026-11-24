
"use strict";

/*
=========================================================
API.JS - PLATAFORMA IoT
=========================================================

Funciones:
- Comprobar conexión con FastAPI.
- Cargar demostraciones.
- Consultar estado del vehículo.
- Consultar historial de movimientos.
- Respetar permisos de MONITOREO.
- Utilizar el vehículo seleccionado.
- Enviar credenciales de sesión.

La autorización definitiva se realiza en FastAPI.
=========================================================
*/


// =====================================================
// OBTENER VEHÍCULO SELECCIONADO
// =====================================================

function obtenerVehiculoAPI() {
    if (
        !window.IOT43 ||
        typeof window.IOT43.getVehicle !== "function"
    ) {
        return null;
    }

    const valor = window.IOT43.getVehicle();

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return null;
    }

    const id = Number(valor);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}


// =====================================================
// VERIFICAR PERMISOS DE MONITOREO
// =====================================================

function tienePermisoMonitoreoAPI() {
    if (
        !window.IOT43 ||
        typeof window.IOT43.canMonitor !== "function"
    ) {
        return false;
    }

    return (
        obtenerVehiculoAPI() !== null &&
        Boolean(window.IOT43.canMonitor())
    );
}


// =====================================================
// ENCABEZADOS DE AUTENTICACIÓN
// =====================================================

function obtenerHeadersAPI() {
    const headers = {
        "Accept": "application/json"
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
// CONSTRUIR DIRECCIONES DINÁMICAS
// =====================================================

function urlVehiculoAPI(idVehiculo, recurso) {
    return (
        `https://${CONFIG.API_URL_BASE}` +
        `/api/vehiculos/${idVehiculo}/${recurso}`
    );
}


// =====================================================
// COMPROBAR SI LA API ESTÁ DISPONIBLE
// =====================================================

async function checkApiHealth() {
    /*
     * No utilizamos /estado ni /historial,
     * porque esas rutas están protegidas.
     *
     * Conservamos la comprobación original
     * mediante DEMOS.
     *
     * Más adelante podremos sustituirla
     * por un endpoint público /health.
     */

    try {
        const respuesta = await fetch(
            CONFIG.ENDPOINTS.DEMOS,
            {
                method: "GET",
                cache: "no-store"
            }
        );

        return respuesta.ok;

    } catch (error) {
        console.error(
            "[API] Error contactando FastAPI:",
            error
        );

        return false;
    }
}


// =====================================================
// CARGAR DEMOSTRACIONES
// =====================================================

async function cargarDemosEnSelector() {
    const select = document.getElementById(
        "select-demo"
    );

    if (!select) return;

    const idVehiculo = obtenerVehiculoAPI();

    if (!idVehiculo) {
        select.replaceChildren();

        const opcion = document.createElement("option");

        opcion.value = "";
        opcion.textContent =
            "⚠️ Selecciona un vehículo";

        select.appendChild(opcion);

        return;
    }

    try {
        const respuesta = await fetch(
            urlVehiculoAPI(idVehiculo, "demos"),
            {
                method: "GET",
                headers: obtenerHeadersAPI()
            }
        );

        if (!respuesta.ok) {
            throw new Error(
                `HTTP ${respuesta.status}`
            );
        }

        const listaDemos = await respuesta.json();

        // Evita mostrar demos de un vehículo anterior.
        if (obtenerVehiculoAPI() !== idVehiculo) {
            return;
        }

        select.replaceChildren();

        const inicial = document.createElement("option");

        inicial.value = "";
        inicial.textContent =
            "✨ Selecciona una DEMO ✨";

        select.appendChild(inicial);

        if (!Array.isArray(listaDemos)) {
            return;
        }

        listaDemos.forEach(demo => {
            const idDemo =
                demo.id_demo ??
                demo.id ??
                demo.ID;

            if (
                idDemo === null ||
                idDemo === undefined
            ) {
                return;
            }

            const opcion = document.createElement(
                "option"
            );

            opcion.value = String(idDemo);

            opcion.textContent =
                demo.nombre ||
                demo.nombre_demo ||
                `Demo #${idDemo}`;

            select.appendChild(opcion);
        });

    } catch (error) {
        console.error(
            "[DEMOS] Error cargando demos:",
            error
        );

        if (obtenerVehiculoAPI() !== idVehiculo) {
            return;
        }

        select.replaceChildren();

        const opcion = document.createElement("option");

        opcion.value = "";
        opcion.textContent =
            "⚠️ Error cargando demos";

        select.appendChild(opcion);
    }
}


// =====================================================
// FORMATO DE FECHA Y HORA
// =====================================================

function formatearFechaHora(isoString) {
    if (!isoString) {
        return {
            fecha: "--/--/----",
            hora: "--:--:--"
        };
    }

    let texto = String(isoString).trim();

    /*
     * Conservamos la interpretación UTC
     * utilizada en tu archivo anterior.
     *
     * Si ya existe una zona horaria,
     * no añadimos otra letra Z.
     */

    const tieneZona =
        /(?:Z|[+-]\d{2}:\d{2})$/i.test(texto);

    if (!tieneZona) {
        texto += "Z";
    }

    const fechaObj = new Date(texto);

    if (Number.isNaN(fechaObj.getTime())) {
        return {
            fecha: "--/--/----",
            hora: "--:--:--"
        };
    }

    const dia = String(
        fechaObj.getDate()
    ).padStart(2, "0");

    const mes = String(
        fechaObj.getMonth() + 1
    ).padStart(2, "0");

    const anio = fechaObj.getFullYear();

    const horas = String(
        fechaObj.getHours()
    ).padStart(2, "0");

    const minutos = String(
        fechaObj.getMinutes()
    ).padStart(2, "0");

    const segundos = String(
        fechaObj.getSeconds()
    ).padStart(2, "0");

    return {
        fecha: `${dia}/${mes}/${anio}`,
        hora: `${horas}:${minutos}:${segundos}`
    };
}


// =====================================================
// CONSULTAR ÚLTIMO ESTADO
// =====================================================

async function cargarUltimoEstado() {
    if (!tienePermisoMonitoreoAPI()) {
        console.log(
            "[MONITOREO] Consulta de estado omitida."
        );

        return false;
    }

    const idVehiculo = obtenerVehiculoAPI();

    const elementoComando = document.getElementById(
        "um-comando"
    );

    const elementoFecha = document.getElementById(
        "um-fecha"
    );

    const elementoHora = document.getElementById(
        "um-hora"
    );

    try {
        const respuesta = await fetch(
            urlVehiculoAPI(idVehiculo, "estado"),
            {
                method: "GET",
                headers: obtenerHeadersAPI(),
                cache: "no-store"
            }
        );

        if (!respuesta.ok) {
            throw new Error(
                `HTTP ${respuesta.status}`
            );
        }

        const estado = await respuesta.json();

        /*
         * Si cambió el vehículo o se retiró
         * el permiso mientras llegaba la respuesta,
         * descartamos esos datos.
         */

        if (
            obtenerVehiculoAPI() !== idVehiculo ||
            !tienePermisoMonitoreoAPI()
        ) {
            return false;
        }

        if (elementoComando) {
            elementoComando.textContent =
                estado.comando || "DESCONOCIDO";
        }

        const fh = formatearFechaHora(
            estado.fecha_actualizacion
        );

        if (elementoFecha) {
            elementoFecha.textContent = fh.fecha;
        }

        if (elementoHora) {
            elementoHora.textContent = fh.hora;
        }

        return true;

    } catch (error) {
        console.error(
            "[MONITOREO] Error consultando estado:",
            error
        );

        if (
            obtenerVehiculoAPI() !== idVehiculo ||
            !tienePermisoMonitoreoAPI()
        ) {
            return false;
        }

        if (elementoComando) {
            elementoComando.textContent =
                "ERROR AL CONSULTAR";
        }

        return false;
    }
}


// =====================================================
// CONSULTAR HISTORIAL
// =====================================================

async function cargarHistorial() {
    if (!tienePermisoMonitoreoAPI()) {
        console.log(
            "[MONITOREO] Consulta de historial omitida."
        );

        return false;
    }

    const idVehiculo = obtenerVehiculoAPI();

    const tbody = document.getElementById(
        "tabla-historial"
    );

    if (!tbody) return false;

    try {
        const respuesta = await fetch(
            urlVehiculoAPI(idVehiculo, "historial"),
            {
                method: "GET",
                headers: obtenerHeadersAPI(),
                cache: "no-store"
            }
        );

        if (!respuesta.ok) {
            throw new Error(
                `HTTP ${respuesta.status}`
            );
        }

        const historial = await respuesta.json();

        if (
            obtenerVehiculoAPI() !== idVehiculo ||
            !tienePermisoMonitoreoAPI()
        ) {
            return false;
        }

        tbody.replaceChildren();

        if (
            !Array.isArray(historial) ||
            historial.length === 0
        ) {
            const fila = document.createElement("tr");
            const celda = document.createElement("td");

            celda.colSpan = 4;
            celda.className =
                "text-center py-3";

            celda.textContent = "Sin registros";

            fila.appendChild(celda);
            tbody.appendChild(fila);

            return true;
        }

        historial.slice(0, 10).forEach(
            (movimiento, index) => {
                const fh = formatearFechaHora(
                    movimiento.fecha_hora
                );

                const nombreLimpio = String(
                    movimiento.comando || "DESCONOCIDO"
                ).replace(/_/g, " ");

                const fila = document.createElement("tr");

                const datos = [
                    String(index + 1),
                    nombreLimpio,
                    fh.fecha,
                    fh.hora
                ];

                datos.forEach((dato, indice) => {
                    const celda =
                        document.createElement("td");

                    celda.textContent = dato;

                    if (indice === 1) {
                        celda.className = "fw-bold";
                    }

                    fila.appendChild(celda);
                });

                tbody.appendChild(fila);
            }
        );

        return true;

    } catch (error) {
        console.error(
            "[MONITOREO] Error consultando historial:",
            error
        );

        if (
            obtenerVehiculoAPI() !== idVehiculo ||
            !tienePermisoMonitoreoAPI()
        ) {
            return false;
        }

        tbody.replaceChildren();

        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 4;
        celda.className =
            "text-center text-danger py-3";

        celda.textContent =
            "Error al cargar historial";

        fila.appendChild(celda);
        tbody.appendChild(fila);

        return false;
    }
}
