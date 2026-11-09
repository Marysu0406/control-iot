// js/api.js
import { CONFIG } from './config.js';

export async function checkApiHealth() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/vehiculos/${CONFIG.VEHICULO_ID}`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

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