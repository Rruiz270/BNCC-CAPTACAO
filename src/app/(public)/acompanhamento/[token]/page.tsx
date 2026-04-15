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
        {/* Countdown to Censo */}
        {(() => {
          const censoDate = new Date('2026-05-27T23:59:59');
          const bnccDate = new Date('2026-08-31T23:59:59');
          const now = new Date();
          const censoDays = Math.max(0, Math.ceil((censoDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const bnccDays = Math.max(0, Math.ceil((bnccDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-2xl p-4 border ${censoDays <= 14 ? 'bg-red-500/20 border-red-500/40' : censoDays <= 30 ? 'bg-orange-500/20 border-orange-500/40' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/40">Censo Escolar 2026</div>
                    <div className="text-sm text-white/70 mt-0.5">Prazo para quick wins no Educacenso</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${censoDays <= 14 ? 'text-red-400' : censoDays <= 30 ? 'text-orange-400' : 'text-white'}`}>{censoDays}</div>
                    <div className="text-xs text-white/40">dias restantes</div>
                  </div>
                </div>
                <div className="text-xs text-white/30 mt-2">Data referencia: 27/05/2026</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/40">BNCC Computacao</div>
                    <div className="text-sm text-white/70 mt-0.5">Curriculo + CME + SIMEC para VAAR 2027</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#00B4D8]">{bnccDays}</div>
                    <div className="text-xs text-white/40">dias restantes</div>
                  </div>
                </div>
                <div className="text-xs text-white/30 mt-2">Prazo: Agosto 2026</div>
              </div>
            </div>
          );
        })()}

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

        {/* Upcoming tasks grouped by phase */}
        {(['curto', 'medio', 'longo'] as const).map(phase => {
          const phaseTasks = upcomingTasks.filter(t => t.phase === phase);
          if (phaseTasks.length === 0) return null;
          const phaseConfig = {
            curto: { label: 'Curto Prazo — Quick Wins (Censo 27/Mai)', color: 'orange', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
            medio: { label: 'Medio Prazo — BNCC Computacao (Agosto 2026)', color: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
            longo: { label: 'Longo Prazo — EC 135 e Expansao (2027+)', color: 'cyan', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
          }[phase];
          return (
            <div key={phase} className={`${phaseConfig.bg} rounded-2xl p-5 border ${phaseConfig.border}`}>
              <h2 className="text-sm font-semibold text-white/80 mb-4">{phaseConfig.label}</h2>
              <div className="space-y-2">
                {phaseTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <div className={`w-2 h-2 rounded-full ${t.status === 'progress' ? 'bg-[#00B4D8]' : 'bg-orange-400'}`}/>
                    <div className="flex-1">
                      <div className="text-sm text-white/80">{t.tarefa}</div>
                      {t.dueDate && <div className="text-xs text-white/40">Prazo: {t.dueDate}</div>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-lg ${t.status === 'progress' ? 'bg-[#00B4D8]/20 text-[#00B4D8]' : 'bg-orange-400/20 text-orange-400'}`}>
                      {t.status === 'progress' ? 'Em andamento' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  )
}
