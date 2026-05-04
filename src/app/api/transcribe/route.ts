export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
}
import { NextRequest, NextResponse } from 'next/server'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

interface Utterance {
  speaker: string
  text: string
  start: number
  end: number
}

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

function calcSpeakerStats(utterances: Utterance[]): Record<string, { ms: number; percent: number }> {
  const durations: Record<string, number> = {}
  for (const u of utterances) {
    durations[u.speaker] = (durations[u.speaker] || 0) + (u.end - u.start)
  }
  const total = Object.values(durations).reduce((a, b) => a + b, 0)
  return Object.fromEntries(
    Object.entries(durations).map(([speaker, ms]) => [
      speaker,
      { ms, percent: total > 0 ? Math.round((ms / total) * 100) : 0 },
    ])
  )
}

async function transcribeAudio(audioUrl: string): Promise<{ text: string; utterances: Utterance[] }> {
  const createRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      authorization: ASSEMBLYAI_API_KEY!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: 'uk',
      speech_model: 'best',
      speaker_labels: true,
    }),
  })
  const createData = await createRes.json()
  console.log('AssemblyAI create response:', JSON.stringify(createData))
  if (!createRes.ok) throw new Error(`Transcription request failed: ${JSON.stringify(createData)}`)

  const { id } = createData
  while (true) {
    await new Promise(r => setTimeout(r, 3000))
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY! },
    })
    const result = await pollRes.json()
    if (result.status === 'completed') {
      return {
        text: result.text,
        utterances: result.utterances || [],
      }
    }
    if (result.status === 'error') throw new Error(result.error)
  }
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

    const { text, utterances } = await transcribeAudio(audioUrl)
    const speakerStats = calcSpeakerStats(utterances)

    return NextResponse.json({ transcript: text, utterances, speakerStats })
  } catch (err) {
    console.error('AssemblyAI error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
