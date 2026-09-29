'use strict'
// «Гроші» — простий трекер витрат. Усі дані лишаються на телефоні (IndexedDB + localStorage).
// Витрати з Monobank підтягуються через особистий API-токен (Apple Pay — це звичайні оплати карткою).

const CATS = [
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
const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]))

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
  filter: null,
  settings: Object.assign({ token: '', limit: 0, accounts: [], since: {}, lastSync: 0, rules: {} }, LS.get('settings', {})),
  syncing: false,
  syncMsg: '',
}
const saveSettings = () => LS.set('settings', S.settings)

// ---------- утиліти ----------
const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
function dayKey(ts) { const d = new Date(ts); return monthKey(d) + '-' + String(d.getDate()).padStart(2, '0') }
const uah = (k) => Math.round(Math.abs(k) / 100).toLocaleString('uk-UA').replace(/ /g, ' ') + ' ₴'
const monthName = (key) => new Date(key + '-01T12:00').toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
function dayLabel(key) {
  const today = dayKey(Date.now()), yest = dayKey(Date.now() - 864e5)
  if (key === today) return 'Сьогодні'
  if (key === yest) return 'Вчора'
  return new Date(key + 'T12:00').toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' })
}
const counts = (t) => !t.ignore && t.amount < 0
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
  const app = $('#app')
  if (S.tab === 'home') app.innerHTML = viewHome()
  else if (S.tab === 'stats') app.innerHTML = viewStats()
  else app.innerHTML = viewSettings()
  app.insertAdjacentHTML('beforeend', `<button class="fab" data-act="add" aria-label="Додати">+</button>
    <nav class="tabs">${[['home', '🏠', 'Головна'], ['stats', '📊', 'Статистика'], ['settings', '⚙️', 'Налаштування']]
      .map(([id, i, n]) => `<button data-act="tab" data-v="${id}" class="${S.tab === id ? 'on' : ''}"><span>${i}</span>${n}</button>`).join('')}</nav>`)
}

function monthHeader() {
  const cur = monthKey(new Date())
  return `<div class="head"><button class="arrow" data-act="mprev">‹</button><div class="month">${monthName(S.month)}</div>
    <button class="arrow" data-act="mnext" ${S.month >= cur ? 'disabled' : ''}>›</button></div>`
}

function viewHome() {
  const all = monthTxs()
  const spent = all.filter(counts).reduce((s, t) => s - t.amount, 0)
  const income = all.filter((t) => !t.ignore && t.amount > 0).reduce((s, t) => s + t.amount, 0)
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
  let list = all
  if (S.filter) list = list.filter((t) => t.cat === S.filter)
  const groups = []
  for (const t of list) {
    const k = dayKey(t.ts)
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [] })
    groups[groups.length - 1].items.push(t)
  }
  const body = groups.map((g) => {
    const sum = g.items.filter(counts).reduce((s, t) => s - t.amount, 0)
    return `<div class="day"><span>${dayLabel(g.k)}</span><span>${sum ? '−' + uah(sum) : ''}</span></div>
      <div class="list">${g.items.map(rowHtml).join('')}</div>`
  }).join('') || `<div class="empty">Поки порожньо.<br>Натисни «+», щоб додати витрату${S.settings.token ? '' : ',<br>або підключи Monobank в налаштуваннях'}.</div>`
  return `${monthHeader()}
    <div class="hero"><div class="lbl">Витрачено${isCur ? ` · сьогодні ${uah(today)}` : ''}</div><div class="big">${uah(spent)}</div>${limitHtml}
    ${income ? `<div class="sub"><span>Надходження ${uah(income)}</span></div>` : ''}</div>
    ${S.filter ? `<div class="chips"><button class="chip on" data-act="clearfilter">${CAT[S.filter].ico} ${CAT[S.filter].name} ✕</button></div>` : ''}
    ${body}${S.settings.token ? `<div class="sync">${esc(S.syncMsg) || syncedLabel()} · <button data-act="sync" style="text-decoration:underline">оновити</button></div>` : ''}`
}
function syncedLabel() {
  if (S.syncing) return 'Оновлення…'
  if (!S.settings.lastSync) return 'Ще не синхронізовано'
  const m = Math.round((Date.now() - S.settings.lastSync) / 60000)
  return m < 1 ? 'Оновлено щойно' : `Оновлено ${m} хв тому`
}
function rowHtml(t) {
  const c = CAT[t.cat] || CAT.other
  const title = t.note || t.desc || c.name
  return `<button class="row ${t.ignore ? 'ign' : ''}" data-act="edit" data-id="${esc(t.id)}">
    <div class="ico">${c.ico}</div>
    <div class="mid"><div class="t">${esc(title)}</div><div class="s">${c.name} · ${t.src === 'mono' ? 'картка' : 'готівка'}${t.photo ? ' · 📎' : ''}${t.ignore ? ' · не враховано' : ''}</div></div>
    <div class="a ${t.amount > 0 ? 'in' : ''}">${t.amount > 0 ? '+' : '−'}${uah(t.amount)}</div></button>`
}

