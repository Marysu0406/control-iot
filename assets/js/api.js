async function checkApiHealth() {
    try {
        const res = await fetch(CONFIG.ENDPOINTS.DEMOS);
        if (res.ok) return true;
    } catch (e) {
        console.error("Error contactando la API de AWS:", e);
    }
    return false;
}

async function cargarDemosEnSelector() {
    try {
        const response = await fetch(CONFIG.ENDPOINTS.DEMOS);
        if (response.ok) {
            const listaDemos = await response.json();
            const select = document.getElementById('select-demo');
            select.innerHTML = '<option value="">✨ Selecciona una DEMO ✨</option>';
            
            listaDemos.forEach(demo => {
                const opcion = document.createElement('option');
                opcion.value = demo.id || demo.id_demo || demo.ID; 
                opcion.text = demo.nombre || demo.nombre_demo || `Demo #${opcion.value}`; 
                select.appendChild(opcion);
            });
        }
    } catch(e) {
        const select = document.getElementById('select-demo');
        select.innerHTML = '<option value="">⚠️ Error cargando demos</option>';
        console.error("Fallo al traer las demos:", e);
    }
}