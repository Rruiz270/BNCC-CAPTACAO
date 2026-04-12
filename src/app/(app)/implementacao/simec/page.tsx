"use client";

import { PageHeader } from "@/components/page-header";

const STEPS = [
  {
    num: 1,
    titulo: "Acessar o SIMEC",
    desc: "Acesse o Sistema Integrado de Monitoramento, Execução e Controle do Ministério da Educação através do endereço simec.mec.gov.br. Utilize as credenciais do dirigente municipal de educação ou do responsável designado. Caso não possua acesso, solicite junto à representação do MEC no estado.",
    dica: "Mantenha suas credenciais seguras e atualizadas. O acesso deve ser restrito ao dirigente ou técnico formalmente designado pela portaria municipal.",
  },
  {
    num: 2,
    titulo: "Atualizar o PAR",
    desc: "No módulo PAR (Plano de Ações Articuladas), navegue até a dimensão 'Gestão Educacional' e localize o indicador relacionado ao currículo e componentes curriculares. Atualize o diagnóstico local incluindo a situação do componente de Computação na rede municipal.",
    dica: "O PAR deve refletir fielmente a realidade do município. Dados inconsistentes podem gerar pendências na análise do MEC e atrasar a liberação de recursos.",
  },
  {
    num: 3,
    titulo: "Registrar condicionalidades VAAR",
    desc: "Acesse o módulo VAAR dentro do SIMEC. Localize a condicionalidade referente à implementação curricular de Computação. Preencha todos os campos obrigatórios, informando: resolução do CME aprovada, data de implementação, número de escolas atendidas e carga horária ofertada.",
    dica: "As condicionalidades VAAR possuem prazo definido pelo MEC. Fique atento ao calendário oficial para não perder o período de registro.",
  },
  {
    num: 4,
    titulo: "Anexar documentação comprobatória",
    desc: "Faça upload dos documentos que comprovam o atendimento da condicionalidade: cópia da resolução CME, grade curricular atualizada, certificados de formação docente, atas de reuniões e relatórios de acompanhamento. Os arquivos devem estar em formato PDF com tamanho máximo de 10MB cada.",
    dica: "Digitalize os documentos com boa qualidade e nomeie os arquivos de forma clara (ex: resolucao_cme_001_2026.pdf). Isso facilita a análise pelo MEC.",
  },
  {
    num: 5,
    titulo: "Validar e submeter",
    desc: "Revise todas as informações preenchidas e documentos anexados. Utilize a função 'Validar' para verificar se há campos obrigatórios pendentes. Após a validação sem erros, clique em 'Submeter' para enviar o registro. Imprima o comprovante de submissão para arquivo.",
    dica: "Após a submissão, acompanhe o status regularmente. O MEC pode solicitar informações complementares ou correções. O prazo para resposta geralmente é de 15 dias úteis.",
  },
];

export default function SimecPage() {
  return (
    <div>
      <PageHeader
        title="Guia SIMEC"
        description="Passo a passo para registro no Sistema Integrado de Monitoramento"
      />

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">
        {/* Intro */}
        <div className="animate-fade-in bg-white border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-[var(--navy)] mb-2">Sobre o SIMEC</h2>
          <p className="text-sm text-[var(--text2)] leading-relaxed">
            O SIMEC (Sistema Integrado de Monitoramento, Execução e Controle) é a plataforma
            oficial do MEC para gestão das políticas educacionais. O registro correto das
            condicionalidades VAAR no SIMEC é essencial para garantir o recebimento integral
            dos recursos do FUNDEB.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {STEPS.map((step) => (
            <div key={step.num} className="animate-fade-in">
              <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--cyan)] transition-colors">
                {/* Step header */}
                <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)]">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--navy)] text-white font-bold text-lg flex items-center justify-center">
                    {step.num}
                  </span>
                  <h3 className="font-bold text-[var(--navy)]">{step.titulo}</h3>
                </div>

                {/* Step body */}
                <div className="px-6 py-5">
                  <p className="text-sm text-[var(--text2)] leading-relaxed">{step.desc}</p>
                </div>

                {/* Tip */}
                <div className="mx-6 mb-5 bg-[var(--orange)]/8 border border-[var(--orange)]/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0 mt-0.5">💡</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--orange)]">
                        Dica
                      </span>
                      <p className="text-xs text-[var(--text2)] mt-0.5 leading-relaxed">
                        {step.dica}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Links úteis */}
        <div className="animate-fade-in bg-[var(--cyan)]/5 border border-[var(--cyan)]/20 rounded-xl p-6">
          <h3 className="text-sm font-bold text-[var(--navy)] mb-3">Links Úteis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Portal SIMEC", url: "https://simec.mec.gov.br" },
              { label: "Manual do Usuário SIMEC", url: "#" },
              { label: "Calendário VAAR 2026", url: "#" },
              { label: "FAQ — Dúvidas Frequentes", url: "#" },
            ].map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-lg px-4 py-3 text-sm font-medium text-[var(--navy)] hover:border-[var(--cyan)] hover:text-[var(--cyan)] transition-colors"
              >
                <span className="text-[var(--cyan)]">→</span>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
