'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOUCH_TYPES = ['', 'знайомство', '1т', '2т', '4т', '8т', '12т', 'продаж']
const TOUCH_TYPES_REQUIRED = ['знайомство', '1т', '2т', '4т', '8т', '12т', 'продаж']
const TOUCH_LABELS: Record<string, string> = {
  '': 'Всі типи',
  'знайомство': 'Зум-знайомство',
  '1т': '1й тиждень', '2т': '2й тиждень', '4т': '4й тиждень',
  '8т': '8й тиждень', '12т': '12й тиждень', 'продаж': 'Продаж (15т)',
}
const PERIODS = [
  { value: 'all', label: 'Всі' },
  { value: 'month', label: 'Місяць' },
  { value: 'week', label: 'Тиждень' },
  { value: 'day', label: 'День' },
]

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function sc(s: number) { return s >= 8 ? '#0d9488' : s >= 6 ? '#d97706' : '#ef4444' }
function sb(s: number) { return s >= 8 ? '#f0fdf4' : s >= 6 ? '#fffbeb' : '#fef2f2' }
function sbd(s: number) { return s >= 8 ? '#99f6e4' : s >= 6 ? '#fde68a' : '#fecaca' }

function ScoreBadge({ score }: { score: number }) {
  return (
    <span style={{
      background: sb(score), color: sc(score), border: `1px solid ${sbd(score)}`,
      borderRadius: 8, padding: '3px 10px', fontWeight: 700, fontSize: 14,
      display: 'inline-block', minWidth: 54, textAlign: 'center', flexShrink: 0,
    }}>
      {score}/10
    </span>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }}>{children}</div>
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(124,58,237,0.25)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
}

// ─── Analysis Detail (expanded) ───────────────────────────────────────────────

