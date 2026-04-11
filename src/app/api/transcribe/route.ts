import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  let groqForm = new FormData()
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'uk')
  groqForm.append('response_format', 'text')

  if (contentType.includes('application/json')) {
    // URL режим
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

    const audioRes = await fetch(url)
    if (!audioRes.ok) return NextResponse.json({ error: 'Cannot fetch audio' }, { status: 400 })

    const blob = await audioRes.blob()
    const filename = url.split('/').pop()?.split('?')[0] || 'audio.wav'
    groqForm.append('file', blob, filename)
  } else {
    // File режим
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    groqForm.append('file', file)
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Groq error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }

  const transcript = await res.text()
  return NextResponse.json({ transcript })
}