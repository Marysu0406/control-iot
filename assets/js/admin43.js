
/*
==========================================================
ADMINISTRACION 4.3 - PLATAFORMA IoT
==========================================================

CONTROL 4.1 + MONITOREO 4.2 + ADMINISTRACION 4.3

Roles:
- ADMINISTRADOR
- USUARIO
- INVITADO

Vehiculos dinamicos:
- Administrador: selecciona unidad
- Usuario: sus unidades asignadas
- Invitado: unidad reservada

Permisos individuales:
- Joysticks
- Monitoreo
- Foco
- Sonido
- Velocidad
- Power
- Ejecutar demos
- Editar demos

La autorizacion definitiva corresponde a FastAPI.
==========================================================
*/

(() => {
    "use strict";

    const BASE = `https://${CONFIG.API_URL_BASE}`;
    const TOKEN_KEY = "iot43_token";

    const PERMISOS = [
        "joystick",
        "monitoreo",
        "foco",
        "sonido",
        "velocidad",
        "power",
        "ejecutar_demos",
        "editar_demos"
    ];

    const IDS_PERMISOS = {
        joystick: "adm-perm-joystick",
        monitoreo: "adm-perm-monitoreo",
        foco: "adm-perm-foco",
        sonido: "adm-perm-sonido",
        velocidad: "adm-perm-velocidad",
        power: "adm-perm-power",
        ejecutar_demos: "adm-perm-ejecutar-demos",
        editar_demos: "adm-perm-editar-demos"
    };

    const COMANDO_PERMISO = {
        1: "joystick",
        2: "joystick",
        3: "joystick",
        4: "joystick",
        5: "foco",
        6: "sonido",
        7: "velocidad",
        8: "power",
        9: "joystick",
        10: "joystick",
        11: "joystick",
        12: "joystick"
    };

    const el = id => document.getElementById(id);

    const val = id =>
        String(el(id)?.value ?? "").trim();

    const safe = valor =>
        String(valor ?? "—");

    const permisosVacios = () =>
        Object.fromEntries(
            PERMISOS.map(nombre => [nombre, false])
        );

    const state = {
        token: sessionStorage.getItem(TOKEN_KEY) || "",
        perfil: null,

        flota: [],
        usuarios: [],
        modelos: [],
        vehiculos: [],
        demos: [],

        vehiculoActivo: null,
        permisosActuales: permisosVacios(),

        guest: "",
        guestVehicleId: null,
        guestExpiresAt: 0,
        guestTimer: null,

        permisosCargados: false,
        permisosUsuarioId: null,
        permisosVehiculoId: null,

        cargando: false,
        iniciandoSesion: false,
        reservando: false
    };

    // ======================================================
    // MENSAJES
    // ======================================================

    function msg(texto, error = false) {
        const nodo = el("admin-msg");

        if (nodo) {
            nodo.textContent = texto;
            nodo.style.color = error
                ? "#b42335"
                : "#256c47";
        }

        console[error ? "warn" : "log"](
            "[ADMIN 4.3]",
            texto
        );
    }

    function msgAcceso(texto, error = false) {
        const nodo = el("acceso-mensaje");

        if (!nodo) return;

        nodo.textContent = texto;
        nodo.style.color = error
            ? "#ff6666"
            : "#256c47";
    }

    function msgPermisos(texto, error = false) {
        const nodo = el("adm-permisos-mensaje");

        if (!nodo) return;

        nodo.textContent = texto;
        nodo.style.color = error
            ? "#b42335"
            : "#256c47";
    }

    async function run(funcion) {
        try {
            return await funcion();
        } catch (error) {
            console.error("[ADMIN 4.3]", error);
            msg(error.message, true);
            return null;
        }
    }

    // ======================================================
    // SOLICITUDES A FASTAPI
    // ======================================================

    async function api(
        ruta,
        metodo = "GET",
        cuerpo = undefined,
        tipo = "AUTO"
    ) {
        const headers = {};

        if (cuerpo !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        if (
            tipo === "USUARIO" ||
            (tipo === "AUTO" && state.token)
        ) {
            if (state.token) {
                headers.Authorization =
                    `Bearer ${state.token}`;
            }
        }

        if (
            tipo === "INVITADO" ||
            (
                tipo === "AUTO" &&
                !state.token &&
                state.guest
            )
        ) {
            if (state.guest) {
                headers["X-Guest-Token"] = state.guest;
            }
        }

        let respuesta;

        try {
            respuesta = await fetch(BASE + ruta, {
                method: metodo,
                headers,
                body: cuerpo === undefined
                    ? undefined
                    : JSON.stringify(cuerpo)
            });
        } catch (error) {
            throw new Error(
                "No se pudo conectar con FastAPI."
            );
        }

        let datos = {};

        try {
            datos = await respuesta.json();
        } catch (error) {
            datos = {};
        }

        if (!respuesta.ok) {
            let detalle = datos.detail;

            if (Array.isArray(detalle)) {
                detalle = detalle
                    .map(item => item.msg || "Dato inválido")
                    .join("; ");
            }

            const error = new Error(
                typeof detalle === "string"
                    ? detalle
                    : `Error HTTP ${respuesta.status}`
            );

            error.status = respuesta.status;
            throw error;
        }

        return datos;
    }

    // ======================================================
    // VALIDACIONES
    // ======================================================

    function idValido(valor) {
        if (
            valor === null ||
            valor === undefined ||
            valor === ""
        ) {
            return null;
        }

        const numero = Number(valor);

        return (
            Number.isSafeInteger(numero) &&
            numero > 0
        ) ? numero : null;
    }

    function esAdministrador() {
        return (
            state.perfil?.rol === "ADMINISTRADOR" &&
            Boolean(state.token)
        );
    }

    function esUsuario() {
        return (
            state.perfil?.rol === "USUARIO" &&
            Boolean(state.token)
        );
    }

    function invitadoVigente() {
        return Boolean(
            state.guest &&
            state.guestVehicleId &&
            Date.now() < state.guestExpiresAt
        );
    }

    function tieneVehiculo(id) {
        return state.flota.some(
            v => Number(v.id_vehiculo) === Number(id)
        );
    }

    function getRole() {
        if (esAdministrador()) return "ADMINISTRADOR";
        if (esUsuario()) return "USUARIO";
        if (invitadoVigente()) return "INVITADO";

        return "SIN_SESION";
    }

    function getVehicle() {
        return idValido(state.vehiculoActivo);
    }

    function getPermisos() {
        return { ...state.permisosActuales };
    }

    function puedeUsarPermiso(nombre) {
        if (!getVehicle()) return false;

        if (esAdministrador()) return true;

        if (esUsuario()) {
            return (
                tieneVehiculo(getVehicle()) &&
                state.permisosActuales[nombre] === true
            );
        }

        if (invitadoVigente()) {
            return (
                getVehicle() ===
                Number(state.guestVehicleId) &&
                nombre !== "editar_demos"
            );
        }

        return false;
    }

    function canControl() {
        if (!getVehicle()) return false;

        return [
            "joystick",
            "foco",
            "sonido",
            "velocidad",
            "power"
        ].some(puedeUsarPermiso);
    }

    function canCommand(comando) {
        const numero = Number(comando);

        if (numero === 14) {
            return (
                esAdministrador() ||
                (
                    esUsuario() &&
                    tieneVehiculo(getVehicle())
                ) ||
                (
                    invitadoVigente() &&
                    getVehicle() ===
                    Number(state.guestVehicleId)
                )
            );
        }

        const permiso = COMANDO_PERMISO[numero];

        return Boolean(
            permiso &&
            puedeUsarPermiso(permiso)
        );
    }

    function canDemo() {
        return puedeUsarPermiso("ejecutar_demos");
    }

    function canMonitor() {
        return puedeUsarPermiso("monitoreo");
    }

    function headersParaControl() {
        if (
            state.token &&
            (esAdministrador() || esUsuario())
        ) {
            return {
                Authorization: `Bearer ${state.token}`
            };
        }

        if (invitadoVigente()) {
            return {
                "X-Guest-Token": state.guest
            };
        }

        return {};
    }

    // ======================================================
    // COMUNICAR CAMBIOS A APP.JS
    // ======================================================

    function avisarCambioSesion() {
        window.dispatchEvent(
            new Event("iot:sesion-cambiada")
        );
    }

    function avisarCambioVehiculo() {
        window.dispatchEvent(
            new Event("iot:vehiculo-cambiado")
        );
    }

    // ======================================================
    // SELECTORES GENERALES
    // ======================================================

    function opt(valor, etiqueta) {
        const opcion = document.createElement("option");

        opcion.value = String(valor ?? "");
        opcion.textContent = String(etiqueta ?? "");

        return opcion;
    }

    function updateSelect(
        id,
        datos,
        textoInicial,
        etiqueta
    ) {
        const select = el(id);

        if (!select) return;

        const anterior = select.value;

        select.replaceChildren(
            opt("", textoInicial)
        );

        datos.forEach(item => {
            select.append(
                opt(item.id, etiqueta(item))
            );
        });

        if (
            anterior &&
            Array.from(select.options).some(
                opcion => opcion.value === anterior
            )
        ) {
            select.value = anterior;
        }
    }

    // ======================================================
    // TABLAS
    // ======================================================

    function fillTable(
        id,
        encabezados,
        filas,
        obtenerValores
    ) {
        const tabla = el(id);

        if (!tabla) return;

        tabla.replaceChildren();

        const thead = document.createElement("thead");
        const cabecera = document.createElement("tr");

        encabezados.forEach(titulo => {
            const th = document.createElement("th");

            th.textContent = titulo;
            cabecera.append(th);
        });

        thead.append(cabecera);
        tabla.append(thead);

        const tbody = document.createElement("tbody");

        if (!filas.length) {
            const fila = document.createElement("tr");
            const celda = document.createElement("td");

            celda.colSpan = encabezados.length;
            celda.textContent =
                "No hay registros disponibles.";

            fila.append(celda);
            tbody.append(fila);
        }

        filas.forEach(item => {
            const fila = document.createElement("tr");

            obtenerValores(item).forEach(valor => {
                const celda = document.createElement("td");

                celda.textContent = safe(valor);
                fila.append(celda);
            });

            tbody.append(fila);
        });

        tabla.append(tbody);
    }

    // ======================================================
    // SELECTOR DINÁMICO DEL ADMINISTRADOR
    // ======================================================

    function crearSelectorVehiculo() {
        const barra = el("barra-sesion");

        if (
            !barra ||
            el("iot-selector-vehiculo")
        ) {
            return;
        }

        const contenedor = document.createElement("div");
        contenedor.id = "iot-contenedor-vehiculo";
        contenedor.style.display = "none";
        contenedor.style.flex = "1";
        contenedor.style.maxWidth = "280px";

        const select = document.createElement("select");

        select.id = "iot-selector-vehiculo";
        select.className = "form-select form-select-sm";

        select.setAttribute(
            "aria-label",
            "Seleccionar vehículo a controlar"
        );

        select.append(
            opt("", "Seleccionar vehículo")
        );

        contenedor.append(select);

        const botonSalir = el("btn-salir-plataforma");

        if (botonSalir) {
            barra.insertBefore(contenedor, botonSalir);
        } else {
            barra.append(contenedor);
        }

        select.addEventListener(
            "change",
            () => run(async () => {
                if (!esAdministrador()) return;

                const id = idValido(select.value);

                state.vehiculoActivo = id;

                aplicarPermisosAdministrador();

                redraw();
                avisarCambioVehiculo();
            })
        );
    }

    function actualizarSelectorVehiculo() {
        crearSelectorVehiculo();

        const contenedor = el("iot-contenedor-vehiculo");

        if (contenedor) {
            contenedor.style.display =
                esAdministrador() ? "block" : "none";
        }

        if (!esAdministrador()) return;

        updateSelect(
            "iot-selector-vehiculo",
            state.vehiculos.map(v => ({
                id: v.id_vehiculo,
                nombre: `#${v.id_vehiculo} ${v.nombre}`
            })),
            "Seleccionar vehículo",
            v => v.nombre
        );

        const selector = el("iot-selector-vehiculo");

        if (selector) {
            selector.value =
                String(state.vehiculoActivo || "");
        }
    }

    // ======================================================
    // PERMISOS DEL VEHÍCULO ACTIVO
    // ======================================================

    function aplicarPermisosAdministrador() {
        if (!esAdministrador()) return;

        state.permisosActuales = Object.fromEntries(
            PERMISOS.map(nombre => [nombre, true])
        );
    }

    async function cargarPermisosPropios() {
        state.permisosActuales = permisosVacios();

        if (!esUsuario()) return;

        const idVehiculo = getVehicle();

        if (
            !idVehiculo ||
            !tieneVehiculo(idVehiculo)
        ) {
            return;
        }

        /*
         * Esta ruta se implementará en FastAPI
         * en el próximo paso.
         *
         * Hasta entonces se mantienen denegados
         * los permisos individuales.
         */
        const datos = await api(
            `/api/admin/mi-permisos/${idVehiculo}`,
            "GET",
            undefined,
            "USUARIO"
        );

        if (
            !datos.permisos ||
            typeof datos.permisos !== "object"
        ) {
            throw new Error(
                "FastAPI no devolvió los permisos."
            );
        }

        state.permisosActuales = Object.fromEntries(
            PERMISOS.map(nombre => [
                nombre,
                datos.permisos[nombre] === true
            ])
        );
    }

    async function seleccionarVehiculo(id) {
        const elegido = idValido(id);

        if (!elegido) {
            state.vehiculoActivo = null;
            state.permisosActuales = permisosVacios();

            redraw();
            avisarCambioVehiculo();
            return;
        }

        if (esUsuario() && !tieneVehiculo(elegido)) {
            throw new Error(
                "El vehículo no pertenece a este usuario."
            );
        }

        if (
            invitadoVigente() &&
            elegido !== Number(state.guestVehicleId)
        ) {
            throw new Error(
                "El vehículo no corresponde a la reserva."
            );
        }

        if (esAdministrador()) {
            const existe = state.vehiculos.some(
                v => Number(v.id_vehiculo) === elegido
            );

            if (!existe) {
                throw new Error(
                    "Selecciona un vehículo registrado."
                );
            }
        }

        state.vehiculoActivo = elegido;
        state.permisosActuales = permisosVacios();

        if (esAdministrador()) {
            aplicarPermisosAdministrador();
        } else if (esUsuario()) {
            await cargarPermisosPropios();
        } else if (invitadoVigente()) {
            state.permisosActuales = {
                ...permisosVacios(),
                joystick: true,
                monitoreo: true,
                foco: true,
                sonido: true,
                velocidad: true,
                power: true,
                ejecutar_demos: true
            };
        }

        redraw();
        avisarCambioVehiculo();
    }

    // ======================================================
    // PANTALLAS
    // ======================================================

    function mostrarAcceso() {
        const acceso = el("pantalla-acceso");
        const app = el("aplicacion-iot");

        if (acceso) {
            acceso.hidden = false;
            acceso.style.display = "flex";
        }

        if (app) {
            app.hidden = true;
            app.style.display = "none";
        }
    }

    function mostrarAplicacion() {
        const acceso = el("pantalla-acceso");
        const app = el("aplicacion-iot");

        if (acceso) {
            acceso.hidden = true;
            acceso.style.display = "none";
        }

        if (app) {
            app.hidden = false;
            app.style.display = "flex";
        }
    }

    function panelLogin() {
        if (el("acceso-panel-login")) {
            el("acceso-panel-login").hidden = false;
        }

        if (el("acceso-panel-invitado")) {
            el("acceso-panel-invitado").hidden = true;
        }

        msgAcceso("");
    }

    function panelInvitado() {
        if (el("acceso-panel-login")) {
            el("acceso-panel-login").hidden = true;
        }

        if (el("acceso-panel-invitado")) {
            el("acceso-panel-invitado").hidden = false;
        }

        msgAcceso("");
    }

    function view(tab) {
        if (
            tab === "tab-administracion" &&
            !esAdministrador()
        ) {
            tab = "tab-control";
        }

        if (
            tab === "tab-monitoreo" &&
            !canMonitor()
        ) {
            tab = "tab-control";
        }

        [
            ["tab-control", "view-control"],
            ["tab-monitoreo", "view-monitoreo"],
            ["tab-administracion", "view-administracion"]
        ].forEach(([botonId, vistaId]) => {
            const boton = el(botonId);
            const vista = el(vistaId);

            const activa = botonId === tab;

            if (boton) {
                boton.classList.toggle("active", activa);
            }

            if (vista) {
                vista.style.display =
                    activa ? "flex" : "none";
            }
        });

        if (
            tab === "tab-administracion" &&
            esAdministrador()
        ) {
            run(fetchAll);
        }

        window.scrollTo(0, 0);
    }

    // ======================================================
    // ACTUALIZAR INTERFAZ
    // ======================================================

    function redraw() {
        const rol = getRole();

        const identidad = el("admin-identidad");
        const etiqueta = el("sesion-etiqueta");

        let nombre = "Sin sesión";

        if (state.perfil) {
            nombre =
                `${state.perfil.nombre} · ${rol}`;
        } else if (invitadoVigente()) {
            nombre =
                "INVITADO · Reserva temporal";
        }

        if (identidad) identidad.textContent = nombre;
        if (etiqueta) etiqueta.textContent = nombre;

        const barra = el("barra-sesion");

        if (barra) {
            barra.hidden = rol === "SIN_SESION";
            barra.style.display =
                rol === "SIN_SESION"
                    ? "none"
                    : "flex";
        }

        const tabAdmin = el("tab-administracion");

        if (tabAdmin) {
            tabAdmin.hidden = !esAdministrador();
            tabAdmin.style.display =
                esAdministrador() ? "" : "none";
        }

        const tabMonitor = el("tab-monitoreo");

        if (tabMonitor) {
            tabMonitor.hidden = !canMonitor();
            tabMonitor.style.display =
                canMonitor() ? "" : "none";
        }

        if (el("admin-panel")) {
            el("admin-panel").hidden =
                !esAdministrador();
        }

        if (el("admin-cliente")) {
            el("admin-cliente").hidden =
                !esUsuario();
        }

        if (el("admin-publico")) {
            el("admin-publico").hidden =
                Boolean(state.perfil);
        }

        if (el("admin-invitado")) {
            el("admin-invitado").hidden =
                Boolean(state.perfil);
        }

        if (el("admin-login")) {
            el("admin-login").hidden =
                Boolean(state.perfil);
        }

        if (el("admin-logout")) {
            el("admin-logout").hidden =
                !state.perfil;
        }

        if (el("admin-flota")) {
            el("admin-flota").hidden =
                !esUsuario();
        }

        [
            ["btn-foco", 5],
            ["btn-sonido", 6],
            ["btn-velocidad", 7],
            ["btn-detener", 14]
        ].forEach(([id, comando]) => {
            const boton = el(id);

            if (boton) {
                boton.disabled = !canCommand(comando);
            }
        });

        const botonDemo = el("btn-play-demo");

        if (botonDemo) {
            botonDemo.disabled = !canDemo();
        }

        const aviso = el("admin-aviso-control");

        if (aviso) {
            aviso.hidden = canControl();

            aviso.textContent = canControl()
                ? "Control autorizado."
                : "No hay funciones de control autorizadas.";
        }

        const flota = el("admin-mi-flota");

        if (flota) {
            flota.textContent = state.flota.length
                ? state.flota.map(v =>
                    `#${v.id_vehiculo} ${v.nombre}`
                ).join(" · ")
                : "Sin vehículos asignados.";
        }

        actualizarSelectorVehiculo();
        renderCliente();

        if (rol === "SIN_SESION") {
            mostrarAcceso();
        } else {
            mostrarAplicacion();
        }
    }

    // ======================================================
    // AUTENTICACIÓN Y FLOTA
    // ======================================================

    async function cargarPerfil() {
        if (!state.token) {
            state.perfil = null;
            state.flota = [];
            return;
        }

        try {
            state.perfil = await api(
                "/api/auth/me",
                "GET",
                undefined,
                "USUARIO"
            );

        } catch (error) {
            state.perfil = null;
            state.flota = [];

            if (
                error.status === 401 ||
                error.status === 403
            ) {
                state.token = "";
                sessionStorage.removeItem(TOKEN_KEY);
            }

            throw error;
        }

        state.flota = [];

        if (esUsuario()) {
            try {
                const flota = await api(
                    "/api/admin/mi-flota",
                    "GET",
                    undefined,
                    "USUARIO"
                );

                if (Array.isArray(flota)) {
                    state.flota = flota;
                }

            } catch (error) {
                msg(
                    "No se pudo consultar la flota.",
                    true
                );
            }

            const primeraUnidad =
                state.flota.length
                    ? Number(state.flota[0].id_vehiculo)
                    : null;

            state.vehiculoActivo = primeraUnidad;

            try {
                await cargarPermisosPropios();
            } catch (error) {
                state.permisosActuales =
                    permisosVacios();

                console.warn(
                    "[PERMISOS] Pendiente de verificar:",
                    error.message
                );
            }
        }

        if (esAdministrador()) {
            await fetchAll();

            const existeActual =
                state.vehiculos.some(v =>
                    Number(v.id_vehiculo) ===
                    Number(state.vehiculoActivo)
                );

            if (!existeActual) {
                state.vehiculoActivo =
                    state.vehiculos.length
                        ? Number(
                            state.vehiculos[0].id_vehiculo
                        )
                        : null;
            }

            aplicarPermisosAdministrador();
        }

        redraw();
        avisarCambioSesion();
    }

    async function iniciarSesion(correo, password) {
        if (state.iniciandoSesion) return;

        state.iniciandoSesion = true;

        const boton = el("acceso-btn-login");

        if (boton) boton.disabled = true;

        msgAcceso("Verificando credenciales...");

        try {
            const datos = await api(
                "/api/auth/login",
                "POST",
                { correo, password },
                "PUBLICO"
            );

            if (!datos.token) {
                throw new Error(
                    "FastAPI no devolvió un token."
                );
            }

            state.token = datos.token;

            sessionStorage.setItem(
                TOKEN_KEY,
                datos.token
            );

            state.guest = "";
            state.guestVehicleId = null;
            state.guestExpiresAt = 0;

            detenerContador();

            await cargarPerfil();

            if (!state.perfil) {
                throw new Error(
                    "No se pudo verificar el perfil."
                );
            }

            if (el("acceso-password")) {
                el("acceso-password").value = "";
            }

            if (el("adm-password")) {
                el("adm-password").value = "";
            }

            redraw();
            view("tab-control");

            msg(`Sesión iniciada: ${state.perfil.rol}`);

        } catch (error) {
            msgAcceso(error.message, true);
            msg(error.message, true);

        } finally {
            state.iniciandoSesion = false;

            if (boton) boton.disabled = false;
        }
    }

    async function cerrarSesion() {
        if (state.guest) {
            await finalizarInvitado();
        }

        if (state.token) {
            try {
                await api(
                    "/api/auth/logout",
                    "POST",
                    undefined,
                    "USUARIO"
                );
            } catch (error) {
                console.warn(
                    "[AUTH] No se confirmó el cierre remoto.",
                    error
                );
            }
        }

        state.token = "";
        state.perfil = null;
        state.flota = [];
        state.vehiculoActivo = null;
        state.permisosActuales = permisosVacios();

        state.guest = "";
        state.guestVehicleId = null;
        state.guestExpiresAt = 0;

        sessionStorage.removeItem(TOKEN_KEY);

        detenerContador();
        limpiarPermisos();

        redraw();
        avisarCambioSesion();
        panelLogin();
    }

    // ======================================================
    // SELECTORES Y TABLAS DE INVENTARIO
    // ======================================================

    function renderCliente() {
        const destino = el("adm-cliente-lista");

        if (!destino) return;

        destino.replaceChildren();

        if (!esUsuario()) return;

        if (!state.flota.length) {
            destino.textContent =
                "No tienes unidades asignadas.";
            return;
        }

        state.flota.forEach(v => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "admin43-unidad";

            const titulo = document.createElement("strong");
            titulo.textContent =
                `${v.nombre} · Vehículo #${v.id_vehiculo}`;

            const estado = document.createElement("small");
            estado.textContent =
                `Estado: ${v.estado_comercial || "Sin verificar"}`;

            tarjeta.append(titulo, estado);

            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = "Seleccionar vehículo";

            boton.addEventListener(
                "click",
                () => run(async () => {
                    await seleccionarVehiculo(v.id_vehiculo);
                    view("tab-control");
                })
            );

            tarjeta.append(boton);
            destino.append(tarjeta);
        });
    }

    function renderData() {
        fillTable(
            "adm-tabla-usuarios",
            ["ID", "Nombre", "Correo", "Rol", "Activo"],
            state.usuarios,
            u => [
                u.id_usuario,
                u.nombre,
                u.correo,
                u.rol,
                u.activo ? "Sí" : "No"
            ]
        );

        fillTable(
            "adm-tabla-modelos",
            ["ID", "Modelo", "Descripción", "Activo"],
            state.modelos,
            m => [
                m.id_modelo,
                m.nombre,
                m.descripcion,
                m.activo ? "Sí" : "No"
            ]
        );

        fillTable(
            "adm-tabla-vehiculos",
            [
                "ID",
                "Unidad",
                "Modelo",
                "Propietario",
                "Estado",
                "Serie"
            ],
            state.vehiculos,
            v => [
                v.id_vehiculo,
                v.nombre,
                v.nombre_modelo,
                v.propietario,
                v.estado_comercial,
                v.numero_serie
            ]
        );

        fillTable(
            "adm-tabla-demos",
            ["ID", "Nombre", "Vehículo", "Tipo"],
            state.demos,
            d => [
                d.id_demo,
                d.nombre,
                d.id_vehiculo,
                d.tipo_demo
            ]
        );

        updateSelect(
            "adm-vehiculo",
            state.vehiculos.map(v => ({
                id: v.id_vehiculo,
                nombre: `#${v.id_vehiculo} ${v.nombre}`
            })),
            "Seleccionar unidad",
            v => v.nombre
        );

        updateSelect(
            "adm-modelo",
            state.modelos.map(m => ({
                id: m.id_modelo,
                nombre: m.nombre
            })),
            "Sin modelo",
            m => m.nombre
        );

        updateSelect(
            "adm-propietario",
            state.usuarios
                .filter(u =>
                    u.rol === "USUARIO" &&
                    Boolean(u.activo)
                )
                .map(u => ({
                    id: u.id_usuario,
                    nombre: u.nombre
                })),
            "Sin propietario",
            u => u.nombre
        );

        updateSelect(
            "adm-edit-usuario",
            state.usuarios
                .filter(u => u.rol === "USUARIO")
                .map(u => ({
                    id: u.id_usuario,
                    nombre: u.nombre
                })),
            "Seleccionar comprador",
            u => u.nombre
        );

        updateSelect(
            "adm-edit-modelo",
            state.modelos.map(m => ({
                id: m.id_modelo,
                nombre: m.nombre
            })),
            "Seleccionar modelo",
            m => m.nombre
        );

        updateSelect(
            "adm-crear-demo-unidad",
            state.vehiculos.map(v => ({
                id: v.id_vehiculo,
                nombre: v.nombre
            })),
            "Seleccionar unidad",
            v => v.nombre
        );

        updateSelect(
            "adm-mov-demo-id",
            state.demos.map(d => ({
                id: d.id_demo,
                nombre: d.nombre
            })),
            "Seleccionar demo",
            d => d.nombre
        );

        updateSelect(
            "adm-demo",
            state.demos.map(d => ({
                id: d.id_demo,
                nombre: d.nombre
            })),
            "Seleccionar demo",
            d => d.nombre
        );

        actualizarSelectoresPermisos();
    }

    function renderMetricas() {
        const destino = el("adm-metricas");

        if (!destino) return;

        const indicadores = [
            [
                "Compradores",
                state.usuarios.filter(
                    u => u.rol === "USUARIO"
                ).length
            ],
            ["Modelos", state.modelos.length],
            ["Unidades", state.vehiculos.length],
            [
                "Asignadas",
                state.vehiculos.filter(
                    v => v.id_propietario != null
                ).length
            ],
            [
                "Exhibición",
                state.vehiculos.filter(
                    v => v.estado_comercial === "EXHIBICION"
                ).length
            ],
            ["Demos", state.demos.length]
        ];

        destino.replaceChildren();

        indicadores.forEach(([titulo, cantidad]) => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "admin43-metrica";

            const numero = document.createElement("strong");
            numero.textContent = cantidad;

            const etiqueta = document.createElement("span");
            etiqueta.textContent = titulo;

            tarjeta.append(numero, etiqueta);
            destino.append(tarjeta);
        });
    }

    async function fetchAll() {
        if (!esAdministrador() || state.cargando) {
            return;
        }

        state.cargando = true;

        const consultas = [
            ["usuarios", "/api/admin/usuarios"],
            ["modelos", "/api/admin/modelos"],
            ["vehiculos", "/api/admin/vehiculos"],
            ["demos", "/api/admin/demos"]
        ];

        try {
            const resultados = await Promise.allSettled(
                consultas.map(async ([nombre, ruta]) => {
                    const datos = await api(ruta);

                    if (!Array.isArray(datos)) {
                        throw new Error(
                            `${nombre} no devolvió una lista.`
                        );
                    }

                    return datos;
                })
            );

            const errores = [];

            resultados.forEach((resultado, indice) => {
                const nombre = consultas[indice][0];

                if (resultado.status === "fulfilled") {
                    state[nombre] = resultado.value;
                } else {
                    errores.push(
                        `${nombre}: ${resultado.reason.message}`
                    );
                }
            });

            renderData();
            renderMetricas();
            actualizarSelectorVehiculo();

            if (errores.length) {
                msg(
                    "Algunas consultas fallaron: " +
                    errores.join(" | "),
                    true
                );
            } else {
                msg("Inventario actualizado.");
            }

        } finally {
            state.cargando = false;
        }
    }

    // ======================================================
    // PANEL ADMINISTRATIVO DE PERMISOS
    // ======================================================

    function actualizarSelectoresPermisos() {
        updateSelect(
            "adm-perm-usuario",
            state.usuarios
                .filter(u => u.rol === "USUARIO")
                .map(u => ({
                    id: u.id_usuario,
                    nombre: u.nombre
                })),
            "Seleccionar comprador",
            u => u.nombre
        );

        actualizarVehiculosPermisos();
    }

    function actualizarVehiculosPermisos() {
        const idUsuario = Number(
            val("adm-perm-usuario")
        );

        const disponibles = state.vehiculos
            .filter(v =>
                idUsuario > 0 &&
                Number(v.id_propietario) === idUsuario
            )
            .map(v => ({
                id: v.id_vehiculo,
                nombre: `#${v.id_vehiculo} ${v.nombre}`
            }));

        updateSelect(
            "adm-perm-vehiculo",
            disponibles,
            disponibles.length
                ? "Seleccionar vehículo"
                : "Sin vehículos asignados",
            v => v.nombre
        );
    }

    function limpiarPermisos() {
        state.permisosCargados = false;
        state.permisosUsuarioId = null;
        state.permisosVehiculoId = null;

        PERMISOS.forEach(nombre => {
            const nodo = el(IDS_PERMISOS[nombre]);

            if (nodo) nodo.checked = false;
        });

        const formulario = el("adm-form-permisos");

        if (formulario) {
            formulario.hidden = true;
            formulario.style.display = "none";
        }

        msgPermisos("");
    }

    function colocarPermisos(permisos) {
        PERMISOS.forEach(nombre => {
            const nodo = el(IDS_PERMISOS[nombre]);

            if (nodo) {
                nodo.checked =
                    permisos[nombre] === true;
            }
        });
    }

    async function consultarPermisos() {
        if (!esAdministrador()) {
            throw new Error(
                "Se requiere Administrador."
            );
        }

        const idUsuario = Number(
            val("adm-perm-usuario")
        );

        const idVehiculo = Number(
            val("adm-perm-vehiculo")
        );

        limpiarPermisos();

        if (!idUsuario || !idVehiculo) {
            throw new Error(
                "Selecciona un comprador y su vehículo."
            );
        }

        const datos = await api(
            `/api/admin/permisos/${idUsuario}/${idVehiculo}`,
            "GET",
            undefined,
            "USUARIO"
        );

        if (!datos.permisos) {
            throw new Error(
                "FastAPI no devolvió los permisos."
            );
        }

        colocarPermisos(datos.permisos);

        state.permisosCargados = true;
        state.permisosUsuarioId = idUsuario;
        state.permisosVehiculoId = idVehiculo;

        const formulario = el("adm-form-permisos");

        if (formulario) {
            formulario.hidden = false;
            formulario.style.display = "block";
        }

        msgPermisos(
            datos.configurado
                ? "Permisos cargados correctamente."
                : "Sin configuración. Selecciona los permisos y guarda."
        );
    }

    async function guardarPermisos() {
        if (!esAdministrador()) {
            throw new Error(
                "Se requiere Administrador."
            );
        }

        const idUsuario = Number(
            val("adm-perm-usuario")
        );

        const idVehiculo = Number(
            val("adm-perm-vehiculo")
        );

        if (
            !state.permisosCargados ||
            idUsuario !== state.permisosUsuarioId ||
            idVehiculo !== state.permisosVehiculoId
        ) {
            throw new Error(
                "Consulta nuevamente los permisos."
            );
        }

        const permisos = Object.fromEntries(
            PERMISOS.map(nombre => [
                nombre,
                Boolean(
                    el(IDS_PERMISOS[nombre])?.checked
                )
            ])
        );

        const resultado = await api(
            `/api/admin/permisos/${idUsuario}/${idVehiculo}`,
            "PUT",
            permisos,
            "USUARIO"
        );

        if (!resultado.ok) {
            throw new Error(
                "El servidor no confirmó el guardado."
            );
        }

        msgPermisos(
            "Permisos guardados correctamente en Amazon RDS."
        );
    }

    // ======================================================
    // CATÁLOGO DE EXHIBICIÓN
    // ======================================================

    async function cargarCatalogo() {
        const destino = el("adm-catalogo-publico");

        if (!destino) return;

        const unidades = await api(
            "/api/invitados/exhibicion",
            "GET",
            undefined,
            "PUBLICO"
        );

        destino.replaceChildren();

        if (!Array.isArray(unidades)) return;

        unidades.forEach(v => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "admin43-unidad";

            const titulo = document.createElement("strong");
            titulo.textContent = v.nombre;

            const descripcion = document.createElement("p");
            descripcion.textContent =
                v.descripcion || "Vehículo de exhibición.";

            tarjeta.append(titulo, descripcion);
            destino.append(tarjeta);
        });
    }

    // ======================================================
    // INVITADOS
    // ======================================================

    
