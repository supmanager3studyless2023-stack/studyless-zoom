'use strict'
// «Гроші» — простий трекер витрат. Усі дані лишаються на телефоні (IndexedDB + localStorage).
// Витрати з Monobank підтягуються через особистий API-токен (Apple Pay — це звичайні оплати карткою).

const BASE_CATS = [
  { id: 'food', ico: '🛒', name: 'Продукти', color: '#4ade80' },
  { id: 'cafe', ico: '☕', name: 'Кафе', color: '#fb923c' },
  { id: 'transport', ico: '🚌', name: 'Транспорт', color: '#60a5fa' },
  { id: 'car', ico: '🚗', name: 'Авто', color: '#38bdf8' },
  { id: 'home', ico: '🏠', name: 'Дім', color: '#a78bfa' },
  { id: 'health', ico: '💊', name: "Здоров'я", color: '#f87171' },
  { id: 'fun', ico: '🎬', name: 'Розваги', color: '#f472b6' },
  { id: 'shop', ico: '👕', name: 'Покупки', color: '#facc15' },
  { id: 'sub', ico: '📱', name: 'Зв’язок', color: '#2dd4bf' },
  { id: 'transfer', ico: '💸', name: 'Перекази', color: '#94a3b8' },
  { id: 'other', ico: '📦', name: 'Інше', color: '#a1a1aa' },
  { id: 'income', ico: '💰', name: 'Дохід', color: '#22c55e' },
]
const PALETTE = ['#e879f9', '#34d399', '#fbbf24', '#818cf8', '#fb7185', '#22d3ee', '#a3e635', '#f97316']
let CATS = BASE_CATS
let CAT = Object.fromEntries(BASE_CATS.map((c) => [c.id, c]))
const catOf = (id) => CAT[id] || CAT.other
function rebuildCats() {
  CATS = [...BASE_CATS, ...S.settings.customCats]
  CAT = Object.fromEntries(CATS.map((c) => [c.id, c]))
}

function mccToCat(mcc) {
  const m = Number(mcc)
  if ([5411, 5422, 5441, 5451, 5462, 5499, 5300, 5311].includes(m)) return 'food'
  if (m >= 5811 && m <= 5814) return 'cafe'
  if ([4111, 4112, 4121, 4131, 4789, 4784, 7523].includes(m)) return 'transport'
  if ([5541, 5542, 5511, 5521, 7531, 7538, 7542, 5533].includes(m)) return 'car'
  if ([4900, 5200, 5211, 5712, 5713, 7349, 1520, 1711, 1731].includes(m)) return 'home'
  if (m === 5912 || (m >= 8011 && m <= 8099) || m === 5122) return 'health'
  if ([7832, 7841, 7922, 7991, 7996, 7997, 7998, 7999, 5815, 5816, 5817, 5818, 5942, 5945, 5947].includes(m)) return 'fun'
  if ((m >= 5611 && m <= 5699) || [5732, 5734, 5651, 5691, 5311, 5651, 5944, 5977].includes(m)) return 'shop'
  if ([4814, 4899, 4816].includes(m)) return 'sub'
  if ([4829, 6012, 6011, 6538].includes(m)) return 'transfer'
  return 'other'
}

// ---------- сховище ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem('money.' + k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem('money.' + k, JSON.stringify(v)) } catch { /* ignore */ } },
}
let db
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('money', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('tx', { keyPath: 'id' })
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
const store = (mode = 'readonly') => db.transaction('tx', mode).objectStore('tx')
const idb = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
const dbAll = () => idb(store().getAll())
const dbPut = (t) => idb(store('readwrite').put(t))
const dbDel = (id) => idb(store('readwrite').delete(id))

// ---------- стан ----------
const S = {
  txs: [],
  tab: 'home',
  month: monthKey(new Date()),
  kind: 'all',
  statCat: null,
  statScroll: 0,
  q: '',
  settings: Object.assign({ token: '', limit: 0, accounts: [], since: {}, lastSync: 0, rules: {}, customCats: [], v: 1, lastBackup: 0, snooze: 0, openAdd: false, plans: [], daily: 0, own: 0 }, LS.get('settings', {})),
  debts: LS.get('debts', []),
  syncing: false,
  syncMsg: '',
}
const saveSettings = () => LS.set('settings', S.settings)
const saveDebts = () => LS.set('debts', S.debts)

// ---------- утиліти ----------
const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
function dayKey(ts) { const d = new Date(ts); return monthKey(d) + '-' + String(d.getDate()).padStart(2, '0') }
const uah = (k) => Math.round(Math.abs(k) / 100).toLocaleString('uk-UA').replace(/ /g, ' ') + ' ₴'
const monthName = (key) => new Date(key + '-01T12:00').toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }).replace(/\s*р\.$/, '')
function dayLabel(key) {
  const today = dayKey(Date.now()), yest = dayKey(Date.now() - 864e5)
  if (key === today) return 'Сьогодні'
  if (key === yest) return 'Вчора'
  return new Date(key + 'T12:00').toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' })
}
const active = (t) => !t.ignore && !t.own // переказ між своїми картками не є ні витратою, ні надходженням
const counts = (t) => active(t) && t.amount < 0
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show')
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const normDesc = (s) => String(s || '').trim().toLowerCase()

// ---------- відображення ----------
function monthTxs() {
  return S.txs.filter((t) => monthKey(new Date(t.ts)) === S.month).sort((a, b) => b.ts - a.ts)
}
function render() {
  const app = $('#app'), y = window.scrollY
  LS.set('ui', { tab: S.tab, month: S.month, kind: S.kind, statCat: S.statCat, at: Date.now() })
  if (S.tab === 'home') app.innerHTML = viewHome()
  else if (S.tab === 'stats') app.innerHTML = viewStats()
  else if (S.tab === 'debts') app.innerHTML = viewDebts()
  else app.innerHTML = viewSettings()
  app.insertAdjacentHTML('beforeend', `<button class="fab" data-act="add" aria-label="Додати">+</button>
    <nav class="tabs">${[['home', '🏠', 'Головна'], ['stats', '📊', 'Статистика'], ['debts', '💳', 'Борги'], ['settings', '⚙️', 'Налаштування']]
      .map(([id, i, n]) => `<button data-act="tab" data-v="${id}" class="${S.tab === id ? 'on' : ''}"><span>${i}</span>${n}</button>`).join('')}</nav>`)
  window.scrollTo(0, y) // після збереження/видалення лишаємось там, де були
}

function monthHeader() {
  const cur = monthKey(new Date())
  return `<div class="head"><button class="arrow" data-act="mprev">‹</button><div class="month">${monthName(S.month)}</div>
    <button class="arrow" data-act="mnext" ${S.month >= cur ? 'disabled' : ''}>›</button></div>`
}

