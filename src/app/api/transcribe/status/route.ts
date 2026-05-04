import { NextRequest, NextResponse } from 'next/server'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

interface Utterance {
  speaker: string
  text: string
  start: number
  end: number
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

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

  try {
    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY! },
    })
    const data = await res.json()

    const utterances: Utterance[] = data.utterances || []
    const speakerStats = data.status === 'completed' ? calcSpeakerStats(utterances) : {}

    return NextResponse.json({
      status: data.status,
      transcript: data.text ?? null,
      utterances: data.status === 'completed' ? utterances : [],
      speakerStats,
      error: data.error ?? null,
    })
  } catch (err) {
    console.error('Status check error:', err)
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 })
  }
}
