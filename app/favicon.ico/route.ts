export const revalidate = 31536000

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#06b6d4"/>
      <stop offset="1" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#g)"/>
  <circle cx="128" cy="128" r="68" fill="none" stroke="#ffffff" stroke-width="22" />
  <circle cx="128" cy="128" r="38" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.6"/>
</svg>`

export async function GET() {
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}


