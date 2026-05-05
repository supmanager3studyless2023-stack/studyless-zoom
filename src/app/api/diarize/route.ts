import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { transcript, managerName, studentName } = await request.json()
  if (!transcript || transcript.length < 50) {
    return NextResponse.json({ error: 'No transcript' }, { status: 400 })
  }

  const mgrLabel = managerName || 'Менеджер'
  const stdLabel = studentName || 'Студент'

  const prompt = `Ти аналізуєш транскрипт дзвінка між менеджером і студентом школи.
Менеджер (${mgrLabel}) веде розмову, ставить питання, пропонує рішення.
Студент (${stdLabel}) відповідає, ділиться враженнями, описує прогрес.

Розбий транскрипт на репліки і познач кожну. Відповідай ТІЛЬКИ рядками у такому форматі:
[${mgrLabel}]: текст репліки
[${stdLabel}]: текст репліки

Без JSON, без markdown, без пояснень — тільки розмічені рядки.

ТРАНСКРИПТ:
${transcript.slice(0, 15000)}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('')

    const utterances: { speaker: 'manager' | 'student'; text: string }[] = []
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith(`[${mgrLabel}]:`)) {
        utterances.push({ speaker: 'manager', text: trimmed.replace(`[${mgrLabel}]:`, '').trim() })
      } else if (trimmed.startsWith(`[${stdLabel}]:`)) {
        utterances.push({ speaker: 'student', text: trimmed.replace(`[${stdLabel}]:`, '').trim() })
      }
    }

    if (!utterances.length) {
      return NextResponse.json({ error: 'Could not parse utterances' }, { status: 422 })
    }

    const mgrChars = utterances.filter(u => u.speaker === 'manager').reduce((s, u) => s + u.text.length, 0)
    const stdChars = utterances.filter(u => u.speaker === 'student').reduce((s, u) => s + u.text.length, 0)
    const total = mgrChars + stdChars
    const managerPercent = total > 0 ? Math.round((mgrChars / total) * 100) : 50
    const studentPercent = 100 - managerPercent

    return NextResponse.json({ utterances, managerPercent, studentPercent })
  } catch (err) {
    console.error('Diarize error:', err)
    return NextResponse.json({ error: 'Diarization failed' }, { status: 500 })
  }
}
