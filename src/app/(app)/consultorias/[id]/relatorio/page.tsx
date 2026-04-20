"use client";

import { useState, useEffect, use } from "react";

interface Resumo {
  consultoria: {
    id: number;
    status: string;
    startDate: string;
    endDate: string | null;
  };
  municipio: {
    nome: string;
    codigoIbge: string;
    receitaTotal: number;
    totalMatriculas: number;
    populacao: number | null;
    regiao: string | null;
  };
  cenarioAlvo: {
    receitaBase: number;
    receitaProjetada: number;
    delta: number;
    deltaPct: number;
  } | null;
  compliance: {
    total: number;
    done: number;
    late: number;
    porSecao: {
      section: string;
      sectionName: string;
      total: number;
      done: number;
      items: {
        itemKey: string;
        itemText: string;
        status: string;
      }[];
    }[];
  };
  plano: Record<string, { total: number; done: number }>;
  categorias: {
    categoria: string;
    label: string;
    fator: number;
    qtdAtual: number;
    qtdProjetada: number;
    receitaAtual: number;
    receitaProjetada: number;
    delta: number;
  }[];
  snapshot: {
    hash: string;
    signedBy: string;
    signedAt: string;
  } | null;
  acoesCenso2026: AcaoCenso[];
  roadmap2027: RoadmapItem[];
}

interface AcaoCenso {
  tarefa: string;
  completedAt: string | null;
}

interface RoadmapItem {
  tarefa: string;
  descricao: string | null;
  dueDate: string | null;
}

function fmtCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

