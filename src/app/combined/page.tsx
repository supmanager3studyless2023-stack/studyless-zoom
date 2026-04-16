'use client'
import { useState } from 'react'

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

export default function CombinedPage() {
  const [touchType, setTouchType] = useState('знайомство')
  const [callUrl, setCallUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [managerName, setManagerName] = useState('')
  const [studentName, setStudentName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [resultTab, setResultTab] = useState<'manager' | 'director'>('manager')

  async function transcribeUrl(url: string) {
    setLoading(true)
    setLoadingStep('Транскрибуємо дзвінок...')
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
    setLoadingStep('')
  }

  async function transcribeFile(file: File) {
    setLoading(true)
    setLoadingStep('Транскрибуємо аудіо...')
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTranscript(data.transcript)
    } catch {
      setError('Помилка транскрибування.')
    }
    setLoading(false)
    setLoadingStep('')
  }

  async function analyzeAll() {
    const textToAnalyze = transcript
    if (textToAnalyze.length < 100) { setError('Вставте транскрипт або завантажте аудіо'); return }
    setError('')
    setLoading(true)
    setLoadingStep('AI аналізує дзвінок (нотатки + QA одночасно)...')
    setResult(null)
    try {
      const res = await fetch('/api/analyze-combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToAnalyze,
          touchType,
          managerName,
          studentName,
          sessionDate,
          fathomLink: callUrl,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      setResultTab('manager')
    } catch {
      setError('Помилка аналізу. Спробуйте ще раз.')
    }
    setLoading(false)
    setLoadingStep('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-violet-600"></div>
          <span className="font-medium text-gray-900">Study Less</span>
          <span className="text-gray-400 text-sm">/ Аналіз дзвінка</span>
          <div className="ml-auto flex gap-3">
            <a href="/scripts" className="text-sm text-gray-400 hover:text-gray-600">Менеджер</a>
            <a href="/director" className="text-sm text-gray-400 hover:text-gray-600">Керівник</a>
          </div>
        </div>

        {/* Форма */}
        {!result && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h1 className="text-lg font-medium text-gray-900 mb-1">Єдиний аналіз дзвінка</h1>
            <p className="text-sm text-gray-400 mb-4">
              Одна кнопка — транскрипція + нотатки для менеджера + QA для керівника одночасно
            </p>

            {/* Тип дотику */}
            <div className="flex gap-2 flex-wrap mb-4">
              {TOUCH_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setTouchType(t)}
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

            {/* Мета поля */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Ім'я менеджера" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Ім'я студента" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              <input value={sessionDate} onChange={e => setSessionDate(e.target.value)} type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
            </div>

            {/* URL або файл */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Посилання на запис дзвінка</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={callUrl}
                  onChange={e => setCallUrl(e.target.value)}
                  placeholder="https://fathom.video/... або Ringostat..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                />
                <button
                  onClick={() => { if (callUrl) transcribeUrl(callUrl) }}
                  disabled={loading || !callUrl}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                  Транскрибувати
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Або завантажте аудіо (mp3, mp4, wav, m4a)</label>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) transcribeFile(f) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-violet-50 file:text-violet-700"
              />
            </div>

            {/* Транскрипт */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">
                Транскрипт {transcript && <span className="text-teal-600">✓ готово ({transcript.length} символів)</span>}
              </label>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                rows={transcript ? 6 : 3}
                placeholder="Транскрипт з'явиться тут після обробки, або вставте вручну..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
              />
            </div>

            {loading && (
              <div className="flex items-center gap-2 mb-3 text-sm text-violet-600">
                <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                {loadingStep}
              </div>
            )}

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              onClick={analyzeAll}
              disabled={loading}
              className="w-full bg-violet-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? loadingStep : `Аналізувати — ${TOUCH_LABELS[touchType]}`}
            </button>

            <p className="text-xs text-center text-gray-400 mt-2">
              Транскрипція виконується 1 раз · Нотатки менеджера + QA керівника одночасно
            </p>
          </div>
        )}

        {/* Результат */}
        {result && (
          <div>
            {/* Шапка результату */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    {managerName && <span>Менеджер: <b>{managerName}</b></span>}
                    {studentName && <span> · Студент: <b>{studentName}</b></span>}
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{TOUCH_LABELS[touchType]}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">QA оцінка:</span>
                    <span className={`text-2xl font-bold ${SCORE_COLOR(result.director.overall_score)}`}>
                      {result.director.overall_score}
                    </span>
                    <span className="text-gray-300">/10</span>
                  </div>
                </div>
                <button
                  onClick={() => { setResult(null); setTranscript(''); setCallUrl('') }}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700"
                >
                  Новий аналіз
                </button>
              </div>
            </div>

            {/* Вкладки результату */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
              <button
                onClick={() => setResultTab('manager')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${resultTab === 'manager' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📋 Нотатки менеджера
              </button>
              <button
                onClick={() => setResultTab('director')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${resultTab === 'director' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📊 QA керівника
              </button>
            </div>

            {/* Нотатки менеджера */}
            {resultTab === 'manager' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-medium text-gray-900 mb-4">Нотатки по студенту</h2>
                <div className="flex flex-col gap-3">
                  {result.manager.results?.map((r: any) => (
                    <div key={r.id} className={`rounded-xl border p-3 ${r.found === false ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
                      <div className="text-xs text-gray-400 mb-1">{r.label}</div>
                      <div className={`text-sm ${r.found === false ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                        {r.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QA керівника */}
            {resultTab === 'director' && (
              <div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
                  <div className={`flex items-baseline gap-3 mb-3`}>
                    <span className={`text-4xl font-bold ${SCORE_COLOR(result.director.overall_score)}`}>{result.director.overall_score}</span>
                    <span className="text-gray-300 text-2xl">/10</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{result.director.overall_comment}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 mb-4">
                  {result.director.criteria?.map((c: any) => (
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
                    {result.director.top_strengths?.map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm text-teal-700 mb-1"><span>+</span><span>{s}</span></div>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="text-sm font-medium text-amber-800 mb-2">Що покращити</div>
                    {result.director.top_improvements?.map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm text-amber-700 mb-1"><span>→</span><span>{s}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}