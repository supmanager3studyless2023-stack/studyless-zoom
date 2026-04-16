import Anthropic from '@anthropic-ai/sdk'
import { appendToSheet } from '@/lib/sheets'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ====== З api/scripts/route.ts ======
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
    { id: 'likes', label: 'Що подобається студенту' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту' },
    { id: 'next_criteria', label: 'Критерії успішного 2го тижня' },
    { id: 'problems', label: 'Проблеми та складності' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '2т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту' },
    { id: 'next_criteria', label: 'Критерії успішних 4 тижнів' },
    { id: 'problems', label: 'Проблеми та складності' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '4т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту' },
    { id: 'next_criteria', label: 'Критерії успішних 8 тижнів' },
    { id: 'problems', label: 'Проблеми та складності' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '8т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту' },
    { id: 'next_criteria', label: 'Критерії успішних 12 тижнів' },
    { id: 'result_criteria', label: 'Критерії результату на 12му тижні' },
    { id: 'problems', label: 'Проблеми та складності' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  '12т': [
    { id: 'success', label: 'Вдалось з критеріїв успіху' },
    { id: 'fail', label: 'НЕ вдалось з критеріїв успіху' },
    { id: 'likes', label: 'Що подобається студенту' },
    { id: 'dislikes', label: 'Що НЕ подобається студенту' },
    { id: 'next_criteria', label: 'Критерії успішних 15 тижнів' },
    { id: 'actual_goals', label: 'Актуальні цілі вивчення' },
    { id: 'level_sufficiency', label: 'Достатність рівня' },
    { id: 'continuation', label: 'Продовження навчання: Попередня відповідь' },
    { id: 'problems', label: 'Проблеми та складності' },
    { id: 'record_link', label: 'Посилання на запис' },
  ],
  'продаж': [
    { id: 'audience', label: 'Аудиторія' },
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

// ====== З api/director/route.ts ======
const SCRIPTS: Record<string, string> = {
  'знайомство': `Скрипт Зум-знайомства:
1. Встановлення контакту та план зустрічі
2. GROW: Goal — ціль студента
3. GROW: Reality — поточний рівень
4. GROW: Obstacles — перешкоди
5. GROW: Will — бажання діяти
6. Відповідність тарифу цілям
7. Потенційні ризики відставання
8. Тип особистості та методи впливу
9. Комфортний формат спілкування
10. Побажання щодо викладача та графіка
11. Критерії успішного 1го тижня`,
  '1т': `Скрипт контрольного дотику 1го тижня:
1. Вхід у контакт — підтримка, не контроль
2. Загальне відчуття після першого тижня
3. Що вдалось з критеріїв успіху
4. Що не вдалось — зняття напруги
5. Що подобається у форматі навчання
6. Що не подобається / дискомфорт
7. Перевірка розуміння процесу
8. Формування критеріїв успіху 2го тижня`,
  '2т': `Скрипт контрольного дотику 2го тижня:
1. Вхід у контакт — відчуття партнерства
2. Очікування vs реальність
3. Що вдалось з критеріїв успіху 2го тижня
4. Що не вдалось
5. Компоненти навчання — що зайшло / що ні
6. Перевірка залученості та взаємодії з наставником
7. Формування критеріїв успіху 4 тижнів`,
  '4т': `Скрипт контрольного дотику 4го тижня:
1. Вхід у контакт — партнерство і спільний рух
2. Темп і загальне відчуття
3. Метч із наставником
4. Що вдалось з критеріїв успіху 4го тижня
5. Що не вдалось
6. Компоненти навчання — цінність і відчуття
7. Чого не вистачає для цілі
8. Що змінити / додати для прогресу (апсейл)
9. Індикатори прогресу
10. Критерії успішних 8 тижнів`,
  '8т': `Скрипт контрольного дотику 8го тижня:
1. Вхід у контакт — увага і підтримка
2. Відчуття прогресу щодо цілі
3. Що вдалось з критеріїв успіху 8го тижня
4. Що не вдалось
5. Перевірка на ред-флаги й дискомфорт
6. Що подобається / що дає результат
7. Чого не вистачає для цілі
8. Що змінити / додати (апсейл)
9. Індикатори результату
10. Критерії успішних 12 тижнів`,
  '12т': `Скрипт контрольного дотику 12го тижня:
1. Вхід у контакт — визнання пройденого шляху
2. Відчуття результату (самопродаж)
3. Що вдалось з критеріїв успіху 12го тижня
4. Що не вдалось
5. Що подобається / що не подобається
6. Актуальність цілі
7. Чи закривається ціль на цьому рівні
8. Формування горизонту на 15 тижнів
9. Підсумок і якір на продовження`,
  'продаж': `Скрипт продажного дзвінка (15 тиждень):
1. Вхід у розмову — задати рамку рішення
2. Якір на результат — студент продає сам собі
3. Актуальність цілі (шкала 0-10)
4. Чесна точка: поточний рівень ≠ закрита ціль
5. Міні-діагностика (що дає прогрес / що заважає)
6. Варіанти руху далі (апсейл / основний / даунсейл)
7. Вибір варіанту
8. Закриття на оплату (дата + час)
9. Фінальне резюме`,
}

const CRITERIA_BY_TYPE: Record<string, { id: string; title: string }[]> = {
  'знайомство': [
    { id: 'contact', title: 'Встановлення контакту' },
    { id: 'grow', title: 'Якість GROW-моделі' },
    { id: 'needs', title: 'Виявлення потреб' },
    { id: 'tariff', title: 'Відповідність тарифу' },
    { id: 'closing', title: 'Завершення та критерії 1го тижня' },
  ],
  '1т': [
    { id: 'contact', title: 'Якість входу в контакт' },
    { id: 'diagnostics', title: 'Діагностика стану студента' },
    { id: 'success', title: 'Робота з критеріями успіху' },
    { id: 'barriers', title: 'Виявлення бар\'єрів' },
    { id: 'next_week', title: 'Формування критеріїв 2го тижня' },
  ],
  '2т': [
    { id: 'contact', title: 'Якість входу в контакт' },
    { id: 'expectations', title: 'Очікування vs реальність' },
    { id: 'success', title: 'Робота з критеріями успіху' },
    { id: 'components', title: 'Аналіз компонентів навчання' },
    { id: 'next_criteria', title: 'Формування критеріїв 4 тижнів' },
  ],
  '4т': [
    { id: 'contact', title: 'Якість входу в контакт' },
    { id: 'pace', title: 'Темп і метч з наставником' },
    { id: 'success', title: 'Робота з критеріями успіху' },
    { id: 'upsell', title: 'Апсейл блок' },
    { id: 'next_criteria', title: 'Формування критеріїв 8 тижнів' },
  ],
  '8т': [
    { id: 'contact', title: 'Якість входу в контакт' },
    { id: 'progress', title: 'Виявлення прогресу' },
    { id: 'redflags', title: 'Перевірка на ред-флаги' },
    { id: 'upsell', title: 'Апсейл блок' },
    { id: 'next_criteria', title: 'Формування критеріїв 12 тижнів' },
  ],
  '12т': [
    { id: 'contact', title: 'Якість входу в контакт' },
    { id: 'result', title: 'Виявлення результату' },
    { id: 'goal', title: 'Актуальність цілі' },
    { id: 'sufficiency', title: 'Достатність рівня' },
    { id: 'anchor', title: 'Якір на продовження' },
  ],
  'продаж': [
    { id: 'frame', title: 'Рамка рішення' },
    { id: 'anchor', title: 'Якір на результат' },
    { id: 'goal', title: 'Актуальність цілі' },
    { id: 'offer', title: 'Презентація варіантів' },
    { id: 'closing', title: 'Закриття на оплату' },
  ],
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { transcript, touchType, managerName, studentName, sessionDate, fathomLink } = await request.json()
  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const fields = TOUCH_FIELDS[touchType] || TOUCH_FIELDS['знайомство']
  const script = SCRIPTS[touchType] || SCRIPTS['знайомство']
  const criteria = CRITERIA_BY_TYPE[touchType] || CRITERIA_BY_TYPE['знайомство']
  const isZnayomstvo = touchType === 'знайомство'

  // ====== ПРОМПТИ ======
  const managerPrompt = isZnayomstvo
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

  const directorPrompt = `Ти — експерт з QA для школи англійської мови Study Less. Проаналізуй транскрипт дзвінка менеджера зі студентом і оціни якість роботи менеджера згідно скрипту.
Тип дзвінку: ${touchType === 'знайомство' ? 'Зум-знайомство' : `Контрольний дотик ${touchType}`}
Менеджер: ${managerName || 'невідомо'}
Студент: ${studentName || 'невідомо'}
СКРИПТ ДЛЯ ОЦІНКИ:
${script}
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
      "analysis": "детальний аналіз",
      "strong": "конкретний приклад що спрацювало",
      "improve": "конкретна рекомендація"
    }
  ],
  "top_strengths": ["...", "...", "..."],
  "top_improvements": ["...", "...", "..."]
}
КРИТЕРІЇ:
${criteria.map(c => `- id:"${c.id}" | ${c.title}`).join('\n')}
Всі відповіді українською мовою.
ТРАНСКРИПТ:
${transcript}`

  // ====== ПАРАЛЕЛЬНИЙ АНАЛІЗ ======
  const [managerMsg, directorMsg] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: managerPrompt }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: directorPrompt }],
    }),
  ])

  const parseJson = (msg: any) => {
    const raw = msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  }

  const managerParsed = parseJson(managerMsg)
  const directorParsed = parseJson(directorMsg)

  // ====== ЗБЕРЕЖЕННЯ В SUPABASE ======
  await Promise.all([
    supabase.from('touch_analyses').insert({
      manager_email: 'test@studyless.com',
      student_name: studentName || null,
      session_date: sessionDate || null,
      touch_type: touchType,
      fathom_link: fathomLink || null,
      results: managerParsed.results,
    }).then(({ error }) => { if (error) console.error('Supabase manager error:', error) }),

    supabase.from('director_analyses').insert({
      manager_name: managerName || directorParsed.manager || null,
      student_name: studentName || directorParsed.student || null,
      session_date: sessionDate || null,
      touch_type: touchType,
      overall_score: directorParsed.overall_score,
      overall_comment: directorParsed.overall_comment,
      criteria: directorParsed.criteria,
      top_strengths: directorParsed.top_strengths,
      top_improvements: directorParsed.top_improvements,
    }).then(({ error }) => { if (error) console.error('Supabase director error:', error) }),
  ])

  // ====== GOOGLE SHEETS (лише менеджер) ======
  const sheetName = SHEET_NAMES[touchType] || 'Sessions'
  try {
    await appendToSheet(sheetName, [
      new Date().toLocaleDateString('uk-UA'),
      'test@studyless.com',
      managerName || '',
      studentName || '',
      sessionDate || '',
      ...(fathomLink ? [fathomLink] : []),
      ...managerParsed.results.map((r: any) => r.value),
    ])
  } catch (e) {
    console.error('Sheets error:', e)
  }

  return NextResponse.json({
    manager: managerParsed,
    director: directorParsed,
  })
}