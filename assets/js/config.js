
/*
 * CONFIGURACIÓN GENERAL
 * Plataforma IoT
 *
 * CONTROL 4.1
 * MONITOREO 4.2
 * ADMINISTRACIÓN 4.3
 */

const CONFIG = {
    VEHICULO_ID: 1,

    API_URL_BASE: "marysuarez.duckdns.org",

    COMANDOS: {
        ADELANTE: 1,
        ATRAS: 2,

        CABINA_IZQ: 3,
        CABINA_DER: 4,

        FOCO: 5,
        SONIDO: 6,
        VELOCIDAD: 7,
        POWER: 8,

        SUBIR_PALA: 9,
        BAJAR_PALA: 10,

        DERECHA: 11,
        IZQUIERDA: 12,

        CARRO_DER: 11,
        CARRO_IZQ: 12,

        APAGAR_TODO: 14
    }
};

// DIRECCIONES DEL BACKEND
CONFIG.ENDPOINTS = {

    DEMOS:
        `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/demos`,

    WS:
        `wss://${CONFIG.API_URL_BASE}/ws/vehiculo/${CONFIG.VEHICULO_ID}`,

    ESTADO:
        `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/estado`,

    HISTORIAL:
        `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/historial`,

    MOVIMIENTO:
        `https://${CONFIG.API_URL_BASE}/api/movimiento`
};