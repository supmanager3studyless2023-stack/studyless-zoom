'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const FIELDS = [
  { id: 'g', label: 'G — ціль студента', tag: 'GROW' },
  { id: 'r', label: 'R — реальність', tag: 'GROW' },
  { id: 'o', label: 'O — перешкоди', tag: 'GROW' },
  { id: 'w', label: 'W — бажання діяти', tag: 'GROW' },
  { id: 'tarif', label: 'Відповідність тарифу', tag: 'Оцінка' },
  { id: 'risks', label: 'Потенційні ризики', tag: 'Оцінка' },
  { id: 'type', label: 'Тип особистості', tag: 'Оцінка' },
  { id: 'comm', label: 'Формат спілкування', tag: 'Комунікація' },
  { id: 'teach', label: 'Побажання щодо викладача', tag: 'Комунікація' },
  { id: 'sched', label: 'Графік занять', tag: 'Комунікація' },
  { id: 'extra', label: 'Особливі побажання', tag: 'Комунікація' },
  { id: 'week1', label: 'Критерії 1-го тижня', tag: 'Оцінка' },
  { id: 'impact', label: 'Методи впливу', tag: 'Комунікація' },
]

const TAG_COLORS: Record<string, string> = {
  'GROW': 'bg-violet-100 text-violet-800',
  'Оцінка': 'bg-teal-100 text-teal-800',
  'Комунікація': 'bg-amber-100 text-amber-800',
}

export default function HomePage() {
  const [transcript, setTranscript] = useState('')
  const [studentName, setStudentName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [fathomLink, setFathomLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleAnalyze() {
    if (transcript.length < 100) { setError('Вставте транскрипт (мінімум 100 символів)'); return }
    setError('')
    setLoading(true)
    setResults([])
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, studentName, sessionDate, fathomLink }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data.results)
    } catch (e) {
      setError('Помилка аналізу. Спробуйте ще раз.')
    }
    setLoading(false)
  }

  function copyField(id: string, value: string) {
    navigator.clipboard.writeText(value)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function copyAll() {
    const text = FIELDS.map(f => {
      const r = results.find((x: any) => x.id === f.id)
      return `${f.label}\n${r?.value || '—'}`
    }).join('\n\n')
    navigator.clipboard.writeText(`${studentName || 'Студент'}\n\n${text}`)
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  const filled = results.filter((r: any) => r.found).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-600"></div>
            <span className="font-medium text-gray-900">Study Less</span>
            <span className="text-gray-400 text-sm">/ Аналіз знайомств</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">Вийти</button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ім'я студента</label>
              <input value={studentName} onChange={e => setStudentName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                placeholder="Катерина Гугленко" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Дата</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Посилання Fathom (необов'язково)</label>
              <input value={fathomLink} onChange={e => setFathomLink(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                placeholder="https://fathom.video/share/..." />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Транскрипт з Fathom</label>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={10}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
              placeholder="Вставте транскрипт розмови..." />
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button onClick={handleAnalyze} disabled={loading}
            className="mt-4 w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'AI аналізує транскрипт...' : 'Проаналізувати знайомство'}
          </button>
        </div>

        {results.length > 0 && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-medium text-teal-600">{filled}</div>
                <div className="text-xs text-gray-500 mt-1">поля заповнено</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-medium text-violet-600">{FIELDS.length - filled}</div>
                <div className="text-xs text-gray-500 mt-1">не згадувалося</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-medium text-gray-900">{Math.round(filled / FIELDS.length * 100)}%</div>
                <div className="text-xs text-gray-500 mt-1">повнота картки</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              {FIELDS.map(f => {
                const r = results.find((x: any) => x.id === f.id)
                return (
                  <div key={f.id} className={`bg-white rounded-xl border border-l-4 ${r?.found ? 'border-l-teal-400' : 'border-l-gray-200'} border-gray-200 overflow-hidden`}>
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-600">{f.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[f.tag]}`}>{f.tag}</span>
                        {r?.found && (
                          <button onClick={() => copyField(f.id, r.value)}
                            className={`text-xs px-2 py-0.5 rounded border ${copied === f.id ? 'border-teal-400 text-teal-600' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}>
                            {copied === f.id ? 'Скопійовано' : 'Копіювати'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`px-4 py-3 text-sm ${r?.found ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                      {r?.value || '—'}
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={copyAll}
              className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700">
              {copied === 'all' ? 'Скопійовано!' : 'Скопіювати всі поля для PlanFix'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}