export default function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/consultorias/${id}/resumo`)
      .then((r) => r.json())
      .then(setResumo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--text3)] animate-pulse-slow">Gerando relatório...</div>
      </div>
    );
  }

  if (!resumo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Erro ao carregar dados da consultoria.</div>
      </div>
    );
  }

  const { consultoria, municipio, cenarioAlvo, compliance, categorias, snapshot, acoesCenso2026, roadmap2027 } = resumo;
  const receitaBase = cenarioAlvo?.receitaBase ?? municipio.receitaTotal;
  const receitaProj = cenarioAlvo?.receitaProjetada ?? receitaBase;
  const delta = cenarioAlvo?.delta ?? 0;
  const deltaPct = cenarioAlvo?.deltaPct ?? 0;
  const compliancePct = compliance.total > 0 ? Math.round((compliance.done / compliance.total) * 100) : 0;

  return (
    <>
      {/* Print button - hidden on print */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 rounded-lg text-sm font-bold bg-[#0A2463] text-white hover:bg-[#0A2463]/80 transition-colors shadow-lg"
        >
          Imprimir / Salvar PDF
        </button>
        <button
          onClick={() => window.history.back()}
          className="px-5 py-2.5 rounded-lg text-sm font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors shadow-lg"
        >
          Voltar
        </button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white print:shadow-none shadow-xl my-8 print:my-0">
        {/* CABECALHO */}
        <header className="bg-[#0A2463] text-white px-10 py-8 print:px-8 print:py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[#00B4D8] text-xs font-bold uppercase tracking-[0.2em] mb-1">Instituto i10</div>
              <h1 className="text-2xl font-bold">Relatório de Consultoria FUNDEB</h1>
              <div className="text-white/60 text-sm mt-2">{municipio.nome} - SP</div>
              <div className="text-white/40 text-xs mt-1">
                IBGE: {municipio.codigoIbge || "-"} | {fmtDate(consultoria.startDate)}
                {consultoria.endDate ? ` a ${fmtDate(consultoria.endDate)}` : ""}
              </div>
            </div>
            <div className="text-right text-white/50 text-xs">
              <div>Consultoria #{consultoria.id}</div>
              <div className="mt-1">{fmtDate(new Date().toISOString())}</div>
            </div>
          </div>
        </header>

        <div className="px-10 py-8 print:px-8 space-y-8 text-[13px] leading-relaxed text-gray-800">
          {/* SECAO 1: RESUMO EXECUTIVO */}
          <section>
            <h2 className="text-lg font-bold text-[#0A2463] border-b-2 border-[#0A2463] pb-1 mb-4">
              1. Resumo Executivo
            </h2>
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Receita Atual</div>
                <div className="text-xl font-bold text-[#0A2463]">{fmtCurrency(receitaBase)}</div>
                <div className="text-xs text-gray-500">{fmtNumber(municipio.totalMatriculas)} matrículas</div>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Receita Projetada 2027</div>
                <div className="text-xl font-bold text-[#00B4D8]">{fmtCurrency(receitaProj)}</div>
                <div className="text-xs font-bold" style={{ color: delta > 0 ? "#00C88A" : "#D4553A" }}>
                  {delta > 0 ? "+" : ""}{fmtCurrency(delta)} ({deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%)
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Compliance VAAR</div>
                <div className="text-xl font-bold" style={{ color: compliancePct >= 80 ? "#00C88A" : compliancePct >= 50 ? "#E8A838" : "#D4553A" }}>
                  {compliancePct}%
                </div>
                <div className="text-xs text-gray-500">{compliance.done} de {compliance.total} itens concluídos</div>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Plano de Ação</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Curto: {resumo.plano.curto?.done ?? 0}/{resumo.plano.curto?.total ?? 0}</div>
                  <div>Médio: {resumo.plano.medio?.done ?? 0}/{resumo.plano.medio?.total ?? 0}</div>
                  <div>Longo: {resumo.plano.longo?.done ?? 0}/{resumo.plano.longo?.total ?? 0}</div>
                </div>
              </div>
            </div>
          </section>

          {/* SECAO 2: TABELA DE CATEGORIAS */}
          <section className="break-before-auto">
            <h2 className="text-lg font-bold text-[#0A2463] border-b-2 border-[#0A2463] pb-1 mb-4">
              2. Categorias FUNDEB - Projeção de Receita
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2 px-2 border border-gray-200 font-semibold">Categoria</th>
                  <th className="text-right py-2 px-2 border border-gray-200 font-semibold">Fator</th>
                  <th className="text-right py-2 px-2 border border-gray-200 font-semibold">Qtd Atual</th>
                  <th className="text-right py-2 px-2 border border-gray-200 font-semibold">Qtd Proj.</th>
                  <th className="text-right py-2 px-2 border border-gray-200 font-semibold">Receita Atual</th>
                  <th className="text-right py-2 px-2 border border-gray-200 font-semibold">Receita 2027</th>
                  <th className="text-right py-2 px-2 border border-gray-200 font-semibold">Ganho</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((cat) => (
                  <tr key={cat.categoria} className="hover:bg-gray-50">
                    <td className="py-1.5 px-2 border border-gray-200 font-medium">{cat.label || cat.categoria}</td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right tabular-nums">{cat.fator.toFixed(2)}</td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right tabular-nums">{fmtNumber(cat.qtdAtual)}</td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right tabular-nums font-medium" style={{ color: cat.qtdProjetada > cat.qtdAtual ? "#00C88A" : undefined }}>
                      {fmtNumber(cat.qtdProjetada)}
                    </td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right tabular-nums">{fmtCurrency(cat.receitaAtual)}</td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right tabular-nums font-medium text-[#00B4D8]">{fmtCurrency(cat.receitaProjetada)}</td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right tabular-nums font-bold" style={{ color: cat.delta > 0 ? "#00C88A" : cat.delta < 0 ? "#D4553A" : undefined }}>
                      {cat.delta > 0 ? "+" : ""}{fmtCurrency(cat.delta)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#0A2463] text-white font-bold">
                  <td className="py-2 px-2 border border-[#0A2463]">TOTAL</td>
                  <td className="py-2 px-2 border border-[#0A2463]" />
                  <td className="py-2 px-2 border border-[#0A2463] text-right tabular-nums">{fmtNumber(categorias.reduce((s, c) => s + c.qtdAtual, 0))}</td>
                  <td className="py-2 px-2 border border-[#0A2463] text-right tabular-nums">{fmtNumber(categorias.reduce((s, c) => s + c.qtdProjetada, 0))}</td>
                  <td className="py-2 px-2 border border-[#0A2463] text-right tabular-nums">{fmtCurrency(categorias.reduce((s, c) => s + c.receitaAtual, 0))}</td>
                  <td className="py-2 px-2 border border-[#0A2463] text-right tabular-nums">{fmtCurrency(categorias.reduce((s, c) => s + c.receitaProjetada, 0))}</td>
                  <td className="py-2 px-2 border border-[#0A2463] text-right tabular-nums">+{fmtCurrency(categorias.reduce((s, c) => s + c.delta, 0))}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* SECAO 3: CORRECOES CENSO 2026 */}
          <section>
            <h2 className="text-lg font-bold text-[#0A2463] border-b-2 border-[#0A2463] pb-1 mb-4">
              3. Correções Realizadas para o Censo 2026
            </h2>
            {acoesCenso2026.length === 0 ? (
              <p className="text-gray-500 italic">Nenhuma ação de curto prazo concluída nesta consultoria.</p>
            ) : (
              <ul className="space-y-2">
                {acoesCenso2026.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#00C88A] font-bold mt-0.5">&#x2713;</span>
                    <span className="flex-1">{a.tarefa}</span>
                    <span className="text-gray-400 text-xs">{fmtDate(a.completedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* SECAO 4: PLANO DE ACAO 2027 */}
          <section>
            <h2 className="text-lg font-bold text-[#0A2463] border-b-2 border-[#0A2463] pb-1 mb-4">
              4. Plano de Ação - Captações 2027
            </h2>
            {roadmap2027.length === 0 ? (
              <p className="text-gray-500 italic">Todas as tarefas de médio e longo prazo foram concluídas.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-2 px-2 border border-gray-200 font-semibold">#</th>
                    <th className="text-left py-2 px-2 border border-gray-200 font-semibold">Tarefa</th>
                    <th className="text-left py-2 px-2 border border-gray-200 font-semibold">Descrição</th>
                    <th className="text-center py-2 px-2 border border-gray-200 font-semibold">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {roadmap2027.map((t, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-2 border border-gray-200 text-gray-400">{i + 1}</td>
                      <td className="py-1.5 px-2 border border-gray-200 font-medium">{t.tarefa}</td>
                      <td className="py-1.5 px-2 border border-gray-200 text-gray-600">{t.descricao || "-"}</td>
                      <td className="py-1.5 px-2 border border-gray-200 text-center">{t.dueDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* SECAO 5: COMPLIANCE VAAR */}
          <section className="break-before-auto">
            <h2 className="text-lg font-bold text-[#0A2463] border-b-2 border-[#0A2463] pb-1 mb-4">
              5. Compliance VAAR - Status das Condicionalidades
            </h2>
            {compliance.porSecao.map((sec) => (
              <div key={sec.section} className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  {sec.section}. {sec.sectionName}
                  <span className="ml-2 text-xs font-normal text-gray-400">({sec.done}/{sec.total})</span>
                </h3>
                <table className="w-full text-xs border-collapse mb-2">
                  <tbody>
                    {sec.items.map((item) => (
                      <tr key={item.itemKey}>
                        <td className="py-1 px-2 border border-gray-200 w-8 text-center">
                          {item.status === "done" ? (
                            <span className="text-[#00C88A] font-bold">&#x2713;</span>
                          ) : item.status === "late" ? (
                            <span className="text-[#D4553A] font-bold">!</span>
                          ) : (
                            <span className="text-gray-300">&#x25CB;</span>
                          )}
                        </td>
                        <td className="py-1 px-2 border border-gray-200">{item.itemText}</td>
                        <td className="py-1 px-2 border border-gray-200 text-center w-20">
                          <span className={`text-[10px] font-bold uppercase ${
                            item.status === "done" ? "text-[#00C88A]" : item.status === "late" ? "text-[#D4553A]" : "text-gray-400"
                          }`}>
                            {item.status === "done" ? "OK" : item.status === "late" ? "ATRASO" : item.status === "progress" ? "ANDAMENTO" : "PENDENTE"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          {/* RODAPE */}
          <footer className="border-t-2 border-[#0A2463] pt-4 mt-8">
            <div className="flex items-end justify-between text-[10px] text-gray-400">
              <div>
                <div className="text-xs font-bold text-[#0A2463] mb-1">Instituto i10 - Plataforma FUNDEB 2026</div>
                <div>Relatório gerado automaticamente em {fmtDate(new Date().toISOString())}</div>
                {snapshot && (
                  <div className="mt-1">
                    Snapshot: <span className="font-mono">{snapshot.hash.slice(0, 24)}</span>
                    {" | "}Assinado por: {snapshot.signedBy} em {fmtDate(snapshot.signedAt)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div>Consultoria #{consultoria.id}</div>
                <div>{municipio.nome} - SP</div>
              </div>
            </div>

            {/* Signature line */}
            <div className="mt-10 grid grid-cols-2 gap-16">
              <div className="border-t border-gray-400 pt-2 text-center text-xs text-gray-500">
                Consultor Responsável
              </div>
              <div className="border-t border-gray-400 pt-2 text-center text-xs text-gray-500">
                Secretário(a) Municipal de Educação
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