function viewHome() {
  const all = monthTxs()
  const spent = all.filter(counts).reduce((s, t) => s - t.amount, 0)
  const income = all.filter((t) => active(t) && t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const isCur = S.month === monthKey(new Date())
  const today = isCur ? S.txs.filter((t) => counts(t) && dayKey(t.ts) === dayKey(Date.now())).reduce((s, t) => s - t.amount, 0) : 0
  const limit = S.settings.limit * 100
  let limitHtml = ''
  if (limit > 0) {
    const pct = Math.min(100, (spent / limit) * 100)
    const left = limit - spent
    let hint = left >= 0 ? `Залишилось ${uah(left)}` : `Перевищено на ${uah(left)}`
    if (isCur && left > 0) {
      const d = new Date(); const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1
      hint += ` · ≈${uah(left / days)}/день`
    }
    limitHtml = `<div class="bar ${left < 0 ? 'over' : ''}"><i style="width:${pct}%"></i></div><div class="sub"><span>${hint}</span><span>з ${uah(limit)}</span></div>`
  }
  return `${monthHeader()}
    <div class="hero"><div class="lbl">Витрачено${isCur ? ` · сьогодні ${uah(today)}` : ''}</div><div class="big">${uah(spent)}</div>${limitHtml}
    <div class="two" style="margin-top:14px"><div><div class="lbl">Надходження</div><div class="mini in">+${uah(income)}</div></div>
      <div><div class="lbl">Баланс місяця</div><div class="mini ${income - spent < 0 ? 'neg' : 'in'}">${income - spent < 0 ? '−' : '+'}${uah(income - spent)}</div></div></div></div>
    ${backupBanner()}
    <div class="seg">${[['all', 'Усі'], ['out', 'Витрати'], ['in', 'Надходження']].map(([k, n]) => `<button data-act="kind" data-v="${k}" class="${S.kind === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <input class="field" id="search" type="search" placeholder="🔍 Пошук за назвою, категорією чи сумою" value="${esc(S.q)}">
    <div id="txlist">${homeList()}</div>${S.settings.token ? `<div class="sync">${esc(S.syncMsg) || syncedLabel()} · <button data-act="sync" style="text-decoration:underline">оновити</button></div>` : ''}`
}
function backupBanner() {
  const s = S.settings, day = 864e5
  if (S.txs.length + S.debts.length < 5 || Date.now() - s.lastBackup < 14 * day || Date.now() - s.snooze < 3 * day) return ''
  return `<div class="box" style="margin-bottom:12px"><p style="margin:0 0 10px">Твої записи зберігаються лише на цьому телефоні. Збережи копію, щоб нічого не втратити.</p>
    <div class="two"><button class="btn" data-act="export" style="margin:0">Зберегти копію</button><button class="btn sec" data-act="snooze" style="margin:0">Пізніше</button></div></div>`
}
// ---------- перевірка даних ----------
function reportHtml() {
  const mono = S.txs.filter((t) => t.src === 'mono')
  const fmtD = (ts) => new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: '2-digit' })
  const byMonth = {}
  for (const t of S.txs) {
    const k = monthKey(new Date(t.ts)); const m = byMonth[k] || (byMonth[k] = { inc: 0, spent: 0, own: 0, ign: 0, n: 0 })
    m.n++
    if (t.own) { if (t.amount > 0) m.own += t.amount } else if (t.ignore) m.ign += Math.abs(t.amount)
    else if (t.amount > 0) m.inc += t.amount; else m.spent -= t.amount
  }
  let cum = 0
  const cumBy = {}
  for (const k of Object.keys(byMonth).sort()) { cum += byMonth[k].inc - byMonth[k].spent; cumBy[k] = cum }
  const months = Object.keys(byMonth).sort().reverse().map((k) => {
    const m = byMonth[k], diff = m.inc - m.spent
    return `<div class="box" style="margin-bottom:8px"><b style="text-transform:capitalize">${monthName(k)}</b>
      <div class="sub"><span>Надходження</span><span>+${uah(m.inc)}</span></div><div class="sub"><span>Витрати</span><span>−${uah(m.spent)}</span></div>
      <div class="sub"><span>Різниця</span><b style="color:${diff < 0 ? 'var(--danger)' : 'var(--accent)'}">${diff < 0 ? '−' : '+'}${uah(diff)}</b></div>
      <div class="sub"><span>Накопичено з початку даних</span><b style="color:${cumBy[k] < 0 ? 'var(--danger)' : 'var(--accent)'}">${cumBy[k] < 0 ? '−' : '+'}${uah(cumBy[k])}</b></div>
      <div class="sub"><span>Перекази між своїми картками та транзит (не враховано)</span><span>${uah(m.own)}</span></div>
      ${m.ign ? `<div class="sub"><span>Позначено «не враховувати»</span><span>${uah(m.ign)}</span></div>` : ''}<div class="sub"><span>Операцій</span><span>${m.n}</span></div></div>`
  }).join('')
  // покриття даних по картках
  const warns = []
  const cov = S.settings.accounts.map((a) => {
    const ts = mono.filter((t) => t.acc === a.id).map((t) => t.ts).sort((x, y) => x - y)
    if (!ts.length) return `<div class="sub"><span>${esc(a.name)}${a.on ? '' : ' (вимкнено)'}</span><span>немає операцій</span></div>`
    let gap = 0, gapAt = 0
    for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > gap) { gap = ts[i] - ts[i - 1]; gapAt = ts[i - 1] }
    if (gap > 10 * 864e5) warns.push(`Картка «${a.name}»: немає операцій ${Math.round(gap / 864e5)} дн. після ${fmtD(gapAt)} — можливо, історію не завантажено.`)
    return `<div class="sub"><span>${esc(a.name)}${a.on ? '' : ' (вимкнено)'}</span><span>${fmtD(ts[0])} – ${fmtD(ts[ts.length - 1])} · ${ts.length}</span></div>`
  }).join('')
  const off = S.settings.accounts.filter((a) => !a.on)
  if (off.length) warns.push(`Вимкнені картки (${off.map((a) => a.name).join(', ')}) не потрапляють у витрати й надходження.`)
  const first = mono.length ? Math.min(...mono.map((t) => t.ts)) : 0
  if (first && new Date(first).getDate() > 3) warns.push(`Дані з банку починаються з ${fmtD(first)}, тому ${monthName(monthKey(new Date(first)))} неповний. Завантаж історію в налаштуваннях.`)
  warns.push('Не враховано: рахунки ФОП, валютні рахунки та скарбнички. Переказ у скарбничку виглядає як витрата, а з неї як надходження.')
  // підозрілі непарні перекази
  const sus = mono.filter((t) => !t.own && !t.ignore && (Number(t.mcc) === 4829 || /переказ|скарбнич|(^|\s)банк[уа](\s|$)|jar/i.test(t.desc || '')))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10)
  const susHtml = sus.map((t) => `<button class="row" data-act="repedit" data-id="${esc(t.id)}" style="padding:8px 0"><div class="mid"><div class="t">${esc(t.desc || 'Переказ')}</div><div class="s">${fmtD(t.ts)} · ${esc(S.settings.accounts.find((a) => a.id === t.acc)?.name || '')}</div></div><div class="a ${t.amount > 0 ? 'in' : ''}">${t.amount > 0 ? '+' : '−'}${uah(t.amount)}</div></button>`).join('')
  const big = S.txs.filter((t) => active(t) && t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5)
    .map((t) => `<div class="sub"><span>${fmtD(t.ts)} · ${esc(t.desc || t.note || 'Надходження')}</span><span>+${uah(t.amount)}</span></div>`).join('')
  return `<div class="panel"><h3 style="margin-top:0">Перевірка даних</h3>
    <div class="box" style="margin-bottom:12px">${warns.map((w) => `<p style="color:var(--text)">⚠️ ${esc(w)}</p>`).join('')}</div>
    <h3>Місяці</h3>${months || '<p>Немає даних.</p>'}
    <h3>Покриття по картках</h3><div class="box">${cov || '<p>Банк не підключено.</p>'}</div>
    <h3>Найбільші непарні перекази</h3><div class="box"><p>Якщо це переказ між твоїми картками або скарбничкою, відкрий і ввімкни «Переказ між моїми картками».</p>${susHtml || '<p>Немає.</p>'}</div>
    <h3>Найбільші надходження</h3><div class="box">${big || '<p>Немає.</p>'}</div>
    <button class="btn sec" data-act="fclose" style="margin-top:12px">Закрити</button></div>`
}
function dayGroups(list, kind) {
  const groups = []
  for (const t of list) {
    const k = dayKey(t.ts)
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [] })
    groups[groups.length - 1].items.push(t)
  }
  return groups.map((g) => {
    const sum = g.items.filter(counts).reduce((s, t) => s - t.amount, 0)
    const inSum = g.items.filter((t) => active(t) && t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const dsum = kind === 'in' ? (inSum ? '+' + uah(inSum) : '') : sum ? '−' + uah(sum) : ''
    return `<div class="day"><span>${dayLabel(g.k)}</span><span>${dsum}</span></div><div class="list">${g.items.map(rowHtml).join('')}</div>`
  }).join('')
}
function homeList() {
  let list = monthTxs()
  if (S.kind === 'out') list = list.filter((t) => t.amount < 0)
  else if (S.kind === 'in') list = list.filter((t) => t.amount > 0)
  const q = S.q.trim().toLowerCase().replace(',', '.')
  if (q) list = list.filter((t) => [t.note, t.desc, catOf(t.cat).name, String(Math.abs(t.amount) / 100)].some((x) => String(x || '').toLowerCase().includes(q)))
  return dayGroups(list, S.kind) || (q ? '<div class="empty">Нічого не знайдено.</div>'
    : `<div class="empty">Поки порожньо.<br>Натисни «+», щоб додати витрату${S.settings.token ? '' : ',<br>або підключи Monobank в налаштуваннях'}.</div>`)
}
function syncedLabel() {
  if (S.syncing) return 'Оновлення…'
  if (!S.settings.lastSync) return 'Ще не синхронізовано'
  const m = Math.round((Date.now() - S.settings.lastSync) / 60000)
  return m < 1 ? 'Оновлено щойно' : `Оновлено ${m} хв тому`
}
function rowHtml(t) {
  const c = catOf(t.cat)
  const title = t.note || t.desc || c.name
  return `<button class="row ${t.ignore || t.own ? 'ign' : ''}" data-act="edit" data-id="${esc(t.id)}">
    <div class="ico">${c.ico}</div>
    <div class="mid"><div class="t">${esc(title)}</div><div class="s">${c.name} · ${t.src === 'mono' ? 'картка' : 'готівка'}${t.photo ? ' · 📎' : ''}${t.own === 'jar' ? ' · транзит зі скарбнички' : t.own ? ' · між своїми картками' : t.ignore ? ' · не враховано' : ''}</div></div>
    <div class="a ${t.amount > 0 ? 'in' : ''}">${t.amount > 0 ? '+' : '−'}${uah(t.amount)}</div></button>`
}

function viewCat() {
  const c = catOf(S.statCat)
  const list = monthTxs().filter((t) => t.cat === S.statCat)
  const total = list.filter(counts).reduce((s, t) => s - t.amount, 0)
  const inc = list.filter((t) => active(t) && t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const all = monthTxs().filter(counts).reduce((s, t) => s - t.amount, 0)
  return `<button class="chip" data-act="catback" style="margin-bottom:8px">‹ Усі категорії</button>${monthHeader()}
    <div class="hero"><div class="lbl">${esc(c.ico)} ${esc(c.name)}</div><div class="big">${uah(S.statCat === 'income' ? inc : total)}</div>
    <div class="sub"><span>${list.length} операцій</span><span>${S.statCat !== 'income' && all ? Math.round((total / all) * 100) + '% від усіх витрат' : ''}</span></div></div>
    ${dayGroups(list, S.statCat === 'income' ? 'in' : 'out') || '<div class="empty">У цій категорії немає операцій за місяць.</div>'}`
}
function monthSpend(key, upto) {
  const by = {}
  let total = 0
  for (const t of S.txs) {
    if (!counts(t) || monthKey(new Date(t.ts)) !== key || new Date(t.ts).getDate() > upto) continue
    by[t.cat] = (by[t.cat] || 0) - t.amount; total -= t.amount
  }
  return { total, by }
}
function compareHtml(total, byNow) {
  const [y, m] = S.month.split('-').map(Number), pk = monthKey(new Date(y, m - 2, 1))
  const isCur = S.month === monthKey(new Date())
  const prev = monthSpend(pk, isCur ? new Date().getDate() : 31)
  if (prev.total <= 0 || total <= 0) return ''
  const diff = total - prev.total, pct = Math.round((Math.abs(diff) / prev.total) * 100)
  const pname = ['січні', 'лютому', 'березні', 'квітні', 'травні', 'червні', 'липні', 'серпні', 'вересні', 'жовтні', 'листопаді', 'грудні'][new Date(pk + '-01T12:00').getMonth()]
  let top = null
  for (const id of new Set([...Object.keys(byNow), ...Object.keys(prev.by)])) {
    const dlt = (byNow[id] || 0) - (prev.by[id] || 0)
    if (!top || Math.abs(dlt) > Math.abs(top.dlt)) top = { id, dlt }
  }
  return `<div class="box" style="margin-bottom:12px"><div>${diff === 0 ? 'Так само' : `На <b>${pct}% ${diff < 0 ? 'менше' : 'більше'}</b>`}, ніж ${isCur ? 'за той самий період у ' : 'у '}${pname}</div>
    ${top && top.dlt ? `<div class="sub"><span>Найбільша різниця: ${esc(catOf(top.id).ico)} ${esc(catOf(top.id).name)}</span><span>${top.dlt > 0 ? '+' : '−'}${uah(top.dlt)}</span></div>` : ''}</div>`
}
function viewStats() {
  if (S.statCat) return viewCat()
  const all = monthTxs().filter(counts)
  const total = all.reduce((s, t) => s - t.amount, 0)
  const income = monthTxs().filter((t) => active(t) && t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const by = {}
  for (const t of all) by[t.cat] = (by[t.cat] || 0) - t.amount
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1])
  const body = rows.map(([id, v]) => {
    const c = catOf(id), pct = total ? (v / total) * 100 : 0
    return `<button class="cat" data-act="statcat" data-v="${id}"><div class="ico">${c.ico}</div><div class="mid">
      <div class="top"><span>${c.name}</span><span>${uah(v)} · ${Math.round(pct)}%</span></div>
      <div class="bar"><i style="width:${pct}%;background:${c.color}"></i></div></div></button>`
  }).join('') || '<div class="empty">Немає витрат за цей місяць.</div>'
  const d = new Date(), isCur = S.month === monthKey(d)
  const days = isCur ? d.getDate() : new Date(+S.month.slice(0, 4), +S.month.slice(5), 0).getDate()
  return `${monthHeader()}<div class="hero"><div class="lbl">Всього витрат</div><div class="big">${uah(total)}</div>
    <div class="sub"><span>У середньому ${uah(total / days)}/день</span><span>${all.length} операцій</span></div>
    <div class="two" style="margin-top:14px"><div><div class="lbl">Надходження</div><div class="mini in">+${uah(income)}</div></div>
      <div><div class="lbl">Баланс місяця</div><div class="mini ${income - total < 0 ? 'neg' : 'in'}">${income - total < 0 ? '−' : '+'}${uah(income - total)}</div></div></div></div>${compareHtml(total, by)}${body}`
}

function viewSettings() {
  const s = S.settings
  const accs = s.accounts.map((a, i) => `<label class="tog"><span>${esc(a.name)}</span><input type="checkbox" data-act="acc" data-i="${i}" ${a.on ? 'checked' : ''}></label>`).join('')
  return `<div class="head"><div class="month">Налаштування</div></div>
    <h3>Ліміт на місяць</h3><div class="box"><input class="field" id="limit" type="number" inputmode="numeric" placeholder="Напр. 30000" value="${s.limit || ''}" style="margin:0"></div>
    <h3>Monobank</h3><div class="box">
      <p>Витрати (в т.ч. Apple Pay) підтягуються автоматично, коли відкриваєш застосунок. Токен зберігається лише на цьому телефоні.
      Отримати: <b>api.monobank.ua</b> → увійти через застосунок Mono → скопіювати токен.</p>
      <input class="field" id="token" type="password" placeholder="Токен Monobank" value="${esc(s.token)}" autocomplete="off">
      <button class="btn" data-act="savetoken">${s.token ? 'Зберегти й оновити' : 'Підключити'}</button>
      ${accs ? `<div style="margin-top:10px">${accs}</div>` : ''}
      ${s.token ? `<div style="margin-top:14px"><p style="margin-bottom:8px">Завантажити старіші операції (наприклад, для порівняння місяців):</p>
        <select class="field" id="histmonths">${[1, 2, 3, 5, 11].map((n) => { const d = new Date(new Date().getFullYear(), new Date().getMonth() - n, 1); return `<option value="${n}">З 1 ${GEN[d.getMonth()]} ${d.getFullYear()}</option>` }).join('')}</select>
        <button class="btn sec" data-act="history">Завантажити історію</button><div class="sync" id="syncmsg">${esc(S.syncMsg)}</div></div>` : ''}
      ${s.token ? '<button class="btn del" data-act="disconnect">Відключити банк</button>' : ''}</div>
    <h3>Швидке додавання</h3><div class="box"><label class="tog" style="padding:0"><span>Після відкриття одразу форма нової витрати</span><input type="checkbox" data-act="openadd" ${s.openAdd ? 'checked' : ''}></label></div>
    <h3>Мої категорії</h3><div class="box">
      ${s.customCats.map((c) => `<div class="tog"><span>${esc(c.ico)} ${esc(c.name)}</span><button data-act="delcat" data-v="${esc(c.id)}" style="color:var(--danger)">Видалити</button></div>`).join('')}
      <div class="two" style="grid-template-columns:70px 1fr;margin-top:${s.customCats.length ? 10 : 0}px"><input class="field" id="cico" placeholder="🏷️" style="margin:0;text-align:center"><input class="field" id="cname" placeholder="Назва нової категорії" style="margin:0"></div>
      <button class="btn sec" data-act="addcat" style="margin-top:10px">Додати категорію</button></div>
    <h3>Дані</h3><div class="box"><p>${s.lastBackup ? 'Остання копія: ' + new Date(s.lastBackup).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) + '. ' : ''}Дані лише на телефоні. Раз на кілька тижнів зберігай копію — якщо видалити застосунок або почистити Safari, дані зникнуть.</p>
      <button class="btn sec" data-act="report">Перевірити дані</button>
      <button class="btn sec" data-act="export">Зберегти копію</button>
      <button class="btn sec" data-act="import">Відновити з копії</button>
      <input type="file" id="importfile" accept="application/json" hidden></div>
    <div class="sync">Версія 1.0</div>`
}


// ---------- борги: розстрочка та кредитний ліміт ----------
function nextPayDate(d) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const at = (y, m) => new Date(y, m, Math.min(d.day, new Date(y, m + 1, 0).getDate()))
  let t = at(now.getFullYear(), now.getMonth())
  if (t < now) t = at(now.getFullYear(), now.getMonth() + 1)
  return { t, days: Math.round((t - now) / 864e5) }
}
// Цикл кредитки: скільки витрачено з картки і скільки погашено переказами зі своїх карток за останні місяці
function creditFlowHtml(d) {
  const rows = []
  for (let i = 0; i < 3; i++) {
    const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i)
    const key = monthKey(dt)
    let spent = 0, repaid = 0
    for (const t of S.txs) {
      if (t.acc !== d.acc || t.ignore || monthKey(new Date(t.ts)) !== key) continue
      if (t.amount < 0 && !t.own) spent -= t.amount
      else if (t.amount > 0 && t.own) repaid += t.amount
    }
    if (spent || repaid) rows.push(`<div class="sub"><span style="text-transform:capitalize">${dt.toLocaleDateString('uk-UA', { month: 'long' })}</span><span>витрачено ${uah(spent)} · погашено ${uah(repaid)}</span></div>`)
  }
  return rows.length ? `<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:6px"><div class="lbl" style="color:var(--muted);font-size:13px">По картці за місяцями</div>${rows.join('')}</div>` : ''
}

