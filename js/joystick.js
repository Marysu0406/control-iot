// js/joystick.js
export function initJoystick(onCommand, onStop) {
    const zone = document.getElementById('joystick-zone');
    const manager = nipplejs.create({
        zone: zone,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: '#0d6efd'
    });

    let lastCommand = null;

    manager.on('dir:up', () => {
        if (lastCommand !== 1) { lastCommand = 1; onCommand(1); }
    });
    manager.on('dir:down', () => {
        if (lastCommand !== 2) { lastCommand = 2; onCommand(2); }
    });
    manager.on('dir:left', () => {
        if (lastCommand !== 12) { lastCommand = 12; onCommand(12); }
    });
    manager.on('dir:right', () => {
        if (lastCommand !== 11) { lastCommand = 11; onCommand(11); }
    });

    manager.on('end', () => {
        lastCommand = null;
        onStop(13);
    });
}