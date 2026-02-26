// ==========================================
// CHINESE NEW YEAR 2026 & IDUL FITRI (RAMADHAN) 2026 MIX LIVE EFFECTS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 1. Setup Stars layer
    const starsLayer = document.createElement("div");
    starsLayer.className = "ramadhan-stars-layer";
    document.body.appendChild(starsLayer);

    const createStar = () => {
        const star = document.createElement("div");
        star.className = "r-star";
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 100}vh`;
        
        // Randomize twinkle speed
        const duration = Math.random() * 3 + 2;
        star.style.animation = `twinkleStar ${duration}s infinite alternate ease-in-out`;
        
        starsLayer.appendChild(star);
    };

    // Create 100 scattered stars
    for(let i=0; i<100; i++) {
        createStar();
    }

    // 2. Setup Gold Dust Particles (Upward floating)
    const createDust = () => {
        const dust = document.createElement("div");
        dust.className = "gold-dust";
        
        const size = Math.random() * 4 + 2;
        dust.style.width = `${size}px`;
        dust.style.height = `${size}px`;
        
        dust.style.left = `${Math.random() * 100}vw`;
        
        // Randomize float speed and delay
        const duration = Math.random() * 10 + 10;
        const delay = Math.random() * 5;
        dust.style.animation = `floatUp ${duration}s ${delay}s infinite linear`;
        
        starsLayer.appendChild(dust);
        
        // Cycle the dust to prevent DOM overload
        setTimeout(() => {
            if(dust.parentNode) dust.remove();
            createDust();
        }, (duration + delay) * 1000);
    };

    // Initialize initial dust 
    for(let i=0; i<30; i++) {
        createDust();
    }
});