// ---------- прогноз до надходжень (затримка виплат, життя на кредитному ліміті) ----------
const dateStr = (ts) => new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
function autoDaily() {
  const from = Date.now() - 30 * 864e5
  const keys = S.debts.filter((d) => d.kind === 'installment' && d.key).map((d) => normDesc(d.key))
  let sum = 0
  for (const t of S.txs) if (counts(t) && t.ts >= from && !keys.some((k) => normDesc(t.desc).includes(k))) sum -= t.amount
  return Math.round(sum / 30)
}
function forecast() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const plans = S.settings.plans.filter((p) => p.date && new Date(p.date + 'T00:00:00') >= today)
  if (!plans.length) return null
  const free = S.debts.filter((d) => d.kind === 'credit').reduce((s, d) => s + Math.max(0, d.total - d.balance), 0) + S.settings.own
  const daily = S.settings.daily || autoDaily()
  const last = Math.max(...plans.map((p) => new Date(p.date + 'T00:00:00')))
  const horizon = Math.min(120, Math.round((last - today) / 864e5))
  const insts = S.debts.filter((d) => d.kind === 'installment' && d.balance > 0 && d.day).map((d) => ({ ...d, rem: d.balance }))
  let pos = free, fixed = 0, firstNeg = null
  const ins = [], hasIn = new Set()
  for (let i = 1; i <= horizon; i++) {
    const day = new Date(today.getTime() + i * 864e5), key = dayKey(day.getTime())
    pos -= daily
    for (const d of insts) if (d.rem > 0 && day.getDate() === Math.min(d.day, new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate())) {
      const pay = Math.min(d.monthly, d.rem); d.rem -= pay; pos -= pay; fixed += pay
    }
    for (const p of plans.filter((x) => x.date === key)) {
      if (p.kind === 'out') { pos -= p.amount; fixed += p.amount } else {
        ins.push({ p, days: i, before: pos, safeDaily: hasIn.size ? null : Math.max(0, free - fixed) / i }); hasIn.add(p.id); pos += p.amount
      }
    }
    if (pos < 0 && !firstNeg) firstNeg = { ts: day.getTime(), days: i }
  }
  return { free, daily, firstNeg, ins, end: pos, last }
}
function forecastHtml() {
  const s = S.settings, f = forecast()
  const controls = `<div class="two" style="margin-top:10px"><div><div class="lbl" style="color:var(--muted);font-size:13px">Витрати на день</div><input class="field" id="daily" inputmode="numeric" placeholder="${uah(autoDaily())} (авто)" value="${s.daily ? s.daily / 100 : ''}" style="margin:0"></div>
    <div><div class="lbl" style="color:var(--muted);font-size:13px">Своїх грошей зараз</div><input class="field" id="own" inputmode="numeric" placeholder="0" value="${s.own ? s.own / 100 : ''}" style="margin:0"></div></div>`
  if (!f) return `<div class="box" style="margin-bottom:12px"><b>Прогноз до надходжень</b><p style="margin:6px 0 0">Додай нижче очікувані виплати (з датою) і разові витрати, наприклад дні народження. Тоді я покажу, коли закінчиться вільний кредит.</p></div>`
  const head = f.firstNeg
    ? `<div style="color:var(--danger);font-weight:600">⚠️ Вільні гроші й кредит закінчаться ≈ ${dateStr(f.firstNeg.ts)} (через ${f.firstNeg.days} дн)</div>`
    : `<div style="color:var(--accent);font-weight:600">✅ До ${dateStr(f.last)} вистачає</div>`
  const rows = f.ins.map((x) => {
    const gap = x.before < 0
    return `<div class="sub"><span>${esc(x.p.name)} · ${dateStr(new Date(x.p.date + 'T12:00:00'))} · +${uah(x.p.amount)}</span><span style="color:${gap ? 'var(--danger)' : 'var(--accent)'}">${gap ? 'бракує ' + uah(x.before) : 'запас ' + uah(x.before)}</span></div>`
  }).join('')
  const safe = f.ins[0] && f.ins[0].safeDaily != null ? `<div class="sub"><span>Щоб дотягнути до першої виплати без мінуса</span><b>≈ ${uah(f.ins[0].safeDaily)}/день</b></div>` : ''
  return `<div class="box" style="margin-bottom:12px"><b>Прогноз до надходжень</b>
    <div class="sub"><span>Зараз доступно (вільний кредит + свої)</span><span>${uah(f.free)}</span></div>
    <div style="margin-top:8px">${head}</div><div style="margin-top:6px">${rows}</div>${safe}${controls}
    <p style="margin:10px 0 0;font-size:13px">Рахується з урахуванням платежів за розстрочку й твоїх витрат на день.</p></div>`
}
function plansHtml() {
  const pl = [...S.settings.plans].sort((a, b) => a.date.localeCompare(b.date))
  const today = dayKey(Date.now())
  const rows = pl.map((p) => `<button class="row" data-act="planedit" data-id="${esc(p.id)}" style="padding:10px 0"><div class="ico">${p.kind === 'in' ? '📥' : '🎁'}</div>
    <div class="mid"><div class="t">${esc(p.name)}</div><div class="s">${dateStr(new Date(p.date + 'T12:00:00'))}${p.date < today ? ' · дата минула — онови' : ''}</div></div><div class="a ${p.kind === 'in' ? 'in' : ''}">${p.kind === 'in' ? '+' : '−'}${uah(p.amount)}</div></button>`).join('')
  return `<h3>Очікування й плани</h3><div class="box">${rows || '<p>Поки порожньо.</p>'}
    <div class="two" style="margin-top:10px"><button class="btn sec" data-act="planadd" data-v="in" style="margin:0">＋ Очікую виплату</button><button class="btn sec" data-act="planadd" data-v="out" style="margin:0">＋ Разова витрата</button></div></div>`
}
let pform = null
function openPlan(kind, p) {
  pform = { p: p ? { ...p } : { id: 'p:' + Date.now().toString(36), kind, name: '', amount: 0, date: '' }, isNew: !p }
  const x = pform.p
  $('#sheet').innerHTML = `<div class="panel"><div class="lbl" style="color:var(--muted);text-align:center;margin-bottom:8px">${x.kind === 'in' ? 'Очікувана виплата' : 'Разова витрата'}</div>
    <input class="field" id="pname" placeholder="${x.kind === 'in' ? 'Напр. 1-ша частина за серпень' : 'Напр. Дні народження'}" value="${esc(x.name)}">
    <input class="field" id="pamt" inputmode="decimal" placeholder="Сума" value="${x.amount ? x.amount / 100 : ''}">
    <input class="field" id="pdate" type="date" value="${x.date}">
    <button class="btn" data-act="plansave">Зберегти</button>${!pform.isNew ? '<button class="btn del" data-act="plandel">Видалити</button>' : ''}<button class="btn sec" data-act="fclose">Закрити</button></div>`
  $('#sheet').classList.add('open')
}
function savePlan() {
  const x = pform.p
  x.name = $('#pname').value.trim(); x.amount = kop('#pamt'); x.date = $('#pdate').value
  if (!x.name || x.amount <= 0 || !x.date) { toast('Введи назву, суму й дату'); return }
  const i = S.settings.plans.findIndex((o) => o.id === x.id)
  if (i >= 0) S.settings.plans[i] = x; else S.settings.plans.push(x)
  saveSettings(); closeSheet(); render()
}
function viewDebts() {
  const owed = S.debts.reduce((s, d) => s + d.balance, 0)
  const pays = S.debts.filter((d) => d.kind === 'installment' && d.balance > 0 && d.day).map((d) => ({ d, ...nextPayDate(d) })).sort((a, b) => a.days - b.days)
  const nxt = pays[0]
  const when = (n) => (n === 0 ? 'сьогодні' : n === 1 ? 'завтра' : `через ${n} дн`)
  const cards = S.debts.map((d) => {
    const credit = d.kind === 'credit'
    const pct = d.total ? Math.min(100, ((credit ? d.balance : d.total - d.balance) / d.total) * 100) : 0
    const np = !credit && d.balance > 0 && d.day ? nextPayDate(d) : null
    const log = (d.log || []).slice(-3).reverse().map((l) => `<div class="sub"><span>${new Date(l.ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}${l.note ? ' · ' + esc(l.note) : ''}</span><span>${l.delta < 0 ? '−' : '+'}${uah(l.delta)}</span></div>`).join('')
    return `<div class="box" style="margin-bottom:12px">
      <button class="row" style="padding:0 0 10px" data-act="dedit" data-id="${d.id}"><div class="ico">${credit ? '💳' : '🛍️'}</div>
        <div class="mid"><div class="t">${esc(d.name)}</div><div class="s">${credit ? 'Кредитний ліміт' : 'Розстрочка'} · ✎</div></div>
        <div class="a">${uah(d.balance)}</div></button>
      <div class="bar ${credit && d.balance > d.total ? 'over' : ''}"><i style="width:${pct}%"></i></div>
      <div class="sub"><span>${credit ? `Вільно ${uah(Math.max(0, d.total - d.balance))}` : d.balance > 0 ? `Погашено ${uah(d.total - d.balance)}` : 'Погашено 🎉'}</span><span>${credit ? 'ліміт' : 'з'} ${uah(d.total)}</span></div>
      ${np ? `<div class="sub"><span>Платіж ${uah(d.monthly)} · ${np.t.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</span><span>${when(np.days)}</span></div>` : ''}
      <div class="two" style="margin-top:12px"><button class="btn" data-act="dop" data-id="${d.id}" data-v="pay">Погасити</button>
        ${credit ? `<button class="btn sec" data-act="dop" data-id="${d.id}" data-v="borrow" style="margin:0">Взяв ще</button>` : ''}</div>
      ${credit && d.acc ? creditFlowHtml(d) : ''}
      ${log ? `<div style="margin-top:8px">${log}</div>` : ''}</div>`
  }).join('') || '<div class="empty">Тут можна вести розстрочку й кредитний ліміт.<br>Натисни «+», щоб додати.</div>'
  return `<div class="head"><div class="month">Борги</div></div>
    <div class="hero"><div class="lbl">Загалом винен</div><div class="big">${uah(owed)}</div>
    ${nxt ? `<div class="sub"><span>Найближчий платіж: ${esc(nxt.d.name)} ${uah(nxt.d.monthly)}</span><span>${when(nxt.days)}</span></div>` : ''}</div>${forecastHtml()}${cards}${plansHtml()}`
}

let dform = null
function openDebtSheet(d) {
  const isNew = !d
  dform = { d: d ? { ...d } : { id: 'd:' + Date.now().toString(36), kind: 'installment', name: '', total: 0, balance: 0, monthly: 0, day: 0, log: [] }, isNew, op: null }
  const x = dform.d, inst = x.kind === 'installment'
  $('#sheet').innerHTML = `<div class="panel">
    <div class="seg"><button data-act="dkind" data-v="installment" class="${inst ? 'on' : ''}">Розстрочка</button><button data-act="dkind" data-v="credit" class="${inst ? '' : 'on'}">Кредитний ліміт</button></div>
    <input class="field" id="dname" placeholder="Назва (напр. Магазин / Mono кредитка)" value="${esc(x.name)}">
    <input class="field" id="dtotal" inputmode="decimal" placeholder="${inst ? 'Загальна сума розстрочки' : 'Кредитний ліміт'}" value="${x.total ? x.total / 100 : ''}">
    <input class="field" id="dbal" inputmode="decimal" placeholder="${inst ? 'Залишок до сплати (якщо вже платив)' : 'Використано зараз'}" value="${!isNew ? x.balance / 100 : ''}">
    <div class="two" id="dinst" style="${inst ? '' : 'display:none'}"><input class="field" id="dmonthly" inputmode="decimal" placeholder="Щомісячний платіж" value="${x.monthly ? x.monthly / 100 : ''}">
      <input class="field" id="dday" inputmode="numeric" placeholder="День платежу (1–31)" value="${x.day || ''}"></div>
    <div id="dcredit" style="${inst ? 'display:none' : ''}"><select class="field" id="dacc"><option value="">Картка з кредитним лімітом (необов’язково)</option>${S.settings.accounts.map((a) => `<option value="${esc(a.id)}" ${x.acc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <p style="color:var(--muted);font-size:13px;margin:-4px 4px 10px">Якщо обрати картку, то переказ на неї з іншої твоєї картки сам зменшить борг.</p></div>
    <div id="dinst2" style="${inst ? '' : 'display:none'}"><input class="field" id="dkey" placeholder="Як платіж називається в банку (для автосписання)" value="${esc(x.key || '')}">
      <p style="color:var(--muted);font-size:13px;margin:-4px 4px 10px">Напр. назва магазину з виписки Monobank. Тоді нові платежі з цією назвою самі зменшать борг.</p></div>
    <button class="btn" data-act="dsave">Зберегти</button>
    ${!isNew ? '<button class="btn del" data-act="ddel">Видалити</button>' : ''}<button class="btn sec" data-act="fclose">Закрити</button></div>`
  $('#sheet').classList.add('open')
}
function openDebtOp(d, op) {
  dform = { d, op }
  $('#sheet').innerHTML = `<div class="panel"><div class="lbl" style="color:var(--muted);text-align:center">${op === 'pay' ? 'Погашення' : 'Використано ще'} · ${esc(d.name)}</div>
    <input class="amt" id="damt" type="text" inputmode="decimal" placeholder="0" value="${op === 'pay' && d.monthly ? Math.min(d.monthly, d.balance) / 100 : ''}">
    <input class="field" id="dnote" placeholder="Нотатка (необов’язково)">
    <button class="btn" data-act="dopsave">Зберегти</button><button class="btn sec" data-act="fclose">Закрити</button></div>`
  $('#sheet').classList.add('open')
  setTimeout(() => $('#damt')?.focus(), 60)
}
const kop = (id) => Math.round(parseFloat(($(id).value || '').replace(/\s/g, '').replace(',', '.')) * 100) || 0
function saveDebt() {
  const x = dform.d
  x.name = $('#dname').value.trim(); x.total = kop('#dtotal')
  if (!x.name || x.total <= 0) { toast('Введи назву і суму'); return }
  const bal = $('#dbal').value.trim()
  x.balance = bal === '' ? (dform.isNew ? x.total : x.balance) : kop('#dbal')
  if (x.kind === 'installment') { x.key = $('#dkey').value.trim(); x.monthly = kop('#dmonthly'); x.day = Math.min(31, Math.max(0, parseInt($('#dday').value, 10) || 0)); x.acc = '' } else { x.monthly = 0; x.day = 0; x.acc = $('#dacc').value }
  const i = S.debts.findIndex((o) => o.id === x.id)
  if (i >= 0) S.debts[i] = x; else S.debts.push(x)
  saveDebts(); closeSheet(); render()
}
function saveDebtOp() {
  const v = kop('#damt'); if (v <= 0) { toast('Введи суму'); return }
  const { d, op } = dform
  const delta = op === 'pay' ? -Math.min(v, d.balance) : v
  d.balance += delta; d.log = [...(d.log || []), { ts: Date.now(), delta, note: $('#dnote').value.trim() }]
  saveDebts(); closeSheet(); render()
  if (d.balance === 0) toast(d.kind === 'credit' ? 'Ліміт повністю погашено 🎉' : 'Розстрочку погашено 🎉')
}

// ---------- форма додавання/редагування ----------
let form = null
const catGrid = (sel) => CATS.filter((c) => c.id !== 'income').map((c) => `<button data-act="fcat" data-v="${c.id}" class="${sel === c.id ? 'on' : ''}"><b>${esc(c.ico)}</b>${esc(c.name)}</button>`).join('')
  + '<button data-act="newcat"><b>＋</b>Своя</button>'
function addCategory(name, ico) {
  name = (name || '').trim().slice(0, 20)
  if (!name) return null
  const c = { id: 'c:' + Date.now().toString(36), name, ico: Array.from((ico || '').trim()).slice(0, 4).join('') || '🏷️', color: PALETTE[S.settings.customCats.length % PALETTE.length] }
  S.settings.customCats.push(c); saveSettings(); rebuildCats()
  return c
}
function openSheet(tx) {
  const isNew = !tx
  const t = tx ? { ...tx } : { id: 'm:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), amount: 0, cat: LS.get('lastCat', 'food'), src: 'manual', note: '' }
  form = { t, isNew, expense: t.amount <= 0, photo: t.photo || null, photoChanged: false }
  const sheet = $('#sheet')
  const dt = new Date(t.ts); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  sheet.innerHTML = `<div class="panel">
    <div class="seg"><button data-act="ftype" data-v="e" class="${form.expense ? 'on' : ''}">Витрата</button><button data-act="ftype" data-v="i" class="${form.expense ? '' : 'on'}">Дохід</button></div>
    <input class="amt" id="amt" type="text" inputmode="decimal" placeholder="0" value="${t.amount ? (Math.abs(t.amount) / 100).toString().replace('.', ',') : ''}" autocomplete="off">
    <div class="grid" id="catgrid">${catGrid(t.cat)}</div>
    <input class="field" id="note" placeholder="${t.desc ? esc(t.desc) : 'Нотатка (необов’язково)'}" value="${esc(t.note || '')}">
    <div class="two"><input class="field" id="date" type="datetime-local" value="${dt.toISOString().slice(0, 16)}" style="margin:0">
      <button class="btn sec" data-act="fphoto" style="margin:0" id="photobtn">${form.photo ? '📎 Чек додано' : '📷 Фото чека'}</button></div>
    <input type="file" id="photofile" accept="image/*" capture="environment" hidden>
    <div id="photoprev">${form.photo ? `<img class="photo" style="margin-top:10px" src="${URL.createObjectURL(form.photo)}">` : ''}</div>
    ${!isNew ? `<label class="tog"><span>Переказ між моїми картками</span><input type="checkbox" id="own" ${t.own ? 'checked' : ''}></label>
    <label class="tog"><span>Не враховувати в статистиці</span><input type="checkbox" id="ign" ${t.ignore ? 'checked' : ''}></label>` : ''}
    <div style="margin-top:12px"><button class="btn" data-act="fsave">Зберегти</button>
    ${!isNew ? '<button class="btn del" data-act="fdel">Видалити</button>' : ''}<button class="btn sec" data-act="fclose">Закрити</button></div></div>`
  sheet.classList.add('open')
  if (isNew) setTimeout(() => $('#amt')?.focus(), 60)
}
const closeSheet = () => { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; form = null; dform = null; pform = null }

async function resizePhoto(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7))
}

async function saveForm() {
  const form_isNew = form.isNew
  const raw = $('#amt').value.replace(/\s/g, '').replace(',', '.')
  const val = Math.round(parseFloat(raw) * 100)
  if (!val || val <= 0) { toast('Введи суму'); $('#amt').focus(); return }
  const t = form.t
  t.amount = form.expense ? -val : val
  t.note = $('#note').value.trim()
  const d = new Date($('#date').value); if (!isNaN(d)) t.ts = d.getTime()
  t.ignore = $('#ign') ? $('#ign').checked : false
  const wasOwn = !!t.own
  t.own = $('#own') ? $('#own').checked : false
  if (t.own && !wasOwn) { t.cat = 'transfer'; applyOwnTransfer(t) }
  if (!form.expense) t.cat = 'income'
  else if (t.cat === 'income') t.cat = 'other'
  if (form.photo) t.photo = form.photo; else delete t.photo
  const prevCat = (S.txs.find((x) => x.id === t.id) || {}).cat
  await dbPut(t)
  const i = S.txs.findIndex((x) => x.id === t.id)
  if (i >= 0) S.txs[i] = t; else S.txs.push(t)
  if (form.expense) LS.set('lastCat', t.cat)
  // запам'ятовуємо категорію для цього продавця
  if (t.src === 'mono' && t.desc && prevCat && prevCat !== t.cat) {
    S.settings.rules[normDesc(t.desc)] = t.cat; saveSettings()
    let n = 0
    for (const o of S.txs) if (o.src === 'mono' && o.id !== t.id && normDesc(o.desc) === normDesc(t.desc) && o.cat !== t.cat && o.amount < 0) { o.cat = t.cat; await dbPut(o); n++ }
    toast(`Запам’ятав: ${t.desc} → ${catOf(t.cat).name}${n ? ` (ще ${n})` : ''}`)
  }
  if (t.ts) { const mk = monthKey(new Date(t.ts)); if (form.isNew && mk !== S.month) S.month = mk }
  closeSheet(); render(); toast(form_isNew ? 'Додано' : 'Збережено')
}

// ---------- Monobank ----------
async function mono(path) {
  const h = { 'X-Token': S.settings.token }
  let r
  try { r = await fetch('https://api.monobank.ua' + path, { headers: h }) }
  catch { r = await fetch('/api/money/mono?path=' + encodeURIComponent(path), { headers: h }) } // якщо браузер блокує CORS
  if (r.status === 429) throw new Error('rate')
  if (r.status === 403) throw new Error('token')
  if (!r.ok) throw new Error('http' + r.status)
  return r.json()
}
function setMsg(m) {
  S.syncMsg = m
  const el = $('#syncmsg')
  if (el) el.textContent = m
  else if (S.tab === 'home' && !form) render()
}

async function loadAccounts() {
  const info = await mono('/personal/client-info')
  const old = Object.fromEntries(S.settings.accounts.map((a) => [a.id, a.on]))
  // лише особисті гривневі картки: рахунки ФОП ('fop') ігноруємо
  const NAMES = { black: 'Чорна', white: 'Біла', platinum: 'Platinum', iron: 'Iron', yellow: 'Жовта', eAid: 'єПідтримка' }
  const fop = new Set((info.accounts || []).filter((a) => a.type === 'fop').map((a) => a.id))
  S.settings.accounts = (info.accounts || []).filter((a) => a.currencyCode === 980 && a.type !== 'fop').map((a) => ({
    id: a.id, on: old[a.id] ?? true,
    name: `${NAMES[a.type] || a.type} ${(a.maskedPan && a.maskedPan[0]) || ''}`.trim(),
  }))
  for (const t of S.txs.filter((t) => fop.has(t.acc))) await dbDel(t.id)
  S.txs = S.txs.filter((t) => !fop.has(t.acc))
  saveSettings()
}

// Переказ між своїми картками: витрата на одній картці й надходження тієї ж суми на іншій майже одночасно
function applyOwnTransfer(x) {
  if (x.amount <= 0 || !x.acc || x.debtApplied) return false
  const d = S.debts.find((y) => y.kind === 'credit' && y.acc === x.acc && y.balance > 0)
  if (!d) return false
  const delta = -Math.min(x.amount, d.balance)
  d.balance += delta; d.log = [...(d.log || []), { ts: x.ts, delta, note: 'переказ зі своєї картки', tx: x.id }]
  x.debtApplied = true
  saveDebts()
  return true
}
async function markTransfers(cands, autoDebt) {
  const pool = S.txs.filter((t) => t.src === 'mono' && t.acc && !t.own)
  let n = 0, repaid = 0
  for (const t of cands) {
    if (t.own || t.src !== 'mono' || !t.acc) continue
    // сума збігається, або на боці відправника є комісія до 5% (напр., переказ з кредитної картки)
    const fee = (a, b) => a.amount < 0 && b.amount > 0 && Number(a.mcc) === 4829 && Number(b.mcc) === 4829 && -a.amount >= b.amount && -a.amount <= b.amount * 1.05 + 100
    let m = pool.find((o) => o !== t && !o.own && o.acc !== t.acc && Math.abs(o.ts - t.ts) <= 5 * 60000 && (o.amount === -t.amount || fee(t, o) || fee(o, t)))
    let kind = true
    if (!m) { // гроші зі скарбнички (подарунки від колег), які одразу переказані далі
      const jar = (a, b) => a.amount > 0 && /банки/i.test(a.desc || '') && b.amount < 0 && Number(b.mcc) === 4829 && !b.own && !/^(Переказ на картку|Поповнення)|nizhyn|545708/.test(b.desc || '')
        && -b.amount >= a.amount && -b.amount <= a.amount * 1.05 + 100 && b.ts - a.ts >= -60000 && b.ts - a.ts <= 3 * 864e5
      m = pool.find((o) => o !== t && !o.own && (jar(t, o) || jar(o, t)))
      kind = 'jar'
    }
    if (!m) continue
    for (const x of [t, m]) {
      x.own = kind; x.cat = 'transfer'
      if (autoDebt && kind === true && applyOwnTransfer(x)) repaid++
      await dbPut(x)
    }
    n++
  }
  return { n, repaid }
}
// нова банківська витрата з назвою з поля «Як платіж називається в банку» зменшує залишок розстрочки
function applyDebtPayment(t) {
  if (t.amount >= 0 || !t.desc) return false
  const d = S.debts.find((x) => x.kind === 'installment' && x.balance > 0 && x.key && normDesc(t.desc).includes(normDesc(x.key)))
  if (!d) return false
  const delta = -Math.min(-t.amount, d.balance)
  d.balance += delta; d.log = [...(d.log || []), { ts: t.ts, delta, note: 'авто: ' + t.desc, tx: t.id }]
  saveDebts()
  return true
}
// Monobank: не частіше 1 запиту виписки на хвилину, вікно виписки — до 31 дня
let lastStmt = 0
async function stmt(path) {
  for (let tries = 0; ; tries++) {
    const wait = lastStmt + 61000 - Date.now()
    if (wait > 0) for (let s = Math.ceil(wait / 1000); s > 0; s--) { setMsg(`${S.progress} · чекаю ${s} с (ліміт банку: 1 запит/хв)`); await sleep(1000) }
    setMsg(S.progress)
    lastStmt = Date.now()
    try { return await mono(path) } catch (e) { if (e.message === 'rate' && tries < 2) continue; throw e }
  }
}
async function fetchWindow(a, from, to, autoDebt) {
  let added = 0, autoPaid = 0
  const fresh = []
  for (;;) {
    const items = await stmt(`/personal/statement/${a.id}/${from}/${to}`)
    for (const it of items) {
      const id = 'mono:' + it.id
      if (S.txs.some((x) => x.id === id)) continue
      const rule = S.settings.rules[normDesc(it.description)]
      const t = {
        id, acc: a.id, ts: it.time * 1000, amount: it.amount, src: 'mono', desc: it.description || '', note: it.comment || '',
        mcc: it.mcc, cat: it.amount > 0 ? 'income' : rule || mccToCat(it.mcc),
      }
      await dbPut(t); S.txs.push(t); added++; fresh.push(t)
      if (autoDebt && applyDebtPayment(t)) autoPaid++
    }
    if (items.length < 500) break
    to = items[items.length - 1].time
  }
  return { added, autoPaid, fresh }
}
const bankError = (e) => e.message === 'rate' ? 'Забагато запитів до банку, спробуй за хвилину'
  : e.message === 'token' ? 'Токен не підійшов — перевір у налаштуваннях' : 'Не вдалося зв’язатись з банком'

async function sync(force) {
  if (S.syncing || !S.settings.token) return
  if (!force && Date.now() - S.settings.lastSync < 5 * 60000) return
  S.syncing = true; S.progress = 'Оновлення…'; setMsg(S.progress)
  try {
    if (!S.settings.accounts.length) { await loadAccounts(); await sleep(1000) }
    let added = 0, autoPaid = 0
    const fresh = []
    for (const a of S.settings.accounts.filter((a) => a.on)) {
      const to = Math.floor(Date.now() / 1000)
      const from = Math.max((S.settings.since[a.id] || 0) - 3600, to - 31 * 86400)
      const r = await fetchWindow(a, from, to, true)
      added += r.added; autoPaid += r.autoPaid; fresh.push(...r.fresh)
      S.settings.since[a.id] = to
      saveSettings()
    }
    const tr = await markTransfers(fresh, true)
    S.settings.lastSync = Date.now(); saveSettings()
    S.syncMsg = ''
    if (added) toast(`Нових операцій: ${added}${autoPaid ? `, автосписання боргу: ${autoPaid}` : ''}${tr.n ? `, переказів між своїми картками: ${tr.n}` : ''}${tr.repaid ? ' (кредит зменшено)' : ''}`)
  } catch (e) { S.syncMsg = bankError(e) }
  S.syncing = false; render()
}

// Завантаження старішої історії: іде назад вікнами по 31 день, доки не дійде до початку обраного місяця
const GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
const histTarget = (n) => { const d = new Date(); return Math.floor(new Date(d.getFullYear(), d.getMonth() - n, 1).getTime() / 1000) }
async function loadHistory(n) {
  if (S.syncing || !S.settings.token) return
  const target = histTarget(n)
  const accs = S.settings.accounts.filter((a) => a.on)
  const steps = Math.max(1, accs.length) * Math.ceil((Date.now() / 1000 - target) / (31 * 86400))
  if (!confirm(`Завантаження займе близько ${steps} хв (банк дозволяє 1 запит на хвилину). Тримай застосунок відкритим. Почати?`)) return
  S.syncing = true; S.progress = 'Історія'; setMsg('Історія…')
  let added = 0
  const fresh = []
  try {
    if (!S.settings.accounts.length) await loadAccounts()
    for (const a of S.settings.accounts.filter((a) => a.on)) {
      const mine = S.txs.filter((t) => t.acc === a.id).map((t) => t.ts)
      let to = mine.length ? Math.floor(Math.min(...mine) / 1000) + 3600 : Math.floor(Date.now() / 1000)
      while (to > target) {
        const from = Math.max(to - 31 * 86400, target)
        S.progress = `Історія ${new Date(from * 1000).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} – ${new Date(to * 1000).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}`
        const r = await fetchWindow(a, from, to, false) // борги за старими платежами не чіпаємо
        added += r.added; fresh.push(...r.fresh)
        to = from
      }
    }
    const tr = await markTransfers(fresh, false)
    S.syncMsg = ''
    toast(`Історію завантажено: +${added}${tr.n ? `, переказів між своїми картками: ${tr.n}` : ''}`)
  } catch (e) { S.syncMsg = bankError(e) + (added ? ` (додано ${added})` : '') }
  S.syncing = false; render()
}

// ---------- резервна копія ----------
const blobToData = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b) })
async function exportData() {
  const txs = []
  for (const t of S.txs) txs.push({ ...t, photo: t.photo ? await blobToData(t.photo) : undefined })
  const s = { ...S.settings, token: '' }
  const file = new File([JSON.stringify({ v: 1, txs, settings: s, debts: S.debts })], `hroshi-${dayKey(Date.now())}.json`, { type: 'application/json' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); markBackup(); return } catch { return } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click()
  markBackup()
}
function markBackup() { S.settings.lastBackup = Date.now(); saveSettings(); render(); toast('Копію збережено') }
async function importData(file) {
  try {
    const d = JSON.parse(await file.text())
    if (!Array.isArray(d.txs)) throw new Error()
    let skipped = 0
    for (const t of d.txs) {
      if (typeof t.photo === 'string') t.photo = await (await fetch(t.photo)).blob()
      if (S.txs.some((x) => x.id === t.id)) { skipped++; continue } // наявні записи (з твоїми правками) не перезаписуємо
      await dbPut(t)
    }
    S.txs = await dbAll()
    if (d.settings) {
      const cc = [...S.settings.customCats]
      for (const c of d.settings.customCats || []) if (!cc.some((x) => x.id === c.id)) cc.push(c)
      S.settings = { ...S.settings, limit: d.settings.limit || S.settings.limit, rules: { ...S.settings.rules, ...d.settings.rules }, customCats: cc, plans: [...S.settings.plans, ...(d.settings.plans || []).filter((x) => !S.settings.plans.some((y) => y.id === x.id))] }
      saveSettings(); rebuildCats()
    }
    if (Array.isArray(d.debts)) { S.debts = [...S.debts, ...d.debts.filter((x) => !S.debts.some((y) => y.id === x.id))]; saveDebts() }
    toast(`Додано: ${d.txs.length - skipped}${skipped ? `, пропущено (вже є): ${skipped}` : ''}`); render()
  } catch { toast('Файл не підійшов') }
}

// ---------- події ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]')
  if (!el) { if (e.target.id === 'sheet') closeSheet(); return }
  const act = el.dataset.act, v = el.dataset.v
  switch (act) {
    case 'tab': if (S.tab === v) { window.scrollTo({ top: 0, behavior: 'smooth' }); break } S.tab = v; render(); window.scrollTo(0, 0); break
    case 'add': if (S.tab === 'debts') openDebtSheet(); else openSheet(); break
    case 'dedit': openDebtSheet(S.debts.find((d) => d.id === el.dataset.id)); break
    case 'dop': openDebtOp(S.debts.find((d) => d.id === el.dataset.id), v); break
    case 'dkind': {
      const inst = v === 'installment'; dform.d.kind = v
      document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v))
      $('#dinst').style.display = $('#dinst2').style.display = inst ? '' : 'none'
      $('#dcredit').style.display = inst ? 'none' : ''
      $('#dtotal').placeholder = inst ? 'Загальна сума розстрочки' : 'Кредитний ліміт'
      $('#dbal').placeholder = inst ? 'Залишок до сплати (якщо вже платив)' : 'Використано зараз'
      break
    }
    case 'planadd': openPlan(v); break
    case 'planedit': openPlan(null, S.settings.plans.find((p) => p.id === el.dataset.id)); break
    case 'plansave': savePlan(); break
    case 'plandel': S.settings.plans = S.settings.plans.filter((p) => p.id !== pform.p.id); saveSettings(); closeSheet(); render(); break
    case 'dsave': saveDebt(); break
    case 'dopsave': saveDebtOp(); break
    case 'ddel': if (confirm('Видалити?')) { S.debts = S.debts.filter((d) => d.id !== dform.d.id); saveDebts(); closeSheet(); render() } break
    case 'edit': openSheet(S.txs.find((t) => t.id === el.dataset.id)); break
    case 'mprev': case 'mnext': {
      const [y, m] = S.month.split('-').map(Number); const d = new Date(y, m - 1 + (act === 'mnext' ? 1 : -1), 1)
      S.month = monthKey(d); render(); window.scrollTo(0, 0); break
    }
    case 'statcat': S.statScroll = window.scrollY; S.statCat = v; render(); window.scrollTo(0, 0); break
    case 'catback': S.statCat = null; render(); window.scrollTo(0, S.statScroll); break
    case 'kind': S.kind = v; render(); break
    case 'sync': sync(true); break
    case 'history': loadHistory(+$('#histmonths').value); break
    case 'ftype': form.expense = v === 'e'; document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); break
    case 'fcat': form.t.cat = v; document.querySelectorAll('.grid button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); break
    case 'fphoto': $('#photofile').click(); break
    case 'fsave': saveForm(); break
    case 'fclose': closeSheet(); break
    case 'fdel':
      if (confirm('Видалити запис?')) { await dbDel(form.t.id); S.txs = S.txs.filter((t) => t.id !== form.t.id); closeSheet(); render() }
      break
    case 'savetoken': {
      S.settings.token = $('#token').value.trim(); S.settings.accounts = []; S.settings.since = {}; S.settings.lastSync = 0
      saveSettings(); S.tab = 'home'; render(); sync(true); break
    }
    case 'disconnect':
      if (confirm('Відключити банк? Вже завантажені операції залишаться.')) { S.settings.token = ''; S.settings.accounts = []; saveSettings(); render() }
      break
    case 'newcat': {
      const c = addCategory(prompt('Назва категорії'), prompt('Емодзі (необов’язково)', '🏷️'))
      if (c) { form.t.cat = c.id; $('#catgrid').innerHTML = catGrid(c.id) }
      break
    }
    case 'addcat': if (addCategory($('#cname').value, $('#cico').value)) render(); else toast('Введи назву'); break
    case 'delcat':
      if (confirm('Видалити категорію? Операції з нею перейдуть в «Інше».')) {
        S.settings.customCats = S.settings.customCats.filter((c) => c.id !== v)
        for (const k of Object.keys(S.settings.rules)) if (S.settings.rules[k] === v) delete S.settings.rules[k]
        for (const t of S.txs) if (t.cat === v) { t.cat = 'other'; await dbPut(t) }
        saveSettings(); rebuildCats(); render()
      }
      break
    case 'report': $('#sheet').innerHTML = reportHtml(); $('#sheet').classList.add('open'); break
    case 'repedit': { const t = S.txs.find((x) => x.id === el.dataset.id); closeSheet(); if (t) openSheet(t) } break
    case 'export': exportData(); break
    case 'snooze': S.settings.snooze = Date.now(); saveSettings(); render(); break
    case 'import': $('#importfile').click(); break
  }
})
document.addEventListener('change', async (e) => {
  const t = e.target
  if (t.id === 'photofile' && t.files[0]) {
    form.photo = await resizePhoto(t.files[0])
    $('#photobtn').textContent = '📎 Чек додано'
    $('#photoprev').innerHTML = `<img class="photo" style="margin-top:10px" src="${URL.createObjectURL(form.photo)}">`
  } else if (t.id === 'importfile' && t.files[0]) importData(t.files[0])
  else if (t.id === 'daily') { S.settings.daily = kop('#daily'); saveSettings(); render() }
  else if (t.id === 'own') { S.settings.own = kop('#own'); saveSettings(); render() }
  else if (t.id === 'limit') { S.settings.limit = Math.max(0, parseInt(t.value, 10) || 0); saveSettings(); toast('Ліміт збережено') }
  else if (t.dataset && t.dataset.act === 'openadd') { S.settings.openAdd = t.checked; saveSettings() }
  else if (t.dataset && t.dataset.act === 'acc') { S.settings.accounts[+t.dataset.i].on = t.checked; saveSettings() }
})
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { S.q = e.target.value; $('#txlist').innerHTML = homeList() }
})
// свайп вліво/вправо змінює місяць
let sx = 0, sy = 0
document.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY }, { passive: true })
document.addEventListener('touchend', (e) => {
  if ($('#sheet').classList.contains('open') || !['home', 'stats'].includes(S.tab)) return
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy
  if (Math.abs(dx) < 90 || Math.abs(dy) > 50) return
  const btn = document.querySelector(dx > 0 ? '[data-act=mprev]' : '[data-act=mnext]')
  if (btn && !btn.disabled) btn.click()
}, { passive: true })
document.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return
  if (form) saveForm(); else if (pform) savePlan(); else if (dform) (dform.op ? saveDebtOp() : saveDebt()) })
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(false) })

// ---------- старт ----------
// ПРАВИЛО ОНОВЛЕНЬ: нові версії ніколи не видаляють і не перезаписують дані користувача (записи, правки категорій,
// власні категорії, борги). Зміни формату — лише додавання полів із запасними значеннями.
;(async () => {
  try { db = await openDb(); S.txs = await dbAll() } catch { toast('Не вдалося відкрити сховище') }
  rebuildCats()
  const ui = LS.get('ui', null)
  if (ui && Date.now() - ui.at < 30 * 60000) { // швидке повернення в застосунок: лишаємось там, де були
    if (['home', 'stats', 'debts', 'settings'].includes(ui.tab)) S.tab = ui.tab
    if (/^\d{4}-\d{2}$/.test(ui.month)) S.month = ui.month
    if (['all', 'in', 'out'].includes(ui.kind)) S.kind = ui.kind
    if (ui.statCat && (CAT[ui.statCat])) S.statCat = ui.statCat
  }
  if (S.settings.v < 2) {
    // раніше в імпорт могли потрапити рахунки ФОП: чистимо банківські операції без позначки рахунку й завантажуємо заново лише з особистих карток
    for (const t of S.txs.filter((t) => t.src === 'mono' && !t.acc)) await dbDel(t.id)
    S.txs = S.txs.filter((t) => t.src !== 'mono' || t.acc)
    S.settings.accounts = []; S.settings.since = {}; S.settings.lastSync = 0; S.settings.v = 2; saveSettings()
  }
  markTransfers(S.txs.filter((t) => t.src === 'mono'), false).then(() => render()) // позначаємо вже наявні перекази між своїми картками
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist()
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/money-sw.js', { scope: '/money' }).catch(() => {})
  render(); sync(false)
  if (S.settings.openAdd) openSheet()
})()
