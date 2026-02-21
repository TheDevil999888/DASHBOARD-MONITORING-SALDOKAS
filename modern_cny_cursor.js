/* ==========================================
   MODERN CNY 2026 LIVE CURSOR EFFECT
   Theme: Golden Dragon Aura & Red Sparkles
   ========================================== */

(function () {
    // Create Canvas for Cursor
    const cursorCanvas = document.createElement('canvas');
    cursorCanvas.id = 'cursor-canvas';
    cursorCanvas.style.position = 'fixed';
    cursorCanvas.style.top = '0';
    cursorCanvas.style.left = '0';
    cursorCanvas.style.width = '100%';
    cursorCanvas.style.height = '100%';
    cursorCanvas.style.pointerEvents = 'none'; // Click-through
    cursorCanvas.style.zIndex = '99999'; // On top of everything
    document.body.appendChild(cursorCanvas);

    const ctx = cursorCanvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Resize Handler
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        cursorCanvas.width = width;
        cursorCanvas.height = height;
    }
    window.addEventListener('resize', resize);
    resize();

    // Mouse Position
    const mouse = { x: width / 2, y: height / 2 };
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        addParticle(mouse.x, mouse.y); // Add particle on move
    });

    // Particles Array
    const particles = [];

    // Particle Configuration
    const colors = [
        'rgba(255, 215, 0, 0.8)',   // Gold
        'rgba(255, 69, 0, 0.8)',    // Red-Orange
        'rgba(220, 20, 60, 0.8)',   // Crimson
        'rgba(255, 255, 255, 0.8)'  // White Sparkle
    ];

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 4 + 1; // Random size 1-5px
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.life = 1.0; // Life starts at 100%
            this.decay = Math.random() * 0.03 + 0.02; // Faster decay for snappier trail
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.size *= 0.95; // Shrink over time
            this.life -= this.decay;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.life;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0; // Reset
        }
    }

    function addParticle(x, y) {
        // Add a burst of particles for effect
        for (let i = 0; i < 2; i++) {
            particles.push(new Particle(x, y));
        }
    }

    // Animation Loop
    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Update and draw path
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();

            // Remove dead particles
            if (particles[i].life <= 0 || particles[i].size <= 0.1) {
                particles.splice(i, 1);
                i--;
            }
        }

        requestAnimationFrame(animate);
    }

    animate();

    // OPTIONAL: Custom CSS Cursor (Uncomment to hide default and use a custom one)
    const style = document.createElement('style');
    // Default Cursor: Golden Circle with Crosshair
    // Pointer Cursor: Red/Gold Dragon Scale/Arrow
    style.innerHTML = `
        body, html {
            cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffd700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px red);"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>') 16 16, auto !important; 
        }
        
        a, button, .pointer, input, select, .btn, .switch {
            cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%23b91c1c" stroke="%23ffd700" stroke-width="2" style="filter: drop-shadow(0 0 8px gold);"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>') 16 16, pointer !important;
        }
    `;
    document.head.appendChild(style);

})();
