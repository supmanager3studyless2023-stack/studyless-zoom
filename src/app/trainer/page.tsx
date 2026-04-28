'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const OBJECTIONS = ['подумаю', 'дорого', 'порадитись', 'немає часу', 'вже вчу в іншому місці']

const OBJECTION_LABEL: Record<string, string> = {
  'подумаю': '🤔 Подумаю',
  'дорого': '💸 Дорого',
  'порадитись': '👥 Порадитись',
  'немає часу': '⏰ Немає часу',
  'вже вчу в іншому місці': '🔄 Вже вчу деінде',
}

type Phase = 'setup' | 'chat' | 'score'
interface Msg { role: 'user' | 'assistant'; content: string }
interface Profile { name: string; level: string; goal: string; history: string; objection: string }
interface Block { id: string; title: string; done: boolean; score: number; comment: string; fix: string }
interface ScoreResult { overall_score: number; overall_comment: string; blocks: Block[]; top_mistakes: string[]; key_win: string }

function scoreColor(s: number) {
  return s >= 8 ? '#0d9488' : s >= 6 ? '#d97706' : '#ef4444'
}
function scoreBg(s: number) {
  return s >= 8 ? '#f0fdf4' : s >= 6 ? '#fffbeb' : '#fef2f2'
}
function scoreBorder(s: number) {
  return s >= 8 ? '#86efac' : s >= 6 ? '#fde68a' : '#fecaca'
}

