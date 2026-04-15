"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";
import { formatCurrency } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Phase {
  id: string;
  label: string;
  deadline: string;
  color: string;
  bgColor: string;
  borderColor: string;
  items: ChecklistItem[];
}

interface MunicipalityData {
  id: number;
  nome: string;
  financials?: {
    vaar?: number | null;
    receitaTotal?: number | null;
  };
}

/* ------------------------------------------------------------------ */
/* Static data                                                         */
/* ------------------------------------------------------------------ */

const DEADLINE = new Date("2026-08-01T00:00:00");

function buildInitialPhases(): Phase[] {
  return [
    {
      id: "curto",
      label: "CURTO PRAZO",
      deadline: "ate Maio 2026",
      color: "#EA580C",
      bgColor: "rgba(234,88,12,0.06)",
      borderColor: "rgba(234,88,12,0.25)",
      items: [
        { id: "c1", text: "Formar comissao municipal para BNCC Computacao", checked: false },
        { id: "c2", text: "Realizar diagnostico da situacao atual de infraestrutura digital", checked: false },
        { id: "c3", text: "Mapear competencias docentes em tecnologia educacional", checked: false },
      ],
    },
    {
      id: "medio",
      label: "MEDIO PRAZO",
      deadline: "ate Agosto 2026",
      color: "#0A2463",
      bgColor: "rgba(10,36,99,0.04)",
      borderColor: "rgba(10,36,99,0.18)",
      items: [
        { id: "m1", text: "Atualizar curriculo municipal com competencias de computacao (3 eixos: Cultura Digital, Mundo Digital, Pensamento Computacional)", checked: false },
        { id: "m2", text: "Aprovar atualizacao no CME (Conselho Municipal de Educacao)", checked: false },
        { id: "m3", text: "Registrar curriculo atualizado no SIMEC", checked: false },
        { id: "m4", text: "Regulamentar uso pedagogico de dispositivos digitais nas escolas", checked: false },
        { id: "m5", text: "Iniciar formacao docente em computacao educacional", checked: false },
      ],
    },
    {
      id: "longo",
      label: "LONGO PRAZO",
      deadline: "2027+",
      color: "#00B4D8",
      bgColor: "rgba(0,180,216,0.05)",
      borderColor: "rgba(0,180,216,0.20)",
      items: [
        { id: "l1", text: "Implementar laboratorios de informatica/robotica", checked: false },
        { id: "l2", text: "Estabelecer parcerias publico-privadas para tecnologia educacional", checked: false },
        { id: "l3", text: "Monitorar indicadores de aprendizagem digital", checked: false },
        { id: "l4", text: "Integrar computacao em avaliacoes municipais", checked: false },
      ],
    },
  ];
}

const EIXOS = [
  {
    title: "Cultura Digital",
    description: "Cidadania, etica, seguranca digital",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    title: "Mundo Digital",
    description: "Hardware, software, redes, dados",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
      </svg>
    ),
  },
  {
    title: "Pensamento Computacional",
    description: "Algoritmos, abstracao, decomposicao, reconhecimento de padroes",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
];

