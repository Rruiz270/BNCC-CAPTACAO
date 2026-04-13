'use client'

import { useState, useEffect } from 'react'

interface Municipality { id: number; nome: string }

export default function GerarRelatorio() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedNome, setSelectedNome] = useState('')
  const [generating, setGenerating] = useState(false)
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/municipalities?limit=645&sort=nome')
      .then(r => r.json())
      .then(d => setMunicipalities(d.data || []))
      .catch(() => {})
  }, [])

  const filtered = search.length > 1
    ? municipalities.filter(m => m.nome.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : []

  async function handleGenerate() {
    if (!selectedId) return
    setGenerating(true)
    setError(null)
    setReportHtml(null)
    try {
      const res = await fetch(`/api/relatorios?municipalityId=${selectedId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar')
      setReportHtml(data.html)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setGenerating(false)
    }
  }

  function handlePrint() {
    if (!reportHtml) return
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(reportHtml)
      win.document.close()
      setTimeout(() => win.print(), 500)
    }
  }

  function handleDownload() {
    if (!reportHtml) return
    const blob = new Blob([reportHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-fundeb-${selectedNome.toLowerCase().replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text1)]">Gerar Relatorio de Consultoria</h1>
        <p className="text-[var(--text3)] text-sm mt-1">
          Relatorio completo com ficha municipal, diagnostico T1-T6, matriculas, compliance e plano de acao
        </p>
      </div>

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
                  <button key={m.id} onClick={() => { setSelectedId(m.id); setSelectedNome(m.nome); setSearch(''); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text2)] hover:bg-[#00B4D8]/10 hover:text-[#0A2463] transition-colors"
                  >{m.nome}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-[#00B4D8]/10 text-[#0A2463] font-semibold text-sm">{selectedNome}</div>
            <button onClick={() => { setSelectedId(null); setSelectedNome(''); setSearch(''); setReportHtml(null); }}
              className="px-3 py-2 rounded-xl bg-[var(--bg)] text-[var(--text3)] hover:text-[var(--text1)] text-sm border border-[var(--border)]">Trocar</button>
          </div>
        )}

        {selectedId && !reportHtml && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 w-full py-3 rounded-xl bg-[#00B4D8] text-white font-semibold hover:bg-[#00B4D8]/80 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Gerando relatorio...' : 'Gerar Relatorio Completo'}
          </button>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-50 rounded-xl text-red-600 text-sm border border-red-200">{error}</div>
        )}
      </div>

      {reportHtml && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={handlePrint}
              className="px-6 py-2.5 rounded-xl bg-[#00B4D8] text-white font-semibold hover:bg-[#00B4D8]/80 text-sm">
              Imprimir / PDF
            </button>
            <button onClick={handleDownload}
              className="px-6 py-2.5 rounded-xl bg-[var(--bg)] text-[var(--text1)] font-semibold hover:bg-gray-100 text-sm border border-[var(--border)]">
              Download HTML
            </button>
            <button onClick={() => setReportHtml(null)}
              className="px-6 py-2.5 rounded-xl bg-[var(--bg)] text-[var(--text3)] hover:text-[var(--text1)] text-sm border border-[var(--border)]">
              Fechar Preview
            </button>
          </div>
          <div className="bg-white rounded-xl overflow-hidden shadow-lg">
            <iframe
              srcDoc={reportHtml}
              className="w-full border-0"
              style={{ minHeight: '80vh' }}
              title="Relatorio Preview"
            />
          </div>
        </div>
      )}
    </div>
  )
}
