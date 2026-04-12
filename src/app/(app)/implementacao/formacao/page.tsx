"use client";

import { PageHeader } from "@/components/page-header";

type ModuleStatus = "disponivel" | "em_breve" | "concluido" | "em_andamento";

interface TrainingModule {
  num: number;
  titulo: string;
  horas: number;
  descricao: string;
  topicos: string[];
  status: ModuleStatus;
}

const MODULES: TrainingModule[] = [
  {
    num: 1,
    titulo: "Fundamentos BNCC Computação",
    horas: 8,
    descricao:
      "Compreensão da estrutura curricular de Computação na BNCC, competências específicas, habilidades por ano e articulação com os demais componentes curriculares.",
    topicos: [
      "Estrutura da BNCC e o componente de Computação",
      "Competências gerais e específicas",
      "Habilidades por ano escolar",
      "Articulação interdisciplinar",
    ],
    status: "disponivel",
  },
  {
    num: 2,
    titulo: "Pensamento Computacional na Prática",
    horas: 8,
    descricao:
      "Metodologias e atividades práticas para o desenvolvimento do pensamento computacional em sala de aula, incluindo computação desplugada e resolução de problemas.",
    topicos: [
      "Decomposição e abstração",
      "Reconhecimento de padrões",
      "Algoritmos e automação",
      "Computação desplugada: atividades sem computador",
    ],
    status: "disponivel",
  },
  {
    num: 3,
    titulo: "Ferramentas e Recursos Digitais",
    horas: 8,
    descricao:
      "Exploração de plataformas, softwares e recursos digitais para o ensino de computação, desde ambientes de programação visual até ferramentas de colaboração.",
    topicos: [
      "Scratch e programação visual",
      "Plataformas de ensino de programação",
      "Robótica educacional",
      "Ferramentas de colaboração digital",
    ],
    status: "em_breve",
  },
  {
    num: 4,
    titulo: "Avaliação e Acompanhamento",
    horas: 8,
    descricao:
      "Estratégias de avaliação formativa e somativa para o componente de Computação, elaboração de rubricas, portfólios digitais e relatórios de acompanhamento.",
    topicos: [
      "Avaliação formativa em Computação",
      "Rubricas e critérios de avaliação",
      "Portfólios digitais",
      "Relatórios para o SIMEC",
    ],
    status: "em_breve",
  },
];

function getStatusConfig(status: ModuleStatus) {
  switch (status) {
    case "disponivel":
      return { label: "Disponível", bg: "bg-[var(--green)]/10", text: "text-[var(--green-dark)]", dot: "bg-[var(--green)]" };
    case "em_andamento":
      return { label: "Em andamento", bg: "bg-[var(--cyan)]/10", text: "text-[var(--cyan)]", dot: "bg-[var(--cyan)]" };
    case "concluido":
      return { label: "Concluído", bg: "bg-[var(--navy)]/10", text: "text-[var(--navy)]", dot: "bg-[var(--navy)]" };
    case "em_breve":
      return { label: "Em breve", bg: "bg-[var(--orange)]/10", text: "text-[var(--orange)]", dot: "bg-[var(--orange)]" };
  }
}

export default function FormacaoPage() {
  const totalHoras = MODULES.reduce((sum, m) => sum + m.horas, 0);

  return (
    <div>
      <PageHeader
        title="Formação Docente"
        description="Programa de capacitação para implementação curricular"
      />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Summary stats */}
        <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Total do Programa</div>
            <div className="text-2xl font-extrabold text-[var(--cyan)] mt-1">{totalHoras}h</div>
            <div className="text-xs text-[var(--text2)] mt-0.5">carga horária total</div>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Módulos</div>
            <div className="text-2xl font-extrabold text-[var(--navy)] mt-1">{MODULES.length}</div>
            <div className="text-xs text-[var(--text2)] mt-0.5">módulos de {MODULES[0].horas}h cada</div>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Modalidade</div>
            <div className="text-2xl font-extrabold text-[var(--navy)] mt-1">Híbrida</div>
            <div className="text-xs text-[var(--text2)] mt-0.5">presencial + online</div>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Certificação</div>
            <div className="text-2xl font-extrabold text-[var(--green)] mt-1">Sim</div>
            <div className="text-xs text-[var(--text2)] mt-0.5">válida para progressão</div>
          </div>
        </div>

        {/* Modules */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--navy)]">Módulos do Programa</h2>
          {MODULES.map((mod) => {
            const statusCfg = getStatusConfig(mod.status);
            return (
              <div
                key={mod.num}
                className="animate-fade-in bg-white border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--cyan)] transition-colors"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                  <div className="flex items-center gap-4">
                    <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--navy)] text-white font-bold text-sm flex items-center justify-center">
                      M{mod.num}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-[var(--navy)]">{mod.titulo}</h3>
                      <span className="text-xs text-[var(--text3)]">{mod.horas} horas</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                </div>

                <div className="px-6 py-5">
                  <p className="text-sm text-[var(--text2)] leading-relaxed mb-4">{mod.descricao}</p>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                      Tópicos abordados
                    </span>
                    <ul className="mt-2 space-y-1.5">
                      {mod.topicos.map((topico, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-[var(--text2)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] flex-shrink-0" />
                          {topico}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Calendar placeholder */}
        <section className="animate-fade-in">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-3">Calendário de Formações</h2>
          <div className="bg-white border border-dashed border-[var(--border)] rounded-xl p-10 text-center">
            <span className="text-4xl block mb-3">📅</span>
            <p className="text-sm font-medium text-[var(--text2)]">
              Calendário de formações em elaboração
            </p>
            <p className="text-xs text-[var(--text3)] mt-1">
              As datas serão definidas em conjunto com a Secretaria Municipal de Educação
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