function viewStats() {
  const all = monthTxs().filter(counts)
  const total = all.reduce((s, t) => s - t.amount, 0)
  const by = {}
  for (const t of all) by[t.cat] = (by[t.cat] || 0) - t.amount
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1])
  const body = rows.map(([id, v]) => {
    const c = CAT[id] || CAT.other, pct = total ? (v / total) * 100 : 0
    return `<button class="cat" data-act="filter" data-v="${id}"><div class="ico">${c.ico}</div><div class="mid">
      <div class="top"><span>${c.name}</span><span>${uah(v)} · ${Math.round(pct)}%</span></div>
      <div class="bar"><i style="width:${pct}%;background:${c.color}"></i></div></div></button>`
  }).join('') || '<div class="empty">Немає витрат за цей місяць.</div>'
  const d = new Date(), isCur = S.month === monthKey(d)
  const days = isCur ? d.getDate() : new Date(+S.month.slice(0, 4), +S.month.slice(5), 0).getDate()
  return `${monthHeader()}<div class="hero"><div class="lbl">Всього витрат</div><div class="big">${uah(total)}</div>
    <div class="sub"><span>У середньому ${uah(total / days)}/день</span><span>${all.length} операцій</span></div></div>${body}`
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
      ${s.token ? '<button class="btn del" data-act="disconnect">Відключити банк</button>' : ''}</div>
    <h3>Дані</h3><div class="box"><p>Дані лише на телефоні. Раз на кілька тижнів зберігай копію — якщо видалити застосунок або почистити Safari, дані зникнуть.</p>
      <button class="btn sec" data-act="export">Зберегти копію</button>
      <button class="btn sec" data-act="import">Відновити з копії</button>
      <input type="file" id="importfile" accept="application/json" hidden></div>
    <div class="sync">Версія 1.0</div>`
}

// ---------- форма додавання/редагування ----------
let form = null
function openSheet(tx) {
  const isNew = !tx
  const t = tx ? { ...tx } : { id: 'm:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), amount: 0, cat: LS.get('lastCat', 'food'), src: 'manual', note: '' }
  form = { t, isNew, expense: t.amount <= 0, photo: t.photo || null, photoChanged: false }
  const sheet = $('#sheet')
  const dt = new Date(t.ts); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  sheet.innerHTML = `<div class="panel">
    <div class="seg"><button data-act="ftype" data-v="e" class="${form.expense ? 'on' : ''}">Витрата</button><button data-act="ftype" data-v="i" class="${form.expense ? '' : 'on'}">Дохід</button></div>
    <input class="amt" id="amt" type="text" inputmode="decimal" placeholder="0" value="${t.amount ? (Math.abs(t.amount) / 100).toString().replace('.', ',') : ''}" autocomplete="off">
    <div class="grid">${CATS.filter((c) => c.id !== 'income').map((c) => `<button data-act="fcat" data-v="${c.id}" class="${t.cat === c.id ? 'on' : ''}"><b>${c.ico}</b>${c.name}</button>`).join('')}</div>
    <input class="field" id="note" placeholder="${t.desc ? esc(t.desc) : 'Нотатка (необов’язково)'}" value="${esc(t.note || '')}">
    <div class="two"><input class="field" id="date" type="datetime-local" value="${dt.toISOString().slice(0, 16)}" style="margin:0">
      <button class="btn sec" data-act="fphoto" style="margin:0" id="photobtn">${form.photo ? '📎 Чек додано' : '📷 Фото чека'}</button></div>
    <input type="file" id="photofile" accept="image/*" capture="environment" hidden>
    <div id="photoprev">${form.photo ? `<img class="photo" style="margin-top:10px" src="${URL.createObjectURL(form.photo)}">` : ''}</div>
    ${!isNew ? `<label class="tog"><span>Не враховувати в статистиці</span><input type="checkbox" id="ign" ${t.ignore ? 'checked' : ''}></label>` : ''}
    <div style="margin-top:12px"><button class="btn" data-act="fsave">Зберегти</button>
    ${!isNew ? '<button class="btn del" data-act="fdel">Видалити</button>' : ''}<button class="btn sec" data-act="fclose">Закрити</button></div></div>`
  sheet.classList.add('open')
  if (isNew) setTimeout(() => $('#amt').focus(), 60)
}
const closeSheet = () => { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; form = null }

async function resizePhoto(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.7))
}

async function saveForm() {
  const raw = $('#amt').value.replace(/\s/g, '').replace(',', '.')
  const val = Math.round(parseFloat(raw) * 100)
  if (!val || val <= 0) { toast('Введи суму'); $('#amt').focus(); return }
  const t = form.t
  t.amount = form.expense ? -val : val
  t.note = $('#note').value.trim()
  const d = new Date($('#date').value); if (!isNaN(d)) t.ts = d.getTime()
  t.ignore = $('#ign') ? $('#ign').checked : false
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
    toast(`Запам’ятав: ${t.desc} → ${CAT[t.cat].name}${n ? ` (ще ${n})` : ''}`)
  }
  if (t.ts) { const mk = monthKey(new Date(t.ts)); if (form.isNew && mk !== S.month) S.month = mk }
  closeSheet(); render()
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
function setMsg(m) { S.syncMsg = m; if (S.tab === 'home' && !form) render() }

async function loadAccounts() {
  const info = await mono('/personal/client-info')
  const old = Object.fromEntries(S.settings.accounts.map((a) => [a.id, a.on]))
  S.settings.accounts = (info.accounts || []).filter((a) => a.currencyCode === 980).map((a) => ({
    id: a.id, on: old[a.id] ?? true,
    name: `${a.type === 'black' ? 'Чорна' : a.type === 'white' ? 'Біла' : a.type} ${(a.maskedPan && a.maskedPan[0]) || ''}`.trim(),
  }))
  saveSettings()
}

async function sync(force) {
  if (S.syncing || !S.settings.token) return
  if (!force && Date.now() - S.settings.lastSync < 5 * 60000) return
  S.syncing = true; setMsg('Оновлення…')
  try {
    if (!S.settings.accounts.length) { await loadAccounts(); await sleep(1000) }
    const accs = S.settings.accounts.filter((a) => a.on)
    let added = 0, first = true
    for (const a of accs) {
      let to = Math.floor(Date.now() / 1000)
      const from = Math.max((S.settings.since[a.id] || 0) - 3600, to - 31 * 86400)
      const newest = to
      for (;;) {
        if (!first) { for (let s = 61; s > 0; s--) { setMsg(`Monobank дозволяє 1 запит/хв, чекаю ${s} с…`); await sleep(1000) } }
        first = false
        setMsg('Оновлення…')
        const items = await mono(`/personal/statement/${a.id}/${from}/${to}`)
        for (const it of items) {
          const id = 'mono:' + it.id
          if (S.txs.some((x) => x.id === id)) continue
          const rule = S.settings.rules[normDesc(it.description)]
          const t = {
            id, ts: it.time * 1000, amount: it.amount, src: 'mono', desc: it.description || '', note: it.comment || '',
            mcc: it.mcc, cat: it.amount > 0 ? 'income' : rule || mccToCat(it.mcc),
          }
          await dbPut(t); S.txs.push(t); added++
        }
        if (items.length < 500) break
        to = items[items.length - 1].time
      }
      S.settings.since[a.id] = newest
      saveSettings()
    }
    S.settings.lastSync = Date.now(); saveSettings()
    S.syncMsg = ''
    if (added) toast(`Нових операцій: ${added}`)
  } catch (e) {
    S.syncMsg = e.message === 'rate' ? 'Забагато запитів до банку, спробуй за хвилину'
      : e.message === 'token' ? 'Токен не підійшов — перевір у налаштуваннях' : 'Не вдалося зв’язатись з банком'
  }
  S.syncing = false; render()
}

// ---------- резервна копія ----------
const blobToData = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b) })
async function exportData() {
  const txs = []
  for (const t of S.txs) txs.push({ ...t, photo: t.photo ? await blobToData(t.photo) : undefined })
  const s = { ...S.settings, token: '' }
  const file = new File([JSON.stringify({ v: 1, txs, settings: s })], `hroshi-${dayKey(Date.now())}.json`, { type: 'application/json' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return } catch { return } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click()
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text())
    if (!Array.isArray(d.txs)) throw new Error()
    for (const t of d.txs) {
      if (typeof t.photo === 'string') t.photo = await (await fetch(t.photo)).blob()
      await dbPut(t)
    }
    S.txs = await dbAll()
    if (d.settings) { S.settings = { ...S.settings, limit: d.settings.limit || S.settings.limit, rules: { ...S.settings.rules, ...d.settings.rules } }; saveSettings() }
    toast(`Відновлено: ${d.txs.length}`); render()
  } catch { toast('Файл не підійшов') }
}

// ---------- події ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]')
  if (!el) { if (e.target.id === 'sheet') closeSheet(); return }
  const act = el.dataset.act, v = el.dataset.v
  switch (act) {
    case 'tab': S.tab = v; render(); window.scrollTo(0, 0); break
    case 'add': openSheet(); break
    case 'edit': openSheet(S.txs.find((t) => t.id === el.dataset.id)); break
    case 'mprev': case 'mnext': {
      const [y, m] = S.month.split('-').map(Number); const d = new Date(y, m - 1 + (act === 'mnext' ? 1 : -1), 1)
      S.month = monthKey(d); render(); break
    }
    case 'filter': S.filter = v; S.tab = 'home'; render(); window.scrollTo(0, 0); break
    case 'clearfilter': S.filter = null; render(); break
    case 'sync': sync(true); break
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
    case 'export': exportData(); break
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
  else if (t.id === 'limit') { S.settings.limit = Math.max(0, parseInt(t.value, 10) || 0); saveSettings(); toast('Ліміт збережено') }
  else if (t.dataset && t.dataset.act === 'acc') { S.settings.accounts[+t.dataset.i].on = t.checked; saveSettings() }
})
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && form && e.target.tagName === 'INPUT') saveForm() })
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(false) })

// ---------- старт ----------
;(async () => {
  try { db = await openDb(); S.txs = await dbAll() } catch { toast('Не вдалося відкрити сховище') }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist()
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/money-sw.js', { scope: '/money' }).catch(() => {})
  render(); sync(false)
})()
