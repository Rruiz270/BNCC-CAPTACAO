'use client'

import { useState, useEffect } from 'react'

interface Municipality {
  id: number
  nome: string
}

interface MuniDetail {
  id: number
  nome: string
  financials: {
    receitaTotal: number
    contribuicao: number
    recursosReceber: number
    vaat: number
    vaar: number
    ganhoPerda: number
  }
  historico: Record<string, number>
  potencial: {
    potTotal: number
    pctPotTotal: number
    nFaltantes: number
  }
  enrollmentSummary: {
    totalMatriculas: number
    categoriasAtivas: number
  }
  // T1-T6 fields (may be null if not synced)
  pot_t1?: number
  pot_t2?: number
  pot_t3?: number
  pot_t4?: number
  pot_t5_vaar?: number
  pot_t5_vaat?: number
  pot_t6?: number
  estrategias_resumo?: string
  n_estrategias?: number
  crescimento_4anos?: number
  recebe_vaar?: boolean
  recebe_vaat?: boolean
  quick_win_score?: number
  cats_faltantes?: string
}

const TIER_INFO = [
  { key: 't1', label: 'T1 - Categorias Zeradas', desc: 'Ativar categorias sem matriculas', color: '#ef4444', icon: '!' },
  { key: 't2', label: 'T2 - Reclassificacao Integral', desc: 'Converter parcial para integral', color: '#f59e0b', icon: '\u2191' },
  { key: 't3', label: 'T3 - AEE/Ed. Especial', desc: 'Captar dupla matricula e especial', color: '#8b5cf6', icon: '\u267f' },
  { key: 't4', label: 'T4 - Campo/Indigena', desc: 'Multiplicadores localizacao diferenciada', color: '#22c55e', icon: '\U0001f33e' },
  { key: 't5', label: 'T5 - VAAR/VAAT', desc: 'Otimizar complementacoes', color: '#3b82f6', icon: '$' },
  { key: 't6', label: 'T6 - EC 135 Integral', desc: 'Expansao escola integral obrigatoria', color: '#06b6d4', icon: '\U0001f3eb' },
]

