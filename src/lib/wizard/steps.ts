// Definicao das 10 etapas do wizard de consultoria FUNDEB
// Referencia: docs/blueprint/WIZARD.md

export type StepStatus = "locked" | "available" | "in_progress" | "completed" | "blocked";

export interface WizardStepDef {
  id: number;            // 0..9
  slug: string;          // url segment
  short: string;         // label curto para o stepper
  title: string;         // titulo na pagina
  description: string;   // descricao curta
  objective: string;     // o que se entrega na etapa
  useCases: string[];    // UC-XX.NN cobertos
  gates: string[];       // gates obrigatorios para avançar
}

export const WIZARD_STEPS: WizardStepDef[] = [
  {
    id: 0,
    slug: "step-0-preflight",
    short: "Pre-flight",
    title: "Pre-flight",
    description: "Autenticacao e escolha de carteira",
    objective: "Validar consultor e selecionar carteira ativa",
    useCases: ["UC-GE.01", "UC-GE.02"],
    gates: ["Sessão de usuário válida"],
  },
  {
    id: 1,
    slug: "step-1-cidade",
    short: "Cidade",
    title: "Cidade",
    description: "Selecionar município e abrir sessão de consultoria",
    objective: "Sessão consultoria criada/recuperada para o município",
    useCases: ["UC-ES.01", "UC-P2.01", "UC-EX.08", "UC-CO.02"],
    gates: ["Município selecionado", "Sessão ativa criada/recuperada"],
  },
  {
    id: 2,
    slug: "step-2-discovery",
    short: "Discovery",
    title: "Discovery — Dados Brutos & ETL",
    description: "Importar/atualizar dados (Extração → Treat → Catalog)",
    objective: "Banco estrutural fresco para o município",
    useCases: ["UC-P1.01", "UC-P1.02", "UC-AX.05", "UC-EX.01", "UC-SU.01", "UC-AU.08"],
    gates: ["ETL executado com sucesso", "Matrículas categorizadas"],
  },
  {
    id: 3,
    slug: "step-3-diagnostico",
    short: "Diagnóstico",
    title: "Diagnóstico",
    description: "Potencial, ganho/perda e categorias subnotificadas",
    objective: "Diagnóstico revisado e validado",
    useCases: ["UC-ES.03", "UC-PR.01", "UC-PR.02", "UC-AX.01", "UC-EX.02", "UC-CO.06"],
    gates: ["Consultor marcou como validado"],
  },
  {
    id: 4,
    slug: "step-4-simulacao",
    short: "Simulação",
    title: "Simulação de Cenários",
    description: "Simular reclassificação e definir cenário-alvo",
    objective: "Cenário-alvo escolhido",
    useCases: ["UC-PR.03", "UC-P1.05", "UC-P2.03"],
    gates: ["Cenário marcado como alvo"],
  },
  {
    id: 5,
    slug: "step-5-compliance",
    short: "Compliance",
    title: "Compliance",
    description: "Checklist das 5 seções A-E com evidências",
    objective: "100% dos itens classificados",
    useCases: ["UC-ES.04", "UC-P1.03", "UC-P1.04", "UC-AU.04"],
    gates: ["Todos os itens classificados"],
  },
  {
    id: 6,
    slug: "step-6-plano-acao",
    short: "Plano",
    title: "Plano de Ação",
    description: "Curto (7 semanas), médio e longo prazo",
    objective: "Plano completo nas 3 fases",
    useCases: ["UC-PR.04", "UC-P2.04", "UC-P2.06", "UC-AX.02", "UC-AX.04"],
    gates: ["Pelo menos 1 tarefa em cada fase"],
  },
  {
    id: 7,
    slug: "step-7-documentos",
    short: "Documentos",
    title: "Documentos",
    description: "Minuta CME, decreto e resolução",
    objective: "Minuta CME gerada (>= rascunho)",
    useCases: ["UC-ES.05", "UC-PR.05", "UC-P1.06", "UC-P2.05", "UC-EX.05", "UC-EX.07", "UC-GE.03", "UC-AU.02", "UC-AU.03", "UC-CO.05"],
    gates: ["Minuta CME gerada"],
  },
  {
    id: 8,
    slug: "step-8-execucao",
    short: "Execução",
    title: "Execução Semanal",
    description: "Acompanhamento até 27/Mai/2026",
    objective: "Tarefas semanais marcadas",
    useCases: ["UC-PR.06", "UC-PR.07", "UC-AX.04", "UC-AX.05"],
    gates: [],
  },
  {
    id: 9,
    slug: "step-9-entrega",
    short: "Entrega",
    title: "Entrega & Snapshot",
    description: "Encerrar consultoria com snapshot imutavel",
    objective: "Snapshot gerado e dossie exportado",
    useCases: ["UC-ES.06", "UC-EX.03", "UC-AU.05", "UC-AU.06", "UC-AU.07", "UC-CO.03"],
    gates: ["Steps 1-7 completos", "Checklist final assinado"],
  },
];

export function getStepBySlug(slug: string): WizardStepDef | undefined {
  return WIZARD_STEPS.find((s) => s.slug === slug);
}

export function getStepById(id: number): WizardStepDef | undefined {
  return WIZARD_STEPS.find((s) => s.id === id);
}

export function nextStep(currentId: number): WizardStepDef | undefined {
  return WIZARD_STEPS.find((s) => s.id === currentId + 1);
}

export function prevStep(currentId: number): WizardStepDef | undefined {
  return WIZARD_STEPS.find((s) => s.id === currentId - 1);
}
