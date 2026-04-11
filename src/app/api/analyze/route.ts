import Anthropic from '@anthropic-ai/sdk'
import { appendToSheet } from '@/lib/sheets'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const FIELDS = [
  { id: 'g', label: 'G — ціль студента', prompt: 'Яка конкретна ціль студента у вивченні англійської? Бажаний рівень, для чого вчить мову, часові рамки. 2-4 речення.' },
  { id: 'r', label: 'R — реальність (поточний рівень)', prompt: 'Який зараз рівень англійської студента? Попередній досвід, що подобалось/не подобалось. 2-3 речення.' },
  { id: 'o', label: 'O — перешкоди', prompt: 'Які перешкоди або складності студент назвав на шляху до цілі? 2-3 речення.' },
  { id: 'w', label: 'W — бажання діяти', prompt: 'Скільки часу на день студент готовий виділяти? Добре/дуже добре/ідеально якщо є. Коротко.' },
  { id: 'tarif', label: 'Відповідність тарифу цілям', prompt: 'Чи відповідає обраний тариф цілям студента? 2-4 речення.' },
  { id: 'risks', label: 'Потенційні ризики', prompt: 'Які потенційні ризики відставання або зниження мотивації? 2-3 речення.' },
  { id: 'type', label: 'Тип особистості', prompt: 'Який тип особистості — активний/пасивний/ініціативний? 1-2 речення.' },
  { id: 'comm', label: 'Комфортний формат спілкування', prompt: 'Як зручніше отримувати повідомлення — Telegram, дзвінки? 1-2 речення.' },
  { id: 'teach', label: 'Побажання щодо викладача', prompt: 'Чи є побажання щодо викладача? Якщо не згадувалось — так і напиши.' },
  { id: 'sched', label: 'Побажання щодо графіка занять', prompt: 'В який час зручно займатись? Що конкретно назвав.' },
  { id: 'extra', label: 'Особливі побажання', prompt: 'Особливі побажання — що хоче екстра або чого НЕ має бути? Якщо не було — напиши немає.' },
  { id: 'week1', label: 'Критерії успішного 1-го тижня', prompt: 'Що студент назвав критеріями успішного першого тижня? 2-3 речення.' },
  { id: 'impact', label: 'Методи впливу', prompt: 'Як менеджеру стимулювати студента якщо почне відставати? Що сам сказав.' },
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

  const { transcript, studentName, sessionDate, fathomLink } = await request.json()
  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Ти — AI-асистент для школи англійської мови Study Less. Аналізуй транскрипт Zoom-знайомства і заповни картку студента за GROW-моделлю.

Відповідай ТІЛЬКИ у форматі JSON без markdown:
{"results":[{"id":"...","value":"...","found":true/false}]}

Якщо інформація не згадувалась — found:false, value:"Не згадувалося під час знайомства".
Всі відповіді українською мовою, стисло і по суті.

ПОЛЯ:
${FIELDS.map(f => `- id:"${f.id}" | ${f.label} | ${f.prompt}`).join('\n')}

ТРАНСКРИПТ:
${transcript}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  await supabase.from('analyses').insert({
    manager_email: userEmail,
    student_name: studentName || null,
    session_date: sessionDate || null,
    fathom_link: fathomLink || null,
    results: parsed.results,
  })
try {
 await appendToSheet('Sessions', [
  new Date().toLocaleDateString('uk-UA'),
   userEmail || '',
  studentName || '',
  sessionDate || '',
  fathomLink || '',
  ...parsed.results.map((r: any) => r.value),
])
} catch (e) {
  console.error('Sheets error:', e)
}
  return NextResponse.json(parsed)
}