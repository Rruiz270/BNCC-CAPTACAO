"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";

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
    icon: "💰",
    titulo: "Relatório Financeiro",
    descricao: "Análise de receitas e contribuições",
    detalhes: "Demonstrativo detalhado de receitas do FUNDEB, contribuições municipais, complementação da União (VAAF, VAAT, VAAR) e projeções financeiras.",
  },
  {
    id: "matriculas",
    icon: "🎓",
    titulo: "Relatório de Matrículas",
    descricao: "Distribuição por categoria",
    detalhes: "Distribuição de matrículas por etapa (creche, pré-escola, fundamental), modalidade (regular, EJA, especial), turno e localização das escolas.",
  },
  {
    id: "compliance",
    icon: "✅",
    titulo: "Relatório de Compliance",
    descricao: "Status das condicionalidades",
    detalhes: "Situação de atendimento das condicionalidades VAAR: currículo BNCC, formação docente, registro SIMEC, resolução CME e documentação comprobatória.",
  },
  {
    id: "potencial",
    icon: "📈",
    titulo: "Relatório de Potencial",
    descricao: "Oportunidades de captação",
    detalhes: "Análise de oportunidades de ampliação de receitas: matrículas em categorias com maior fator de ponderação, novas condicionalidades e otimização de recursos.",
  },
];

export default function RelatoriosPage() {
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

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Gere relatórios analíticos do FUNDEB"
      />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
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
                    <span className="text-3xl flex-shrink-0">{report.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-[var(--navy)]">{report.titulo}</h3>
                      <p className="text-xs text-[var(--cyan)] font-medium mt-0.5">
                        {report.descricao}
                      </p>
                      <p className="text-xs text-[var(--text2)] mt-3 leading-relaxed">
                        {report.detalhes}
                      </p>
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
                      "Relatório gerado!"
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
          <h3 className="text-sm font-bold text-[var(--navy)] mb-2">Sobre os Relatórios</h3>
          <ul className="text-xs text-[var(--text2)] space-y-1.5 list-disc list-inside leading-relaxed">
            <li>Os relatórios são gerados com base nos dados importados na plataforma.</li>
            <li>Relatórios financeiros utilizam dados do SIOPE e projeções do FNDE.</li>
            <li>Os dados de matrículas são baseados no Censo Escolar mais recente.</li>
            <li>Relatórios podem ser exportados em PDF e Excel após a geração.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
