'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'

const PERIODS = [
  { value: 'all',   label: 'Всі' },
  { value: 'month', label: 'Місяць' },
  { value: 'week',  label: 'Тиждень' },
  { value: 'day',   label: 'День' },
  { value: 'hour',  label: 'Година' },
]

const TOUCH_TYPES = ['', 'знайомство', '1т', '2т', '4т', '8т', '12т', 'продаж']
const TOUCH_LABELS: Record<string, string> = {
  '':           'Всі типи',
  'знайомство': 'Зум-знайомство',
  '1т': '1й тиждень', '2т': '2й тиждень', '4т': '4й тиждень',
  '8т': '8й тиждень', '12т': '12й тиждень', 'продаж': 'Продаж (15т)',
}

function scoreColor(s: number) {
  if (s >= 8) return '#0d9488'
  if (s >= 6) return '#d97706'
  return '#ef4444'
}
function scoreBg(s: number) {
  if (s >= 8) return '#f0fdf4'
  if (s >= 6) return '#fffbeb'
  return '#fef2f2'
}
function scoreBorder(s: number) {
  if (s >= 8) return '#99f6e4'
  if (s >= 6) return '#fde68a'
  return '#fecaca'
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span style={{
      background: scoreBg(score), color: scoreColor(score),
      border: `1px solid ${scoreBorder(score)}`,
      borderRadius: 8, padding: '2px 10px', fontWeight: 700, fontSize: 15,
    }}>
      {score}/10
    </span>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 14, marginTop: 0 }}>{children}</h2>
}

