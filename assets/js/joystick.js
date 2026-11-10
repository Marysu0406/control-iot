class VirtualJoystick {
    constructor(elementId, callback) {
        this.base = document.getElementById(elementId);
        this.knob = this.base.querySelector('.joystick-knob');
        this.callback = callback;
        this.active = false;
        this.centerX = 0;
        this.centerY = 0;
        this.maxRadius = this.base.offsetWidth / 2 - this.knob.offsetWidth / 2;
        this.lastCommand = null;
        this.initEvents();
    }

    initEvents() {
        this.base.addEventListener('mousedown', (e) => this.start(e));
        this.base.addEventListener('touchstart', (e) => this.start(e.touches[0]), {passive: false});
        
        document.addEventListener('mousemove', (e) => this.move(e));
        document.addEventListener('touchmove', (e) => this.move(e.touches[0]), {passive: false});
        
        document.addEventListener('mouseup', () => this.end());
        document.addEventListener('touchend', () => this.end());
    }

    start(e) {
        this.active = true;
        const rect = this.base.getBoundingClientRect();
        this.centerX = rect.left + rect.width / 2;
        this.centerY = rect.top + rect.height / 2;
        this.maxRadius = this.base.offsetWidth / 2 - this.knob.offsetWidth / 2;
        this.move(e);
    }

    move(e) {
        if (!this.active) return;
        let dx = e.clientX - this.centerX;
        let dy = e.clientY - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.maxRadius) {
            const ratio = this.maxRadius / distance;
            dx *= ratio;
            dy *= ratio;
        }

        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        this.determineDirection(angle, distance);
    }

    end() {
        this.active = false;
        this.knob.style.transform = `translate(-50%, -50%)`;
        if (this.lastCommand !== null) {
            this.callback(null);
            this.lastCommand = null;
        }
    }

    determineDirection(angle, distance) {
        if (distance < 20) return;
        let command = null;

        if (angle > -45 && angle <= 45) command = 'RIGHT';
        else if (angle > 45 && angle <= 135) command = 'DOWN';
        else if (angle > 135 || angle <= -135) command = 'LEFT';
        else if (angle > -135 && angle <= -45) command = 'UP';

        if (command && command !== this.lastCommand) {
            this.lastCommand = command;
            this.callback(command);
        }
    }
}