function AnalysisDetail({ row }: { row: any }) {
  const criteria: any[] = Array.isArray(row.criteria) ? row.criteria : []
  return (
    <div style={{ padding: '16px 24px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
      {row.overallComment && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
          {row.overallComment}
        </div>
      )}

      {criteria.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Блоки скрипту</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {criteria.map((c: any, i: number) => (
              <div key={c.id ?? i} style={{
                borderRadius: 10, padding: '12px 14px',
                background: c.done ? sb(c.score) : '#f3f4f6',
                border: `1px solid ${c.done ? sbd(c.score) : '#e5e7eb'}`,
                opacity: c.done ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, flex: 1, marginRight: 8, lineHeight: 1.4 }}>{c.title}</div>
                  {c.done
                    ? <span style={{ fontSize: 14, fontWeight: 800, color: sc(c.score), flexShrink: 0 }}>{c.score}/10</span>
                    : <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>Не зроблено</span>}
                </div>
                {c.comment && <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: c.fix ? 4 : 0 }}>{c.comment}</div>}
                {c.fix && <div style={{ fontSize: 12, color: '#d97706', lineHeight: 1.4 }}>→ {c.fix}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {row.topStrengths?.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Сильні сторони</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {row.topStrengths.map((s: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #99f6e4', fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
                  <span style={{ color: '#0d9488', flexShrink: 0, fontWeight: 700 }}>✓</span>{s}
                </div>
              ))}
            </div>
          </div>
        )}
        {row.topImprovements?.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Що покращити</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {row.topImprovements.map((s: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
                  <span style={{ color: '#ef4444', flexShrink: 0, fontWeight: 700 }}>↑</span>{s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Analyses List ────────────────────────────────────────────────────────────

function AnalysesList({ analyses, showManager = false }: { analyses: any[]; showManager?: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!analyses.length) {
    return <div style={{ textAlign: 'center', padding: '36px 0', color: '#9ca3af', fontSize: 14 }}>Аналізів поки немає</div>
  }

  return (
    <div>
      {analyses.map((row, i) => (
        <div key={row.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
          <button
            onClick={() => setExpandedId(prev => prev === row.id ? null : row.id)}
            style={{
              width: '100%', padding: '11px 0', display: 'flex', alignItems: 'center', gap: 12,
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap',
            }}
          >
            <ScoreBadge score={row.overallScore} />
            {showManager && (
              <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', minWidth: 110, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.managerName || '—'}
              </span>
            )}
            <span style={{ fontSize: 14, color: '#374151', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.studentName || '—'}
            </span>
            <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>
              {TOUCH_LABELS[row.touchType] ?? row.touchType || '—'}
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              {row.sessionDate || new Date(row.createdAt).toLocaleDateString('uk-UA')}
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{expandedId === row.id ? '▲' : '▼'}</span>
          </button>
          {expandedId === row.id && <AnalysisDetail row={row} />}
        </div>
      ))}
    </div>
  )
}

// ─── Analysis Form ────────────────────────────────────────────────────────────

function AnalysisForm({
  defaultManagerName,
  allManagers,
  isDirector,
  onDone,
  onCancel,
}: {
  defaultManagerName: string
  allManagers: string[]
  isDirector: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const [callUrl, setCallUrl] = useState('')
  const [studentName, setStudentName] = useState('')
  const [managerName, setManagerName] = useState(defaultManagerName)
  const [touchType, setTouchType] = useState('знайомство')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [step, setStep] = useState<'idle' | 'transcribing' | 'diarizing' | 'analyzing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const isProcessing = ['transcribing', 'diarizing', 'analyzing'].includes(step)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!callUrl.trim()) return
    setError('')

    try {
      // Step 1: Transcribe
      setStep('transcribing')
      setProgress('Завантаження запису...')
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: callUrl.trim(), language: 'uk' }),
      })
      if (!transcribeRes.ok) {
        const err = await transcribeRes.json().catch(() => ({}))
        throw new Error(err.error || 'Помилка транскрипції')
      }
      const { jobId } = await transcribeRes.json()

      setProgress('Транскрибуємо запис...')
      let transcript = ''
      while (true) {
        await new Promise(r => setTimeout(r, 3000))
        const st = await fetch(`/api/transcribe/status?id=${jobId}`)
        const stData = await st.json()
        if (stData.status === 'completed') { transcript = stData.transcript; break }
        if (stData.status === 'error') throw new Error('Помилка розпізнавання мови')
      }

      // Step 2: Diarize
      setStep('diarizing')
      setProgress('Визначаємо голоси...')
      let finalTranscript = transcript
      try {
        const dRes = await fetch('/api/diarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, managerName: managerName || defaultManagerName, studentName }),
        })
        const dData = await dRes.json()
        if (dData.utterances?.length) {
          const mgr = managerName || defaultManagerName || 'Менеджер'
          const std = studentName || 'Студент'
          finalTranscript = dData.utterances
            .map((u: any) => `[${u.speaker === 'manager' ? mgr : std}]: ${u.text}`)
            .join('\n')
        }
      } catch { /* fall back to plain transcript */ }

      // Step 3: Analyze
      setStep('analyzing')
      setProgress('AI аналізує дзвінок...')
      const aRes = await fetch('/api/analyze-combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript,
          touchType,
          managerName: managerName || defaultManagerName,
          studentName,
          sessionDate,
        }),
      })
      if (!aRes.ok) {
        const err = await aRes.json().catch(() => ({}))
        throw new Error(err.error || 'Помилка аналізу')
      }

      setStep('done')
      setProgress('Готово!')
      setTimeout(onDone, 1200)
    } catch (e: any) {
      setError(e.message || 'Невідома помилка')
      setStep('error')
    }
  }

  return (
    <Card style={{ marginBottom: 24, border: '1px solid #c4b5fd', background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#4c1d95' }}>Новий аналіз дзвінка</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      {step === 'done' ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0d9488' }}>Аналіз збережено!</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Оновлюємо список...</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Посилання на запис *</label>
              <input
                value={callUrl} onChange={e => setCallUrl(e.target.value)}
                placeholder="https://zoom.us/rec/... або fathom.video/..."
                required disabled={isProcessing}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Студент</label>
              <input
                value={studentName} onChange={e => setStudentName(e.target.value)}
                placeholder="Ім'я студента" disabled={isProcessing}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Тип торкання</label>
              <select value={touchType} onChange={e => setTouchType(e.target.value)} disabled={isProcessing} style={inputStyle}>
                {TOUCH_TYPES_REQUIRED.map(t => <option key={t} value={t}>{TOUCH_LABELS[t]}</option>)}
              </select>
            </div>

            {isDirector && (
              <div>
                <label style={labelStyle}>Менеджер</label>
                <input
                  list="mgr-list" value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  placeholder="Ім'я менеджера" disabled={isProcessing}
                  style={inputStyle}
                />
                <datalist id="mgr-list">{allManagers.map(m => <option key={m} value={m} />)}</datalist>
              </div>
            )}

            <div>
              <label style={labelStyle}>Дата дзвінка</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} disabled={isProcessing} style={inputStyle} />
            </div>
          </div>

          {isProcessing && (
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: '#ede9fe', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Spinner />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4c1d95' }}>{progress}</div>
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>
                  {step === 'transcribing' && 'Крок 1/3 — розпізнавання мови (може тривати 1–3 хв)'}
                  {step === 'diarizing' && 'Крок 2/3 — визначення спікерів'}
                  {step === 'analyzing' && 'Крок 3/3 — AI-аналіз по скрипту'}
                </div>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', fontSize: 13 }}>
              {error}
              <button
                type="button" onClick={() => { setStep('idle'); setError('') }}
                style={{ marginLeft: 12, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
              >
                Спробувати ще
              </button>
            </div>
          )}

          {!isProcessing && step !== 'done' && (
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button type="submit" style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Аналізувати
              </button>
              <button type="button" onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                Скасувати
              </button>
            </div>
          )}
        </form>
      )}
    </Card>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }

// ─── Manager View ─────────────────────────────────────────────────────────────

function ManagerView({ managerName }: { managerName: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [period, setPeriod] = useState('all')
  const [touchType, setTouchType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ period })
    if (managerName) params.set('manager', managerName)
    if (touchType) params.set('touchType', touchType)
    const res = await fetch(`/api/dashboard?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [managerName, period, touchType])

  useEffect(() => { load() }, [load])

  const analyses: any[] = data?.recent ?? []
  const avgScore = data?.avgScore ?? 0
  const redCount = data?.redCalls?.length ?? 0

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Мої аналізи</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>{data?.total ?? 0}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Середня оцінка</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: avgScore ? sc(avgScore) : '#111827' }}>{avgScore || '—'}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Тривожних (&lt;6)</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: redCount > 0 ? '#ef4444' : '#111827' }}>{redCount}</div>
        </Card>
      </div>

      {/* New analysis button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            marginBottom: 24, padding: '11px 24px', borderRadius: 10,
            border: '1px dashed #c4b5fd', background: '#faf5ff',
            color: '#7c3aed', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + Додати аналіз дзвінка
        </button>
      )}

      {showForm && (
        <AnalysisForm
          defaultManagerName={managerName}
          allManagers={[]}
          isDirector={false}
          onDone={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid',
                borderColor: period === p.value ? '#6366f1' : '#d1d5db',
                background: period === p.value ? '#6366f1' : '#fff',
                color: period === p.value ? '#fff' : '#374151',
                fontWeight: period === p.value ? 700 : 400,
                cursor: 'pointer', fontSize: 13,
              }}>{p.label}</button>
            ))}
          </div>
          <select value={touchType} onChange={e => setTouchType(e.target.value)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', color: '#374151' }}>
            {TOUCH_TYPES.map(t => <option key={t} value={t}>{TOUCH_LABELS[t]}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <SectionTitle>Мої дзвінки</SectionTitle>
        {loading
          ? <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 14 }}>Завантаження...</div>
          : <AnalysesList analyses={analyses} showManager={false} />}
      </Card>
    </div>
  )
}

// ─── Director View ────────────────────────────────────────────────────────────

function DirectorView() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('day')
  const [manager, setManager] = useState('')
  const [touchType, setTouchType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'errors' | 'strengths'>('errors')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ period })
    if (manager) params.set('manager', manager)
    if (touchType) params.set('touchType', touchType)
    const res = await fetch(`/api/dashboard?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [period, manager, touchType])

  useEffect(() => { load() }, [load])

  const allManagers: string[] = data?.allManagers ?? []

  return (
    <div>
      {/* Filters + New button */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid',
                  borderColor: period === p.value ? '#6366f1' : '#d1d5db',
                  background: period === p.value ? '#6366f1' : '#fff',
                  color: period === p.value ? '#fff' : '#374151',
                  fontWeight: period === p.value ? 700 : 400,
                  cursor: 'pointer', fontSize: 13,
                }}>{p.label}</button>
              ))}
            </div>
            <select value={manager} onChange={e => setManager(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', color: '#374151' }}>
              <option value="">Всі менеджери</option>
              {allManagers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={touchType} onChange={e => setTouchType(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', color: '#374151' }}>
              {TOUCH_TYPES.map(t => <option key={t} value={t}>{TOUCH_LABELS[t]}</option>)}
            </select>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: '1px solid #c4b5fd',
              background: showForm ? '#7c3aed' : '#faf5ff',
              color: showForm ? '#fff' : '#7c3aed',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {showForm ? '✕ Закрити' : '+ Новий аналіз'}
          </button>
        </div>
      </Card>

      {showForm && (
        <AnalysisForm
          defaultManagerName=""
          allManagers={allManagers}
          isDirector={true}
          onDone={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 15 }}>Завантаження...</div>}

      {!loading && data && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Всього аналізів', value: data.total, color: '#111827' },
              { label: 'Середня оцінка', value: data.avgScore, color: sc(data.avgScore) },
              { label: 'Тривожних (<6)', value: data.redCalls?.length ?? 0, color: data.redCalls?.length > 0 ? '#ef4444' : '#111827' },
              { label: 'Менеджерів', value: data.managerRanking?.length ?? 0, color: '#111827' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Manager ranking */}
            <Card>
              <SectionTitle>Рейтинг менеджерів</SectionTitle>
              {!data.managerRanking?.length
                ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.managerRanking.map((m: any, i: number) => (
                      <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#374151', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 14, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 6 }}>{m.total}x</span>
                        <ScoreBadge score={m.avgScore} />
                      </div>
                    ))}
                  </div>}
            </Card>

            {/* Touch types */}
            <Card>
              <SectionTitle>По типах торкань</SectionTitle>
              {!data.touchTypeStats?.length
                ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.touchTypeStats.sort((a: any, b: any) => b.total - a.total).map((t: any) => (
                      <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>{TOUCH_LABELS[t.type] ?? t.type}</span>
                        <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 6 }}>{t.total}x</span>
                        <ScoreBadge score={t.avgScore} />
                      </div>
                    ))}
                  </div>}
            </Card>
          </div>

          {/* Block heatmap */}
          {data.criteriaAvg?.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <SectionTitle>Середні оцінки по блоках скрипту</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {data.criteriaAvg.map((c: any) => (
                  <div key={c.id} style={{ borderRadius: 10, padding: '12px 14px', background: sb(c.avgScore), border: `1px solid ${sbd(c.avgScore)}` }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{c.title}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: sc(c.avgScore) }}>{c.avgScore}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Errors / Strengths */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {(['errors', 'strengths'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid',
                  borderColor: activeTab === tab ? (tab === 'errors' ? '#ef4444' : '#0d9488') : '#d1d5db',
                  background: activeTab === tab ? (tab === 'errors' ? '#fef2f2' : '#f0fdf4') : '#fff',
                  color: activeTab === tab ? (tab === 'errors' ? '#ef4444' : '#0d9488') : '#374151',
                  fontWeight: activeTab === tab ? 700 : 400, cursor: 'pointer', fontSize: 13,
                }}>
                  {tab === 'errors' ? '⚠️ Типові помилки' : '✅ Сильні сторони'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeTab === 'errors'
                ? (data.topImprovements?.length
                    ? data.topImprovements.map((imp: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                          <span style={{ background: '#ef4444', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{imp.count}x</span>
                          <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{imp.text}</span>
                        </div>
                      ))
                    : <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>)
                : (data.topStrengths?.length
                    ? data.topStrengths.map((s: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #99f6e4' }}>
                          <span style={{ background: '#0d9488', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.count}x</span>
                          <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s.text}</span>
                        </div>
                      ))
                    : <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>)}
            </div>
          </Card>

          {/* All analyses */}
          <Card>
            <SectionTitle>
              Всі аналізи
              {data.recent?.length > 0 && <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>({data.recent.length})</span>}
            </SectionTitle>
            <AnalysesList analyses={data.recent ?? []} showManager={true} />
          </Card>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
      setAuthLoading(false)
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ color: '#9ca3af', fontSize: 15 }}>Завантаження...</div>
      </div>
    )
  }

  const meta = user?.user_metadata ?? {}
  const isDirector = meta.role === 'director'
  const managerName: string = meta.manager_name || user?.email?.split('@')[0] || ''
  const displayName = meta.manager_name || user?.email || ''

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        *, *::before, *::after { box-sizing: border-box; }
        input, select, button, textarea { font-family: inherit; }
        button:hover { opacity: 0.9; }
      `}</style>

      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Study Less</span>
          <span style={{ color: '#d1d5db' }}>/</span>
          <span style={{ fontSize: 15, color: '#6b7280' }}>
            {isDirector ? 'Аналітика дзвінків' : 'Мої дзвінки'}
          </span>
        </div>

        {isDirector && (
          <a href="/trainer" style={{ fontSize: 13, color: '#7c3aed', textDecoration: 'none', fontWeight: 600, border: '1px solid #c4b5fd', borderRadius: 8, padding: '6px 14px' }}>
            🎯 Тренажер
          </a>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: isDirector ? '#4c1d95' : '#6366f1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}>
            {displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{displayName}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{isDirector ? 'Керівник' : 'Менеджер'}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{ marginLeft: 4, padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}
          >
            Вийти
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {isDirector
          ? <DirectorView />
          : <ManagerView managerName={managerName} />}
      </div>
    </div>
  )
}
