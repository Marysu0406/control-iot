# Control de Vehículo IoT (Frontend)

Panel de control web moderno, responsivo y orientado a móviles para el pilotaje de un vehículo/excavadora IoT. Desarrollado en JavaScript vainilla (ES6) y estilizado con Bootstrap y CSS Grid/Flexbox. 

Se comunica de forma segura mediante un canal cifrado de WebSockets (`WSS`) hacia un servidor backend en AWS EC2, orquestando lógica almacenada en Amazon RDS.

## Características de la Interfaz
- **Arquitectura de Cero Scroll:** El diseño se ajusta milimétricamente al 100% de la ventana (100vh), garantizando que los joysticks no muevan el navegador en móviles.
- **Sistema de Doble Joystick Virtual:** Implementación matemática propia de joysticks capacitivos usando coordenadas del plano cartesiano, un control exclusivo para tracción (Avanzar/Retroceder/Rotar) y otro para herramienta (Cabina y Pala).
- **Control de Actuadores y Toggles:** Botones responsivos con efectos de encendido de luz (box-shadow neon glow) en Foco, Sonido y Velocidad para proporcionar retroalimentación visual táctil inmediata.
- **Monitor de Acción en Vivo (Live Action Bar):** Barra frontal que parsea el envío de comandos (JSON) al texto natural, demostrando la orden que procesará el hardware de manera instantánea.
- **Botón Prioritario de Interrupción:** Comando físico mapeado al número `13` (`DETENER SISTEMA`) para garantizar protocolos de parada remota segura.

## Requisitos y Despliegue
Este repositorio está estructurado para despliegue directo en **GitHub Pages**. Todos los archivos estáticos (`.html`, `.js`, `.css`) se interpretan desde la raíz y el directorio `/assets`. 

**Stack Tecnológico:** HTML5, CSS3, JavaScript.  
**Dependencias Externas:** CDN de Bootstrap 5.3 y FontAwesome 6.4.

*Desarrollado y estructurado por Maricarmen Suárez Olivares (MSO) - 2026*