export default function ProjecaoFinanceira() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [data, setData] = useState<MuniDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/municipalities?limit=645&sort=nome')
      .then(r => r.json())
      .then(d => setMunicipalities(d.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    fetch(`/api/municipalities/${selectedId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedId])

  const filtered = search.length > 1
    ? municipalities.filter(m => m.nome.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : []

  const fmt = (v: number | null | undefined) => {
    if (v == null) return 'R$ 0'
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  const fmtN = (v: number) => v.toLocaleString('pt-BR')
  const pct = (v: number | null | undefined) => v != null ? `${v.toFixed(1)}%` : '-'

  // T1-T6 values
  const tiers = data ? [
    { ...TIER_INFO[0], value: data.pot_t1 || 0 },
    { ...TIER_INFO[1], value: data.pot_t2 || 0 },
    { ...TIER_INFO[2], value: data.pot_t3 || 0 },
    { ...TIER_INFO[3], value: data.pot_t4 || 0 },
    { ...TIER_INFO[4], value: (data.pot_t5_vaar || 0) + (data.pot_t5_vaat || 0) },
    { ...TIER_INFO[5], value: data.pot_t6 || 0 },
  ] : []

  const totalPotencial = tiers.reduce((s, t) => s + t.value, 0)
  const maxTier = Math.max(...tiers.map(t => t.value), 1)

  // Historical data for chart
  const histYears = data ? ['2022', '2023', '2024', '2025', '2026'] : []
  const histValues = data ? histYears.map(y => data.historico?.[y] || 0) : []
  const maxHist = Math.max(...histValues, 1)
  const receitaAtual = data?.financials?.receitaTotal || 0
  const receitaOtimizada = receitaAtual + totalPotencial

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Projecao Financeira FUNDEB</h1>
        <p className="text-white/50 text-sm mt-1">
          Visao consolidada: receita atual vs. cenario otimizado com detalhamento por tier de potencial (T1-T6)
        </p>
      </div>

      {/* Municipality picker */}
      <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
        <h2 className="text-sm font-semibold text-white/80 mb-3">Municipio</h2>
        {!selectedId ? (
          <div>
            <input
              type="text"
              placeholder="Buscar municipio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 placeholder-white/40 outline-none focus:border-[#00B4D8] text-sm"
            />
            {filtered.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-white/5 border border-white/10">
                {filtered.map(m => (
                  <button key={m.id} onClick={() => { setSelectedId(m.id); setSearch(''); }}
                    className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-[#00B4D8]/20 hover:text-white transition-colors"
                  >{m.nome}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-[#00B4D8]/20 text-white font-semibold text-sm">{data?.nome || '...'}</div>
            <button onClick={() => { setSelectedId(null); setData(null); setSearch(''); }}
              className="px-3 py-2 rounded-xl bg-white/10 text-white/60 hover:text-white text-sm">Trocar</button>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-8 text-white/50">Carregando...</div>}

      {data && !loading && (
        <>
          {/* Big numbers: Current vs Optimized */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="text-xs text-white/40 mb-1">Receita Atual FUNDEB</div>
              <div className="text-2xl font-bold text-white">{fmt(receitaAtual)}</div>
              <div className="text-xs text-white/30 mt-1">{fmtN(data.enrollmentSummary?.totalMatriculas || 0)} matriculas</div>
            </div>
            <div className="bg-gradient-to-br from-[#00E5A0]/20 to-[#00E5A0]/5 rounded-2xl p-5 border border-[#00E5A0]/20">
              <div className="text-xs text-[#00E5A0]/60 mb-1">Potencial de Captacao</div>
              <div className="text-2xl font-bold text-[#00E5A0]">+{fmt(totalPotencial)}</div>
              <div className="text-xs text-[#00E5A0]/40 mt-1">
                +{data.potencial?.pctPotTotal ? pct(data.potencial.pctPotTotal) : pct(receitaAtual > 0 ? (totalPotencial / receitaAtual) * 100 : 0)} sobre receita atual
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#00B4D8]/20 to-[#00B4D8]/5 rounded-2xl p-5 border border-[#00B4D8]/20">
              <div className="text-xs text-[#00B4D8]/60 mb-1">Receita Otimizada</div>
              <div className="text-2xl font-bold text-[#00B4D8]">{fmt(receitaOtimizada)}</div>
              <div className="text-xs text-[#00B4D8]/40 mt-1">Cenario com todas as otimizacoes aplicadas</div>
            </div>
          </div>

          {/* T1-T6 Breakdown */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h2 className="text-sm font-semibold text-white/80 mb-4">Potencial por Tier (T1-T6)</h2>
            <div className="space-y-3">
              {tiers.map(tier => (
                <div key={tier.key} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: tier.color + '30', color: tier.color }}>
                    {tier.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-semibold text-white">{tier.label}</span>
                        <span className="text-xs text-white/40 ml-2">{tier.desc}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums" style={{ color: tier.color }}>{fmt(tier.value)}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max((tier.value / maxTier) * 100, 2)}%`, background: tier.color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.cats_faltantes && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <div className="text-xs font-semibold text-red-400 mb-1">Categorias Nao Captadas ({data.potencial?.nFaltantes || 0})</div>
                <div className="text-xs text-red-300/80">{data.cats_faltantes}</div>
              </div>
            )}
            {data.estrategias_resumo && (
              <div className="mt-3 p-3 bg-[#00E5A0]/10 rounded-xl border border-[#00E5A0]/20">
                <div className="text-xs font-semibold text-[#00E5A0] mb-1">Estrategias Identificadas ({data.n_estrategias || 0})</div>
                <div className="text-xs text-[#00E5A0]/80">{data.estrategias_resumo}</div>
              </div>
            )}
          </div>

          {/* Historical Evolution */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h2 className="text-sm font-semibold text-white/80 mb-4">Evolucao Historica FUNDEB</h2>
            <div className="flex items-end gap-2 h-48">
              {histYears.map((year, i) => {
                const val = histValues[i]
                const h = maxHist > 0 ? (val / maxHist) * 100 : 0
                return (
                  <div key={year} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-white/60 tabular-nums">{fmt(val)}</div>
                    <div className="w-full rounded-t-lg transition-all" style={{
                      height: `${Math.max(h, 5)}%`,
                      background: year === '2026' ? '#00B4D8' : '#ffffff20',
                    }} />
                    <div className="text-xs text-white/50">{year}</div>
                  </div>
                )
              })}
              {/* Projected bar */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-[#00E5A0] tabular-nums">{fmt(receitaOtimizada)}</div>
                <div className="w-full rounded-t-lg border-2 border-dashed border-[#00E5A0]/40" style={{
                  height: `${Math.max((receitaOtimizada / maxHist) * 100, 5)}%`,
                  background: '#00E5A020',
                }} />
                <div className="text-xs text-[#00E5A0]">Otimizado</div>
              </div>
            </div>
            {data.crescimento_4anos != null && (
              <div className="mt-3 text-xs text-white/40">
                Crescimento nos ultimos 4 anos: <span className="text-white/70 font-semibold">{data.crescimento_4anos.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* Quick indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
              <div className="text-xs text-white/40">VAAR</div>
              <div className={`text-lg font-bold ${data.recebe_vaar ? 'text-[#00E5A0]' : 'text-red-400'}`}>
                {data.recebe_vaar ? 'Recebe' : 'Nao Recebe'}
              </div>
              <div className="text-xs text-white/30">{fmt(data.financials?.vaar)}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
              <div className="text-xs text-white/40">VAAT</div>
              <div className={`text-lg font-bold ${data.recebe_vaat ? 'text-[#00E5A0]' : 'text-yellow-400'}`}>
                {data.recebe_vaat ? 'Recebe' : 'Nao Recebe'}
              </div>
              <div className="text-xs text-white/30">{fmt(data.financials?.vaat)}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
              <div className="text-xs text-white/40">Quick-Win Score</div>
              <div className="text-lg font-bold text-[#00B4D8]">{data.quick_win_score?.toFixed(1) || '-'}</div>
              <div className="text-xs text-white/30">Facilidade de captacao</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
              <div className="text-xs text-white/40">Ganho/Perda</div>
              <div className={`text-lg font-bold ${(data.financials?.ganhoPerda || 0) >= 0 ? 'text-[#00E5A0]' : 'text-red-400'}`}>
                {fmt(data.financials?.ganhoPerda)}
              </div>
              <div className="text-xs text-white/30">Saldo FUNDEB atual</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
