import { NextRequest, NextResponse } from 'next/server'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

  try {
    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY! },
    })
    const data = await res.json()

    return NextResponse.json({
      status: data.status,   // 'queued' | 'processing' | 'completed' | 'error'
      transcript: data.text ?? null,
      error: data.error ?? null,
    })
  } catch (err) {
    console.error('Status check error:', err)
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 })
  }
}
