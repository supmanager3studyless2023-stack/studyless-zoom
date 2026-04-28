import Anthropic from '@anthropic-ai/sdk'
import { appendToSheet, storeFeedbackHtml } from '@/lib/sheets'
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const fields = TOUCH_FIELDS[touchType] || TOUCH_FIELDS['знайомство']
  const script = SCRIPTS[touchType] || SCRIPTS['знайомство']
  const criteria = CRITERIA_BY_TYPE[touchType] || CRITERIA_BY_TYPE['знайомство']
  const isZnayomstvo = touchType === 'знайомство'
  const isProdazh = touchType === 'продаж'

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
Тип дзвінку: ${touchType === 'знайомство' ? 'Зум-знайомство' : touchType === 'продаж' ? 'Продажний дзвінок 15 тиждень' : `Контрольний дотик ${touchType}`}
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

  const feedbackPrompt = `Ти — старший sales coach школи англійської мови Study Less. Проаналізуй транскрипт продажного дзвінка та надай детальний персональний фідбек у вигляді повного HTML-документу.

Менеджер: ${managerName || 'невідомо'}
Студент: ${studentName || 'невідомо'}
Дата: ${sessionDate || new Date().toLocaleDateString('uk-UA')}

СКРИПТ ПРОДАЖНОГО ДЗВІНКА 3.0 (15 тиждень):
${SCRIPTS['продаж']}

КРИТЕРІЇ ЯКІСНОГО ДЗВІНКА (за скриптом 3.0):
${CRITERIA_BY_TYPE['продаж'].map(c => `- ${c.title}`).join('\n')}

СТОП-ФРАЗИ СКРИПТУ 3.0 (завжди шукай у транскрипті):
- «є пропозиція» — порушує рамку входу (Блок 1)
- «це нормально для вашого рівня» — знецінює відчуття студента (Блок 2)
- «зачекаю на ваш дзвінок» / «буду вивчати питання» — втрата ініціативи при «подумаю» (Блок 8)
- Пропозиція 3+ варіантів підряд без паузи на реакцію — аукціон (Блок 6)
- Відкрите «подумаю» без конкретного дедлайну рішення (Блок 8)
- Відсутність шкали готовності 1-10 (Блок 3)
- Перехід до офера без діагностики компонентів (пропущений Блок 5)

ТРАНСКРИПТ:
${transcript}

Поверни ВИКЛЮЧНО повний HTML-документ від <!DOCTYPE html> до </html>. Жодних пояснень до або після.

Документ має містити 8 розділів у такій структурі:

1. ШАПКА (.header з gradient фоном). Всередині .header-top (flex, space-between) — ліворуч: h1 "Фідбек по продажному дзвінку (Скрипт 3.0)" і .subtitle "Study Less · Аналіз продажного дзвінка"; праворуч: .score-badge з загальною оцінкою (.score-num — велика цифра 0–10, .score-label — "з 10"). Під .header-top — .header-meta (flex row) з .meta-item елементами: менеджер, студент, дата, результат дзвінка. Під ними — .summary з одним підсумковим реченням про дзвінок.

2. 📊 ОЦІНКИ ПО БЛОКАХ — div.scores-grid з рівно 8 div.score-card (по одній на кожен блок скрипту 3.0). Назви блоків: "Блок 1: Вхід і рамка", "Блок 2: Ціль і ефективність", "Блок 3: Шкала готовності", "Блок 5: Міні-діагностика", "Блок 6: Офер", "Блок 7: Вибір", "Блок 8: Закриття на оплату", "Блок 9: Резюме і закріплення".
   Структура кожної картки:
   <div class="score-card">
     <div class="sc-label">Назва блоку</div>
     <div class="sc-row"><div class="sc-num color-X">N/10</div><div class="bar-track"><div class="bar-fill fill-X" style="width:N0%"></div></div></div>
     <div class="sc-comment">1–2 речення: ЧОМУ саме ця оцінка — що конкретно зроблено або пропущено в цьому блоці</div>
   </div>
   Кольори: 0–3 → color-red/fill-red; 4–5 → color-orange/fill-orange; 6–7 → color-yellow/fill-yellow; 8–10 → color-green/fill-green.

3. ✅ ПЛЮСИ — div.card з ul.item-list, 4–8 позитивних моментів.
   Кожен li: div.bullet.bullet-green → <b>коротка назва</b> → цитата з транскрипту курсивом → пояснення.

4. ❌ МІНУСИ — div.card з ul.item-list, 3–7 помилок і упущень (зокрема пропущені/порушені блоки скрипту 3.0).
   Кожен li: div.bullet.bullet-red → <b>коротка назва</b> → що відбулося → чому заважає продажу.

5. 📈 ТОЧКИ РОСТУ — div.card, 3–5 рекомендацій.
   Кожен пункт у div.growth-item: div.growth-num з номером + div.growth-text з <strong>назва</strong> та описом дії + ефекту.

6. 💚 ЕКОЛОГІЧНИЙ ФІДБЕК — div.card з div.eco-block, 2–3 абзаци (теги p) теплого підтримуючого коментаря. Без жорсткої критики.

7. 🚫 ФРАЗИ ТАБУ — div.card, для кожної фрази div.phrase-block:
   - div.phrase-bad: div.label "Сказав менеджер" + div.text (пряма цитата з транскрипту)
   - div.phrase-why: чому ця фраза шкодить
   - div.phrase-good: div.label "Замінити на" + div.text (конкретна альтернатива)
   Мінімум 3–5 блоків. ТІЛЬКИ фрази що реально звучали у транскрипті.

8. ❓ ЧОМУ НЕ ВІДБУВСЯ ПРОДАЖ — div.card, ТІЛЬКИ якщо продаж реально не відбувся.
   Для кожного зламаного моменту div.moment-block: div.moment-title (назва моменту + номер блоку), div.moment-desc (що сталось), div.moment-fix (<strong>Як уникнути</strong> + конкретна фраза-замінник).
   Якщо продаж відбувся — цей розділ НЕ додавати.

CSS (обов'язково вбудувати у <style> в <head>, точно ці класи):
* * { box-sizing:border-box; margin:0; padding:0; }
* body: font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; background:#f4f6fb; color:#1a1a2e; line-height:1.6; padding:32px 16px;
* .container: max-width:900px; margin:0 auto;
* .header: background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%); border-radius:16px; padding:36px 40px; margin-bottom:28px; color:#fff;
* .header-top: display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;
* .header h1: font-size:22px; font-weight:700;
* .header .subtitle: font-size:14px; color:#a0aec0; margin-top:4px;
* .score-badge: background:rgba(255,255,255,0.08); border:2px solid rgba(255,255,255,0.18); border-radius:12px; padding:14px 24px; text-align:center; min-width:110px;
* .score-badge .score-num: font-size:42px; font-weight:800; color:#f6ad55; line-height:1;
* .score-badge .score-label: font-size:11px; color:#a0aec0; margin-top:4px; text-transform:uppercase; letter-spacing:1px;
* .header-meta: margin-top:20px; display:flex; gap:24px; flex-wrap:wrap;
* .meta-item: font-size:13px; color:#a0aec0;
* .meta-item span: color:#e2e8f0; font-weight:600;
* .header .summary: margin-top:14px; font-size:15px; background:rgba(255,255,255,0.1); border-radius:8px; padding:12px 16px;
* .scores-grid: display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; margin-bottom:28px;
* .score-card: background:#fff; border-radius:12px; padding:16px 20px; box-shadow:0 1px 6px rgba(0,0,0,0.07);
* .sc-label: font-size:12px; font-weight:600; color:#718096; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;
* .sc-row: display:flex; align-items:center; gap:12px;
* .sc-num: font-size:20px; font-weight:800; min-width:38px;
* .bar-track: flex:1; height:8px; background:#edf2f7; border-radius:99px; overflow:hidden;
* .bar-fill: height:100%; border-radius:99px;
* .sc-comment: font-size:12px; color:#4a5568; margin-top:8px; line-height:1.5;
* .color-red: color:#e53e3e; .color-orange: color:#dd6b20; .color-yellow: color:#d69e2e; .color-green: color:#38a169;
* .fill-red: background:#fc8181; .fill-orange: background:#f6ad55; .fill-yellow: background:#f6e05e; .fill-green: background:#68d391;
* .card: background:#fff; border-radius:14px; padding:24px 28px; margin-bottom:20px; box-shadow:0 1px 8px rgba(0,0,0,0.07);
* .card-title: font-size:15px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:10px;
* .icon: width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;
* .icon-green: background:#f0fff4; .icon-red: background:#fff5f5; .icon-blue: background:#ebf8ff; .icon-orange: background:#fffaf0; .icon-purple: background:#faf5ff;
* .item-list: list-style:none;
* .item-list li: display:flex; gap:12px; padding:10px 0; border-bottom:1px solid #f7fafc; font-size:14px; align-items:flex-start;
* .item-list li:last-child: border-bottom:none;
* .bullet: width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; margin-top:1px;
* .bullet-green: background:#f0fff4; color:#38a169; .bullet-red: background:#fff5f5; color:#e53e3e;
* .phrase-block: border:1px solid #fed7d7; border-radius:10px; overflow:hidden; margin-bottom:12px;
* .phrase-bad: background:#fff5f5; padding:12px 16px; font-size:13px;
* .phrase-bad .label: font-size:10px; font-weight:700; color:#e53e3e; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;
* .phrase-bad .text: color:#c53030; font-weight:600;
* .phrase-why: background:#fff; padding:8px 16px; font-size:12px; color:#718096; border-top:1px solid #fed7d7; font-style:italic;
* .phrase-good: background:#f0fff4; padding:12px 16px; font-size:13px; border-top:1px solid #c6f6d5;
* .phrase-good .label: font-size:10px; font-weight:700; color:#38a169; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;
* .phrase-good .text: color:#276749; font-weight:500;
* .moment-block: border-left:4px solid #fc8181; padding:14px 18px; margin-bottom:14px; background:#fff5f5; border-radius:0 10px 10px 0;
* .moment-title: font-weight:700; font-size:14px; color:#c53030; margin-bottom:6px;
* .moment-desc: font-size:13px; color:#4a5568; margin-bottom:8px;
* .moment-fix: font-size:12px; color:#276749; background:#f0fff4; border-radius:6px; padding:8px 12px; border-left:3px solid #68d391;
* .moment-fix strong: display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#38a169; margin-bottom:3px;
* .eco-block: background:linear-gradient(135deg,#f0fff4,#ebf8ff); border:1px solid #c6f6d5; border-radius:12px; padding:20px 24px; font-size:14px; line-height:1.8; color:#2d3748;
* .eco-block p+p: margin-top:10px;
* .growth-item: display:flex; gap:14px; padding:12px 0; border-bottom:1px solid #f7fafc; align-items:flex-start;
* .growth-item:last-child: border-bottom:none;
* .growth-num: width:28px; height:28px; border-radius:50%; background:#ebf8ff; color:#3182ce; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px;
* .growth-text: font-size:14px; color:#2d3748;
* .growth-text strong: color:#1a1a2e; display:block; margin-bottom:2px;
* .footer: text-align:center; font-size:12px; color:#a0aec0; margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0;
* @media(max-width:600px): .header{padding:24px 20px} .card{padding:18px 18px} .header-top{flex-direction:column}

Усі тексти — ВИКЛЮЧНО українською мовою.`

  const parseJson = (msg: any) => {
    const raw = msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  }

  const getText = (msg: any): string =>
    msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('').trim()

  // Step 1: run manager + director in parallel
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

  const managerParsed = parseJson(managerMsg)
  const directorParsed = parseJson(directorMsg)

  // Step 2: run feedback using director scores so HTML matches platform
  let feedbackMsg: any = null
  if (isProdazh) {
    const d = directorParsed
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

    const finalFeedbackPrompt = feedbackPrompt.replace('ТРАНСКРИПТ:', scoreContext + '\nТРАНСКРИПТ:')

    feedbackMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10000,
      messages: [{ role: 'user', content: finalFeedbackPrompt }],
    })
  }

  let feedbackHtml: string | null = null
  let feedbackZipUrl: string | null = null

  if (isProdazh && feedbackMsg) {
    const raw = getText(feedbackMsg)
    const cleaned = raw.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    feedbackHtml = cleaned.startsWith('<!') || cleaned.includes('<html') ? cleaned : null

    if (feedbackHtml) {
      try {
        const feedbackId = crypto.randomUUID()
        await storeFeedbackHtml(feedbackId, feedbackHtml, managerName || '', studentName || '')
        const host = request.headers.get('host') ?? 'studyless-zoom.vercel.app'
        const proto = host.includes('localhost') ? 'http' : 'https'
        feedbackZipUrl = `${proto}://${host}/api/feedback/${feedbackId}`
      } catch (e) {
        console.error('Feedback storage error:', e)
      }
    }
  }

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
    ...(feedbackHtml ? { feedback_html: feedbackHtml } : {}),
    ...(feedbackZipUrl ? { feedback_zip_url: feedbackZipUrl } : {}),
  })
}