const LEGAL_REFS = [
  {
    title: "BNCC Computacao",
    ref: "Resolucao CNE/CP no 1/2024",
    description: "Estabelece as competencias de computacao na educacao basica.",
  },
  {
    title: "EC 108/2020",
    ref: "FUNDEB Permanente",
    description: "Emenda constitucional que torna o FUNDEB permanente com novas condicionalidades.",
  },
  {
    title: "Lei 14.113/2020",
    ref: "Regulamentacao do FUNDEB",
    description: "Regulamenta o FUNDEB, incluindo VAAT e VAAR.",
  },
  {
    title: "VAAR Condicionalidades",
    ref: "Indicadores de resultado",
    description: "Valor Aluno/Ano Resultado vinculado ao cumprimento de metas educacionais.",
  },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function BnccComputacaoPage() {
  const { activeSession, municipality: ctxMunicipality } = useConsultoria();
  const [phases, setPhases] = useState<Phase[]>(buildInitialPhases);
  const [muniData, setMuniData] = useState<MunicipalityData | null>(null);
  const [loadingMuni, setLoadingMuni] = useState(false);

  // ---- Deadline countdown ----
  const daysUntilDeadline = useMemo(() => {
    const now = new Date();
    const diff = DEADLINE.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  // ---- Fetch municipality data when active session ----
  const municipalityId = activeSession?.municipalityId;

  useEffect(() => {
    if (!municipalityId) {
      setMuniData(null);
      return;
    }
    setLoadingMuni(true);
    fetch(`/api/municipalities/${municipalityId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Falha ao carregar dados");
        return r.json();
      })
      .then((data) => {
        setMuniData({
          id: data.id,
          nome: data.nome,
          financials: data.financials,
        });
      })
      .catch(() => setMuniData(null))
      .finally(() => setLoadingMuni(false));
  }, [municipalityId]);

  // ---- Toggle checklist item ----
  function toggleItem(phaseId: string, itemId: string) {
    setPhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              items: phase.items.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item
              ),
            }
          : phase
      )
    );
  }

  // ---- Compute progress per phase ----
  function phaseProgress(phase: Phase) {
    const total = phase.items.length;
    const done = phase.items.filter((i) => i.checked).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  // ---- Overall progress ----
  const totalItems = phases.reduce((acc, p) => acc + p.items.length, 0);
  const totalDone = phases.reduce(
    (acc, p) => acc + p.items.filter((i) => i.checked).length,
    0
  );
  const overallProgress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

  // ---- VAAR amount ----
  const vaarAmount = muniData?.financials?.vaar ?? null;

  return (
    <div>
      <PageHeader
        label="Compliance"
        title="BNCC Computacao"
        description="Preparacao municipal para as competencias de computacao na educacao basica"
      />

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* ============================================================ */}
        {/* Session banner                                                */}
        {/* ============================================================ */}
        {!activeSession ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-amber-800 text-sm font-semibold">
              Nenhuma consultoria ativa
            </p>
            <p className="text-amber-600 text-xs mt-1">
              Inicie uma consultoria na sidebar para ver os dados financeiros do municipio.
            </p>
          </div>
        ) : (
          <div className="bg-[#00B4D8]/5 border border-[#00B4D8]/20 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#00E5A0]" />
            <span className="font-semibold text-[#0A2463]">
              {ctxMunicipality?.nome ?? "Carregando..."}
            </span>
            {loadingMuni && (
              <span className="ml-auto text-xs text-[#0A2463]/50">
                Carregando dados financeiros...
              </span>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* Deadline + Impact cards                                       */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Countdown */}
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-50">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                  Prazo
                </div>
                <div className="text-2xl font-extrabold text-[#0A2463]">
                  {daysUntilDeadline} dias
                </div>
                <div className="text-xs text-[var(--text2)]">
                  para o prazo BNCC Computacao (Agosto 2026)
                </div>
              </div>
            </div>
          </div>

          {/* Impact */}
          <div className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50">
                <svg
                  className="w-6 h-6 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                  Impacto
                </div>
                <div className="text-sm font-bold text-[#0A2463]">
                  Municipios que nao cumprirem perdem o VAAR em 2027
                </div>
                <div className="text-xs text-red-500 mt-0.5">
                  Perda direta de recursos do FUNDEB
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Overall progress                                              */}
        {/* ============================================================ */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Progresso Geral
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[#0A2463]">
                {overallProgress}%
              </div>
              <div className="text-xs text-[var(--text2)] mt-0.5">
                {totalDone} de {totalItems} itens concluidos
              </div>
            </div>
            <svg
              className="w-10 h-10 text-[#00B4D8] opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="mt-3 w-full bg-[var(--bg)] rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[#00B4D8] transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* Checklist phases                                              */}
        {/* ============================================================ */}
        <div className="space-y-5">
          {phases.map((phase) => {
            const progress = phaseProgress(phase);
            return (
              <div
                key={phase.id}
                className="bg-white border border-[var(--border)] rounded-xl overflow-hidden"
              >
                {/* Phase header */}
                <div
                  className="px-5 py-4 flex items-center justify-between"
                  style={{
                    background: phase.bgColor,
                    borderBottom: `1px solid ${phase.borderColor}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: phase.color }}
                    >
                      {phase.label}
                    </span>
                    <span className="text-xs text-[var(--text2)]">
                      {phase.deadline}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold" style={{ color: phase.color }}>
                      {progress}%
                    </span>
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: phase.color,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Checklist items */}
                <div className="divide-y divide-[var(--border)]">
                  {phase.items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-[var(--bg)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItem(phase.id, item.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#00B4D8] focus:ring-[#00B4D8] accent-[#00B4D8]"
                      />
                      <span
                        className={`text-sm leading-relaxed ${
                          item.checked
                            ? "line-through text-[var(--text3)]"
                            : "text-[var(--text1)]"
                        }`}
                      >
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* 3 Structural Axes                                             */}
        {/* ============================================================ */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-[#0A2463] mb-1">
            Os 3 Eixos Estruturantes
          </h2>
          <p className="text-xs text-[var(--text3)] mb-5">
            A BNCC Computacao organiza as competencias em tres eixos complementares
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {EIXOS.map((eixo) => (
              <div
                key={eixo.title}
                className="border border-[var(--border)] rounded-xl p-4 hover:border-[#00B4D8]/40 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#00B4D8]/10 text-[#00B4D8] mb-3">
                  {eixo.icon}
                </div>
                <h3 className="text-sm font-bold text-[#0A2463] mb-1">
                  {eixo.title}
                </h3>
                <p className="text-xs text-[var(--text2)] leading-relaxed">
                  {eixo.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* Financial Impact Calculator                                   */}
        {/* ============================================================ */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-[#0A2463] mb-1">
            Impacto Financeiro
          </h2>
          <p className="text-xs text-[var(--text3)] mb-5">
            Simulacao do impacto financeiro em caso de nao cumprimento
          </p>

          {!activeSession ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">
                Inicie uma consultoria para calcular o impacto financeiro do municipio.
              </p>
            </div>
          ) : loadingMuni ? (
            <div className="animate-pulse space-y-3">
              <div className="h-5 w-48 bg-gray-200 rounded" />
              <div className="h-5 w-64 bg-gray-200 rounded" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current VAAR */}
              <div className="border border-[var(--border)] rounded-xl p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                  VAAR Atual
                </div>
                <div className="text-2xl font-extrabold text-[#00B4D8] mt-1">
                  {vaarAmount != null
                    ? formatCurrency(Number(vaarAmount))
                    : "N/D"}
                </div>
                <div className="text-xs text-[var(--text2)] mt-0.5">
                  {muniData?.nome ?? ctxMunicipality?.nome ?? "--"}
                </div>
              </div>

              {/* Loss if non-compliant */}
              <div className="border border-red-200 bg-red-50 rounded-xl p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  Se nao cumprir
                </div>
                <div className="text-2xl font-extrabold text-red-600 mt-1">
                  {vaarAmount != null
                    ? `- ${formatCurrency(Number(vaarAmount))}`
                    : "N/D"}
                </div>
                <div className="text-xs text-red-500 mt-0.5">
                  Perda de R${" "}
                  {vaarAmount != null
                    ? formatCurrency(Number(vaarAmount)).replace("R$ ", "")
                    : "?"}{" "}
                  em 2027
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* Legal References                                              */}
        {/* ============================================================ */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-[#0A2463] mb-1">
            Fundamentacao Legal
          </h2>
          <p className="text-xs text-[var(--text3)] mb-5">
            Base normativa para as condicionalidades de computacao no FUNDEB
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LEGAL_REFS.map((ref) => (
              <div
                key={ref.title}
                className="border border-[var(--border)] rounded-lg px-4 py-3 hover:border-[#00B4D8]/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#0A2463]/5">
                    <svg
                      className="w-4 h-4 text-[#0A2463]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0A2463]">
                      {ref.title}
                    </div>
                    <div className="text-xs font-medium text-[#00B4D8]">
                      {ref.ref}
                    </div>
                    <div className="text-xs text-[var(--text2)] mt-1 leading-relaxed">
                      {ref.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
