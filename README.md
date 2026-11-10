# Control y Monitoreo de Vehículo IoT (Frontend)

Panel de control web moderno, responsivo y orientado a móviles para el pilotaje y monitoreo en tiempo real de una excavadora/vehículo IoT. Desarrollado en JavaScript vainilla (ES6+), Bootstrap 5 y CSS Grid/Flexbox bajo una arquitectura de SPA (Single Page Application).

Se comunica de forma segura mediante un canal cifrado de WebSockets (`WSS`) y peticiones REST hacia un servidor backend en AWS EC2, interactuando con una base de datos en Amazon RDS MySQL.

---

## 🚀 Características del Sistema

- **Arquitectura SPA (Single Page Application):** Dos vistas integradas (`CONTROL` y `MONITOREO`) que conmutan mediante pestañas sin recargar el navegador, manteniendo la sesión de WebSocket siempre activa.
- **Módulo de Control (Práctica 4.1):**
  - **Doble Joystick Virtual:** Uno dedicado al desplazamiento (Adelante, Atrás, Izquierda, Derecha) y otro para la cabina y el brazo/pala.
  - **Actuadores y Toggles:** Botones responsivos con efectos de iluminación neón (`box-shadow`) para Foco, Sonido y Velocidad.
  - **Secuencias Automáticas (DEMO):** Selector dinámico alimentado directamente desde la base de datos RDS.
  - **Botón de Emergencia:** Paro prioritario mapeado al comando de interrupción.
- **Módulo de Monitoreo (Práctica 4.2):**
  - **Tarjeta de Último Estado:** Muestra en tiempo real el comando activo, fecha y hora confiables.
  - **Tabla de Historial Persistido:** Renderiza de forma estructurada los últimos 10 movimientos individuales guardados en MySQL, con desplazamiento interno y diseño adaptativo.
- **Indicadores Independientes de Conectividad:** Monitoreo visual en tiempo real del estado del WebSocket (`WSS`), la API REST en AWS y la base de datos Amazon RDS.

---

*Desarrollado y estructurado por Maricarmen Suárez Olivares (MSO) - 2026*