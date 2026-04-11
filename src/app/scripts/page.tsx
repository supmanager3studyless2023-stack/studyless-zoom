'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

const TAG_COLORS: Record<string, string> = {
  'GROW': 'bg-violet-100 text-violet-800',
  'Оцінка': 'bg-teal-100 text-teal-800',
  'Комунікація': 'bg-amber-100 text-amber-800',
}

export default function ScriptsPage() {
  const [touchType, setTouchType] = useState('знайомство')
  const [transcript, setTranscript] = useState('')
  const [managerName, setManagerName] = useState('')
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

  async function handleAnalyze() {
    if (transcript.length < 100) { setError('Вставте транскрипт (мінімум 100 символів)'); return }
    setError('')
    setLoading(true)
    setResults([])
    try {
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, touchType, managerName, studentName, sessionDate, fathomLink }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data.results)
    } catch {
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
    const text = results.map(r => `${r.label}:\n${r.value || '–'}`).join('\n\n')
    navigator.clipboard.writeText(`${studentName || 'Студент'}\n\n${text}`)
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  const filled = results.filter((r: any) => r.found !== false).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-violet-600"></div>
          <span className="font-medium text-gray-900">Study Less</span>
          <span className="text-gray-400 text-sm">/ Менеджер</span>
          <button onClick={handleLogout} className="ml-auto text-sm text-gray-400 hover:text-gray-600">Вийти</button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <h1 className="text-lg font-medium text-gray-900 mb-1">Аналіз дзвінка</h1>
          <p className="text-sm text-gray-400 mb-4">Оберіть тип взаємодії, вставте транскрипт або завантажте аудіо — AI заповнить поля для Planfix</p>

          {/* Тип дотику */}
          <div className="flex gap-2 flex-wrap mb-4">
            {TOUCH_TYPES.map(t => (
              <button
                key={t}
                onClick={() => { setTouchType(t); setResults([]) }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  touchType === t
                    ? t === 'продаж'
                      ? 'bg-green-500 text-white border-green-500'
                      : t === 'знайомство'
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                }`}
              >
                {TOUCH_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Поля введення */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ім'я студента</label>
              <input
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Катерина Гугленко"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Дата</label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          {touchType === 'знайомство' && (
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Посилання Fathom (необов'язково)</label>
              <input
                value={fathomLink}
                onChange={e => setFathomLink(e.target.value)}
                placeholder="https://fathom.video/share/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          )}

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
            {loading && results.length === 0 && <p className="text-xs text-violet-500 mt-1">Транскрибування аудіо...</p>}
          </div>

          {/* Транскрипт */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">
              Транскрипт {touchType === 'знайомство' ? 'з Fathom' : 'дзвінка'}
            </label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={10}
              placeholder="Вставте транскрипт або завантажте аудіо вище..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {loading && results.length === 0 && transcript.length < 100
              ? 'Транскрибування...'
              : loading
                ? `AI аналізує ${TOUCH_LABELS[touchType]}...`
                : `Аналізувати — ${TOUCH_LABELS[touchType]}`}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-medium text-teal-600">{filled}</div>
                <div className="text-xs text-gray-500 mt-1">поля заповнено</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-medium text-violet-600">{results.length - filled}</div>
                <div className="text-xs text-gray-500 mt-1">не згадувалось</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-medium text-gray-900">{Math.round(filled / results.length * 100)}%</div>
                <div className="text-xs text-gray-500 mt-1">повнота картки</div>
              </div>
            </div>

            {/* Fields */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900">
                  {TOUCH_LABELS[touchType]}
                  {studentName && <span className="text-gray-400 font-normal"> · {studentName}</span>}
                </h2>
                <button
                  onClick={copyAll}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700"
                >
                  {copied === 'all' ? '✓ Скопійовано' : 'Копіювати все для Planfix'}
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {results.map(r => (
                  <div
                    key={r.id}
                    className={`bg-white rounded-xl border border-l-4 ${r.found !== false ? 'border-l-teal-400' : 'border-l-gray-200'} border-gray-200 overflow-hidden`}
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-600">{r.label}</span>
                      <div className="flex items-center gap-2">
                        {r.tag && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[r.tag] || 'bg-gray-100 text-gray-600'}`}>
                            {r.tag}
                          </span>
                        )}
                        {r.found !== false && (
                          <button
                            onClick={() => copyField(r.id, r.value)}
                            className={`text-xs px-2 py-0.5 rounded border ${copied === r.id ? 'border-teal-400 text-teal-600' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}
                          >
                            {copied === r.id ? 'Скопійовано' : 'Копіювати'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`px-4 py-3 text-sm ${r.found !== false ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                      {r.value || '–'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setResults([]); setTranscript('') }}
              className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700"
            >
              Новий аналіз
            </button>
          </div>
        )}
      </div>
    </div>
  )
}