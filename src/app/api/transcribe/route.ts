import { NextRequest, NextResponse } from 'next/server'

const CHUNK_SIZE = 20 * 1024 * 1024 // 20 MB

async function transcribeBlob(blob: Blob, filename: string): Promise<string> {
  const groqForm = new FormData()
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'uk')
  groqForm.append('response_format', 'text')
  groqForm.append('file', blob, filename)

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Groq error:', err)
    throw new Error('Transcription failed')
  }

  return await res.text()
}

async function transcribeLargeBlob(blob: Blob, filename: string): Promise<string> {
  if (blob.size <= CHUNK_SIZE) {
    return transcribeBlob(blob, filename)
  }

  const chunks: string[] = []
  let offset = 0

  while (offset < blob.size) {
    const chunk = blob.slice(offset, offset + CHUNK_SIZE)
    const text = await transcribeBlob(chunk, filename)
    chunks.push(text)
    offset += CHUNK_SIZE
  }

  return chunks.join(' ')
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  let blob: Blob
  let filename: string

  if (contentType.includes('application/json')) {
    // URL режим
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

    const audioRes = await fetch(url)
    if (!audioRes.ok) return NextResponse.json({ error: 'Cannot fetch audio' }, { status: 400 })

    blob = await audioRes.blob()
    filename = url.split('/').pop()?.split('?')[0] || 'audio.wav'
  } else {
    // File режим
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    blob = file
    filename = file.name
  }

  try {
    const transcript = await transcribeLargeBlob(blob, filename)
    return NextResponse.json({ transcript })
  } catch {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}