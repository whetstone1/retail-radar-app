const fs = require('fs');

function createSVGIcon(size) {
  const pad = Math.round(size * 0.1);
  const r = Math.round(size * 0.08);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#E53935"/>
  <text x="${size/2}" y="${size*0.68}" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-style="italic" font-size="${size*0.6}" fill="white">R</text>
</svg>`;
}

[16, 48, 128].forEach(size => {
  fs.writeFileSync(`${__dirname}/icon${size}.svg`, createSVGIcon(size));
  // Also create a simple .png placeholder (browsers need png)
  // In production, use proper PNG exports from design tools
  fs.writeFileSync(`${__dirname}/icon${size}.png`, Buffer.from(createSVGIcon(size)));
});
console.log('Icons created (SVG placeholders)');
