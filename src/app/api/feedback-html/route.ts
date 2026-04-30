import Anthropic from '@anthropic-ai/sdk'
import { storeFeedbackHtml } from '@/lib/sheets'
import { FEEDBACK_HTML_SYSTEM_PROMPT } from '@/lib/feedback-html-prompt'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { transcript, managerName, studentName, sessionDate, directorAnalysis } = await request.json()
  if (!transcript || !directorAnalysis) {
    return NextResponse.json({ error: 'Missing transcript or directorAnalysis' }, { status: 400 })
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  })

  const d = directorAnalysis
  const scoreContext = [
    'ОЦІНКИ ПРОРАХОВАНІ QA-ДИРЕКТОРОМ — використай ці значення ТОЧНО у розділі "ОЦІНКИ ПО БЛОКАХ", не перераховуй:',
    `Загальна оцінка: ${d.overall_score}/10`,
    `Загальний коментар: ${d.overall_comment}`,
    '',
    'Оцінки по блоках:',
    ...(d.criteria ?? []).map((c: any) =>
      `${c.title}: ${c.score}/10 — ${c.analysis} | Сильне: ${c.strong} | Покращити: ${c.improve}`
    ),
    '',
  ].join('\n')

  const userText = `Менеджер: ${managerName || 'невідомо'}
Студент: ${studentName || 'невідомо'}
Дата: ${sessionDate || new Date().toLocaleDateString('uk-UA')}
${scoreContext}
ТРАНСКРИПТ:
${transcript}`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 6000,
    system: [{ type: 'text', text: FEEDBACK_HTML_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userText }],
  } as any)

  const raw = msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('').trim()
  const cleaned = raw.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  const html = cleaned.startsWith('<!') || cleaned.includes('<html') ? cleaned : null

  if (!html) {
    return NextResponse.json({ error: 'Failed to generate HTML feedback' }, { status: 500 })
  }

  let zipUrl: string | null = null
  try {
    const feedbackId = crypto.randomUUID()
    await storeFeedbackHtml(feedbackId, html, managerName || '', studentName || '')
    const host = request.headers.get('host') ?? 'studyless-zoom.vercel.app'
    const proto = host.includes('localhost') ? 'http' : 'https'
    zipUrl = `${proto}://${host}/api/feedback/${feedbackId}`
  } catch (e) {
    console.error('Feedback storage error:', e)
  }

  return NextResponse.json({ html, zipUrl })
}
