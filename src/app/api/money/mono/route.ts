import { NextRequest, NextResponse } from 'next/server'

// Fallback proxy for the finance PWA (public/money) in case the browser can't
// reach api.monobank.ua directly (CORS). The token is only forwarded, never stored or logged.
const ALLOWED = /^\/personal\/(client-info|statement\/[A-Za-z0-9_-]+\/\d+\/\d+)$/

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || ''
  const token = request.headers.get('x-token')
  if (!token || !ALLOWED.test(path)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const res = await fetch(`https://api.monobank.ua${path}`, {
    headers: { 'X-Token': token },
    cache: 'no-store',
  })
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
