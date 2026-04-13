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
  { key: 't1', label: 'T1 - Categorias Zeradas', desc: 'Ativar categorias sem matriculas', color: '#ef4444' },
  { key: 't2', label: 'T2 - Reclassificacao Integral', desc: 'Converter parcial para integral', color: '#f59e0b' },
  { key: 't3', label: 'T3 - AEE/Ed. Especial', desc: 'Captar dupla matricula e especial', color: '#8b5cf6' },
  { key: 't4', label: 'T4 - Campo/Indigena', desc: 'Multiplicadores localizacao diferenciada', color: '#22c55e' },
  { key: 't5', label: 'T5 - VAAR/VAAT', desc: 'Otimizar complementacoes', color: '#3b82f6' },
  { key: 't6', label: 'T6 - EC 135 Integral', desc: 'Expansao escola integral obrigatoria', color: '#06b6d4' },
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

  const histYears = data ? ['2022', '2023', '2024', '2025', '2026'] : []
  const histValues = data ? histYears.map(y => data.historico?.[y] || 0) : []
  const maxHist = Math.max(...histValues, 1)
  const receitaAtual = data?.financials?.receitaTotal || 0
  const receitaOtimizada = receitaAtual + totalPotencial

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text1)]">Projecao Financeira FUNDEB</h1>
        <p className="text-[var(--text3)] text-sm mt-1">
          Visao consolidada: receita atual vs. cenario otimizado com detalhamento por tier de potencial (T1-T6)
        </p>
      </div>

      {/* Municipality picker */}
      <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text2)] mb-3">Municipio</h2>
        {!selectedId ? (
          <div>
            <input
              type="text"
              placeholder="Buscar municipio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg)] text-[var(--text1)] border border-[var(--border)] placeholder-[var(--text3)] outline-none focus:border-[#00B4D8] text-sm"
            />
            {filtered.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-white border border-[var(--border)]">
                {filtered.map(m => (
                  <button key={m.id} onClick={() => { setSelectedId(m.id); setSearch(''); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text2)] hover:bg-[#00B4D8]/10 hover:text-[#0A2463] transition-colors"
                  >{m.nome}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-[#00B4D8]/10 text-[#0A2463] font-semibold text-sm">{data?.nome || '...'}</div>
            <button onClick={() => { setSelectedId(null); setData(null); setSearch(''); }}
              className="px-3 py-2 rounded-xl bg-[var(--bg)] text-[var(--text3)] hover:text-[var(--text1)] text-sm border border-[var(--border)]">Trocar</button>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-8 text-[var(--text3)]">Carregando...</div>}

      {data && !loading && (
        <>
          {/* Big numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
              <div className="text-xs text-[var(--text3)] mb-1">Receita Atual FUNDEB</div>
              <div className="text-2xl font-bold text-[var(--text1)]">{fmt(receitaAtual)}</div>
              <div className="text-xs text-[var(--text3)] mt-1">{fmtN(data.enrollmentSummary?.totalMatriculas || 0)} matriculas</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-5 border border-emerald-200">
              <div className="text-xs text-emerald-600 mb-1">Potencial de Captacao</div>
              <div className="text-2xl font-bold text-emerald-700">+{fmt(totalPotencial)}</div>
              <div className="text-xs text-emerald-500 mt-1">
                +{data.potencial?.pctPotTotal ? pct(data.potencial.pctPotTotal) : pct(receitaAtual > 0 ? (totalPotencial / receitaAtual) * 100 : 0)} sobre receita atual
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-xl p-5 border border-cyan-200">
              <div className="text-xs text-cyan-600 mb-1">Receita Otimizada</div>
              <div className="text-2xl font-bold text-cyan-700">{fmt(receitaOtimizada)}</div>
              <div className="text-xs text-cyan-500 mt-1">Cenario com todas as otimizacoes aplicadas</div>
            </div>
          </div>

          {/* T1-T6 Breakdown */}
          <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text1)] mb-4">Potencial por Tier (T1-T6)</h2>
            <div className="space-y-3">
              {tiers.map((tier, i) => (
                <div key={tier.key} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: tier.color }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-semibold text-[var(--text1)]">{tier.label}</span>
                        <span className="text-xs text-[var(--text3)] ml-2">{tier.desc}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums" style={{ color: tier.color }}>{fmt(tier.value)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
              <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200">
                <div className="text-xs font-semibold text-red-700 mb-1">Categorias Nao Captadas ({data.potencial?.nFaltantes || 0})</div>
                <div className="text-xs text-red-600">{data.cats_faltantes}</div>
              </div>
            )}
            {data.estrategias_resumo && (
              <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Estrategias Identificadas ({data.n_estrategias || 0})</div>
                <div className="text-xs text-emerald-600">{data.estrategias_resumo}</div>
              </div>
            )}
          </div>

          {/* Historical Evolution */}
          <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text1)] mb-4">Evolucao Historica FUNDEB</h2>
            <div className="flex items-end gap-2 h-48">
              {histYears.map((year, i) => {
                const val = histValues[i]
                const h = maxHist > 0 ? (val / maxHist) * 100 : 0
                return (
                  <div key={year} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-[var(--text3)] tabular-nums">{fmt(val)}</div>
                    <div className="w-full rounded-t-lg transition-all" style={{
                      height: `${Math.max(h, 5)}%`,
                      background: year === '2026' ? '#00B4D8' : '#e5e7eb',
                    }} />
                    <div className="text-xs text-[var(--text3)]">{year}</div>
                  </div>
                )
              })}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-emerald-600 tabular-nums">{fmt(receitaOtimizada)}</div>
                <div className="w-full rounded-t-lg border-2 border-dashed border-emerald-400" style={{
                  height: `${Math.max((receitaOtimizada / maxHist) * 100, 5)}%`,
                  background: '#d1fae520',
                }} />
                <div className="text-xs text-emerald-600 font-semibold">Otimizado</div>
              </div>
            </div>
            {data.crescimento_4anos != null && (
              <div className="mt-3 text-xs text-[var(--text3)]">
                Crescimento nos ultimos 4 anos: <span className="text-[var(--text1)] font-semibold">{data.crescimento_4anos.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* Quick indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-3 border border-[var(--border)] text-center">
              <div className="text-xs text-[var(--text3)]">VAAR</div>
              <div className={`text-lg font-bold ${data.recebe_vaar ? 'text-emerald-600' : 'text-red-500'}`}>
                {data.recebe_vaar ? 'Recebe' : 'Nao Recebe'}
              </div>
              <div className="text-xs text-[var(--text3)]">{fmt(data.financials?.vaar)}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[var(--border)] text-center">
              <div className="text-xs text-[var(--text3)]">VAAT</div>
              <div className={`text-lg font-bold ${data.recebe_vaat ? 'text-emerald-600' : 'text-amber-500'}`}>
                {data.recebe_vaat ? 'Recebe' : 'Nao Recebe'}
              </div>
              <div className="text-xs text-[var(--text3)]">{fmt(data.financials?.vaat)}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[var(--border)] text-center">
              <div className="text-xs text-[var(--text3)]">Quick-Win Score</div>
              <div className="text-lg font-bold text-[#00B4D8]">{data.quick_win_score?.toFixed(1) || '-'}</div>
              <div className="text-xs text-[var(--text3)]">Facilidade de captacao</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[var(--border)] text-center">
              <div className="text-xs text-[var(--text3)]">Ganho/Perda</div>
              <div className={`text-lg font-bold ${(data.financials?.ganhoPerda || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {fmt(data.financials?.ganhoPerda)}
              </div>
              <div className="text-xs text-[var(--text3)]">Saldo FUNDEB atual</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
