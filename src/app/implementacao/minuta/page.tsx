"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";

const RESOLUCAO_TEXTO = `RESOLUÇÃO CME N.º ___/2026

O CONSELHO MUNICIPAL DE EDUCAÇÃO DE _______________, no uso de suas atribuições legais, e considerando:

- A Lei n.º 14.113/2020 (novo FUNDEB);
- A Portaria MEC n.º ___/2025 que estabelece as condicionalidades VAAR;
- O Parecer CNE/CEB n.º 2/2022 que trata das Normas sobre Computação na Educação Básica;
- A necessidade de adequação curricular para o componente de Computação;

RESOLVE:

Art. 1.º — OBJETO
Aprovar a inclusão do componente curricular de Computação no currículo das escolas da rede municipal de ensino de _______________, em conformidade com a Base Nacional Comum Curricular (BNCC) e o referencial curricular de Computação complementar.

Art. 2.º — ABRANGÊNCIA
O componente curricular de Computação será ofertado em todas as unidades escolares da rede municipal, contemplando:
I - Educação Infantil: abordagem integrada aos campos de experiência;
II - Ensino Fundamental — Anos Iniciais (1.º ao 5.º ano): componente integrado;
III - Ensino Fundamental — Anos Finais (6.º ao 9.º ano): componente específico.

Art. 3.º — COMPONENTE CURRICULAR
O componente de Computação organiza-se nos seguintes eixos:
I - Pensamento Computacional;
II - Mundo Digital;
III - Cultura Digital;
IV - Tecnologia e Sociedade.

Art. 4.º — CARGA HORÁRIA
A carga horária mínima do componente curricular de Computação será de:
I - Anos Iniciais: 1 (uma) hora-aula semanal;
II - Anos Finais: 2 (duas) horas-aula semanais;
Parágrafo único. A carga horária poderá ser ampliada conforme disponibilidade da rede e projeto político-pedagógico de cada unidade escolar.

Art. 5.º — FORMAÇÃO DOCENTE
A Secretaria Municipal de Educação deverá:
I - Promover programa de formação continuada com carga horária mínima de 32 (trinta e duas) horas anuais;
II - Garantir acompanhamento pedagógico permanente;
III - Disponibilizar materiais e recursos didáticos adequados;
IV - Estabelecer parcerias com instituições especializadas para suporte técnico-pedagógico.

Art. 6.º — VIGÊNCIA
Esta Resolução entra em vigor na data de sua publicação, com implementação gradual a partir do ano letivo de 2026, devendo a rede municipal estar em plena conformidade até o início do ano letivo de 2027.

_______________, ___ de _____________ de 2026.

_________________________________
Presidente do Conselho Municipal de Educação`;

const ARTIGOS = [
  {
    num: "Art. 1.º",
    titulo: "Objeto",
    resumo: "Aprovação da inclusão do componente curricular de Computação no currículo municipal, em conformidade com a BNCC.",
  },
  {
    num: "Art. 2.º",
    titulo: "Abrangência",
    resumo: "Oferta em todas as unidades escolares: Educação Infantil (integrada), Anos Iniciais (integrado) e Anos Finais (específico).",
  },
  {
    num: "Art. 3.º",
    titulo: "Componente Curricular",
    resumo: "Organização em 4 eixos: Pensamento Computacional, Mundo Digital, Cultura Digital e Tecnologia e Sociedade.",
  },
  {
    num: "Art. 4.º",
    titulo: "Carga Horária",
    resumo: "Mínimo de 1h/semana (Anos Iniciais) e 2h/semana (Anos Finais), com possibilidade de ampliação.",
  },
  {
    num: "Art. 5.º",
    titulo: "Formação Docente",
    resumo: "Programa de formação continuada com mínimo de 32h anuais, acompanhamento pedagógico e materiais didáticos.",
  },
  {
    num: "Art. 6.º",
    titulo: "Vigência",
    resumo: "Implementação gradual a partir de 2026 com conformidade plena até o ano letivo de 2027.",
  },
];

export default function MinutaPage() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(RESOLUCAO_TEXTO);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Minuta de Resolução CME"
        description="Modelo de resolução para aprovação do currículo computacional"
      />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Resumo dos artigos */}
        <section className="animate-fade-in">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-3">Estrutura da Resolução</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ARTIGOS.map((art) => (
              <div
                key={art.num}
                className="bg-white border border-[var(--border)] rounded-xl p-4 hover:border-[var(--cyan)] transition-colors"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)]">
                  {art.num}
                </div>
                <div className="font-semibold text-sm text-[var(--navy)] mt-1">{art.titulo}</div>
                <p className="text-xs text-[var(--text2)] mt-1 leading-relaxed">{art.resumo}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Documento completo */}
        <section className="animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--navy)]">Documento Completo</h2>
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copied
                  ? "bg-[var(--green)] text-white"
                  : "bg-[var(--navy)] text-white hover:bg-[var(--navy-dark)]"
              }`}
            >
              {copied ? "Copiado!" : "Copiar Modelo"}
            </button>
          </div>

          <div className="bg-white border-2 border-[var(--navy)]/20 rounded-xl p-8 shadow-sm">
            <pre
              className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
            >
              {RESOLUCAO_TEXTO}
            </pre>
          </div>
        </section>

        {/* Instruções */}
        <section className="animate-fade-in">
          <div className="bg-[var(--cyan)]/5 border border-[var(--cyan)]/20 rounded-xl p-5">
            <h3 className="text-sm font-bold text-[var(--navy)] mb-2">Como utilizar este modelo</h3>
            <ul className="text-xs text-[var(--text2)] space-y-1.5 list-disc list-inside leading-relaxed">
              <li>Substitua os campos em branco (___) pelos dados do seu município.</li>
              <li>Adapte os artigos conforme a realidade e legislação local.</li>
              <li>Submeta ao CME com parecer técnico da Secretaria de Educação.</li>
              <li>Após aprovação, publique no Diário Oficial do município.</li>
              <li>Registre a resolução aprovada no SIMEC como comprovação VAAR.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
