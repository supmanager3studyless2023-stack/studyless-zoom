'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const TOUCH_TYPES = ['знайомство', '1т', '2т', '4т', '8т', '12т', 'продаж']
const TOUCH_LABELS: Record<string, string> = {
  'знайомство': 'Зум-знайомство',
  '1т': '1й тиждень',
  '2т': '2й тиждень',
  '4т': '4й тиждень',
  '8т': '8й тиждень',
  '12т': '12й тиждень',
  'продаж': 'Продаж (15т)',
}
const SCORE_COLOR = (s: number) => s >= 8 ? 'text-teal-600' : s >= 6 ? 'text-amber-500' : 'text-red-500'
const SCORE_BG = (s: number) => s >= 8 ? 'bg-teal-50 border-teal-200' : s >= 6 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

export default function DirectorPage() {
  const [tab, setTab] = useState<'analyze' | 'dashboard'>('analyze')
  const [touchType, setTouchType] = useState('знайомство')
  const [transcript, setTranscript] = useState('')
  const [managerName, setManagerName] = useState('')
  const [studentName, setStudentName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [analyses, setAnalyses] = useState<any[]>([])
  const [dashLoading, setDashLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterManager, setFilterManager] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    if (tab === 'dashboard') loadAnalyses()
  }, [tab])

  async function loadAnalyses() {
    setDashLoading(true)
    const { data } = await supabase
      .from('director_analyses')
      .select('*')
      .order('created_at', { ascending: false })
    setAnalyses(data || [])
    setDashLoading(false)
  }

  async function transcribeUrl(url: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTranscript(data.transcript)
    } catch {
      setError('Помилка транскрибування. Спробуйте ще раз.')
    }
    setLoading(false)
  }

  async function transcribeFile(file: File) {
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTranscript(data.transcript)
    } catch {
      setError('Помилка транскрибування. Спробуйте ще раз.')
    }
    setLoading(false)
  }

  async function analyze() {
    if (transcript.length < 100) { setError('Вставте транскрипт'); return }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, touchType, managerName, studentName, sessionDate }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setError('Помилка аналізу. Спробуйте ще раз.')
    }
    setLoading(false)
  }

  const managers = [...new Set(analyses.map(r => r.manager_name).filter(Boolean))]
  const filtered = analyses.filter(r => {
    if (filterType !== 'all' && r.touch_type !== filterType) return false
    if (filterManager !== 'all' && r.manager_name !== filterManager) return false
    return true
  })

  const avgScore = analyses.length
    ? Math.round(analyses.reduce((s, r) => s + (r.overall_score || 0), 0) / analyses.length * 10) / 10
    : 0

  const managerStats = managers.map(name => {
    const rows = analyses.filter(r => r.manager_name === name)
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (r.overall_score || 0), 0) / rows.length * 10) / 10 : 0
    return { name, total: rows.length, avg }
  }).sort((a, b) => b.avg - a.avg)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-violet-600"></div>
          <span className="font-medium text-gray-900">Study Less</span>
          <span className="text-gray-400 text-sm">/ Керівник</span>
          <a href="/scripts" className="ml-auto text-sm text-gray-400 hover:text-gray-600">← Менеджери</a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setTab('analyze')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'analyze' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Аналіз дзвінка
          </button>
          <button
            onClick={() => setTab('dashboard')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Дашборд
          </button>
        </div>

        {/* АНАЛІЗ */}
        {tab === 'analyze' && (
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
              <h1 className="text-lg font-medium text-gray-900 mb-1">QA Аналіз дзвінка</h1>
              <p className="text-sm text-gray-400 mb-4">Оберіть тип дзвінка — AI оцінить якість роботи менеджера по скрипту</p>

              <div className="flex gap-2 flex-wrap mb-4">
                {TOUCH_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => { setTouchType(t); setResult(null) }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      touchType === t
                        ? t === 'продаж' ? 'bg-green-500 text-white border-green-500'
                        : t === 'знайомство' ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                    }`}
                  >
                    {TOUCH_LABELS[t]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Ім'я менеджера" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Ім'я студента" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <input value={sessionDate} onChange={e => setSessionDate(e.target.value)} type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              </div>

              {/* Аудіо */}
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Завантажити аудіо (mp3, mp4, wav, m4a)</label>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) transcribeFile(f) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-violet-50 file:text-violet-700"
                />
                <input
                  type="url"
                  placeholder="Або вставте посилання на запис (Ringostat, Fathom...)"
                  className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  onBlur={e => { const url = e.target.value.trim(); if (url) transcribeUrl(url) }}
                />
                {loading && !result && <p className="text-xs text-violet-500 mt-1">Транскрибування аудіо...</p>}
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Транскрипт дзвінка</label>
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  rows={10}
                  placeholder="Вставте транскрипт або завантажте аудіо вище..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
                />
              </div>

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <button onClick={analyze} disabled={loading} className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                {loading && !transcript ? 'Транскрибування...' : loading ? `AI аналізує ${TOUCH_LABELS[touchType]}...` : `Аналізувати — ${TOUCH_LABELS[touchType]}`}
              </button>
            </div>

            {result && (
              <div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">
                        {result.manager && <span>Менеджер: <b>{result.manager}</b></span>}
                        {result.student && <span> · Студент: <b>{result.student}</b></span>}
                        <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{TOUCH_LABELS[touchType]}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className={`text-4xl font-bold ${SCORE_COLOR(result.overall_score)}`}>{result.overall_score}</span>
                        <span className="text-gray-300 text-2xl">/10</span>
                      </div>
                    </div>
                    <button onClick={() => { setResult(null); setTranscript('') }} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700">Новий аналіз</button>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{result.overall_comment}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 mb-4">
                  {result.criteria?.map((c: any) => (
                    <div key={c.id} className={`rounded-xl border p-4 ${SCORE_BG(c.score)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 text-sm">{c.title}</span>
                        <span className={`text-lg font-bold ${SCORE_COLOR(c.score)}`}>{c.score}<span className="text-gray-300 text-sm font-normal">/{c.max}</span></span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{c.analysis}</p>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-2 text-sm"><span className="text-teal-600 font-medium shrink-0">+</span><span className="text-gray-600">{c.strong}</span></div>
                        <div className="flex gap-2 text-sm"><span className="text-amber-500 font-medium shrink-0">→</span><span className="text-gray-600">{c.improve}</span></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                    <div className="text-sm font-medium text-teal-800 mb-2">Сильні сторони</div>
                    {result.top_strengths?.map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm text-teal-700 mb-1"><span>+</span><span>{s}</span></div>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="text-sm font-medium text-amber-800 mb-2">Що покращити</div>
                    {result.top_improvements?.map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm text-amber-700 mb-1"><span>→</span><span>{s}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ДАШБОРД */}
        {tab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className={`text-3xl font-bold ${SCORE_COLOR(avgScore)}`}>{avgScore}</div>
                <div className="text-xs text-gray-500 mt-1">середня оцінка</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-3xl font-medium text-violet-600">{analyses.length}</div>
                <div className="text-xs text-gray-500 mt-1">аналізів проведено</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-3xl font-medium text-teal-600">{managers.length}</div>
                <div className="text-xs text-gray-500 mt-1">менеджерів</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-3xl font-medium text-amber-600">{analyses.filter(r => (r.overall_score || 0) < 6).length}</div>
                <div className="text-xs text-gray-500 mt-1">потребують уваги</div>
              </div>
            </div>

            {managerStats.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
                <h2 className="font-medium text-gray-900 mb-4">Рейтинг менеджерів</h2>
                <div className="flex flex-col gap-3">
                  {managerStats.map((m, i) => (
                    <div key={m.name} className="flex items-center gap-4">
                      <span className="text-sm text-gray-400 w-4">{i + 1}</span>
                      <span className="text-sm text-gray-900 flex-1">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${m.avg >= 8 ? 'bg-teal-400' : m.avg >= 6 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${m.avg * 10}%` }} />
                        </div>
                        <span className={`text-sm font-bold w-8 ${SCORE_COLOR(m.avg)}`}>{m.avg}</span>
                        <span className="text-xs text-gray-400">{m.total} аналізів</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900">Всі аналізи</h2>
                <div className="flex gap-2">
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none">
                    <option value="all">Всі типи</option>
                    {TOUCH_TYPES.map(t => <option key={t} value={t}>{TOUCH_LABELS[t]}</option>)}
                  </select>
                  <select value={filterManager} onChange={e => setFilterManager(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none">
                    <option value="all">Всі менеджери</option>
                    {managers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {dashLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Завантаження...</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">Немає аналізів. Проведіть перший аналіз.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map(r => (
                    <div key={r.id} className={`rounded-xl border p-4 ${SCORE_BG(r.overall_score)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xl font-bold ${SCORE_COLOR(r.overall_score)}`}>{r.overall_score}</span>
                          <span className="text-gray-300">/10</span>
                          {r.manager_name && <span className="text-sm font-medium text-gray-900">{r.manager_name}</span>}
                          {r.student_name && <span className="text-sm text-gray-500">· {r.student_name}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">{TOUCH_LABELS[r.touch_type] || r.touch_type}</span>
                          <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('uk-UA')}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{r.overall_comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}