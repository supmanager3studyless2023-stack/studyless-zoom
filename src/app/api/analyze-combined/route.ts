import Anthropic from '@anthropic-ai/sdk'
import { appendToSheet } from '@/lib/sheets'
import { createClient } from '@supabase/supabase-js'
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
    { id: 'readiness', label: 'Шкала готовності (1-10)' },
    { id: 'goal_movement', label: 'Ціль і відчуття руху до неї' },
    { id: 'next_level_request', label: 'Що має з\'явитись у наступному рівні' },
    { id: 'best_component', label: 'Найефективніший компонент навчання' },
    { id: 'offer_reaction', label: 'Реакція на основний офер' },
    { id: 'objection', label: 'Заперечення / сумнів' },
    { id: 'objection_handling', label: 'Як опрацювали заперечення' },
    { id: 'payment_status', label: 'Статус і дата оплати' },
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
  'продаж': `Скрипт продажного дзвінка 3.0 (15 тиждень):
ПІДГОТОВКА: перед дзвінком вивчи картку студента (NPS, прогрес, ціль, компоненти навчання, сегмент). На дзвінок приходиш зі знанням про людину — не зі скриптом у руках.

БЛОК 1 — ВХІД (1–1,5 хв)
Ціль: задати консультативну рамку «я дзвоню, щоб допомогти, а не продати»
НЕ: «є пропозиція» — А: «є розмова»
Фраза: «Я дзвоню, тому що ви зараз на 15-му тижні — і це важливий момент. Мені треба зрозуміти, як побудувати ваш наступний рівень. Моя ціль — щоб це реально працювало для вас.»

БЛОК 2 — ЦІЛЬ І ВІДЧУТТЯ ЕФЕКТИВНОСТІ (2–3 хв)
Ціль: повернути студента до його цілі та зрозуміти, чи він відчуває рух вперед.
Гілка А (відчуває прогрес): «Ваша ціль — [ціль зі картки]. Наскільки ви зараз відчуваєте, що рухаєтесь до неї? Що саме дає вам відчуття ефективності?»
Гілка Б (НЕ відчуває прогрес або сумнівається): СТОП-ФРАЗА — НЕ кажи «Це нормально для вашого рівня» (знецінює відчуття). Запитай: «По шкалі від 1 до 10, наскільки для вас важливо досягти [ціль]?» Якщо ціль охолола — з'ясуй, чи змінилась ціль, перебудуй офер під нову.

БЛОК 3 — ЩО МАЄ З'ЯВИТИСЬ У НАВЧАННІ (2–2,5 хв)
Шкала готовності: «По шкалі від 1 до 10, наскільки ви готові продовжити навчання?»
Оцінка 1–4: «Зрозуміло. Що зараз стоїть на першому місці? Чому навчання відійшло на другий план?» (досліджуємо: ціль / фінанси / час / мотивація)
Оцінка 5–7: «Що має трапитись, щоб ця оцінка стала 10? Що конкретно має змінитись у навчанні?» (відповідь = точне формулювання офера)
Оцінка 8–10: одразу переходимо до Блоку 5 без затримки.
Питання-відкривач: «Що конкретно має з'явитись або змінитись у наступному рівні порівняно з тим, що є зараз?» (пауза — не підказуй варіанти)
Прихований запит: «А є щось, що ви давно хотіли спробувати або додати, але ще не було нагоди?»

БЛОК 5 — МІНІ-ДІАГНОСТИКА ПОТОЧНОГО РІВНЯ (2–2,5 хв)
«Що з того, що ви використовували — індивідуальні уроки, Speaking Clubs, платформа, матеріали — ви вважаєте найефективнішим для себе?»
«Що найбільше вплинуло на ваш результат? Що вважаєте своїм найсильнішим інструментом?»
Ключ до офера: Індивіди → тариф МАКСИМУМ або СТАНДАРТ; SC + говоріння → тариф з Speaking Club; Платформа/самостійно → легший формат або мікролоти.

БЛОК 6 — ОФЕР: ОСНОВНИЙ ПРОДУКТ І АЛЬТЕРНАТИВИ (4–5 хв)
Правило: перший офер — завжди ОСНОВНИЙ продукт під студента. НЕ найвищий тариф. НЕ найнижчий. Один варіант → реакція → наступний крок. НІКОЛИ не пропонуємо більше двох варіантів підряд — це аукціон.
«Виходячи з того, що ви розповіли — я б рекомендувала вам [назва тарифу]. Саме цей формат підходить вам, тому що [1-2 речення під конкретну відповідь студента]. Як вам така ідея?»
Якщо вагається → один бонус до основного (максимум 2 варіації).
Якщо «не підходить» → матриця альтернатив: крок 2 — індивідуальне навчання, крок 3 — мікролоти.

БЛОК 7 — ВИБІР (1,5–2 хв)
«Якщо дивитись на все, про що ми поговорили — який формат для вас зараз виглядає найбільш правильним?» (НЕ «що думаєте?» — а «який виглядає правильним?» → режим рішення, не роздумів)

БЛОК 8 — ЗАКРИТТЯ НА ОПЛАТУ (3–5 хв)
Обрав варіант: «Вам зручніше оплатити сьогодні чи завтра? Домовились. Фіксую: [дата] о [час] ви оплачуєте. Я зараз надішлю рахунок.»
«Дорого»: «Це зараз про суму одразу чи про загальну вартість формату?» Сума → розстрочка від банку або школи. Формат → матриця.
«Подумаю» — 3-кроковий протокол (СТОП: НЕ кажи «Буду вивчати питання» / «Зачекаю на ваш дзвінок» — втрата ініціативи):
  1. «Між якими варіантами ви зараз думаєте?»
  2. «Поки ви думаєте — ваша стипендія [сума] дійсна до [дата]. Після — згорить. І гарантія: якщо виконаєте умови і не відчуєте прогресу — продовжимо безкоштовно.»
  3. «Берете 24 години — і завтра о [конкретний час] даєте рішення. Підійде?» Відкритого «подумаю» немає.
«Ні»: «Дякую за чесність. Основна причина: час, фінанси чи пріоритети?» → фіксуємо в CRM, нагадування через 4–6 тижнів.

БЛОК 9 — ФІНАЛЬНЕ РЕЗЮМЕ + ПИСЬМОВЕ ЗАКРІПЛЕННЯ (1,5–2 хв)
«Тоді підсумую: ви обрали [варіант], формат [коротко], оплата [дата/час/дедлайн рішення]. Дякую!»
Одразу після дзвінка — повідомлення в месенджер: варіант, дата оплати, стипендія + дата, посилання на оплату.

ТЕХНІКИ-ПІДСИЛЮВАЧІ (точково):
«Для ВАС важливо»: «Для вас важливо [слова студента дослівно]. Саме тому [формат] — логічний наступний крок для вас.»
«Моя експертна думка»: «Зараз найкращий момент закріпити те, що є. Якщо зробити паузу — знання охолонуть і вдвічі важче зайти в ритм.»
«Знецінити ціну»: «[Ціна÷днів] гривень на день — менше, ніж кава. А ви отримуєте [те, що студент сам назвав важливим].»
«Розширити ціль»: «Ви вже дійшли до результату, який самі описали. А що відкриється далі?»`,
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
    { id: 'frame', title: 'Блок 1: Консультативна рамка входу' },
    { id: 'anchor', title: 'Блок 2: Ціль і відчуття ефективності' },
    { id: 'goal', title: 'Блок 3: Шкала готовності і запит на зміни' },
    { id: 'diagnostics', title: 'Блок 5: Міні-діагностика компонентів' },
    { id: 'offer', title: 'Блок 6: Офер і матриця альтернатив' },
    { id: 'choice', title: 'Блок 7: Вибір варіанту студентом' },
    { id: 'closing', title: 'Блок 8: Закриття на оплату' },
    { id: 'summary', title: 'Блок 9: Резюме і письмове закріплення' },
  ],
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { transcript, touchType, managerName, studentName, sessionDate, fathomLink } = await request.json()
  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 })

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  })
  const fields = TOUCH_FIELDS[touchType] || TOUCH_FIELDS['знайомство']
  const script = SCRIPTS[touchType] || SCRIPTS['знайомство']
  const criteria = CRITERIA_BY_TYPE[touchType] || CRITERIA_BY_TYPE['знайомство']
  const isZnayomstvo = touchType === 'знайомство'

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

  const directorSystemText = `Ти — експерт з QA для школи англійської мови Study Less. Проаналізуй транскрипт дзвінка менеджера зі студентом і оціни якість роботи менеджера згідно скрипту.
Тип дзвінку: ${touchType === 'знайомство' ? 'Зум-знайомство' : touchType === 'продаж' ? 'Продажний дзвінок 15 тиждень' : `Контрольний дотик ${touchType}`}
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
Всі відповіді українською мовою.`

  const directorUserText = `Менеджер: ${managerName || 'невідомо'}
Студент: ${studentName || 'невідомо'}
ТРАНСКРИПТ:
${transcript}`

  const parseJson = (msg: any) => {
    const raw = msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON found in response. Raw: ${cleaned.slice(0, 200)}`)
    return JSON.parse(match[0])
  }

  // Step 1: run manager + director in parallel
  const [managerMsg, directorMsg] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: managerPrompt }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: [{ type: 'text', text: directorSystemText, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: directorUserText }],
    } as any),
  ])

  const managerParsed = parseJson(managerMsg)
  const directorParsed = parseJson(directorMsg)

  const feedbackZipUrl: string | null = null

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

  // ====== GOOGLE SHEETS — керівник (продаж) ======
  if (touchType === 'продаж') {
    try {
      const d = directorParsed
      const criteriaMap: Record<string, any> = {}
      d.criteria?.forEach((c: any) => { criteriaMap[c.id] = c })

      const formatBlock = (c: any) => c
        ? `${c.score}/10\n+ ${c.strong}\n→ ${c.improve}`
        : ''

      const analysisText = [
        `Загальна оцінка: ${d.overall_score}/10`,
        d.overall_comment,
        '',
        ...(d.criteria?.map((c: any) => `${c.title}: ${c.score}/10\n${c.analysis}\n+ ${c.strong}\n→ ${c.improve}`) ?? []),
        '',
        'Сильні сторони:',
        ...(d.top_strengths?.map((s: string) => `• ${s}`) ?? []),
        '',
        'Що покращити:',
        ...(d.top_improvements?.map((s: string) => `• ${s}`) ?? []),
      ].join('\n')

      await appendToSheet('Аналізи Продажі', [
        new Date().toLocaleDateString('uk-UA'),
        managerName || '',
        studentName || '',
        sessionDate || '',
        d.overall_score ?? '',
        d.overall_comment ?? '',
        formatBlock(criteriaMap['frame']),
        formatBlock(criteriaMap['anchor']),
        formatBlock(criteriaMap['goal']),
        formatBlock(criteriaMap['diagnostics']),
        formatBlock(criteriaMap['offer']),
        formatBlock(criteriaMap['choice']),
        formatBlock(criteriaMap['closing']),
        formatBlock(criteriaMap['summary']),
        d.top_strengths?.join('\n') ?? '',
        d.top_improvements?.join('\n') ?? '',
        analysisText,
        feedbackZipUrl ?? '',
      ])
    } catch (e) {
      console.error('Sheets продаж error:', e)
    }
  }

  // ====== GOOGLE SHEETS — керівник (знайомство) ======
  if (touchType === 'знайомство') {
    try {
      const d = directorParsed
      const criteriaMap: Record<string, any> = {}
      d.criteria?.forEach((c: any) => { criteriaMap[c.id] = c })

      const formatBlock = (c: any) => c
        ? `${c.score}/10\n+ ${c.strong}\n→ ${c.improve}`
        : ''

      await appendToSheet('Аналізи Знайомства', [
        new Date().toLocaleDateString('uk-UA'),
        managerName || '',
        studentName || '',
        sessionDate || '',
        d.overall_score ?? '',
        d.overall_comment ?? '',
        formatBlock(criteriaMap['contact']),
        formatBlock(criteriaMap['grow']),
        formatBlock(criteriaMap['needs']),
        formatBlock(criteriaMap['tariff']),
        formatBlock(criteriaMap['closing']),
        d.top_strengths?.join('\n') ?? '',
        d.top_improvements?.join('\n') ?? '',
      ])
    } catch (e) {
      console.error('Sheets знайомство error:', e)
    }
  }

  // ====== GOOGLE SHEETS — керівник (КД) ======
  if (['1т', '2т', '4т', '8т', '12т'].includes(touchType)) {
    try {
      const d = directorParsed
      const criteriaMap: Record<string, any> = {}
      d.criteria?.forEach((c: any) => { criteriaMap[c.id] = c })

      const kdCriteriaIds: Record<string, string[]> = {
        '1т': ['contact', 'diagnostics', 'success', 'barriers', 'next_week'],
        '2т': ['contact', 'expectations', 'success', 'components', 'next_criteria'],
        '4т': ['contact', 'pace', 'success', 'upsell', 'next_criteria'],
        '8т': ['contact', 'progress', 'redflags', 'upsell', 'next_criteria'],
        '12т': ['contact', 'result', 'goal', 'sufficiency', 'anchor'],
      }

      const kdTitles: Record<string, string[]> = {
        '1т': ['Вхід в контакт', 'Діагностика стану', 'Критерії успіху', 'Виявлення бар\'єрів', 'Критерії 2го тижня'],
        '2т': ['Вхід в контакт', 'Очікування vs реальність', 'Критерії успіху', 'Компоненти навчання', 'Критерії 4 тижнів'],
        '4т': ['Вхід в контакт', 'Темп і метч', 'Критерії успіху', 'Апсейл блок', 'Критерії 8 тижнів'],
        '8т': ['Вхід в контакт', 'Виявлення прогресу', 'Ред-флаги', 'Апсейл блок', 'Критерії 12 тижнів'],
        '12т': ['Вхід в контакт', 'Виявлення результату', 'Актуальність цілі', 'Достатність рівня', 'Якір на продовження'],
      }

      const ids = kdCriteriaIds[touchType] || []
      const titles = kdTitles[touchType] || []

      const blocks = ids.map((id, i) => {
        const c = criteriaMap[id]
        const title = titles[i] || id
        return c
          ? `${title}\n${c.score}/10\n+ ${c.strong}\n→ ${c.improve}`
          : `${title}\n—`
      })

      await appendToSheet('Аналізи КД', [
        new Date().toLocaleDateString('uk-UA'),
        managerName || '',
        studentName || '',
        sessionDate || '',
        touchType,
        d.overall_score ?? '',
        d.overall_comment ?? '',
        ...blocks,
        d.top_strengths?.join('\n') ?? '',
        d.top_improvements?.join('\n') ?? '',
      ])
    } catch (e) {
      console.error('Sheets КД error:', e)
    }
  }

  // ====== GOOGLE SHEETS — менеджер (всі типи) ======
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
    console.error('Sheets менеджер error:', e)
  }

  return NextResponse.json({
    manager: managerParsed,
    director: directorParsed,
    ...(feedbackZipUrl ? { feedback_zip_url: feedbackZipUrl } : {}),
  })
}
