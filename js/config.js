/**
 * BrowserQuest - Client Configuration
 * Optimized for High Performance and Zero Lag
 */

var Config = {
    // ==========================================
    // ⚡ PERFORMANCE & GRAPHICS MODE SETUP
    // ==========================================
    // Set this to true to turn off lag-inducing visuals
    highPerformanceMode: true, 

    // ==========================================
    // 🖥️ HOSTING & CONNECTION SETTINGS
    // ==========================================
    // Change "localhost" to your server's IP address if hosting online
    host: "localhost",
    port: 8000,
    secure: false, // Set to true if you are using HTTPS/WSS

    // ==========================================
    // 🎨 GAMEPLAY & RENDERING ENGINE
    // ==========================================
    // Use smaller internal canvas scales on low-end machines to save GPU power
    canvasWidth: 800,
    canvasHeight: 480,
    
    // Automatically scales game elements based on your browser window size
    autoScale: true,

    // High performance reduces maximum active map particles (like sparks, blood, dust)
    maxParticles: 25, // Default is usually 100+ which chokes the browser

    // Toggles for rendering engine optimization
    renderShadows: true,      // Shadows require heavy real-time canvas redrawing
    renderWeatherEffects: false, // Disables animated rain, snow, or fog overlay layers
    renderMapAnimations: false,  // Stops tiles like water or flowers from constantly animating
    
    // ==========================================
    // 🚀 HARDWARE ACCELERATION ENGINE OVERRIDES
    // ==========================================
    // Pass these straight into your HTML5 Canvas context setup
    canvasContextOptions: {
        alpha: false,                 // Speeds up image compounding by ignoring transparency
        desynchronized: true,         // Skips the browser compositor for lower input lag
        willReadFrequently: false     // Tells browser to store canvas directly on your GPU
    },

    // ==========================================
    // ⏱️ GAME ENGINE COOLDOWNS & TIMINGS
    // ==========================================
    // How long chat bubbles stay on screen (in milliseconds)
    chatBubbleDuration: 4000,

    // Time window for double-clicking actions
    doubleClickTimeout: 250,

    // Default target frame rate for interpolation calculations
    targetFps: 120
};

// ==========================================
// 🧠 AUTOMATED DYNAMIC PERFORMANCE TWEAKS
// ==========================================
// If high performance is turned OFF, safely restore beautiful game visuals
if (!Config.highPerformanceMode) {
    Config.maxParticles = 100;
    Config.renderShadows = true;
    Config.renderWeatherEffects = true;
    Config.renderMapAnimations = true;
    Config.canvasContextOptions.alpha = true;
    Config.canvasContextOptions.desynchronized = false;
}

// Export config safely for standard web scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}
