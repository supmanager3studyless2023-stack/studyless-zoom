import Anthropic from '@anthropic-ai/sdk'
import { appendToSheet } from '@/lib/sheets'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const QA_CRITERIA = [
  { id: 'script', label: 'Дотримання скрипту', max: 10 },
  { id: 'grow', label: 'Формування GROW', max: 10 },
  { id: 'objections', label: 'Відпрацювання заперечень', max: 10 },
  { id: 'rapport', label: 'Емоційний контакт', max: 10 },
  { id: 'result', label: 'Результативність зустрічі', max: 10 },
]

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const userEmail = user?.email || 'test@studyless.com'

  const { transcript, managerName, studentName, sessionDate } = await request.json()
  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Ти — експерт з QA для школи англійської мови Study Less. Проаналізуй транскрипт Zoom-дзвінка менеджера зі студентом і оціни якість роботи менеджера.

Відповідай ТІЛЬКИ у форматі JSON без markdown:
{
  "manager": "...",
  "student": "...",
  "overall_score": 0-10,
  "overall_comment": "...",
  "criteria": [
    {
      "id": "...",
      "title": "...",
      "score": 0-10,
      "max": 10,
      "analysis": "...",
      "strong": "конкретний приклад з транскрипту",
      "improve": "конкретна рекомендація"
    }
  ],
  "top_strengths": ["...", "...", "..."],
  "top_improvements": ["...", "...", "..."]
}

КРИТЕРІЇ ДЛЯ ОЦІНКИ:
${QA_CRITERIA.map(c => `- ${c.id}: ${c.label} (0-${c.max})`).join('\n')}

Менеджер: ${managerName || 'невідомо'}
Студент: ${studentName || 'невідомо'}

ТРАНСКРИПТ:
${transcript}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

try {
    await appendToSheet('QA', [
      new Date().toLocaleDateString('uk-UA'),
      userEmail || '',
      managerName || '',
      studentName || '',
      sessionDate || '',
      parsed.overall_score || '',
      ...QA_CRITERIA.flatMap(c => {
        const found = parsed.criteria?.find((r: any) => r.id === c.id)
        return [
          found?.score || '',
          found?.analysis || '',
          found?.strong || '',
          found?.improve || '',
        ]
      }),
      parsed.overall_comment || '',
      parsed.top_strengths?.join(' | ') || '',
      parsed.top_improvements?.join(' | ') || '',
    ])
  } catch (e) {
    console.error('Sheets error:', e)
  }

  return NextResponse.json(parsed)
}