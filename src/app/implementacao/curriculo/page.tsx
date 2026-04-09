"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";

const COMPETENCIAS = [
  {
    nome: "Pensamento Computacional",
    desc: "Capacidade de formular e resolver problemas utilizando fundamentos da computação, incluindo abstração, decomposição, reconhecimento de padrões e algoritmos.",
  },
  {
    nome: "Mundo Digital",
    desc: "Compreensão do funcionamento de dispositivos, redes e sistemas computacionais, reconhecendo seus componentes e suas interações.",
  },
  {
    nome: "Cultura Digital",
    desc: "Uso crítico, significativo, reflexivo e ético das tecnologias digitais nas práticas sociais, incluindo comunicação, colaboração e produção de conhecimento.",
  },
  {
    nome: "Tecnologia e Sociedade",
    desc: "Análise dos impactos sociais, culturais e ambientais das tecnologias, promovendo protagonismo e cidadania digital.",
  },
  {
    nome: "Dados e Análise",
    desc: "Coleta, organização, representação, análise e interpretação de dados usando ferramentas computacionais para tomada de decisões informadas.",
  },
  {
    nome: "Programação",
    desc: "Criação de algoritmos e programas para resolver problemas, automatizar processos e expressar ideias de forma criativa.",
  },
];

const PASSOS = [
  {
    num: 1,
    titulo: "Formar comissão curricular",
    desc: "Constituir grupo de trabalho com representantes da secretaria, professores, gestores e especialistas em tecnologia educacional.",
  },
  {
    num: 2,
    titulo: "Adaptar o referencial",
    desc: "Adequar o referencial curricular de computação à realidade local, considerando infraestrutura, formação docente e contexto socioeconômico.",
  },
  {
    num: 3,
    titulo: "Submeter ao CME",
    desc: "Apresentar a proposta curricular ao Conselho Municipal de Educação para deliberação e aprovação formal via resolução.",
  },
  {
    num: 4,
    titulo: "Capacitar professores",
    desc: "Implementar programa de formação continuada para professores, abordando conteúdos, metodologias e ferramentas do componente.",
  },
  {
    num: 5,
    titulo: "Implementar",
    desc: "Iniciar a oferta do componente curricular de forma gradual, começando pelos anos iniciais e expandindo progressivamente.",
  },
  {
    num: 6,
    titulo: "Avaliar",
    desc: "Monitorar e avaliar continuamente a implementação, ajustando estratégias e recursos conforme necessidade identificada.",
  },
];

export default function CurriculoPage() {
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  function toggleStep(num: number) {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Currículo BNCC Computação"
        description="Guia de implementação do componente curricular de Computação"
      />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">
        {/* O que é */}
        <section className="animate-fade-in">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-3">O que é</h2>
          <div className="bg-white border border-[var(--border)] rounded-xl p-6 text-sm text-[var(--text2)] leading-relaxed space-y-3">
            <p>
              A Base Nacional Comum Curricular (BNCC) estabelece que o componente curricular de
              Computação deve ser integrado ao currículo da Educação Básica, garantindo que todos
              os estudantes desenvolvam competências e habilidades relacionadas ao pensamento
              computacional, ao mundo digital e à cultura digital.
            </p>
            <p>
              A implementação deste componente é uma das condicionalidades para o recebimento
              integral dos recursos do FUNDEB (VAAR), conforme estabelecido pela Lei 14.113/2020.
              Municípios que não atenderem a esta exigência podem perder até 2,5% da complementação
              da União.
            </p>
            <p>
              O referencial curricular de Computação organiza-se em eixos temáticos que se
              articulam progressivamente do 1.o ao 9.o ano do Ensino Fundamental, com
              aprofundamento no Ensino Médio.
            </p>
          </div>
        </section>

        {/* Competências Específicas */}
        <section className="animate-fade-in">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-3">Competências Específicas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMPETENCIAS.map((comp, i) => (
              <div
                key={i}
                className="bg-white border border-[var(--border)] rounded-xl p-5 hover:border-[var(--cyan)] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--cyan)]/10 text-[var(--cyan)] font-bold text-sm flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--navy)]">{comp.nome}</h3>
                    <p className="text-xs text-[var(--text2)] mt-1 leading-relaxed">{comp.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Passos para Implementação */}
        <section className="animate-fade-in">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-3">Passos para Implementação</h2>
          <div className="space-y-3">
            {PASSOS.map((passo) => (
              <div
                key={passo.num}
                onClick={() => toggleStep(passo.num)}
                className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${
                  checkedSteps.has(passo.num)
                    ? "border-[var(--green)] bg-[var(--green)]/5"
                    : "border-[var(--border)] hover:border-[var(--cyan)]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      checkedSteps.has(passo.num)
                        ? "bg-[var(--green)] text-white"
                        : "bg-[var(--navy)]/10 text-[var(--navy)]"
                    }`}
                  >
                    {checkedSteps.has(passo.num) ? "✓" : passo.num}
                  </div>
                  <div>
                    <h3
                      className={`font-semibold text-sm ${
                        checkedSteps.has(passo.num) ? "text-[var(--green-dark)] line-through" : "text-[var(--navy)]"
                      }`}
                    >
                      {passo.titulo}
                    </h3>
                    <p className="text-xs text-[var(--text2)] mt-1 leading-relaxed">{passo.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-[var(--text3)]">
            {checkedSteps.size} de {PASSOS.length} passos concluídos
          </div>
        </section>

        {/* Documentos Modelo */}
        <section className="animate-fade-in">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-3">Documentos Modelo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Proposta Curricular", icon: "📄" },
              { label: "Plano de Implementação", icon: "📋" },
              { label: "Modelo de Resolução", icon: "📑" },
              { label: "Relatório de Avaliação", icon: "📊" },
            ].map((doc, i) => (
              <button
                key={i}
                className="bg-white border border-[var(--border)] rounded-xl p-5 text-center hover:border-[var(--cyan)] hover:shadow-sm transition-all group"
              >
                <span className="text-2xl block mb-2">{doc.icon}</span>
                <span className="text-sm font-medium text-[var(--navy)] group-hover:text-[var(--cyan)] transition-colors">
                  {doc.label}
                </span>
                <span className="block text-[10px] text-[var(--text3)] mt-1">Baixar modelo</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
