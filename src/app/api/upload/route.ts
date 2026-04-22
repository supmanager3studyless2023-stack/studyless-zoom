import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await request.arrayBuffer()
  
  const res = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      authorization: process.env.ASSEMBLYAI_API_KEY!,
      'content-type': 'application/octet-stream',
    },
    body,
  })
  
  const data = await res.json()
  return NextResponse.json(data)
}