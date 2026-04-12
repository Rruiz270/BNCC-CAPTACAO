'use client'

import { useState, useEffect, use } from 'react'

interface DashboardData {
  municipio: string
  receitaTotal: number
  potTotal: number
  totalMatriculas: number
  compliance: { section: string; sectionName: string; total: number; done: number }[]
  actionPlans: { phase: string; tarefa: string; status: string; dueDate: string | null }[]
  financials: { ganhoPerda: number; vaar: number; vaat: number }
  historico: Record<string, number>
  lastUpdated: string
}

export default function AcompanhamentoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/acompanhamento/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Token invalido ou expirado')
        return r.json()
      })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const fmt = (v: number | null | undefined) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'R$ 0'

  if (loading) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="text-white/50 animate-pulse">Carregando dashboard...</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 text-lg font-semibold mb-2">Acesso Negado</div>
        <div className="text-white/50 text-sm">{error}</div>
      </div>
    </div>
  )

  if (!data) return null

  const totalCompItems = data.compliance.reduce((s, c) => s + c.total, 0)
  const totalCompDone = data.compliance.reduce((s, c) => s + c.done, 0)
  const compPct = totalCompItems > 0 ? Math.round((totalCompDone / totalCompItems) * 100) : 0

  const totalPlanItems = data.actionPlans.length
  const totalPlanDone = data.actionPlans.filter(a => a.status === 'done').length
  const planPct = totalPlanItems > 0 ? Math.round((totalPlanDone / totalPlanItems) * 100) : 0

  const upcomingTasks = data.actionPlans
    .filter(a => a.status !== 'done')
    .sort((a, b) => (a.dueDate || 'z').localeCompare(b.dueDate || 'z'))
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <header className="bg-[#0A2463] border-b border-white/10 py-6 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-[#00B4D8] text-xs font-bold tracking-widest uppercase mb-1">Instituto i10 - Acompanhamento</div>
          <h1 className="text-2xl font-bold">{data.municipio}</h1>
          <div className="text-white/40 text-xs mt-1">Dashboard de acompanhamento pos-consultoria FUNDEB | Atualizado: {data.lastUpdated}</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="text-xs text-white/40">Receita FUNDEB</div>
            <div className="text-xl font-bold">{fmt(data.receitaTotal)}</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="text-xs text-white/40">Potencial Captacao</div>
            <div className="text-xl font-bold text-[#00E5A0]">+{fmt(data.potTotal)}</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="text-xs text-white/40">Compliance</div>
            <div className="text-xl font-bold text-[#00B4D8]">{compPct}%</div>
            <div className="h-1.5 bg-white/10 rounded-full mt-2"><div className="h-full bg-[#00B4D8] rounded-full" style={{width:`${compPct}%`}}/></div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="text-xs text-white/40">Plano de Acao</div>
            <div className="text-xl font-bold text-[#48CAE4]">{planPct}%</div>
            <div className="h-1.5 bg-white/10 rounded-full mt-2"><div className="h-full bg-[#48CAE4] rounded-full" style={{width:`${planPct}%`}}/></div>
          </div>
        </div>

        {/* Compliance by section */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white/80 mb-4">Compliance por Secao</h2>
          <div className="space-y-3">
            {data.compliance.map(c => {
              const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0
              return (
                <div key={c.section}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white/70">{c.section}. {c.sectionName}</span>
                    <span className="text-sm font-semibold text-white">{c.done}/{c.total}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full">
                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-[#00E5A0]' : pct > 50 ? 'bg-[#00B4D8]' : 'bg-orange-400'}`} style={{width:`${pct}%`}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming tasks */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white/80 mb-4">Proximas Tarefas</h2>
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-4 text-white/30">Todas as tarefas concluidas!</div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <div className={`w-2 h-2 rounded-full ${t.status === 'progress' ? 'bg-[#00B4D8]' : 'bg-orange-400'}`}/>
                  <div className="flex-1">
                    <div className="text-sm text-white/80">{t.tarefa}</div>
                    <div className="text-xs text-white/40">{t.phase === 'curto' ? 'Quick Win' : t.phase === 'medio' ? 'Medio Prazo' : 'Longo Prazo'} {t.dueDate ? `| Prazo: ${t.dueDate}` : ''}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg ${t.status === 'progress' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'bg-orange-400/20 text-orange-400'}`}>
                    {t.status === 'progress' ? 'Em andamento' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
