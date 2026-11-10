const CONFIG = {
    VEHICULO_ID: 1,
    API_URL_BASE: "marysuarez.duckdns.org",
    
    COMANDOS: {
        ADELANTE: 1, ATRAS: 2, IZQUIERDA: 3, DERECHA: 4,
        CABINA_IZQ: 5, CABINA_DER: 6, SUBIR_PALA: 7, BAJAR_PALA: 8,
        FOCO: 9, SONIDO: 10, VELOCIDAD: 11,
        DETENER: 13
    }
};

CONFIG.ENDPOINTS = {
    DEMOS: `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/demos`,
    WS: `wss://${CONFIG.API_URL_BASE}/ws/vehiculo/${CONFIG.VEHICULO_ID}`,
    // Nuevas rutas para la Práctica 2
    ESTADO: `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/estado`,
    HISTORIAL: `https://${CONFIG.API_URL_BASE}/api/vehiculos/${CONFIG.VEHICULO_ID}/historial`
};