
"use strict";

class VirtualJoystick {
    constructor(elementId, callback) {
        this.base = document.getElementById(elementId);

        if (!this.base) {
            throw new Error(`No existe el joystick: ${elementId}`);
        }

        this.knob = this.base.querySelector(".joystick-knob");

        if (!this.knob) {
            throw new Error(`Falta .joystick-knob en ${elementId}`);
        }

        if (typeof callback !== "function") {
            throw new TypeError("El callback debe ser una función");
        }

        this.callback = callback;
        this.active = false;
        this.pointerId = null;
        this.centerX = 0;
        this.centerY = 0;
        this.maxRadius = 0;
        this.lastCommand = null;
        this.repeatTimer = null;

        // Renovación menor que el límite de 1200 ms del ESP32.
        this.REPEAT_MS = 450;
        this.DEAD_ZONE_PX = 20;

        this.base.style.touchAction = "none";

        this.initEvents();
    }

    initEvents() {
        this.base.addEventListener(
            "pointerdown",
            event => this.start(event)
        );

        document.addEventListener(
            "pointermove",
            event => this.move(event)
        );

        document.addEventListener(
            "pointerup",
            event => this.end(event)
        );

        document.addEventListener(
            "pointercancel",
            event => this.end(event)
        );

        this.base.addEventListener(
            "lostpointercapture",
            event => this.end(event)
        );

        window.addEventListener(
            "blur",
            () => this.end()
        );

        document.addEventListener(
            "visibilitychange",
            () => {
                if (document.hidden) {
                    this.end();
                }
            }
        );
    }

    start(event) {
        if (this.active || event.isPrimary === false) return;

        if (
            event.pointerType === "mouse" &&
            event.button !== 0
        ) {
            return;
        }

        event.preventDefault();

        this.active = true;
        this.pointerId = event.pointerId;

        const rect = this.base.getBoundingClientRect();

        this.centerX = rect.left + rect.width / 2;
        this.centerY = rect.top + rect.height / 2;

        this.maxRadius = Math.max(
            0,
            rect.width / 2 - this.knob.offsetWidth / 2
        );

        if (this.base.setPointerCapture) {
            try {
                this.base.setPointerCapture(event.pointerId);
            } catch (_) {
                // El seguimiento global continúa funcionando.
            }
        }

        this.move(event);
    }

    move(event) {
        if (
            !this.active ||
            event.pointerId !== this.pointerId
        ) {
            return;
        }

        event.preventDefault();

        let dx = event.clientX - this.centerX;
        let dy = event.clientY - this.centerY;

        const distance = Math.hypot(dx, dy);

        if (distance > this.maxRadius && distance > 0) {
            const ratio = this.maxRadius / distance;
            dx *= ratio;
            dy *= ratio;
        }

        this.knob.style.transform =
            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        if (distance < this.DEAD_ZONE_PX) {
            this.setDirection(null);
            return;
        }

        const angle =
            Math.atan2(dy, dx) * (180 / Math.PI);

        let direction;

        if (angle > -45 && angle <= 45) {
            direction = "RIGHT";
        } else if (angle > 45 && angle <= 135) {
            direction = "DOWN";
        } else if (angle > 135 || angle <= -135) {
            direction = "LEFT";
        } else {
            direction = "UP";
        }

        this.setDirection(direction);
    }

    setDirection(direction) {
        if (direction === this.lastCommand) return;

        this.stopRepeating();
        this.lastCommand = direction;

        if (direction === null) {
            this.callback(null);
            return;
        }

        // Enviar inmediatamente.
        this.callback(direction);

        // Repetir mientras se mantenga presionado.
        this.repeatTimer = window.setInterval(() => {
            if (
                this.active &&
                this.lastCommand === direction
            ) {
                this.callback(direction);
            }
        }, this.REPEAT_MS);
    }

    stopRepeating() {
        if (this.repeatTimer !== null) {
            window.clearInterval(this.repeatTimer);
            this.repeatTimer = null;
        }
    }

    end(event) {
        if (!this.active) return;

        if (
            event &&
            event.pointerId !== undefined &&
            event.pointerId !== this.pointerId
        ) {
            return;
        }

        this.active = false;

        const oldPointerId = this.pointerId;
        this.pointerId = null;

        this.knob.style.transform =
            "translate(-50%, -50%)";

        // Detener renovación antes de pedir parada.
        this.setDirection(null);

        if (
            oldPointerId !== null &&
            this.base.releasePointerCapture
        ) {
            try {
                if (this.base.hasPointerCapture(oldPointerId)) {
                    this.base.releasePointerCapture(oldPointerId);
                }
            } catch (_) {
                // Sin acción adicional.
            }
        }
    }
}
