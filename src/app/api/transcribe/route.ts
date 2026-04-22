import { NextRequest, NextResponse } from 'next/server'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

function convertGoogleDriveUrl(url: string): string {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`
  }
  return url
}

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

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  let audioUrl: string

  try {
    if (contentType.includes('application/json')) {
      const { url } = await request.json()
      if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })
      audioUrl = convertGoogleDriveUrl(url)
    } else {
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
      const blob = new Blob([await file.arrayBuffer()], { type: file.type })
      audioUrl = await uploadAudio(blob)
    }

    // Запускаємо транскрипцію і одразу повертаємо id
    const createRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'uk',
        speech_model: 'universal-2', // виправлено: була помилка — має бути speech_model (без s)
      }),
    })

    const createData = await createRes.json()
    console.log('AssemblyAI create response:', JSON.stringify(createData))

    if (!createRes.ok) {
      throw new Error(`Transcription request failed: ${JSON.stringify(createData)}`)
    }

    return NextResponse.json({ transcriptId: createData.id })

  } catch (err) {
    console.error('AssemblyAI error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}