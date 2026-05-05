export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
}
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

// Just submits the job and returns jobId immediately — no polling, no timeout risk
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

    const createRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'uk',
      }),
    })
    const createData = await createRes.json()
    if (!createRes.ok) throw new Error(`AssemblyAI error: ${JSON.stringify(createData)}`)

    return NextResponse.json({ jobId: createData.id })
  } catch (err) {
    console.error('Transcribe submit error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