export default function TrainerPage() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [profile, setProfile] = useState<Profile>({ name: '', level: 'B1', goal: '', history: '', objection: 'подумаю' })
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [voiceMode, setVoiceMode] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const speakText = useCallback((text: string) => {
    if (!voiceMode || typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'uk-UA'
    utt.rate = 0.95
    const voices = window.speechSynthesis.getVoices()
    const ukVoice = voices.find(v => v.lang.startsWith('uk')) ?? voices.find(v => v.lang.startsWith('ru')) ?? null
    if (ukVoice) utt.voice = ukVoice
    window.speechSynthesis.speak(utt)
  }, [voiceMode])

  const startChat = () => {
    setMessages([{ role: 'assistant', content: 'Алло?' }])
    setPhase('chat')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    const newMessages: Msg[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/trainer/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, profile }),
      })
      if (!res.body) return

      let assistantText = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: assistantText }
          return copy
        })
      }
      if (assistantText) speakText(assistantText)
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [messages, profile, streaming, speakText])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    recognitionRef.current = rec
    rec.lang = 'uk-UA'
    rec.continuous = false
    rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      if (text.trim()) sendMessage(text.trim())
    }
    rec.start()
  }, [sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const finishSession = async () => {
    if (messages.length < 3) return
    setScoring(true)
    try {
      const res = await fetch('/api/trainer/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, profile }),
      })
      const data = await res.json()
      setResult(data)
      setPhase('score')
    } finally {
      setScoring(false)
    }
  }

  const restart = () => {
    setPhase('setup')
    setMessages([])
    setResult(null)
    setInput('')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ background: '#1e293b', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/dashboard" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>← Дашборд</a>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>AI-тренажер · Продаж 3.0</span>
        {phase === 'chat' && (
          <>
            <span style={{ background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
              {OBJECTION_LABEL[profile.objection]}
            </span>
            <button onClick={() => { setVoiceMode(v => !v); window.speechSynthesis?.cancel() }}
              style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 20, border: '1px solid', borderColor: voiceMode ? '#6ee7b7' : '#475569', background: voiceMode ? 'rgba(16,185,129,0.15)' : 'transparent', color: voiceMode ? '#6ee7b7' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {voiceMode ? '🔊 Голос увімкнений' : '🔇 Увімкнути голос'}
            </button>
          </>
        )}
      </div>

      {/* SETUP */}
      {phase === 'setup' && (
        <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 20px' }}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '32px 36px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Налаштування студента</h2>
            <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>Claude зіграє роль студента з цим профілем</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Ім'я студента</span>
                <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="Наприклад: Марина"
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' }} />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Рівень</span>
                  <select value={profile.level} onChange={e => setProfile(p => ({ ...p, level: e.target.value }))}
                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Заперечення</span>
                  <select value={profile.objection} onChange={e => setProfile(p => ({ ...p, objection: e.target.value }))}
                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
                    {OBJECTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Ціль навчання</span>
                <input value={profile.goal} onChange={e => setProfile(p => ({ ...p, goal: e.target.value }))}
                  placeholder="Наприклад: говорити з колегами в міжнародній компанії"
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none' }} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Попередня історія <span style={{ color: '#9ca3af', fontWeight: 400 }}>(необов'язково)</span></span>
                <textarea value={profile.history} onChange={e => setProfile(p => ({ ...p, history: e.target.value }))}
                  placeholder="Що було на попередніх торканнях? Які досягнення/труднощі?"
                  rows={3}
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', outline: 'none' }} />
              </label>

              <button onClick={startChat}
                disabled={!profile.goal.trim()}
                style={{ marginTop: 8, padding: '12px', borderRadius: 10, border: 'none', background: profile.goal.trim() ? '#7c3aed' : '#e5e7eb', color: profile.goal.trim() ? '#fff' : '#9ca3af', fontWeight: 700, fontSize: 15, cursor: profile.goal.trim() ? 'pointer' : 'not-allowed' }}>
                Почати тренування →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT */}
      {phase === 'chat' && (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
          <div style={{ background: '#f1f5f9', borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#475569', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span><b>Студент:</b> {profile.name || 'Студент'}</span>
            <span><b>Рівень:</b> {profile.level}</span>
            <span><b>Ціль:</b> {profile.goal}</span>
            {profile.history && <span><b>Історія:</b> {profile.history}</span>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '72%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? '#6366f1' : '#fff',
                  color: m.role === 'user' ? '#fff' : '#1f2937',
                  border: m.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                  fontSize: 14, lineHeight: 1.55,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                }}>
                  {m.role === 'assistant' && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', marginBottom: 4 }}>
                      {profile.name || 'Студент'}
                    </div>
                  )}
                  {m.content || <span style={{ opacity: 0.4 }}>▋</span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            {voiceMode && (
              <div style={{ marginBottom: 10, textAlign: 'center' }}>
                <button onClick={startListening} disabled={streaming || listening}
                  style={{
                    width: 64, height: 64, borderRadius: '50%', border: 'none',
                    background: listening ? '#ef4444' : '#6366f1',
                    color: '#fff', fontSize: 26, cursor: streaming || listening ? 'not-allowed' : 'pointer',
                    boxShadow: listening ? '0 0 0 8px rgba(239,68,68,0.25)' : '0 2px 8px rgba(99,102,241,0.4)',
                    transition: 'all 0.2s',
                  }}>
                  {listening ? '⏹' : '🎙️'}
                </button>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                  {listening ? 'Слухаю...' : streaming ? 'Студент відповідає...' : 'Натисни і говори'}
                </div>
              </div>
            )}
            {!voiceMode && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                placeholder="Введіть повідомлення (Enter — надіслати, Shift+Enter — новий рядок)"
                rows={2}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, resize: 'none', outline: 'none' }}
              />
              <button onClick={() => sendMessage(input)} disabled={streaming || !input.trim()}
                style={{ padding: '0 20px', borderRadius: 10, border: 'none', background: streaming || !input.trim() ? '#e5e7eb' : '#6366f1', color: streaming || !input.trim() ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 14, cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer' }}>
                {streaming ? '...' : '↑'}
              </button>
            </div>
            )}
            <button onClick={finishSession} disabled={messages.length < 5 || scoring}
              style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: messages.length < 5 ? '#9ca3af' : '#374151', fontWeight: 600, fontSize: 14, cursor: messages.length < 5 ? 'not-allowed' : 'pointer' }}>
              {scoring ? 'Аналізую дзвінок...' : messages.length < 5 ? `Мінімум ${5 - messages.length} повідомлень для оцінки` : '📊 Завершити та отримати оцінку'}
            </button>
          </div>
        </div>
      )}

      {/* SCORE */}
      {phase === 'score' && result && (
        <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 16px 48px' }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: '28px 32px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 56, fontWeight: 800, color: scoreColor(result.overall_score), lineHeight: 1 }}>{result.overall_score}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>загальна оцінка</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{result.overall_comment}</div>
              {result.key_win && (
                <div style={{ fontSize: 13, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '8px 12px', color: '#6ee7b7' }}>
                  ✅ {result.key_win}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
            {result.blocks.map(b => (
              <div key={b.id} style={{ background: scoreBg(b.score), border: `1px solid ${scoreBorder(b.score)}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{b.title}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: scoreColor(b.score) }}>{b.done ? '✅' : '❌'} {b.score}/10</span>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{b.comment}</p>
                {b.fix && (
                  <div style={{ fontSize: 11, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '6px 10px', color: '#4f46e5', fontStyle: 'italic' }}>
                    💡 {b.fix}
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.top_mistakes?.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 12, fontSize: 15 }}>⚠️ Головні помилки</div>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.top_mistakes.map((m, i) => (
                  <li key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{m}</li>
                ))}
              </ol>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={startChat}
              style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              🔁 Повторити з тим самим студентом
            </button>
            <button onClick={restart}
              style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              ✏️ Новий студент
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
