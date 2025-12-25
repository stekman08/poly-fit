const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [144, 192, 256, 384, 512];
const iconsDir = path.join(__dirname, '..', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

function drawNeonPuzzleIcon(ctx, size) {
    const padding = size * 0.1;
    const pieceSize = (size - padding * 2) / 2;

    // Background - dark with subtle gradient
    const bgGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size * 0.7);
    bgGrad.addColorStop(0, '#1a0a2e');
    bgGrad.addColorStop(1, '#0d0015');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Draw 4 puzzle pieces in neon colors
    const colors = [
        { fill: '#ff00ff', glow: '#ff00ff' }, // Magenta
        { fill: '#00ffff', glow: '#00ffff' }, // Cyan
        { fill: '#00ff00', glow: '#00ff00' }, // Green
        { fill: '#ffff00', glow: '#ffff00' }  // Yellow
    ];

    const positions = [
        { x: padding, y: padding },                          // Top-left
        { x: padding + pieceSize, y: padding },              // Top-right
        { x: padding, y: padding + pieceSize },              // Bottom-left
        { x: padding + pieceSize, y: padding + pieceSize }   // Bottom-right
    ];

    // Draw each piece with glow effect
    positions.forEach((pos, i) => {
        const color = colors[i];
        const margin = size * 0.02;
        const blockSize = pieceSize - margin * 2;

        // Glow effect (multiple layers)
        ctx.shadowColor = color.glow;
        ctx.shadowBlur = size * 0.08;

        // Main block
        ctx.fillStyle = color.fill;
        ctx.globalAlpha = 0.9;

        // Draw rounded rectangle
        const x = pos.x + margin;
        const y = pos.y + margin;
        const radius = size * 0.03;

        ctx.beginPath();
        ctx.roundRect(x, y, blockSize, blockSize, radius);
        ctx.fill();

        // Inner highlight
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(x, y, blockSize, blockSize * 0.4, radius);
        ctx.fill();

        ctx.globalAlpha = 1;
    });

    // Add "POLYFIT" or puzzle notches effect - subtle connector lines
    ctx.shadowBlur = size * 0.02;
    ctx.shadowColor = '#ffffff';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = size * 0.01;

    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(size / 2, padding + pieceSize * 0.3);
    ctx.lineTo(size / 2, size - padding - pieceSize * 0.3);
    ctx.stroke();

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(padding + pieceSize * 0.3, size / 2);
    ctx.lineTo(size - padding - pieceSize * 0.3, size / 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
}

// Generate icons in all sizes
sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    drawNeonPuzzleIcon(ctx, size);

    const buffer = canvas.toBuffer('image/png');
    const filename = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`Generated: icon-${size}.png`);
});

// Generate apple-touch-icon (180x180)
const appleSize = 180;
const appleCanvas = createCanvas(appleSize, appleSize);
const appleCtx = appleCanvas.getContext('2d');
drawNeonPuzzleIcon(appleCtx, appleSize);
const appleBuffer = appleCanvas.toBuffer('image/png');
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleBuffer);
console.log('Generated: apple-touch-icon.png');

console.log('\nAll icons generated successfully!');
