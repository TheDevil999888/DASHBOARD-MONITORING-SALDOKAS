// ==========================================
// ANUNNAKI TECH PARTICLES / CONSTELLATION SYSTEM
// ==========================================
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let mouse = { x: -1000, y: -1000 };

// Chinese New Year 2026 Mix Anunnaki Palette
const colors = [
    '#ff0000', // Bright Luck Red
    '#d80027', // Deep Prosperity Red
    '#ffd700', // Imperial Gold
    '#daa520', // Goldenrod
    '#ffffff', // Tech White
    '#ff4d4d'  // Neon Red
];

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('resize', initCanvas);

function initCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createParticles();
}

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 2 + 1;
        this.length = this.size * (Math.random() * 5 + 2);
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.opacity = Math.random() * 0.5 + 0.2;
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.02;
        this.baseVx = this.vx;
        this.baseVy = this.vy;
        // 20% chance to be a glowing dot (firefly)
        this.type = Math.random() > 0.8 ? 'dot' : 'line';
    }

    update() {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const forceRadius = 200;

        if (distance < forceRadius) {
            const force = (forceRadius - distance) / forceRadius;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * force * 0.5;
            this.vy += Math.sin(angle) * force * 0.5;
        }

        this.vx *= 0.98;
        this.vy *= 0.98;
        this.vx += this.baseVx * 0.02;
        this.vy += this.baseVy * 0.02;

        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.spin;

        if (this.x < -50) this.x = width + 50;
        if (this.x > width + 50) this.x = -50;
        if (this.y < -50) this.y = height + 50;
        if (this.y > height + 50) this.y = -50;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.type === 'dot' ? 15 : 10;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        if (this.type === 'dot') {
            // Draw glowing dot
            ctx.arc(0, 0, this.size * 1.5, 0, Math.PI * 2);
        } else {
            // Draw tech line
            if (ctx.roundRect) {
                ctx.roundRect(-this.length / 2, -this.size / 2, this.length, this.size, this.size / 2);
            } else {
                ctx.rect(-this.length / 2, -this.size / 2, this.length, this.size);
            }
        }
        ctx.fill();
        ctx.restore();
    }
}

function createParticles() {
    particles = [];
    // Increase density effectively
    const particleCount = Math.floor((width * height) / 10000);
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function drawConnections() {
    const maxDistance = 150;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < maxDistance) {
                const opacity = (1 - distance / maxDistance) * 0.2;
                // Gold connection lines for Wealth & Prosperity
                ctx.strokeStyle = `rgba(255, 215, 0, ${opacity})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, width, height);
    drawConnections();
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateParticles);
}

initCanvas();
animateParticles();
