import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, profile } = await request.json()
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const conversation = messages
      .map((m: any) => `${m.role === 'user' ? 'МЕНЕДЖЕР' : `СТУДЕНТ (${profile.name})`}: ${m.content}`)
      .join('\n\n')

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'Ти — QA-директор школи Study Less. Відповідай ТІЛЬКИ валідним JSON без жодного тексту до або після. Без markdown-блоків.',
      messages: [{
        role: 'user',
        content: `Оціни тренувальний продажний дзвінок менеджера по скрипту 3.0.

ПРОФІЛЬ СТУДЕНТА: ${profile.name}, рівень ${profile.level}, ціль: ${profile.goal}, заперечення: «${profile.objection}»

ДЗВІНОК:
${conversation}

Поверни JSON такої структури:
{
  "overall_score": число 0-10,
  "overall_comment": "одне речення",
  "blocks": [
    { "id": "entry",   "title": "Блок 1: Вхід і рамка",        "done": true, "score": 7, "comment": "...", "fix": "..." },
    { "id": "goal",    "title": "Блок 2: Ціль і ефективність",  "done": true, "score": 7, "comment": "...", "fix": "..." },
    { "id": "scale",   "title": "Блок 3: Шкала готовності",     "done": false,"score": 0, "comment": "...", "fix": "..." },
    { "id": "diag",    "title": "Блок 5: Міні-діагностика",     "done": false,"score": 0, "comment": "...", "fix": "..." },
    { "id": "offer",   "title": "Блок 6: Офер",                 "done": true, "score": 7, "comment": "...", "fix": "..." },
    { "id": "choice",  "title": "Блок 7: Вибір",                "done": false,"score": 0, "comment": "...", "fix": "..." },
    { "id": "close",   "title": "Блок 8: Закриття на оплату",   "done": true, "score": 6, "comment": "...", "fix": "..." },
    { "id": "summary", "title": "Блок 9: Резюме і закріплення", "done": false,"score": 0, "comment": "...", "fix": "..." }
  ],
  "top_mistakes": ["помилка 1", "помилка 2", "помилка 3"],
  "key_win": "що вийшло добре"
}`,
      }],
    })

    const raw = (msg.content[0] as any).text as string
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Не вдалось розпарсити відповідь', raw: cleaned.slice(0, 300) }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
