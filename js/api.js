// js/api.js
import { CONFIG } from './config.js';

// Verificación de estado de la API utilizando la documentación de FastAPI
export async function checkApiHealth() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/docs`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Obtener la lista de demos disponibles desde el backend
export async function getDemos() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/vehiculos/${CONFIG.VEHICULO_ID}/demos`);
        if (!response.ok) throw new Error('Error al cargar demos');
        return await response.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

// Enviar comandos de movimiento mediante HTTP POST
export async function enviarMovimiento(idComando) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/movimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_vehiculo: CONFIG.VEHICULO_ID,
                id_comando: parseInt(idComando),
                origen: "WEB"
            })
        });
        return response.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// Ejecutar una secuencia demo específica
export async function ejecutarDemo(idDemo) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/vehiculos/${CONFIG.VEHICULO_ID}/demos/${idDemo}/ejecutar`, {
            method: 'POST'
        });
        return response.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}