export default function DashboardPage() {
  const [period, setPeriod]       = useState('day')
  const [manager, setManager]     = useState('')
  const [touchType, setTouchType] = useState('')
  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<'errors' | 'strengths'>('errors')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryUrl, setSummaryUrl]         = useState<string | null>(null)
  const [summaryError, setSummaryError]     = useState('')
  const summaryRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({ period })
      if (manager)   params.set('manager', manager)
      if (touchType) params.set('touchType', touchType)
      const res = await fetch(`/api/dashboard?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json)
    } catch (e: any) {
      setLoadError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [period, manager, touchType])

  useEffect(() => { load() }, [load])

  const allManagers: string[] = data?.allManagers ?? []

  async function generateSummary() {
    setSummaryLoading(true)
    setSummaryUrl(null)
    setSummaryError('')
    try {
      const res = await fetch('/api/dashboard/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, manager, touchType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Помилка генерації')
      setSummaryUrl(json.url)
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e: any) {
      setSummaryError(e.message)
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/combined" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}>← Аналіз</a>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827', flex: 1 }}>Дашборд аналітики</h1>
        <a href="/trainer" style={{ fontSize: 13, color: '#7c3aed', textDecoration: 'none', fontWeight: 600, border: '1px solid #c4b5fd', borderRadius: 8, padding: '6px 14px' }}>🎯 Тренажер</a>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {/* Filters */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            {/* Period */}
            <div style={{ display: 'flex', gap: 6 }}>
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: '1px solid',
                    borderColor: period === p.value ? '#6366f1' : '#d1d5db',
                    background: period === p.value ? '#6366f1' : '#fff',
                    color: period === p.value ? '#fff' : '#374151',
                    fontWeight: period === p.value ? 700 : 400,
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Manager */}
            <select
              value={manager}
              onChange={e => setManager(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: '#374151', background: '#fff' }}
            >
              <option value="">Всі менеджери</option>
              {allManagers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {/* Touch type */}
            <select
              value={touchType}
              onChange={e => setTouchType(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: '#374151', background: '#fff' }}
            >
              {TOUCH_TYPES.map(t => <option key={t} value={t}>{TOUCH_LABELS[t]}</option>)}
            </select>
          </div>
        </Card>

        {/* Summary generation */}
        <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #c4b5fd' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#4c1d95', fontSize: 15, marginBottom: 3 }}>
                Підсумковий AI-звіт
              </div>
              <div style={{ fontSize: 13, color: '#6d28d9' }}>
                Проаналізує всі дзвінки {PERIODS.find(p => p.value === period)?.label.toLowerCase() === 'всі' ? 'за весь час' : `за ${PERIODS.find(p => p.value === period)?.label.toLowerCase()}`}
                {manager ? ` · ${manager}` : ''}
                {touchType ? ` · ${TOUCH_LABELS[touchType]}` : ''}
                {data?.total ? ` · ${data.total} дзвінків` : ''}
                {' '}— сформує причини продажів, типові помилки та рекомендації
              </div>
            </div>
            <button
              onClick={generateSummary}
              disabled={summaryLoading || !data?.total}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: summaryLoading ? '#a78bfa' : '#7c3aed',
                color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: summaryLoading || !data?.total ? 'not-allowed' : 'pointer',
                opacity: !data?.total ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
              }}
            >
              {summaryLoading ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Генерую звіт...
                </>
              ) : 'Сформувати підсумок'}
            </button>
          </div>

          {summaryError && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', fontSize: 13 }}>
              {summaryError}
            </div>
          )}

          {summaryUrl && (
            <div ref={summaryRef} style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, background: '#fff', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#4c1d95', fontSize: 14, marginBottom: 2 }}>Звіт готовий</div>
                <div style={{ fontSize: 12, color: '#7c3aed' }}>Збережено в Google Sheets · вкладка Feedbacks</div>
              </div>
              <a
                href={summaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '9px 20px', borderRadius: 8, background: '#7c3aed',
                  color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                Завантажити ZIP →
              </a>
            </div>
          )}
        </Card>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

        {loadError && (
          <div style={{ padding: '16px 20px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', fontSize: 14, marginBottom: 16 }}>
            Помилка завантаження: {loadError}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 15 }}>Завантаження...</div>
        )}

        {!loading && data && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <Card>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Всього аналізів</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>{data.total}</div>
              </Card>
              <Card>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Середня оцінка</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: scoreColor(data.avgScore) }}>{data.avgScore}</div>
              </Card>
              <Card>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Тривожні дзвінки (&lt;6)</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: data.redCalls?.length > 0 ? '#ef4444' : '#111827' }}>
                  {data.redCalls?.length ?? 0}
                </div>
              </Card>
              <Card>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Менеджерів</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>{data.managerRanking?.length ?? 0}</div>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* Manager ranking */}
              <Card>
                <SectionTitle>Рейтинг менеджерів</SectionTitle>
                {data.managerRanking?.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.managerRanking?.map((m: any, i: number) => (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#374151', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 14, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 8 }}>{m.total} аналізів</span>
                      <ScoreBadge score={m.avgScore} />
                    </div>
                  ))}
                </div>
              </Card>

              {/* By touch type */}
              <Card>
                <SectionTitle>По типах торкань</SectionTitle>
                {data.touchTypeStats?.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.touchTypeStats?.sort((a: any, b: any) => b.total - a.total).map((t: any) => (
                    <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>{TOUCH_LABELS[t.type] ?? t.type}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 8 }}>{t.total}</span>
                      <ScoreBadge score={t.avgScore} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Block heatmap */}
            {data.criteriaAvg?.length > 0 && (
              <Card style={{ marginBottom: 20 }}>
                <SectionTitle>Середні оцінки по блоках</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {data.criteriaAvg?.map((c: any) => (
                    <div key={c.id} style={{
                      borderRadius: 10, padding: '12px 14px',
                      background: scoreBg(c.avgScore), border: `1px solid ${scoreBorder(c.avgScore)}`,
                    }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{c.title}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(c.avgScore) }}>{c.avgScore}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Typical errors / strengths */}
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {(['errors', 'strengths'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: '6px 16px', borderRadius: 8, border: '1px solid',
                    borderColor: activeTab === tab ? (tab === 'errors' ? '#ef4444' : '#0d9488') : '#d1d5db',
                    background: activeTab === tab ? (tab === 'errors' ? '#fef2f2' : '#f0fdf4') : '#fff',
                    color: activeTab === tab ? (tab === 'errors' ? '#ef4444' : '#0d9488') : '#374151',
                    fontWeight: activeTab === tab ? 700 : 400, cursor: 'pointer', fontSize: 13,
                  }}>
                    {tab === 'errors' ? '⚠️ Типові помилки' : '✅ Типові сильні сторони'}
                  </button>
                ))}
              </div>

              {activeTab === 'errors' && (
                <>
                  <SectionTitle>Найчастіші зони для покращення</SectionTitle>
                  {data.topImprovements?.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.topImprovements?.map((imp: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{imp.count}x</span>
                        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{imp.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'strengths' && (
                <>
                  <SectionTitle>Найчастіші сильні сторони</SectionTitle>
                  {data.topStrengths?.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.topStrengths?.map((s: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #99f6e4' }}>
                        <span style={{ background: '#0d9488', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{s.count}x</span>
                        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* Red calls */}
            {data.redCalls?.length > 0 && (
              <Card style={{ marginBottom: 20 }}>
                <SectionTitle>🔴 Тривожні дзвінки (оцінка &lt; 6)</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.redCalls.map((r: any) => (
                    <div key={r.id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <ScoreBadge score={r.overallScore} />
                        <span style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{r.managerName || '—'}</span>
                        <span style={{ color: '#9ca3af', fontSize: 13 }}>→ {r.studentName || '—'}</span>
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>{TOUCH_LABELS[r.touchType] ?? r.touchType}</span>
                        <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 'auto' }}>
                          {r.sessionDate || new Date(r.createdAt).toLocaleDateString('uk-UA')}
                        </span>
                      </div>
                      {r.overallComment && (
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{r.overallComment}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent analyses */}
            <Card>
              <SectionTitle>Останні аналізи</SectionTitle>
              {data.recent?.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      {['Менеджер', 'Студент', 'Тип', 'Оцінка', 'Дата'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent?.map((r: any, i: number) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                        <td style={{ padding: '9px 12px', color: '#374151' }}>{r.managerName || '—'}</td>
                        <td style={{ padding: '9px 12px', color: '#374151' }}>{r.studentName || '—'}</td>
                        <td style={{ padding: '9px 12px', color: '#6b7280' }}>{(TOUCH_LABELS[r.touchType] ?? r.touchType) || '—'}</td>
                        <td style={{ padding: '9px 12px' }}><ScoreBadge score={r.overallScore} /></td>
                        <td style={{ padding: '9px 12px', color: '#9ca3af' }}>
                          {r.sessionDate || new Date(r.createdAt).toLocaleDateString('uk-UA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {!loading && data && data.total === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 15 }}>
            Аналізів за вибраний період не знайдено
          </div>
        )}
      </div>
    </div>
  )
}
