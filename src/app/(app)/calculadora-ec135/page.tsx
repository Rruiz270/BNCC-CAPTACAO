'use client'

import { useState, useEffect } from 'react'
import { useConsultoria } from '@/lib/consultoria-context'

interface Municipality {
  id: number
  nome: string
}

interface MuniData {
  id: number
  nome: string
  enrollmentSummary: {
    totalMatriculas: number
    eiMat: number
    efMat: number
  }
  financials: {
    receitaTotal: number
    vaat: number
    vaar: number
  }
  potencial: {
    potTotal: number
    pctPotTotal: number
  }
  schools: {
    total: number
    municipais: number | null
  }
  // T6 specific data from municipalities table
  t6_pct_integral?: number
  t6_mat_integral?: number
}

const VAAF_BASE = 5963
const FATOR_INTEGRAL = 1.50
const VALOR_INTEGRAL = VAAF_BASE * FATOR_INTEGRAL // ~8944
const FATOR_PARCIAL = 1.00
const VALOR_PARCIAL = VAAF_BASE * FATOR_PARCIAL // ~5963
const GANHO_POR_CONVERSAO = VALOR_INTEGRAL - VALOR_PARCIAL // ~2981
const CUSTO_INFRA_POR_VAGA = 3500 // estimated infrastructure cost per integral slot

