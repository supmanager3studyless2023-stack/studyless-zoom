import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

  const res = await fetch(url)
  const blob = await res.blob()
  
  return new NextResponse(blob, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
    },
  })
}