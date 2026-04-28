import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { messages, profile } = await request.json()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const conversation = messages
    .map((m: any) => `${m.role === 'user' ? 'МЕНЕДЖЕР' : `СТУДЕНТ (${profile.name})`}: ${m.content}`)
    .join('\n\n')

  const prompt = `Ти — QA-директор школи Study Less. Оціни тренувальний продажний дзвінок менеджера по скрипту 3.0.

ПРОФІЛЬ СТУДЕНТА: ${profile.name}, рівень ${profile.level}, ціль: ${profile.goal}, заперечення: «${profile.objection}»

ДЗВІНОК:
${conversation}

Відповідай ТІЛЬКИ у форматі JSON без markdown:
{
  "overall_score": 0-10,
  "overall_comment": "одне речення — загальний висновок",
  "blocks": [
    { "id": "entry",   "title": "Блок 1: Вхід і рамка",           "done": true/false, "score": 0-10, "comment": "що зроблено або пропущено", "fix": "конкретна фраза або дія" },
    { "id": "goal",    "title": "Блок 2: Ціль і ефективність",     "done": true/false, "score": 0-10, "comment": "...", "fix": "..." },
    { "id": "scale",   "title": "Блок 3: Шкала готовності",        "done": true/false, "score": 0-10, "comment": "...", "fix": "..." },
    { "id": "diag",    "title": "Блок 5: Міні-діагностика",        "done": true/false, "score": 0-10, "comment": "...", "fix": "..." },
    { "id": "offer",   "title": "Блок 6: Офер",                    "done": true/false, "score": 0-10, "comment": "...", "fix": "..." },
    { "id": "choice",  "title": "Блок 7: Вибір",                   "done": true/false, "score": 0-10, "comment": "...", "fix": "..." },
    { "id": "close",   "title": "Блок 8: Закриття на оплату",      "done": true/false, "score": 0-10, "comment": "...", "fix": "..." },
    { "id": "summary", "title": "Блок 9: Резюме і закріплення",    "done": true/false, "score": 0-10, "comment": "...", "fix": "..." }
  ],
  "top_mistakes": ["...", "...", "..."],
  "key_win": "що вийшло добре — одне речення"
}`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (msg.content[0] as any).text as string
  const result = JSON.parse(raw.replace(/```json|```/g, '').trim())
  return NextResponse.json(result)
}
