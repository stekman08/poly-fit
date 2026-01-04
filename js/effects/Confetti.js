/**
 * Neon confetti effect for win celebration
 */

import { COLORS } from '../shapes.js';

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.size = Math.random() * 8 + 4;
        this.speedX = (Math.random() - 0.5) * 12;
        this.speedY = Math.random() * -15 - 5;
        this.gravity = 0.4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;
        this.life = 1.0;
        this.decay = 0.015 + Math.random() * 0.01;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.rotation += this.rotationSpeed;
        this.life -= this.decay;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.life;

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Draw rectangle confetti
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);

        ctx.restore();
    }

    get isDead() {
        return this.life <= 0;
    }
}

export class ConfettiSystem {
    constructor() {
        this.particles = [];
        this.isActive = false;
    }

    burst(x, y, count = 50) {
        this.isActive = true;
        for (let i = 0; i < count; i++) {
            // Spread particles around the burst point
            const offsetX = (Math.random() - 0.5) * 100;
            const offsetY = (Math.random() - 0.5) * 50;
            this.particles.push(new Particle(x + offsetX, y + offsetY));
        }
    }

    update() {
        if (!this.isActive) return;

        // Update all particles and remove dead ones in-place (swap-and-pop)
        // This avoids creating new arrays every frame, reducing GC pressure
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            if (p.isDead) {
                // Swap with last element and pop
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
            }
        }

        if (this.particles.length === 0) {
            this.isActive = false;
        }
    }

    draw(ctx) {
        if (!this.isActive) return;
        this.particles.forEach(p => p.draw(ctx));
    }

    clear() {
        this.particles = [];
        this.isActive = false;
    }
}
