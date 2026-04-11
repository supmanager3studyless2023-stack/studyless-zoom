'use client'
import { useState } from 'react'

const SCORE_COLOR = (s: number) => s >= 8 ? 'text-teal-600' : s >= 6 ? 'text-amber-500' : 'text-red-500'
const SCORE_BG = (s: number) => s >= 8 ? 'bg-teal-50 border-teal-200' : s >= 6 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

export default function QAPage() {
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function analyze() {
    if (transcript.length < 100) { setError('Вставте транскрипт'); return }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError('Помилка аналізу. Спробуйте ще раз.')
    }
    setLoading(false)
  }

  function copyReport() {
    if (!result) return
    let txt = `QA АНАЛІЗ ДЗВІНКА\n`
    txt += `Менеджер: ${result.manager || '—'} | Студент: ${result.student || '—'}\n`
    txt += `Загальна оцінка: ${result.overall_score}/10\n`
    txt += `${result.overall_comment}\n\n`
    result.criteria.forEach((c: any) => {
      txt += `${c.title}: ${c.score}/${c.max}\n`
      txt += `${c.analysis}\n`
      txt += `+ ${c.strong}\n`
      txt += `→ ${c.improve}\n\n`
    })
    txt += `СИЛЬНІ СТОРОНИ:\n${result.top_strengths.map((s: string) => `• ${s}`).join('\n')}\n\n`
    txt += `ЩО ПОКРАЩИТИ:\n${result.top_improvements.map((s: string) => `• ${s}`).join('\n')}`
    navigator.clipboard.writeText(txt)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-violet-600"></div>
          <span className="font-medium text-gray-900">Study Less</span>
          <span className="text-gray-400 text-sm">/ QA Аналіз дзвінка</span>
          <a href="/" className="ml-auto text-sm text-gray-400 hover:text-gray-600">← Картка студента</a>
        </div>

        {!result && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h1 className="text-lg font-medium text-gray-900 mb-1">Аналіз якості дзвінка</h1>
            <p className="text-sm text-gray-400 mb-4">Вставте транскрипт — AI проаналізує роботу менеджера за скриптом Study Less</p>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={12}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
              placeholder="Вставте транскрипт Zoom-знайомства..."
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <button
              onClick={analyze}
              disabled={loading}
              className="mt-4 w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'AI аналізує якість дзвінка...' : 'Проаналізувати дзвінок'}
            </button>
          </div>
        )}

        {result && (
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">
                    {result.manager && <span>Менеджер: <b>{result.manager}</b> · </span>}
                    {result.student && <span>Студент: <b>{result.student}</b></span>}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-4xl font-bold ${SCORE_COLOR(result.overall_score)}`}>{result.overall_score}</span>
                    <span className="text-gray-300 text-2xl">/10</span>
                    <span className="text-sm text-gray-500">загальна оцінка</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={copyReport} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700">
                    Скопіювати звіт
                  </button>
                  <button onClick={() => { setResult(null); setTranscript('') }} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700">
                    Новий аналіз
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{result.overall_comment}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              {result.criteria.map((c: any) => (
                <div key={c.id} className={`rounded-xl border p-4 ${SCORE_BG(c.score)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 text-sm">{c.title}</span>
                    <span className={`text-lg font-bold ${SCORE_COLOR(c.score)}`}>{c.score}<span className="text-gray-300 text-sm font-normal">/{c.max}</span></span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{c.analysis}</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2 text-sm">
                      <span className="text-teal-600 font-medium shrink-0">+</span>
                      <span className="text-gray-600">{c.strong}</span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="text-amber-500 font-medium shrink-0">→</span>
                      <span className="text-gray-600">{c.improve}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <div className="text-sm font-medium text-teal-800 mb-2">Сильні сторони</div>
                {result.top_strengths.map((s: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm text-teal-700 mb-1">
                    <span>•</span><span>{s}</span>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="text-sm font-medium text-amber-800 mb-2">Що покращити</div>
                {result.top_improvements.map((s: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm text-amber-700 mb-1">
                    <span>→</span><span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}