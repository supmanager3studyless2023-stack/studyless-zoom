import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function periodStart(period: string): string | null {
  const now = new Date()
  switch (period) {
    case 'hour':  { const d = new Date(now); d.setHours(d.getHours() - 1); return d.toISOString() }
    case 'day':   { const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString() }
    case 'week':  { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString() }
    case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString() }
    default:      return null
  }
}

export async function GET(request: NextRequest) {
  try {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = request.nextUrl
  const period    = searchParams.get('period') ?? 'all'
  const manager   = searchParams.get('manager') ?? ''
  const touchType = searchParams.get('touchType') ?? ''

  let query = supabase
    .from('director_analyses')
    .select('id, manager_name, student_name, session_date, touch_type, overall_score, overall_comment, criteria, top_strengths, top_improvements, created_at')
    .order('created_at', { ascending: false })

  const since = periodStart(period)
  if (since) query = query.gte('created_at', since)
  if (manager)   query = query.eq('manager_name', manager)
  if (touchType) query = query.eq('touch_type', touchType)

  const { data: rows, error } = await query.limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const analyses = (rows ?? []) as any[]

  // All managers for dropdown (unfiltered)
  const { data: allManagersRows } = await supabase
    .from('director_analyses')
    .select('manager_name')
    .not('manager_name', 'is', null)
  const allManagers = [...new Set((allManagersRows ?? []).map((r: any) => r.manager_name as string).filter(Boolean))].sort()

  const total = analyses.length
  const avgScore = total ? +(analyses.reduce((s, r) => s + (r.overall_score ?? 0), 0) / total).toFixed(2) : 0

  // Manager ranking
  const managerMap: Record<string, { name: string; total: number; scoreSum: number }> = {}
  for (const r of analyses) {
    const n = r.manager_name || 'Невідомий'
    if (!managerMap[n]) managerMap[n] = { name: n, total: 0, scoreSum: 0 }
    managerMap[n].total++
    managerMap[n].scoreSum += r.overall_score ?? 0
  }
  const managerRanking = Object.values(managerMap)
    .map(m => ({ name: m.name, total: m.total, avgScore: +(m.scoreSum / m.total).toFixed(2) }))
    .sort((a, b) => b.avgScore - a.avgScore)

  // Criteria (block) averages
  const criteriaMap: Record<string, { title: string; scoreSum: number; count: number }> = {}
  for (const r of analyses) {
    for (const c of (r.criteria ?? [])) {
      if (!criteriaMap[c.id]) criteriaMap[c.id] = { title: c.title, scoreSum: 0, count: 0 }
      criteriaMap[c.id].scoreSum += c.score ?? 0
      criteriaMap[c.id].count++
    }
  }
  const criteriaAvg = Object.entries(criteriaMap)
    .map(([id, v]) => ({ id, title: v.title, avgScore: +(v.scoreSum / v.count).toFixed(2) }))
    .sort((a, b) => a.avgScore - b.avgScore)

  // Top improvements (typical errors by text frequency)
  const improvMap: Record<string, number> = {}
  for (const r of analyses) {
    for (const imp of (r.top_improvements ?? [])) {
      const key = String(imp).trim()
      if (key) improvMap[key] = (improvMap[key] ?? 0) + 1
    }
    // also collect block-level improve texts
    for (const c of (r.criteria ?? [])) {
      const key = String(c.improve ?? '').trim()
      if (key && key.length > 5) improvMap[key] = (improvMap[key] ?? 0) + 0.5
    }
  }
  const topImprovements = Object.entries(improvMap)
    .map(([text, count]) => ({ text, count: Math.round(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Top strengths
  const strengthMap: Record<string, number> = {}
  for (const r of analyses) {
    for (const s of (r.top_strengths ?? [])) {
      const key = String(s).trim()
      if (key) strengthMap[key] = (strengthMap[key] ?? 0) + 1
    }
  }
  const topStrengths = Object.entries(strengthMap)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Red calls (score < 6)
  const redCalls = analyses
    .filter(r => (r.overall_score ?? 10) < 6)
    .slice(0, 20)
    .map(r => ({
      id: r.id,
      managerName: r.manager_name,
      studentName: r.student_name,
      touchType: r.touch_type,
      overallScore: r.overall_score,
      overallComment: r.overall_comment,
      sessionDate: r.session_date,
      createdAt: r.created_at,
    }))

  // Score distribution by touch type
  const byTouchType: Record<string, { total: number; scoreSum: number }> = {}
  for (const r of analyses) {
    const t = r.touch_type || 'інше'
    if (!byTouchType[t]) byTouchType[t] = { total: 0, scoreSum: 0 }
    byTouchType[t].total++
    byTouchType[t].scoreSum += r.overall_score ?? 0
  }
  const touchTypeStats = Object.entries(byTouchType).map(([type, v]) => ({
    type,
    total: v.total,
    avgScore: +(v.scoreSum / v.total).toFixed(2),
  }))

  // Recent 20 analyses
  const recent = analyses.slice(0, 20).map(r => ({
    id: r.id,
    managerName: r.manager_name,
    studentName: r.student_name,
    touchType: r.touch_type,
    overallScore: r.overall_score,
    sessionDate: r.session_date,
    createdAt: r.created_at,
  }))

  return NextResponse.json({
    total,
    avgScore,
    allManagers,
    managerRanking,
    criteriaAvg,
    topImprovements,
    topStrengths,
    redCalls,
    touchTypeStats,
    recent,
  })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