async function cargarExhibicion() {
    // Consultar vehículos disponibles para exhibición
    const unidades = await api(
        "/api/invitados/exhibicion",
        "GET",
        undefined,
        "PUBLICO"
    );

    if (!Array.isArray(unidades)) {
        throw new Error(
            "El servidor no devolvió una lista."
        );
    }

    /*
     * El servidor determina cuáles vehículos
     * están habilitados para exhibición.
     *
     * Ya no filtramos por CONFIG.VEHICULO_ID.
     */

    const lista = unidades
        .filter(v =>
            Number.isSafeInteger(
                Number(v.id_vehiculo)
            ) &&
            Number(v.id_vehiculo) > 0
        )
        .map(v => ({
            id: Number(v.id_vehiculo),
            nombre:
                `#${v.id_vehiculo} ` +
                (v.nombre || "Vehículo IoT")
        }));

    // Selector del formulario de invitado
    updateSelect(
        "acceso-invitado-vehiculo",
        lista,
        "Seleccionar vehículo",
        v => v.nombre
    );

    // Selector de reservas en Administración
    updateSelect(
        "adm-select-invitado",
        lista,
        "Seleccionar vehículo",
        v => v.nombre
    );

    console.log(
        "[INVITADOS] Vehículos de exhibición:",
        lista.length
    );
}

    async function reservarInvitado(idVehiculo) {
        if (state.reservando) return;

        const id = idValido(idVehiculo);

        if (!id) {
            throw new Error(
                "Selecciona un vehículo de exhibición."
            );
        }

        state.reservando = true;

        try {
            const reserva = await api(
                "/api/invitados/reservar",
                "POST",
                { id_vehiculo: id },
                "PUBLICO"
            );

            if (!reserva.token_invitado) {
                throw new Error(
                    "FastAPI no devolvió el token de invitado."
                );
            }

            state.token = "";
            state.perfil = null;
            state.flota = [];

            sessionStorage.removeItem(TOKEN_KEY);

            state.guest = reserva.token_invitado;
            state.guestVehicleId = id;
            state.guestExpiresAt =
                Date.now() +
                Number(reserva.duracion_minutos || 10) *
                60000;

            await seleccionarVehiculo(id);

            iniciarContador();

            redraw();
            avisarCambioSesion();
            view("tab-control");

        } finally {
            state.reservando = false;
        }
    }

    function detenerContador() {
        if (state.guestTimer !== null) {
            clearInterval(state.guestTimer);
            state.guestTimer = null;
        }

        const reloj = el("sesion-tiempo");

        if (reloj) {
            reloj.hidden = true;
            reloj.textContent = "";
        }
    }

    function actualizarContador() {
        if (!state.guest) {
            detenerContador();
            return;
        }

        const restante = Math.max(
            0,
            state.guestExpiresAt - Date.now()
        );

        const segundos = Math.ceil(restante / 1000);

        const minutos = Math.floor(segundos / 60);
        const resto = segundos % 60;

        const reloj = el("sesion-tiempo");

        if (reloj) {
            reloj.hidden = false;
            reloj.textContent =
                `Tiempo: ${String(minutos).padStart(2, "0")}:` +
                `${String(resto).padStart(2, "0")}`;
        }

        if (restante === 0) {
            state.guest = "";
            state.guestVehicleId = null;
            state.guestExpiresAt = 0;

            state.vehiculoActivo = null;
            state.permisosActuales = permisosVacios();

            detenerContador();

            redraw();
            avisarCambioSesion();
            panelInvitado();

            msgAcceso(
                "Tu reserva terminó. Puedes solicitar otra.",
                true
            );
        }
    }

    function iniciarContador() {
        detenerContador();

        actualizarContador();

        state.guestTimer = setInterval(
            actualizarContador,
            1000
        );
    }

    async function finalizarInvitado() {
        if (!state.guest) return;

        try {
            await api(
                "/api/invitados/finalizar",
                "POST",
                undefined,
                "INVITADO"
            );
        } catch (error) {
            console.warn(
                "[INVITADO] No se confirmó la finalización.",
                error
            );
        }

        state.guest = "";
        state.guestVehicleId = null;
        state.guestExpiresAt = 0;

        detenerContador();
    }

    // ======================================================
    // OPERACIONES ADMINISTRATIVAS
    // ======================================================

    function conectarFormulario(id, funcion) {
        el(id)?.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                run(async () => {
                    if (!esAdministrador()) {
                        throw new Error(
                            "Se requiere Administrador."
                        );
                    }

                    await funcion();
                    await fetchAll();
                });
            }
        );
    }

    conectarFormulario(
        "adm-crear-usuario",
        async () => {
            await api(
                "/api/admin/usuarios",
                "POST",
                {
                    nombre: val("adm-nombre-usuario"),
                    correo: val("adm-correo-usuario"),
                    password: el("adm-clave-usuario").value,
                    rol: "USUARIO"
                }
            );

            el("adm-clave-usuario").value = "";
            msg("Comprador registrado.");
        }
    );

    conectarFormulario(
        "adm-editar-usuario",
        async () => {
            const id = Number(val("adm-edit-usuario"));

            const anterior = state.usuarios.find(
                u => Number(u.id_usuario) === id
            );

            if (!anterior) {
                throw new Error(
                    "Selecciona un comprador."
                );
            }

            await api(
                `/api/admin/usuarios/${id}`,
                "PATCH",
                {
                    nombre:
                        val("adm-edit-nombre") ||
                        anterior.nombre,
                    activo: el("adm-edit-activo").checked
                }
            );

            msg("Comprador actualizado.");
        }
    );

    conectarFormulario(
        "adm-crear-modelo",
        async () => {
            let capacidades = {};

            if (val("adm-capacidades")) {
                try {
                    capacidades = JSON.parse(
                        val("adm-capacidades")
                    );
                } catch (error) {
                    throw new Error(
                        "JSON de capacidades inválido."
                    );
                }
            }

            await api(
                "/api/admin/modelos",
                "POST",
                {
                    nombre: val("adm-nombre-modelo"),
                    descripcion: val("adm-desc-modelo"),
                    capacidades
                }
            );

            msg("Modelo creado.");
        }
    );

    conectarFormulario(
        "adm-editar-modelo",
        async () => {
            const id = Number(val("adm-edit-modelo"));

            const anterior = state.modelos.find(
                m => Number(m.id_modelo) === id
            );

            if (!anterior) {
                throw new Error(
                    "Selecciona un modelo."
                );
            }

            let capacidades =
                anterior.capacidades_json || {};

            if (typeof capacidades === "string") {
                try {
                    capacidades = JSON.parse(capacidades);
                } catch (error) {
                    capacidades = {};
                }
            }

            await api(
                `/api/admin/modelos/${id}`,
                "PUT",
                {
                    nombre:
                        val("adm-edit-nombre-modelo") ||
                        anterior.nombre,
                    descripcion:
                        val("adm-edit-desc-modelo") ||
                        anterior.descripcion ||
                        "",
                    capacidades,
                    activo:
                        el("adm-edit-modelo-activo").checked
                }
            );

            msg("Modelo actualizado.");
        }
    );

    conectarFormulario(
        "adm-nueva-unidad",
        async () => {
            await api(
                "/api/admin/vehiculos",
                "POST",
                {
                    nombre: val("adm-unidad-nombre"),
                    descripcion: val("adm-unidad-desc"),
                    ip_asignada: val("adm-unidad-ip"),
                    estado_comercial: "DISPONIBLE"
                }
            );

            msg("Unidad registrada.");
        }
    );

    conectarFormulario(
        "adm-guardar-unidad",
        async () => {
            const id = Number(val("adm-vehiculo"));

            if (!id) {
                throw new Error(
                    "Selecciona una unidad."
                );
            }

            await api(
                `/api/admin/vehiculos/${id}`,
                "PATCH",
                {
                    id_modelo:
                        val("adm-modelo")
                            ? Number(val("adm-modelo"))
                            : null,

                    id_propietario:
                        val("adm-propietario")
                            ? Number(val("adm-propietario"))
                            : null,

                    estado_comercial:
                        val("adm-estado-comercial"),

                    numero_serie:
                        val("adm-serie") || null
                }
            );

            limpiarPermisos();
            msg("Asignación guardada.");
        }
    );

    conectarFormulario(
        "adm-crear-demo",
        async () => {
            const id = Number(
                val("adm-crear-demo-unidad")
            );

            if (!id) {
                throw new Error(
                    "Selecciona una unidad."
                );
            }

            await api(
                "/api/demos",
                "POST",
                {
                    id_vehiculo: id,
                    nombre: val("adm-nombre-demo"),
                    descripcion: val("adm-desc-demo")
                }
            );

            msg("Demostración creada.");
        }
    );

    conectarFormulario(
        "adm-mov-demo",
        async () => {
            const idDemo = Number(
                val("adm-mov-demo-id")
            );

            const comando = Number(
                val("adm-mov-comando")
            );

            if (!idDemo) {
                throw new Error(
                    "Selecciona una demostración."
                );
            }

            if (![
                1, 2, 3, 4, 5, 6, 7,
                8, 9, 10, 11, 12, 14
            ].includes(comando)) {
                throw new Error(
                    "Comando no definido."
                );
            }

            await api(
                "/api/demos/movimientos",
                "POST",
                {
                    id_demo: idDemo,
                    id_comando: comando,
                    orden: Number(val("adm-mov-orden")),
                    duracion_ms: Number(
                        val("adm-mov-duracion")
                    ),
                    pausa_ms: Number(
                        val("adm-mov-pausa")
                    )
                }
            );

            msg("Movimiento agregado.");
        }
    );

    conectarFormulario(
        "adm-eliminar-mov",
        async () => {
            const id = Number(
                val("adm-eliminar-mov-id")
            );

            if (!id) {
                throw new Error(
                    "Indica el ID del movimiento."
                );
            }

            if (!confirm(
                "¿Eliminar este movimiento?"
            )) {
                return;
            }

            await api(
                `/api/demos/movimientos/${id}`,
                "DELETE"
            );

            msg("Movimiento eliminado.");
        }
    );

    conectarFormulario(
        "adm-guardar-demo",
        async () => {
            const id = Number(val("adm-demo"));

            if (!id) {
                throw new Error(
                    "Selecciona una demostración."
                );
            }

            await api(
                `/api/admin/demos/${id}`,
                "PATCH",
                {
                    tipo_demo: val("adm-tipo-demo")
                }
            );

            msg("Clasificación actualizada.");
        }
    );

    // ======================================================
    // CONSULTAR MOVIMIENTOS
    // ======================================================

    el("adm-cargar-movs")?.addEventListener(
        "click",
        () => run(async () => {
            const id = Number(
                val("adm-mov-demo-id")
            );

            if (!id) {
                throw new Error(
                    "Selecciona una demostración."
                );
            }

            const movimientos = await api(
                `/api/demos/${id}/movimientos`
            );

            fillTable(
                "adm-tabla-movs",
                [
                    "ID",
                    "Comando",
                    "Orden",
                    "Duración ms",
                    "Pausa ms"
                ],
                Array.isArray(movimientos)
                    ? movimientos
                    : [],
                m => [
                    m.id_movimiento_demo,
                    m.id_comando,
                    m.orden,
                    m.duracion_ms,
                    m.pausa_ms
                ]
            );
        })
    );

    // ======================================================
    // AUDITORÍA
    // ======================================================

    el("adm-cargar-auditoria")?.addEventListener(
        "click",
        () => run(async () => {
            const registros = await api(
                "/api/admin/auditoria"
            );

            fillTable(
                "adm-tabla-auditoria",
                [
                    "Fecha",
                    "Acción",
                    "Usuario",
                    "Vehículo"
                ],
                Array.isArray(registros)
                    ? registros
                    : [],
                r => [
                    r.fecha_hora,
                    r.accion,
                    r.id_usuario,
                    r.id_vehiculo
                ]
            );

            msg("Auditoría actualizada.");
        })
    );

    // ======================================================
    // EVENTOS DE NAVEGACIÓN
    // ======================================================

    [
        "tab-control",
        "tab-monitoreo",
        "tab-administracion"
    ].forEach(id => {
        el(id)?.addEventListener(
            "click",
            () => view(id)
        );
    });

    // ======================================================
    // EVENTOS DE INICIO DE SESIÓN
    // ======================================================

    el("acceso-login-form")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            iniciarSesion(
                val("acceso-correo"),
                el("acceso-password").value
            );
        }
    );

    el("adm-login-form")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            iniciarSesion(
                val("adm-correo"),
                el("adm-password").value
            );
        }
    );

    el("btn-salir-plataforma")?.addEventListener(
        "click",
        () => run(cerrarSesion)
    );

    el("admin-logout")?.addEventListener(
        "click",
        () => run(cerrarSesion)
    );

    // ======================================================
    // EVENTOS DE INVITADOS
    // ======================================================

    el("acceso-btn-invitado")?.addEventListener(
        "click",
        () => {
            panelInvitado();
            run(cargarExhibicion);
        }
    );

    el("acceso-btn-volver")?.addEventListener(
        "click",
        panelLogin
    );

    el("acceso-btn-reservar")?.addEventListener(
        "click",
        () => run(async () => {
            try {
                await reservarInvitado(
                    Number(
                        val("acceso-invitado-vehiculo")
                    )
                );
            } catch (error) {
                msgAcceso(error.message, true);
                throw error;
            }
        })
    );

    el("adm-publico-catalogo")?.addEventListener(
        "click",
        () => run(cargarCatalogo)
    );

    el("adm-cargar-exhibicion")?.addEventListener(
        "click",
        () => run(cargarExhibicion)
    );

    el("adm-reservar")?.addEventListener(
        "click",
        () => run(async () => {
            await reservarInvitado(
                Number(val("adm-select-invitado"))
            );
        })
    );

    el("adm-finalizar-reserva")?.addEventListener(
        "click",
        () => run(async () => {
            await finalizarInvitado();

            state.vehiculoActivo = null;
            state.permisosActuales = permisosVacios();

            redraw();
            avisarCambioSesion();
        })
    );

    // ======================================================
    // EVENTOS DE ADMINISTRACIÓN DE PERMISOS
    // ======================================================

    el("adm-perm-usuario")?.addEventListener(
        "change",
        () => {
            limpiarPermisos();
            actualizarVehiculosPermisos();
        }
    );

    el("adm-perm-vehiculo")?.addEventListener(
        "change",
        limpiarPermisos
    );

    el("adm-cargar-permisos")?.addEventListener(
        "click",
        () => run(async () => {
            try {
                await consultarPermisos();
            } catch (error) {
                msgPermisos(error.message, true);
                throw error;
            }
        })
    );

    el("adm-form-permisos")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                try {
                    await guardarPermisos();
                } catch (error) {
                    msgPermisos(error.message, true);
                    throw error;
                }
            });
        }
    );

    // ======================================================
    // INTEGRACIÓN CON CONTROL 4.1
    // ======================================================

    window.IOT43 = {
        canControl,
        canCommand,
        canDemo,
        canMonitor,
        headers: headersParaControl,
        getRole,
        getVehicle,
        getPermisos,

        reject: () => {
            msg(
                "Acceso denegado o permiso no autorizado.",
                true
            );
        }
    };

    // ======================================================
    // INICIALIZACIÓN
    // ======================================================

    async function iniciarAplicacion() {
        mostrarAcceso();
        crearSelectorVehiculo();
        limpiarPermisos();

        if (state.token) {
            try {
                await cargarPerfil();
            } catch (error) {
                console.warn(
                    "[AUTH] No se pudo recuperar la sesión:",
                    error
                );

                msgAcceso(error.message, true);
            }
        }

        redraw();

        if (getRole() !== "SIN_SESION") {
            view("tab-control");
        } else {
            panelLogin();
        }
    }

    iniciarAplicacion().catch(error => {
        console.error(
            "[ADMIN 4.3] Error al iniciar:",
            error
        );

        mostrarAcceso();

        msgAcceso(
            "No se pudo iniciar la plataforma.",
            true
        );
    });

})();
