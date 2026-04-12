"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";

interface Report {
  id: string;
  icon: string;
  titulo: string;
  descricao: string;
  detalhes: string;
}

const REPORTS: Report[] = [
  {
    id: "financeiro",
    icon: "&#x1f4b0;",
    titulo: "Relatorio Financeiro",
    descricao: "Analise de receitas e contribuicoes",
    detalhes: "Demonstrativo detalhado de receitas do FUNDEB, contribuicoes municipais, complementacao da Uniao (VAAF, VAAT, VAAR) e projecoes financeiras.",
  },
  {
    id: "matriculas",
    icon: "&#x1f393;",
    titulo: "Relatorio de Matriculas",
    descricao: "Distribuicao por categoria",
    detalhes: "Distribuicao de matriculas por etapa (creche, pre-escola, fundamental), modalidade (regular, EJA, especial), turno e localizacao das escolas.",
  },
  {
    id: "compliance",
    icon: "&#x2705;",
    titulo: "Relatorio de Compliance",
    descricao: "Status das condicionalidades",
    detalhes: "Situacao de atendimento das condicionalidades VAAR: curriculo BNCC, formacao docente, registro SIMEC, resolucao CME e documentacao comprobatoria.",
  },
  {
    id: "potencial",
    icon: "&#x1f4c8;",
    titulo: "Relatorio de Potencial",
    descricao: "Oportunidades de captacao",
    detalhes: "Analise de oportunidades de ampliacao de receitas: matriculas em categorias com maior fator de ponderacao, novas condicionalidades e otimizacao de recursos.",
  },
];

export default function RelatoriosPage() {
  const { sessions, activeSession } = useConsultoria();
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());

  function handleGenerate(id: string) {
    setGenerating(id);
    setTimeout(() => {
      setGenerating(null);
      setGenerated((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setGenerated((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 3000);
    }, 2000);
  }

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const activeSessions = sessions.filter((s) => s.status === "active");

  return (
    <div>
      <PageHeader
        title="Relatorios"
        description="Gere relatorios analiticos do FUNDEB"
      />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Sessions summary */}
        {sessions.length > 0 && (
          <section className="animate-fade-in">
            <h2 className="text-sm font-bold text-[var(--navy)] uppercase tracking-wider mb-3">
              Sessoes de Consultoria
            </h2>
            <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                <div className="col-span-3">Municipio</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-center">Compliance</div>
                <div className="col-span-2 text-center">Plano de Acao</div>
                <div className="col-span-2 text-center">Inicio</div>
                <div className="col-span-2 text-center">Acoes</div>
              </div>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm border-b border-[var(--border)] last:border-b-0 ${
                    activeSession?.id === session.id ? "bg-[#00B4D8]/5" : ""
                  }`}
                >
                  <div className="col-span-3 font-medium text-[var(--text)]">
                    {session.municipality?.nome}
                    {activeSession?.id === session.id && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[#00E5A0]/15 text-[#00C88A] font-bold uppercase">Ativa</span>
                    )}
                  </div>
                  <div className="col-span-1 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      session.status === "active" ? "bg-emerald-50 text-emerald-700" :
                      session.status === "completed" ? "bg-blue-50 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {session.status === "active" ? "Ativa" : session.status === "completed" ? "Concluida" : "Pausada"}
                    </span>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 bg-[var(--bg)] rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-[var(--cyan)]"
                          style={{ width: `${session.complianceProgress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text3)] tabular-nums">{session.complianceProgress ?? 0}%</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 bg-[var(--bg)] rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-[#8b5cf6]"
                          style={{ width: `${session.actionPlanProgress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text3)] tabular-nums">{session.actionPlanProgress ?? 0}%</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-center text-xs text-[var(--text3)]">
                    {session.startDate ? new Date(session.startDate).toLocaleDateString("pt-BR") : "-"}
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-1.5">
                    <Link
                      href={`/consultorias/${session.id}`}
                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-[var(--navy)] text-white hover:bg-[var(--navy-dark)] transition-colors"
                    >
                      Detalhes
                    </Link>
                    <Link
                      href={`/consultorias/${session.id}/relatorio`}
                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-[var(--cyan)]/10 text-[var(--cyan)] hover:bg-[var(--cyan)]/20 transition-colors"
                    >
                      PDF
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-[var(--text3)]">
              <span>{activeSessions.length} ativa(s)</span>
              <span>{completedSessions.length} concluida(s)</span>
            </div>
          </section>
        )}

        {/* Report cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {REPORTS.map((report) => {
            const isGenerating = generating === report.id;
            const isGenerated = generated.has(report.id);

            return (
              <div
                key={report.id}
                className="animate-fade-in bg-white border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--cyan)] transition-colors"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl flex-shrink-0" dangerouslySetInnerHTML={{ __html: report.icon }} />
                    <div className="flex-1">
                      <h3 className="font-bold text-[var(--navy)]">{report.titulo}</h3>
                      <p className="text-xs text-[var(--cyan)] font-medium mt-0.5">{report.descricao}</p>
                      <p className="text-xs text-[var(--text2)] mt-3 leading-relaxed">{report.detalhes}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-5">
                  <button
                    onClick={() => handleGenerate(report.id)}
                    disabled={isGenerating}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      isGenerated
                        ? "bg-[var(--green)] text-white"
                        : isGenerating
                        ? "bg-[var(--navy)]/30 text-white cursor-wait"
                        : "bg-[var(--navy)] text-white hover:bg-[var(--navy-dark)]"
                    }`}
                  >
                    {isGenerated ? (
                      "Relatorio gerado!"
                    ) : isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Gerando...
                      </span>
                    ) : (
                      "Gerar"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="animate-fade-in bg-[var(--cyan)]/5 border border-[var(--cyan)]/20 rounded-xl p-5">
          <h3 className="text-sm font-bold text-[var(--navy)] mb-2">Sobre os Relatorios</h3>
          <ul className="text-xs text-[var(--text2)] space-y-1.5 list-disc list-inside leading-relaxed">
            <li>Os relatorios sao gerados com base nos dados importados na plataforma.</li>
            <li>Relatorios financeiros utilizam dados do SIOPE e projecoes do FNDE.</li>
            <li>Os dados de matriculas sao baseados no Censo Escolar mais recente.</li>
            <li>Relatorios podem ser exportados em PDF e Excel apos a geracao.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
