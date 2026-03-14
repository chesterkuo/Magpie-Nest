import sharp from 'sharp'

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-512-maskable.png' },
]

for (const { size, name } of sizes) {
  const fontSize = Math.floor(size * 0.5)
  const rx = Math.floor(size * 0.15)

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#3b82f6"/>
        <stop offset="100%" style="stop-color:#8b5cf6"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)" rx="${rx}"/>
    <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial,sans-serif" font-weight="bold" font-size="${fontSize}" fill="white">M</text>
  </svg>`

  await sharp(Buffer.from(svg)).png().toFile(`packages/client/public/icons/${name}`)
  console.log(`Generated ${name}`)
}
