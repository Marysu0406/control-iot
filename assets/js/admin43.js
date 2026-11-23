
/*
 * ==========================================================
 * ADMINISTRACION 4.3 - PLATAFORMA IoT
 * ==========================================================
 *
 * Roles:
 * - ADMINISTRADOR
 * - USUARIO
 * - INVITADO
 *
 * Integracion:
 * - FastAPI
 * - Amazon RDS MySQL
 * - CONTROL 4.1
 * - MONITOREO 4.2
 *
 * IMPORTANTE:
 * Los permisos del frontend solo controlan la interfaz.
 * FastAPI debe verificar todos los permisos nuevamente.
 */

(() => {
    "use strict";

    // ======================================================
    // CONFIGURACION
    // ======================================================

    const BASE = `https://${CONFIG.API_URL_BASE}`;

    const TOKEN_KEY = "iot43_token";

    const el = id => document.getElementById(id);

    const val = id => {
        const elemento = el(id);
        return elemento?.value?.trim() || "";
    };

    const safe = valor => String(valor ?? "—");

    const state = {
        token: sessionStorage.getItem(TOKEN_KEY) || "",
        guest: "",
        guestVehicleId: null,
        perfil: null,
        flota: [],
        modelos: [],
        usuarios: [],
        vehiculos: [],
        demos: [],
        cargando: false
    };

    // ======================================================
    // MENSAJES
    // ======================================================

    function msg(texto, error = false) {
        const destino = el("admin-msg");

        if (!destino) return;

        destino.textContent = texto;

        destino.style.color = error
            ? "#b42335"
            : "#256c47";
    }

    // ======================================================
    // SOLICITUDES AL BACKEND
    // ======================================================

    async function api(
        ruta,
        metodo = "GET",
        cuerpo = undefined,
        invitado = false
    ) {
        const headers = {};

        if (cuerpo !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        if (invitado) {
            if (state.guest) {
                headers["X-Guest-Token"] = state.guest;
            }
        } else if (state.token) {
            headers["Authorization"] =
                `Bearer ${state.token}`;
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
                "No se pudo conectar con FastAPI en AWS."
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

            if (typeof detalle !== "string") {
                detalle = `Error HTTP ${respuesta.status}`;
            }

            const error = new Error(detalle);

            error.status = respuesta.status;
            error.ruta = ruta;

            throw error;
        }

        return datos;
    }

    // ======================================================
    // FUNCION DE EJECUCION SEGURA
    // ======================================================

    async function run(funcion) {
        try {
            await funcion();
        } catch (error) {
            console.error(
                "[ADMIN 4.3]",
                error
            );

            msg(error.message, true);
        }
    }

    // ======================================================
    // HERRAMIENTAS PARA SELECTORES
    // ======================================================

    function opt(valor, texto) {
        const opcion = document.createElement("option");

        opcion.value = String(valor ?? "");
        opcion.textContent = String(texto ?? "");

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

        const existe = Array.from(select.options)
            .some(opcion => opcion.value === anterior);

        if (anterior && existe) {
            select.value = anterior;
        }
    }

    // ======================================================
    // HERRAMIENTAS PARA TABLAS
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
        const trHead = document.createElement("tr");

        encabezados.forEach(titulo => {
            const th = document.createElement("th");
            th.textContent = titulo;
            trHead.append(th);
        });

        thead.append(trHead);
        tabla.append(thead);

        const tbody = document.createElement("tbody");

        if (!filas.length) {
            const filaVacia = document.createElement("tr");
            const celda = document.createElement("td");

            celda.colSpan = encabezados.length;
            celda.textContent = "No hay registros disponibles.";
            celda.className = "text-center";

            filaVacia.append(celda);
            tbody.append(filaVacia);
        }

        filas.forEach(fila => {
            const tr = document.createElement("tr");

            obtenerValores(fila).forEach(valor => {
                const td = document.createElement("td");

                td.textContent = safe(valor);
                tr.append(td);
            });

            tbody.append(tr);
        });

        tabla.append(tbody);
    }

    // ======================================================
    // PERMISOS
    // ======================================================

    function esAdministrador() {
        return state.perfil?.rol === "ADMINISTRADOR";
    }

    function esUsuario() {
        return state.perfil?.rol === "USUARIO";
    }

    function tieneVehiculo(idVehiculo) {
        return state.flota.some(vehiculo =>
            Number(vehiculo.id_vehiculo) ===
            Number(idVehiculo)
        );
    }

    function canControl() {
        if (!state.perfil || !state.token) {
            return false;
        }

        if (esAdministrador()) {
            return true;
        }

        if (esUsuario()) {
            return tieneVehiculo(CONFIG.VEHICULO_ID);
        }

        return false;
    }

    function canDemo() {
        if (canControl()) {
            return true;
        }

        return (
            Boolean(state.guest) &&
            Number(state.guestVehicleId) ===
            Number(CONFIG.VEHICULO_ID)
        );
    }

    function headersParaControl() {
        if (canControl() && state.token) {
            return {
                Authorization: `Bearer ${state.token}`
            };
        }

        if (canDemo() && state.guest) {
            return {
                "X-Guest-Token": state.guest
            };
        }

        return {};
    }

    // ======================================================
    // ESTADO DE LA INTERFAZ
    // ======================================================

    function redraw() {
        const rol = state.perfil?.rol || null;

        const identidad = el("admin-identidad");

        if (identidad) {
            if (rol) {
                identidad.textContent =
                    `${state.perfil.nombre} · ${rol}`;
            } else if (state.guest) {
                identidad.textContent =
                    "INVITADO · Reserva temporal";
            } else {
                identidad.textContent = "Sin sesión";
            }
        }

        if (el("admin-login")) {
            el("admin-login").hidden = Boolean(rol);
        }

        if (el("admin-logout")) {
            el("admin-logout").hidden = !rol;
        }

        if (el("admin-panel")) {
            el("admin-panel").hidden =
                rol !== "ADMINISTRADOR";
        }

        if (el("admin-cliente")) {
            el("admin-cliente").hidden =
                rol !== "USUARIO";
        }

        if (el("admin-publico")) {
            el("admin-publico").hidden = Boolean(rol);
        }

        if (el("admin-invitado")) {
            el("admin-invitado").hidden = Boolean(rol);
        }

        if (el("admin-flota")) {
            el("admin-flota").hidden =
                rol !== "USUARIO";
        }

        const permitido = canControl();

        const aviso = el("admin-aviso-control");

        if (aviso) {
            aviso.hidden = permitido;

            aviso.textContent = permitido
                ? "Control habilitado para su cuenta."
                : "El control manual requiere una cuenta autorizada para el vehículo.";
        }

        // Restringir botones de control manual.
        // No se habilitan para invitados.
        [
            "btn-foco",
            "btn-sonido",
            "btn-velocidad"
        ].forEach(id => {
            const boton = el(id);

            if (boton) {
                boton.disabled = !permitido;
            }
        });

        // El botón de apagado no debe permitir
        // acciones no autorizadas desde la web.
        // El backend debe validar el comando 14.
        const botonApagar = el("btn-detener");

        if (botonApagar) {
            botonApagar.disabled = !permitido;
        }

        const botonDemo = el("btn-play-demo");

        if (botonDemo) {
            botonDemo.disabled = !canDemo();
        }

        const flota = el("admin-mi-flota");

        if (flota) {
            flota.textContent = state.flota.length
                ? state.flota.map(vehiculo =>
                    `#${vehiculo.id_vehiculo} ${vehiculo.nombre}`
                ).join(" · ")
                : "No hay vehículos asignados.";
        }

        renderCliente();
    }

    // ======================================================
    // NAVEGACION DE PANTALLAS
    // ======================================================

    function view(tab) {
        const vistas = [
            ["tab-control", "view-control"],
            ["tab-monitoreo", "view-monitoreo"],
            ["tab-administracion", "view-administracion"]
        ];

        vistas.forEach(([botonId, vistaId]) => {
            const boton = el(botonId);
            const seccion = el(vistaId);

            const activa = botonId === tab;

            if (boton) {
                boton.classList.toggle("active", activa);
            }

            if (seccion) {
                seccion.style.display = activa
                    ? "flex"
                    : "none";
            }
        });

        if (
            tab === "tab-administracion" &&
            esAdministrador()
        ) {
            run(fetchAll);
        }
    }

    // ======================================================
    // CARGAR SESION
    // ======================================================

    async function loadMe() {
        if (!state.token) {
            state.perfil = null;
            state.flota = [];

            redraw();
            return;
        }

        // PRIMERA CONSULTA:
        // Solo un error de autenticacion invalida
        // debe eliminar la sesion.
        try {
            state.perfil = await api("/api/auth/me");
        } catch (error) {
            if (
                error.status === 401 ||
                error.status === 403
            ) {
                state.token = "";
                state.perfil = null;
                state.flota = [];

                sessionStorage.removeItem(TOKEN_KEY);

                redraw();

                msg(
                    "La sesión no es válida. Inicia sesión nuevamente.",
                    true
                );

                return;
            }

            // Un problema de red no implica
            // que las credenciales sean incorrectas.
            state.perfil = null;
            state.flota = [];

            redraw();
            msg(error.message, true);

            return;
        }

        // SEGUNDA CONSULTA:
        // Una falla al consultar la flota
        // NO elimina una sesion valida.
        state.flota = [];

        if (esUsuario()) {
            try {
                const flota = await api(
                    "/api/admin/mi-flota"
                );

                if (Array.isArray(flota)) {
                    state.flota = flota;
                } else {
                    console.warn(
                        "[ADMIN] mi-flota no devolvió una lista."
                    );
                }

            } catch (error) {
                console.warn(
                    "[ADMIN] No se pudo consultar la flota:",
                    error
                );

                msg(
                    "Sesión iniciada, pero no se pudo consultar la flota: " +
                    error.message,
                    true
                );
            }
        }

        redraw();

        if (esAdministrador()) {
            await fetchAll();
        }
    }

    // ======================================================
    // TABLAS DE INVENTARIO
    // ======================================================

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

        // Selector de unidades.
        updateSelect(
            "adm-vehiculo",
            state.vehiculos.map(v => ({
                id: v.id_vehiculo,
                nombre: `#${v.id_vehiculo} ${v.nombre}`
            })),
            "Seleccionar unidad",
            v => v.nombre
        );

        // Selector de modelos.
        updateSelect(
            "adm-modelo",
            state.modelos.map(m => ({
                id: m.id_modelo,
                nombre: m.nombre
            })),
            "Sin modelo asignado",
            m => m.nombre
        );

        // Selector de propietarios.
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

        // Editar comprador.
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

        // Editar modelo.
        updateSelect(
            "adm-edit-modelo",
            state.modelos.map(m => ({
                id: m.id_modelo,
                nombre: m.nombre
            })),
            "Seleccionar modelo",
            m => m.nombre
        );

        // Unidad para demostracion.
        updateSelect(
            "adm-crear-demo-unidad",
            state.vehiculos.map(v => ({
                id: v.id_vehiculo,
                nombre: v.nombre
            })),
            "Seleccionar unidad",
            v => v.nombre
        );

        // Selector para movimientos.
        updateSelect(
            "adm-mov-demo-id",
            state.demos.map(d => ({
                id: d.id_demo,
                nombre: d.nombre
            })),
            "Seleccionar demo",
            d => d.nombre
        );

        // Selector para clasificar demo.
        updateSelect(
            "adm-demo",
            state.demos.map(d => ({
                id: d.id_demo,
                nombre: d.nombre
            })),
            "Seleccionar demo",
            d => d.nombre
        );
    }

    // ======================================================
    // METRICAS DEL ADMINISTRADOR
    // ======================================================

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
            [
                "Modelos",
                state.modelos.length
            ],
            [
                "Unidades",
                state.vehiculos.length
            ],
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
            [
                "Demos",
                state.demos.length
            ]
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

    // ======================================================
    // CARGAR INVENTARIO
    // ======================================================

    async function fetchAll() {
        if (!esAdministrador()) return;

        if (state.cargando) return;

        state.cargando = true;

        msg("Consultando inventario de Amazon RDS...");

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
                            `La respuesta de ${nombre} no es una lista.`
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
                    // No borrar datos previos correctos
                    // cuando falla una sola consulta.
                    errores.push(
                        `${nombre}: ${resultado.reason.message}`
                    );
                }
            });

            renderData();
            renderMetricas();

            if (errores.length) {
                msg(
                    "Algunos datos no pudieron actualizarse: " +
                    errores.join(" | "),
                    true
                );
            } else {
                msg("Inventario actualizado correctamente.");
            }

        } finally {
            state.cargando = false;
        }
    }

    // ======================================================
    // PANEL DEL CLIENTE
    // ======================================================

    function renderCliente() {
        const destino = el("adm-cliente-lista");

        if (!destino) return;

        destino.replaceChildren();

        if (!esUsuario()) {
            return;
        }

        if (!state.flota.length) {
            destino.textContent =
                "Todavía no tienes unidades asignadas.";
            return;
        }

        state.flota.forEach(vehiculo => {
            const tarjeta = document.createElement("div");

            tarjeta.className = "admin43-unidad";

            const titulo = document.createElement("strong");

            titulo.textContent =
                `${vehiculo.nombre} · Unidad #${vehiculo.id_vehiculo}`;

            const estado = document.createElement("small");

            estado.textContent =
                `Estado: ${vehiculo.estado_comercial || "Sin verificar"}`;

            tarjeta.append(titulo, estado);

            if (
                Number(vehiculo.id_vehiculo) ===
                Number(CONFIG.VEHICULO_ID)
            ) {
                const botonControl = document.createElement("button");

                botonControl.type = "button";
                botonControl.textContent = "Ir a CONTROL";

                botonControl.addEventListener(
                    "click",
                    () => view("tab-control")
                );

                const botonMonitoreo = document.createElement("button");

                botonMonitoreo.type = "button";
                botonMonitoreo.textContent = "Ver MONITOREO";

                botonMonitoreo.addEventListener(
                    "click",
                    () => view("tab-monitoreo")
                );

                tarjeta.append(
                    botonControl,
                    botonMonitoreo
                );
            } else {
                const aviso = document.createElement("small");

                aviso.textContent =
                    "Esta interfaz todavía está configurada para el vehículo 1.";

                tarjeta.append(aviso);
            }

            destino.append(tarjeta);
        });
    }

    // ======================================================
    // CATALOGO PUBLICO
    // ======================================================

    async function cargarCatalogo() {
        const destino = el("adm-catalogo-publico");

        if (!destino) return;

        const unidades = await api(
            "/api/invitados/exhibicion"
        );

        if (!Array.isArray(unidades)) {
            throw new Error(
                "El catálogo público no devolvió una lista."
            );
        }

        destino.replaceChildren();

        if (!unidades.length) {
            destino.textContent =
                "No hay unidades públicas en exhibición.";
            return;
        }

        unidades.forEach(vehiculo => {
            const tarjeta = document.createElement("div");

            tarjeta.className = "admin43-unidad";

            const titulo = document.createElement("strong");
            titulo.textContent = vehiculo.nombre;

            const descripcion = document.createElement("p");

            descripcion.textContent =
                vehiculo.descripcion ||
                "Vehículo IoT de exhibición.";

            tarjeta.append(
                titulo,
                descripcion
            );

            destino.append(tarjeta);
        });
    }

    // ======================================================
    // NAVEGACION
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
    // INICIAR SESION
    // ======================================================

    el("adm-login-form")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const resultado = await api(
                    "/api/auth/login",
                    "POST",
                    {
                        correo: val("adm-correo"),
                        password: el("adm-password").value
                    }
                );

                if (!resultado.token) {
                    throw new Error(
                        "El servidor no devolvió un token de sesión."
                    );
                }

                state.token = resultado.token;

                sessionStorage.setItem(
                    TOKEN_KEY,
                    resultado.token
                );

                el("adm-password").value = "";

                await loadMe();

                if (state.perfil) {
                    msg(
                        `Sesión iniciada correctamente: ${state.perfil.rol}`
                    );
                }
            });
        }
    );

    // ======================================================
    // CERRAR SESION
    // ======================================================

    el("admin-logout")?.addEventListener(
        "click",
        () => {
            run(async () => {
                try {
                    await api(
                        "/api/auth/logout",
                        "POST"
                    );
                } catch (error) {
                    console.warn(
                        "[ADMIN] No se confirmó el cierre remoto:",
                        error
                    );
                }

                state.token = "";
                state.perfil = null;
                state.flota = [];
                state.guest = "";
                state.guestVehicleId = null;

                sessionStorage.removeItem(TOKEN_KEY);

                redraw();

                msg("Sesión local cerrada.");
            });
        }
    );

    // ======================================================
    // CREAR COMPRADOR
    // ======================================================

    el("adm-crear-usuario")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
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

                await fetchAll();

                msg("Comprador registrado correctamente.");
            });
        }
    );

    // ======================================================
    // EDITAR COMPRADOR
    // ======================================================

    el("adm-editar-usuario")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const id = Number(
                    val("adm-edit-usuario")
                );

                const usuario = state.usuarios.find(
                    u => Number(u.id_usuario) === id
                );

                if (!usuario) {
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
                            usuario.nombre,

                        activo:
                            el("adm-edit-activo").checked
                    }
                );

                await fetchAll();

                msg("Comprador actualizado.");
            });
        }
    );

    // ======================================================
    // CREAR MODELO
    // ======================================================

    el("adm-crear-modelo")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                let capacidades = {};

                const texto = val(
                    "adm-capacidades"
                );

                if (texto) {
                    try {
                        capacidades = JSON.parse(texto);
                    } catch (error) {
                        throw new Error(
                            "El JSON de capacidades no es válido."
                        );
                    }
                }

                await api(
                    "/api/admin/modelos",
                    "POST",
                    {
                        nombre:
                            val("adm-nombre-modelo"),

                        descripcion:
                            val("adm-desc-modelo"),

                        capacidades
                    }
                );

                await fetchAll();

                msg("Modelo registrado.");
            });
        }
    );

    // ======================================================
    // EDITAR MODELO
    // ======================================================

    el("adm-editar-modelo")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const id = Number(
                    val("adm-edit-modelo")
                );

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
                        capacidades = JSON.parse(
                            capacidades
                        );
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

                await fetchAll();

                msg("Modelo actualizado.");
            });
        }
    );

    // ======================================================
    // CREAR UNIDAD FISICA
    // ======================================================

    el("adm-nueva-unidad")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                await api(
                    "/api/admin/vehiculos",
                    "POST",
                    {
                        nombre:
                            val("adm-unidad-nombre"),

                        descripcion:
                            val("adm-unidad-desc"),

                        ip_asignada:
                            val("adm-unidad-ip"),

                        estado_comercial:
                            "DISPONIBLE"
                    }
                );

                await fetchAll();

                msg(
                    "Unidad creada. Ya puedes asignar su modelo y propietario."
                );
            });
        }
    );

    // ======================================================
    // ASIGNAR UNIDAD
    // ======================================================

    el("adm-guardar-unidad")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const id = Number(
                    val("adm-vehiculo")
                );

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

                await fetchAll();

                msg("Asignación comercial guardada.");
            });
        }
    );

    // ======================================================
    // CREAR DEMOSTRACION
    // ======================================================

    el("adm-crear-demo")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const idVehiculo = Number(
                    val("adm-crear-demo-unidad")
                );

                if (!idVehiculo) {
                    throw new Error(
                        "Selecciona una unidad."
                    );
                }

                await api(
                    "/api/demos",
                    "POST",
                    {
                        id_vehiculo: idVehiculo,

                        nombre:
                            val("adm-nombre-demo"),

                        descripcion:
                            val("adm-desc-demo")
                    }
                );

                await fetchAll();

                msg("Demostración creada.");
            });
        }
    );

    // ======================================================
    // AGREGAR MOVIMIENTO A DEMO
    // ======================================================

    el("adm-mov-demo")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const idDemo = Number(
                    val("adm-mov-demo-id")
                );

                if (!idDemo) {
                    throw new Error(
                        "Selecciona una demostración."
                    );
                }

                const comando = Number(
                    val("adm-mov-comando")
                );

                const catalogo = [
                    1, 2, 3, 4,
                    5, 6, 7, 8,
                    9, 10, 11, 12,
                    14
                ];

                if (!catalogo.includes(comando)) {
                    throw new Error(
                        "Comando fuera del catálogo definitivo."
                    );
                }

                await api(
                    "/api/demos/movimientos",
                    "POST",
                    {
                        id_demo: idDemo,

                        id_comando: comando,

                        orden: Number(
                            val("adm-mov-orden")
                        ),

                        duracion_ms: Number(
                            val("adm-mov-duracion")
                        ),

                        pausa_ms: Number(
                            val("adm-mov-pausa")
                        )
                    }
                );

                msg(
                    "Movimiento agregado a la secuencia."
                );
            });
        }
    );

    // ======================================================
    // ELIMINAR MOVIMIENTO
    // ======================================================

    el("adm-eliminar-mov")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const id = Number(
                    val("adm-eliminar-mov-id")
                );

                if (!id) {
                    throw new Error(
                        "Indica el ID del movimiento."
                    );
                }

                if (!confirm(
                    "¿Eliminar este movimiento de la demostración?"
                )) {
                    return;
                }

                await api(
                    `/api/demos/movimientos/${id}`,
                    "DELETE"
                );

                msg("Movimiento eliminado.");
            });
        }
    );

    // ======================================================
    // CONSULTAR MOVIMIENTOS
    // ======================================================

    el("adm-cargar-movs")?.addEventListener(
        "click",
        () => {
            run(async () => {
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

                if (!Array.isArray(movimientos)) {
                    throw new Error(
                        "El servidor no devolvió una lista de movimientos."
                    );
                }

                fillTable(
                    "adm-tabla-movs",
                    [
                        "ID",
                        "Comando",
                        "Orden",
                        "Duración ms",
                        "Pausa ms"
                    ],
                    movimientos,
                    m => [
                        m.id_movimiento_demo,
                        m.id_comando,
                        m.orden,
                        m.duracion_ms,
                        m.pausa_ms
                    ]
                );

                msg("Movimientos actualizados.");
            });
        }
    );

    // ======================================================
    // CLASIFICAR DEMOSTRACION
    // ======================================================

    el("adm-guardar-demo")?.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            run(async () => {
                const id = Number(
                    val("adm-demo")
                );

                if (!id) {
                    throw new Error(
                        "Selecciona una demostración."
                    );
                }

                await api(
                    `/api/admin/demos/${id}`,
                    "PATCH",
                    {
                        tipo_demo:
                            val("adm-tipo-demo")
                    }
                );

                await fetchAll();

                msg(
                    "Clasificación de demostración guardada."
                );
            });
        }
    );

    // ======================================================
    // AUDITORIA
    // ======================================================

    el("adm-cargar-auditoria")?.addEventListener(
        "click",
        () => {
            run(async () => {
                const registros = await api(
                    "/api/admin/auditoria"
                );

                if (!Array.isArray(registros)) {
                    throw new Error(
                        "El servidor no devolvió una lista de auditoría."
                    );
                }

                fillTable(
                    "adm-tabla-auditoria",
                    [
                        "Fecha",
                        "Acción",
                        "Usuario",
                        "Vehículo"
                    ],
                    registros,
                    r => [
                        r.fecha_hora,
                        r.accion,
                        r.id_usuario,
                        r.id_vehiculo
                    ]
                );

                msg("Auditoría actualizada.");
            });
        }
    );

    // ======================================================
    // CONSULTAR CATALOGO PUBLICO
    // ======================================================

    el("adm-publico-catalogo")?.addEventListener(
        "click",
        () => run(cargarCatalogo)
    );

    // ======================================================
    // CONSULTAR UNIDADES DE EXHIBICION
    // ======================================================

    el("adm-cargar-exhibicion")?.addEventListener(
        "click",
        () => {
            run(async () => {
                const unidades = await api(
                    "/api/invitados/exhibicion"
                );

                if (!Array.isArray(unidades)) {
                    throw new Error(
                        "La respuesta del servidor no es una lista."
                    );
                }

                // Solo el vehiculo que esta
                // implementado en CONTROL 4.1.
                const disponibles = unidades.filter(
                    vehiculo =>
                        Number(vehiculo.id_vehiculo) ===
                        Number(CONFIG.VEHICULO_ID)
                );

                updateSelect(
                    "adm-select-invitado",
                    disponibles.map(vehiculo => ({
                        id: vehiculo.id_vehiculo,
                        nombre: vehiculo.nombre
                    })),
                    "Seleccionar vehículo",
                    vehiculo => vehiculo.nombre
                );

                msg(
                    `${disponibles.length} vehículo(s) disponible(s) para exhibición.`
                );
            });
        }
    );

    // ======================================================
    // RESERVAR EXHIBICION
    // ======================================================

    el("adm-reservar")?.addEventListener(
        "click",
        () => {
            run(async () => {
                const idVehiculo = Number(
                    val("adm-select-invitado")
                );

                if (!idVehiculo) {
                    throw new Error(
                        "Selecciona un vehículo de exhibición."
                    );
                }

                const reserva = await api(
                    "/api/invitados/reservar",
                    "POST",
                    {
                        id_vehiculo: idVehiculo
                    }
                );

                if (!reserva.token_invitado) {
                    throw new Error(
                        "El servidor no entregó un token de invitado."
                    );
                }

                state.guest = reserva.token_invitado;
                state.guestVehicleId = idVehiculo;

                redraw();

                msg(
                    "Reserva temporal activa. Puedes solicitar demostraciones de fábrica."
                );
            });
        }
    );

    // ======================================================
    // FINALIZAR RESERVA
    // ======================================================

    el("adm-finalizar-reserva")?.addEventListener(
        "click",
        () => {
            run(async () => {
                if (!state.guest) {
                    throw new Error(
                        "No hay una reserva activa."
                    );
                }

                await api(
                    "/api/invitados/finalizar",
                    "POST",
                    undefined,
                    true
                );

                state.guest = "";
                state.guestVehicleId = null;

                redraw();

                msg("Reserva finalizada.");
            });
        }
    );

    // ======================================================
    // INTEGRACION PUBLICA CON APP.JS
    // ======================================================

    window.IOT43 = {
        canControl,
        canDemo,
        headers: headersParaControl,

        reject: () => {
            msg(
                "Acceso denegado. Inicia sesión con una cuenta autorizada.",
                true
            );
        },

        // Permite revisar el estado del rol
        // sin exponer el token.
        getRole: () =>
            state.perfil?.rol || "INVITADO"
    };

    // ======================================================
    // INICIALIZACION
    // ======================================================

    redraw();

    loadMe().catch(error => {
        console.error(
            "[ADMIN] Error inicializando:",
            error
        );

        msg(error.message, true);
    });

})();
