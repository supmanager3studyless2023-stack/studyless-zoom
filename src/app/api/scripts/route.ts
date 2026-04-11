import Anthropic from '@anthropic-ai/sdk'
import { appendToSheet } from '@/lib/sheets'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const TOUCH_FIELDS: Record<string, { id: string; label: string }[]> = {
  'знайомство': [
    { id: 'g', label: 'G — ціль студента' },
    { id: 'r', label: 'R — реальність (поточний рівень)' },
    { id: 'o', label: 'O — перешкоди' },
    { id: 'w', label: 'W — бажання діяти' },
    { id: 'tarif', label: 'Відповідність тарифу цілям' },
    { id: 'risks', label: 'Потенційні ризики' },
    { id: 'type', label: 'Тип особистості' },
    { id: 'comm', label: 'Комфортний формат спілкування' },
    { id: 'teach', label: 'Побажання щодо викладача' },
    { id: 'sched', label: 'Побажання щодо графіка занять' },
    { id: 'extra', label: 'Особливі побажання' },
    { id: 'week1', label: 'Критерії успішного 1-го тижня' },
    { id: 'impact', label: 'Методи впливу' },
  ],
  '1т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту (чим задоволений)' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту (чи НЕ задоволений)' },
    { id: 'next_criteria', label: 'Критерії успішного 2го тижня (зі слів студента)' },
    { id: 'problems', label: 'Проблеми та складності які виникали' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '2т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту (чим задоволений)' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту (чи НЕ задоволений)' },
    { id: 'next_criteria', label: 'Критерії успішних 4 тижнів (зі слів студента)' },
    { id: 'problems', label: 'Проблеми та складності які виникали' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '4т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту (чим задоволений)' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту (чи НЕ задоволений)' },
    { id: 'next_criteria', label: 'Критерії успішних 8 тижнів (зі слів студента)' },
    { id: 'problems', label: 'Проблеми та складності які виникали' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '8т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту (чим задоволений)' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту (чи НЕ задоволений)' },
    { id: 'next_criteria', label: 'Критерії успішних 12 тижнів (зі слів студента)' },
    { id: 'result_criteria', label: 'Критерії результату на 12му тижні (зі слів студента)' },
    { id: 'problems', label: 'Проблеми та складності які виникали' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '12т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту (чим задоволений)' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту (чи НЕ задоволений)' },
    { id: 'next_criteria', label: 'Критерії успішних 15 тижнів (зі слів студента)' },
    { id: 'actual_goals', label: 'Актуальні цілі вивчення (зі слів студента)' },
    { id: 'level_sufficiency', label: 'Достатність цього рівня для студента (зі слів студента)' },
    { id: 'continuation', label: 'Продовження навчання: Попередня відповідь' },
    { id: 'problems', label: 'Проблеми та складності які виникали' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  'продаж': [
    { id: 'audience', label: 'Аудитори' },
    { id: 'offer_reaction', label: 'Реакція на офер' },
    { id: 'objection', label: 'Основне заперечення' },
    { id: 'objection_handling', label: 'Як опрацювали' },
    { id: 'payment_status', label: 'Статус оплати' },
  ],
}

const SHEET_NAMES: Record<string, string> = {
  'знайомство': 'Sessions',
  '1т': 'Дотик 1т',
  '2т': 'Дотик 2т',
  '4т': 'Дотик 4т',
  '8т': 'Дотик 8т',
  '12т': 'Дотик 12т',
  'продаж': 'Продаж',
}

export async function POST(request: NextRequest) {
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const userEmail = 'test@studyless.com'
  const { transcript, touchType, managerName, studentName, sessionDate, fathomLink } = await request.json()
  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 })

  const fields = TOUCH_FIELDS[touchType] || TOUCH_FIELDS['знайомство']
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const isZnayomstvo = touchType === 'знайомство'

  const prompt = isZnayomstvo
    ? `Ти — AI-асистент для школи англійської мови Study Less. Аналізуй транскрипт Zoom-знайомства і заповни картку студента за GROW-моделлю.

Відповідай ТІЛЬКИ у форматі JSON без markdown:
{"results":[{"id":"...","label":"...","value":"...","found":true/false}]}

Якщо інформація не згадувалась — found:false, value:"Не згадувалось під час знайомства".
Всі відповіді українською мовою, стисло і по суті.

ПОЛЯ:
${fields.map(f => `- id:"${f.id}" | ${f.label}`).join('\n')}

ТРАНСКРИПТ:
${transcript}`
    : `Ти — AI-асистент для школи англійської мови Study Less. Проаналізуй транскрипт контрольного дотику менеджера зі студентом і витягни відповіді на конкретні питання.

Відповідай ТІЛЬКИ у форматі JSON без markdown:
{"results":[{"id":"...","label":"...","value":"..."}]}

Якщо інформація не згадувалась — value:"Не згадувалось під час дзвінка".
Всі відповіді українською мовою, стисло і по суті.

ПОЛЯ ДЛЯ ЗАПОВНЕННЯ:
${fields.map(f => `- id:"${f.id}" | ${f.label}`).join('\n')}

Менеджер: ${managerName || 'невідомо'}
Студент: ${studentName || 'невідомо'}
Тип дотику: ${touchType}

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
  const { error: sbError } = await supabase.from('touch_analyses').insert({
    manager_email: userEmail,
    student_name: studentName || null,
    session_date: sessionDate || null,
    touch_type: touchType,
    fathom_link: fathomLink || null,
    results: parsed.results,
  })
  if (sbError) console.error('Supabase error:', sbError)
} catch (e) {
  console.error('Supabase insert failed:', e)
}
  const sheetName = SHEET_NAMES[touchType] || 'Sessions'
  try {
    await appendToSheet(sheetName, [
      new Date().toLocaleDateString('uk-UA'),
      userEmail || '',
      managerName || '',
      studentName || '',
      sessionDate || '',
      ...(fathomLink ? [fathomLink] : []),
      ...parsed.results.map((r: any) => r.value),
    ])
  } catch (e) {
    console.error('Sheets error:', e)
  }

  return NextResponse.json(parsed)
}