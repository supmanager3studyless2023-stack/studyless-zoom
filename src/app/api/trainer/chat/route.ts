import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const OBJECTION_STYLE: Record<string, string> = {
  'подумаю':             'В потрібний момент кажеш «треба ще подумати» або «не готовий зараз вирішувати». Поступаєшся тільки якщо менеджер дає конкретний дедлайн і вагомий аргумент.',
  'дорого':              'Тебе хвилює ціна. Кажеш «це дорогувато» або «в іншому місці дешевше». Погоджуєшся якщо менеджер доводить конкретну цінність.',
  'порадитись':          'Тобі важлива думка близьких. Кажеш «треба порадитись з чоловіком/дружиною». Поступаєшся якщо менеджер допомагає сформулювати аргументи для сім\'ї.',
  'немає часу':          'Ти дуже зайнятий. Хочеш вирішити швидко, не любиш довгих пояснень. Якщо менеджер затягує — виявляєш нетерпіння.',
  'вже вчу в іншому місці': 'У тебе вже є варіант навчання. Порівнюєш зі своїм поточним. Потрібен вагомий аргумент щоб розглянути Study Less.',
}

function buildSystemPrompt(profile: any): string {
  const style = OBJECTION_STYLE[profile.objection] ?? OBJECTION_STYLE['подумаю']
  return `Ти — ${profile.name || 'Студент'}, клієнт школи Study Less на 15-му тижні навчання. Менеджер тобі телефонує.

ПРОФІЛЬ:
Рівень: ${profile.level || 'B1'}
Ціль: ${profile.goal || 'покращити розмовний рівень'}${profile.history ? `\nІсторія: ${profile.history}` : ''}

ПОВЕДІНКА:
${style}

ПРАВИЛА:
- Відповідай КОРОТКО — 1–3 речення, як у реальному дзвінку
- Будь живим: можеш уточнювати, трохи відволікатись
- Якщо менеджер пропускає кроки — чекай, не підказуй
- Говори тільки українською
- Не виходь з ролі та не згадуй скрипт чи методологію`
}

export async function POST(request: NextRequest) {
  const { messages, profile } = await request.json()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: buildSystemPrompt(profile),
          messages,
        })
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}
