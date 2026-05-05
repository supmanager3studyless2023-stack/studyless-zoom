import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { transcript, managerName, studentName } = await request.json()
  if (!transcript || transcript.length < 50) {
    return NextResponse.json({ error: 'No transcript' }, { status: 400 })
  }

  const prompt = `Ти аналізуєш транскрипт телефонного/zoom дзвінка між менеджером школи і студентом.
Менеджер: ${managerName || 'невідомо'}
Студент: ${studentName || 'невідомо'}

Розбий транскрипт на репліки і визнач хто говорить — менеджер чи студент.
Менеджер зазвичай ставить питання, веде розмову, пропонує рішення.
Студент відповідає, ділиться відчуттями, описує свій прогрес.

Відповідай ТІЛЬКИ JSON без markdown:
{
  "utterances": [
    { "speaker": "manager", "text": "текст репліки" },
    { "speaker": "student", "text": "текст репліки" }
  ],
  "managerPercent": 60,
  "studentPercent": 40
}

ТРАНСКРИПТ:
${transcript.slice(0, 12000)}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
    const match = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    const data = JSON.parse(match[0])

    return NextResponse.json(data)
  } catch (err) {
    console.error('Diarize error:', err)
    return NextResponse.json({ error: 'Diarization failed' }, { status: 500 })
  }
}