export default function CalculadoraEC135() {
  const { activeSession } = useConsultoria()
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [muniData, setMuniData] = useState<MuniData | null>(null)
  const [loading, setLoading] = useState(false)

  // Custom inputs
  const [matTotal, setMatTotal] = useState(0)
  const [matIntegral, setMatIntegral] = useState(0)
  const [metaPct, setMetaPct] = useState(4) // EC 135 default 4%
  const [custoVaga, setCustoVaga] = useState(CUSTO_INFRA_POR_VAGA)

  useEffect(() => {
    fetch('/api/municipalities?limit=645&sort=nome')
      .then(r => r.json())
      .then(d => setMunicipalities(d.data || []))
      .catch(() => {})
  }, [])

  // Auto-populate from active consultoria
  useEffect(() => {
    const activeMuniId = activeSession?.municipality?.id
    if (activeMuniId && !selectedId) {
      setSelectedId(activeMuniId)
    }
  }, [activeSession, selectedId])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    fetch(`/api/municipalities/${selectedId}`)
      .then(r => r.json())
      .then((d: MuniData) => {
        setMuniData(d)
        setMatTotal(d.enrollmentSummary?.totalMatriculas || 0)
        // Try to get integral count from cats or t6
        const integralCats = ['creche_integral', 'pre_escola_integral', 'ens__fund__integral']
        let integralCount = 0
        if (d.t6_mat_integral) {
          integralCount = d.t6_mat_integral
        } else if (d.enrollmentSummary?.eiMat) {
          // Rough estimate: EI is mostly integral in SP
          integralCount = Math.round((d.enrollmentSummary.eiMat || 0) * 0.6)
        }
        setMatIntegral(integralCount)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedId])

  const filtered = search.length > 1
    ? municipalities.filter(m => m.nome.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : []

  const pctAtual = matTotal > 0 ? (matIntegral / matTotal) * 100 : 0
  const metaAnual = Math.ceil(matTotal * (metaPct / 100))

  // 5-year projection
  const projections = []
  let acumIntegral = matIntegral
  for (let ano = 2026; ano <= 2030; ano++) {
    const novasVagas = metaAnual
    acumIntegral += novasVagas
    const pctIntegral = matTotal > 0 ? (acumIntegral / matTotal) * 100 : 0
    const ganhoFundeb = novasVagas * GANHO_POR_CONVERSAO
    const ganhoAcumulado = (acumIntegral - matIntegral) * GANHO_POR_CONVERSAO
    const custoTotal = novasVagas * custoVaga
    const escolasConverter = Math.ceil(novasVagas / 200) // ~200 alunos por escola
    projections.push({
      ano,
      novasVagas,
      acumIntegral,
      pctIntegral,
      ganhoFundeb,
      ganhoAcumulado,
      custoTotal,
      escolasConverter,
      roi: custoTotal > 0 ? ganhoFundeb / custoTotal : 0,
    })
  }

  const totalGanho5anos = projections.reduce((s, p) => s + p.ganhoFundeb, 0)
  const totalCusto5anos = projections.reduce((s, p) => s + p.custoTotal, 0)

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const fmtN = (v: number) => v.toLocaleString('pt-BR')

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text1)]">Calculadora EC 135/2025</h1>
        <p className="text-[var(--text3)] text-sm mt-1">
          Emenda Constitucional 135 exige 4% de novas vagas em escola integral por ano. Calcule o impacto financeiro FUNDEB.
        </p>
      </div>

      {/* Municipality picker */}
      <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text2)] mb-3">Selecionar Municipio</h2>
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
                  <button
                    key={m.id}
                    onClick={() => { setSelectedId(m.id); setSearch(''); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text2)] hover:bg-[#00B4D8]/10 hover:text-[#0A2463] transition-colors"
                  >
                    {m.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-[#00B4D8]/10 text-[#0A2463] font-semibold text-sm">
              {muniData?.nome || `Municipio #${selectedId}`}
            </div>
            <button
              onClick={() => { setSelectedId(null); setMuniData(null); setSearch(''); }}
              className="px-3 py-2 rounded-xl bg-[var(--bg)] text-[var(--text3)] hover:text-[var(--text1)] text-sm border border-[var(--border)]"
            >
              Trocar
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-[var(--text3)]">Carregando dados...</div>
      )}

      {muniData && !loading && (
        <>
          {/* Current state */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text3)] mb-1">Total Matriculas</div>
              <div className="text-xl font-bold text-[var(--text1)]">{fmtN(matTotal)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text3)] mb-1">Matriculas Integral</div>
              <div className="text-xl font-bold text-[#00B4D8]">{fmtN(matIntegral)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text3)] mb-1">% Integral Atual</div>
              <div className="text-xl font-bold text-[var(--text1)]">{pctAtual.toFixed(1)}%</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--text3)] mb-1">Escolas Municipais</div>
              <div className="text-xl font-bold text-[var(--text1)]">{muniData.schools?.municipais || muniData.schools?.total || '-'}</div>
            </div>
          </div>

          {/* Adjustable parameters */}
          <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text1)] mb-4">Parametros da Simulacao</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-[var(--text3)] mb-1">Total Matriculas</label>
                <input
                  type="number"
                  value={matTotal}
                  onChange={e => setMatTotal(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] text-[var(--text1)] border border-[var(--border)] text-sm outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text3)] mb-1">Matriculas Integral Atuais</label>
                <input
                  type="number"
                  value={matIntegral}
                  onChange={e => setMatIntegral(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] text-[var(--text1)] border border-[var(--border)] text-sm outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text3)] mb-1">Meta % Novas Vagas/Ano</label>
                <input
                  type="number"
                  value={metaPct}
                  onChange={e => setMetaPct(parseFloat(e.target.value) || 4)}
                  step="0.5"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] text-[var(--text1)] border border-[var(--border)] text-sm outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text3)] mb-1">Custo Infra/Vaga (R$)</label>
                <input
                  type="number"
                  value={custoVaga}
                  onChange={e => setCustoVaga(parseInt(e.target.value) || 3500)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] text-[var(--text1)] border border-[var(--border)] text-sm outline-none focus:border-[#00B4D8]"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-[var(--text3)]">
              Meta EC 135: {metaPct}% = {fmtN(metaAnual)} novas vagas integrais por ano | Ganho FUNDEB por conversao: {fmt(GANHO_POR_CONVERSAO)}/aluno
            </div>
          </div>

          {/* Projection table */}
          <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text1)] mb-4">Projecao 2026-2030</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium">Ano</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">Novas Vagas</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">Total Integral</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">% Integral</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">Ganho FUNDEB/Ano</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">Ganho Acumulado</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">Custo Infra</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">Escolas</th>
                    <th className="py-2 px-3 text-xs text-[var(--text3)] font-medium text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map(p => (
                    <tr key={p.ano} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-semibold text-[var(--text1)]">{p.ano}</td>
                      <td className="py-2.5 px-3 text-right text-[var(--text2)]">{fmtN(p.novasVagas)}</td>
                      <td className="py-2.5 px-3 text-right text-[#00B4D8] font-semibold">{fmtN(p.acumIntegral)}</td>
                      <td className="py-2.5 px-3 text-right text-[var(--text2)]">{p.pctIntegral.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">{fmt(p.ganhoFundeb)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-500">{fmt(p.ganhoAcumulado)}</td>
                      <td className="py-2.5 px-3 text-right text-orange-500">{fmt(p.custoTotal)}</td>
                      <td className="py-2.5 px-3 text-right text-[var(--text3)]">{p.escolasConverter}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={p.roi >= 1 ? 'text-emerald-600 font-bold' : 'text-orange-500'}>
                          {(p.roi * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--border)]">
                    <td className="py-3 px-3 font-bold text-[var(--text1)]">Total 5 Anos</td>
                    <td className="py-3 px-3 text-right font-bold text-[var(--text1)]">{fmtN(metaAnual * 5)}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#00B4D8]">{fmtN(projections[4]?.acumIntegral || 0)}</td>
                    <td className="py-3 px-3 text-right font-bold text-[var(--text1)]">{(projections[4]?.pctIntegral || 0).toFixed(1)}%</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600">{fmt(totalGanho5anos)}</td>
                    <td className="py-3 px-3"></td>
                    <td className="py-3 px-3 text-right font-bold text-orange-500">{fmt(totalCusto5anos)}</td>
                    <td className="py-3 px-3"></td>
                    <td className="py-3 px-3 text-right font-bold">
                      <span className={totalGanho5anos > totalCusto5anos ? 'text-emerald-600' : 'text-orange-500'}>
                        {totalCusto5anos > 0 ? ((totalGanho5anos / totalCusto5anos) * 100).toFixed(0) : 0}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-5 border border-emerald-200">
              <div className="text-xs text-emerald-600 mb-1">Ganho FUNDEB Acumulado (5 anos)</div>
              <div className="text-2xl font-bold text-emerald-700">{fmt(totalGanho5anos)}</div>
              <div className="text-xs text-emerald-500 mt-1">Receita adicional via T6 (conversao parcial para integral)</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-5 border border-orange-200">
              <div className="text-xs text-orange-600 mb-1">Investimento Necessario (5 anos)</div>
              <div className="text-2xl font-bold text-orange-600">{fmt(totalCusto5anos)}</div>
              <div className="text-xs text-orange-500 mt-1">Infraestrutura para conversao em integral</div>
            </div>
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-xl p-5 border border-cyan-200">
              <div className="text-xs text-cyan-600 mb-1">Retorno sobre Investimento</div>
              <div className="text-2xl font-bold text-cyan-700">
                {totalCusto5anos > 0 ? ((totalGanho5anos / totalCusto5anos) * 100).toFixed(0) : '-'}%
              </div>
              <div className="text-xs text-cyan-500 mt-1">
                {totalGanho5anos > totalCusto5anos ? 'Investimento se paga com ganho FUNDEB' : 'Investimento parcialmente coberto pelo FUNDEB'}
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-white rounded-xl p-5 border border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text1)] mb-3">Como funciona a EC 135</h2>
            <div className="space-y-2 text-sm text-[var(--text2)]">
              <p>A Emenda Constitucional 135/2025 determina que municipios devem ampliar vagas em escola integral a uma taxa minima de <span className="text-[#00B4D8] font-semibold">4% ao ano</span> sobre o total de matriculas.</p>
              <p>Cada aluno convertido de parcial para integral gera um ganho FUNDEB de <span className="text-emerald-600 font-semibold">{fmt(GANHO_POR_CONVERSAO)}/aluno</span> (fator 1.50 vs 1.00 na base VAAF de {fmt(VAAF_BASE)}).</p>
              <p>Este calculo considera apenas a conversao de EF parcial para integral. Creche e Pre-escola integral tem fatores ainda maiores (1.55 e 1.50 respectivamente).</p>
              <p className="text-[var(--text3)] text-xs">Fonte: EC 108/2020 (FUNDEB Permanente), EC 135/2025, Lei 14.113/2020</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
