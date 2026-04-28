import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { storeFeedbackHtml } from '@/lib/sheets'

function periodStart(period: string): string | null {
  const now = new Date()
  switch (period) {
    case 'hour':  { const d = new Date(now); d.setHours(d.getHours() - 1); return d.toISOString() }
    case 'day':   { const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString() }
    case 'week':  { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString() }
    case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString() }
    default:      return null
  }
}

function periodLabel(period: string): string {
  switch (period) {
    case 'hour':  return 'за останню годину'
    case 'day':   return 'за останній день'
    case 'week':  return 'за останній тиждень'
    case 'month': return 'за останній місяць'
    default:      return 'за весь час'
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const body = await request.json()
  const { period = 'all', manager = '', touchType = '' } = body

  let query = supabase
    .from('director_analyses')
    .select('id, manager_name, student_name, session_date, touch_type, overall_score, overall_comment, criteria, top_strengths, top_improvements, created_at')
    .order('created_at', { ascending: false })

  const since = periodStart(period)
  if (since) query = query.gte('created_at', since)
  if (manager)   query = query.eq('manager_name', manager)
  if (touchType) query = query.eq('touch_type', touchType)

  const { data: rows, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const analyses = (rows ?? []) as any[]
  if (analyses.length === 0) {
    return NextResponse.json({ error: 'Немає аналізів за вибраний період' }, { status: 400 })
  }

  const label = periodLabel(period)
  const prodazhCalls = analyses.filter(r => r.touch_type === 'продаж')

  const formatAnalysis = (r: any) => {
    const criteriaText = (r.criteria ?? []).map((c: any) =>
      `  ${c.title}: ${c.score}/10 — ${c.analysis ?? ''} | Покращити: ${c.improve ?? ''}`
    ).join('\n')
    return [
      `---`,
      `Менеджер: ${r.manager_name || '?'} | Тип: ${r.touch_type} | Оцінка: ${r.overall_score}/10`,
      `Коментар: ${r.overall_comment ?? ''}`,
      criteriaText ? `Блоки:\n${criteriaText}` : '',
      r.top_improvements?.length ? `Зони росту: ${(r.top_improvements as string[]).join('; ')}` : '',
    ].filter(Boolean).join('\n')
  }

  const allData = analyses.map(formatAnalysis).join('\n\n')

  const prompt = `Ти — аналітик школи англійської мови Study Less. На основі даних про ${analyses.length} дзвінків ${label} сформуй підсумковий HTML-звіт для швидкої реакції керівника.

${manager ? `Фільтр: менеджер «${manager}»` : ''}
${touchType ? `Фільтр: тип дзвінку «${touchType}»` : ''}
Всього дзвінків: ${analyses.length}
Продажних дзвінків (15т): ${prodazhCalls.length}

ДАНІ АНАЛІЗІВ (без імен студентів — тільки патерни):
${allData}

===

Згенеруй повний HTML-документ (doctype, html, head, body) зі стилями в <style> тегу. Дизайн: темний header (#1e293b), білі картки з тінями, шрифт Inter, mobile-friendly.

ПРАВИЛА ЗВІТУ:
- НЕ згадуй імена студентів або конкретні деталі окремих дзвінків
- Пиши узагальнено: «менеджери», «в дзвінках», «типова помилка», «патерн» — без прив'язки до конкретної людини
- Фокус на системних патернах, не на поодиноких випадках

HTML-звіт повинен містити РІВНО такі секції (і нічого зайвого між ними):

1. ШАПКА — темний header (#1e293b, білий текст). Ліворуч: "Підсумок аналізів · Study Less" малим текстом, нижче великий заголовок "Аналіз ${analyses.length} дзвінків ${label}". Праворуч: дата генерації (${new Date().toLocaleDateString('uk-UA')}). Під заголовком — рядок з мета-інфо: скільки менеджерів, яких типів дзвінки, середня оцінка.

2. ПРОДАЖНІ ДЗВІНКИ — секція тільки якщо є дзвінки типу «продаж» (їх ${prodazhCalls.length}). Картка з двома колонками:
   - Ліва (зелений фон #f0fdf4, бордер #86efac): "✅ Продаж відбувся — X дзвінків" + нумерований список узагальнених причин (які підходи/техніки спрацювали)
   - Права (червоний фон #fef2f2, бордер #fca5a5): "❌ Продаж не відбувся — X дзвінків" + нумерований список узагальнених причин (які системні помилки/пропуски призвели до цього)
   Визначай факт продажу з overall_comment та аналізу блоку "Закриття на оплату". Якщо не можна визначити — відносити до "не відбувся".

3. ТИПОВІ ПОМИЛКИ — картка "⚠️ Найчастіші зони для покращення". Нумерований список топ-7 найчастіших проблем по всіх дзвінках. Кожен пункт: коротка назва жирним + пояснення одним реченням що саме йде не так (узагальнено). Формуй на основі top_improvements та criteria.improve.

4. СИЛЬНІ СТОРОНИ — картка "✅ Що роблять добре". Нумерований список топ-5 частих сильних сторін (узагальнено, без імен). Формуй з top_improvements та criteria.improve.

5. МЕНЕДЖЕРИ — картка "👤 По менеджерах". Таблиця: Менеджер | Кількість дзвінків | Середня оцінка | Головна зона росту. Сортуй за середньою оцінкою спадно. Зона росту — одна фраза без деталей конкретних дзвінків.

6. ⚡ ТЕРМІНОВІ ДІЇ — картка "⚡ Що виправити прямо зараз". Нумерований список 3-5 конкретних дій які керівник може зробити СЬОГОДНІ: що сказати команді, яку техніку відпрацювати, що проговорити на летючці. Формулюй як чіткі команди: "Провести 10-хвилинний розбір...", "Нагадати всім менеджерам про...", "Відпрацювати скрипт...". НЕ пиши "наступного тижня" — тільки зараз.

ВАЖЛИВО: Поверни ТІЛЬКИ HTML без жодних markdown-блоків чи поясненнь. Починай з <!DOCTYPE html>.`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  let raw = (msg.content[0] as any).text as string
  raw = raw.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  const id = crypto.randomUUID()
  const summaryLabel = manager ? `${manager}_` : ''
  await storeFeedbackHtml(id, raw, `summary_${summaryLabel}${period}`, `${analyses.length} аналізів`)

  const host = process.env.NEXT_PUBLIC_SITE_URL || 'https://studyless-zoom.vercel.app'
  const url = `${host}/api/feedback/${id}`

  return NextResponse.json({ url, id, total: analyses.length })
}
