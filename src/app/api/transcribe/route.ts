import { NextRequest, NextResponse } from 'next/server'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

async function uploadAudio(audioBlob: Blob): Promise<string> {
  const res = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      authorization: ASSEMBLYAI_API_KEY!,
      'content-type': 'application/octet-stream',
    },
    body: audioBlob,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.upload_url
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  const createRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      authorization: ASSEMBLYAI_API_KEY!,
      'content-type': 'application/json',
    },
   body: JSON.stringify({
  audio_url: audioUrl,
  language_code: 'uk',
  speech_model: 'universal-2',
}),
  })

  const createData = await createRes.json()
  console.log('AssemblyAI create response:', JSON.stringify(createData))

  if (!createRes.ok) throw new Error(`Transcription request failed: ${JSON.stringify(createData)}`)

  const { id } = createData

  // Чекаємо поки транскрипція завершиться
  while (true) {
    await new Promise(r => setTimeout(r, 3000)) // чекаємо 3 секунди

    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY! },
    })
    const result = await pollRes.json()

    if (result.status === 'completed') return result.text
    if (result.status === 'error') throw new Error(result.error)
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  let audioUrl: string

  if (contentType.includes('application/json')) {
    // URL режим — передаємо напряму в AssemblyAI
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })
    audioUrl = url
  } else {
    // File режим — спочатку завантажуємо файл
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    audioUrl = await uploadAudio(blob)
  }

  try {
    const transcript = await transcribeAudio(audioUrl)
    return NextResponse.json({ transcript })
  } catch (err) {
    console.error('AssemblyAI error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}