"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { useConsultoria } from "@/lib/consultoria-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Municipality {
  id: number;
  nome: string;
  totalMatriculas: number | null;
  receitaTotal: number | null;
  totalEscolas: number | null;
  totalDocentes: number | null;
  codigoIbge: string | null;
  pctInternet: number | null;
  pctBiblioteca: number | null;
}

interface Session {
  id: number;
  municipalityId: number;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  municipality: Municipality;
  complianceProgress: number;
  actionPlanProgress: number;
}

interface Snapshot {
  id: number;
  consultoriaId: number;
  reason: string;
  createdAt: string;
}

type Phase = "R1" | "R2" | "R3" | "Concluida";

interface EnrichedSession extends Session {
  phase: Phase;
  snapshots: Snapshot[];
  hasBncc: boolean;
  potencial: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CENSO_DEADLINE = new Date("2026-05-27T23:59:59");

const PHASE_CONFIG: Record<Phase, { label: string; color: string; bg: string; border: string }> = {
  R1: { label: "R1 - Curto Prazo", color: "#D4553A", bg: "bg-red-50", border: "border-red-200" },
  R2: { label: "R2 - Medio Prazo", color: "#00B4D8", bg: "bg-blue-50", border: "border-blue-200" },
  R3: { label: "R3 - Longo Prazo", color: "#0891B2", bg: "bg-cyan-50", border: "border-cyan-200" },
  Concluida: { label: "Concluida", color: "#00E5A0", bg: "bg-green-50", border: "border-green-200" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntilCenso(): number {
  const now = new Date();
  const diff = CENSO_DEADLINE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function determinePhase(session: Session, snapshots: Snapshot[], hasBncc: boolean): Phase {
  if (session.status === "completed") return "Concluida";
  // R1: active, no snapshot yet
  if (snapshots.length === 0) return "R1";
  // R2: has snapshot from R1, BNCC pendente
  if (!hasBncc) return "R2";
  // R3: BNCC done, waiting for final report
  return "R3";
}

// Estimate potential based on receita (~5% recovery is a common heuristic)
function estimatePotencial(session: Session): number {
  const receita = Number(session.municipality?.receitaTotal) || 0;
  return Math.round(receita * 0.05);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PhaseBadge({ phase }: { phase: Phase }) {
  const cfg = PHASE_CONFIG[phase];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg} ${cfg.border}`}
      style={{ color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function CensoCountdown() {
  const days = daysUntilCenso();
  const urgent = days <= 30;
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
        urgent
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-orange-50 text-orange-700 border border-orange-200"
      }`}
    >
      <span className="text-lg">{urgent ? "\u26A0" : "\u23F0"}</span>
      <span>
        {days} dia{days !== 1 ? "s" : ""} para o Censo (27/mai)
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border)]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const { sessions: ctxSessions, loading: ctxLoading } = useConsultoria();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [snapshotMap, setSnapshotMap] = useState<Record<number, Snapshot[]>>({});
  const [bnccMap, setBnccMap] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<Phase | "all">("all");
  const [search, setSearch] = useState("");

  // Fetch sessions from API
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/consultorias");
        if (!res.ok) throw new Error("Falha ao carregar consultorias");
        const data = await res.json();
        const list: Session[] = data.sessions || [];
        setSessions(list);

        // Fetch snapshots for each session in parallel
        const snapshotResults = await Promise.all(
          list.map(async (s) => {
            try {
              const snapRes = await fetch(`/api/snapshots?consultoriaId=${s.id}`);
              if (!snapRes.ok) return { id: s.id, snapshots: [] };
              const snapData = await snapRes.json();
              return { id: s.id, snapshots: (snapData.snapshots || []) as Snapshot[] };
            } catch {
              return { id: s.id, snapshots: [] };
            }
          })
        );

        const snapMap: Record<number, Snapshot[]> = {};
        for (const r of snapshotResults) {
          snapMap[r.id] = r.snapshots;
        }
        setSnapshotMap(snapMap);

        // For BNCC status: check action_plans with phase='medio' completion as proxy
        // A session "has BNCC" if its compliance is >= 80% (heuristic)
        const bncc: Record<number, boolean> = {};
        for (const s of list) {
          bncc[s.id] = s.complianceProgress >= 80;
        }
        setBnccMap(bncc);
      } catch {
        // Fallback to context sessions if API fails
        setSessions(ctxSessions as Session[]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ctxSessions]);

  // Enrich sessions with phase, snapshots, potencial
  const enriched: EnrichedSession[] = useMemo(() => {
    return sessions.map((s) => {
      const snapshots = snapshotMap[s.id] || [];
      const hasBncc = bnccMap[s.id] || false;
      const phase = determinePhase(s, snapshots, hasBncc);
      const potencial = estimatePotencial(s);
      return { ...s, phase, snapshots, hasBncc, potencial };
    });
  }, [sessions, snapshotMap, bnccMap]);

  // Filtered and searched list
  const filteredSessions = useMemo(() => {
    return enriched
      .filter((s) => phaseFilter === "all" || s.phase === phaseFilter)
      .filter((s) =>
        search === "" || (s.municipality?.nome ?? "").toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        // R1 first (urgent), then R2, R3, Concluida
        const order: Record<Phase, number> = { R1: 0, R2: 1, R3: 2, Concluida: 3 };
        return order[a.phase] - order[b.phase];
      });
  }, [enriched, phaseFilter, search]);

  // Summary stats
  const stats = useMemo(() => {
    const total = enriched.length;
    const r1 = enriched.filter((s) => s.phase === "R1").length;
    const r2 = enriched.filter((s) => s.phase === "R2").length;
    const r3 = enriched.filter((s) => s.phase === "R3").length;
    const concluidas = enriched.filter((s) => s.phase === "Concluida").length;
    const potencialTotal = enriched.reduce((sum, s) => sum + s.potencial, 0);
    return { total, r1, r2, r3, concluidas, potencialTotal };
  }, [enriched]);

  const isLoading = loading || ctxLoading;

  return (
    <div>
      <PageHeader
        label="Portfolio"
        title="Painel do Consultor"
        description="Visao consolidada de todas as consultorias - gerencie sua carteira de municipios"
      >
        <CensoCountdown />
      </PageHeader>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {/* ---------- Summary KPIs ---------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-[var(--border)] rounded-xl p-5 animate-pulse">
                <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                <div className="h-7 w-16 bg-gray-200 rounded" />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Total Consultorias" value={String(stats.total)} color="var(--navy)" />
              <StatCard
                label="R1 Pendentes"
                value={String(stats.r1)}
                sub="Curto prazo"
                color="#D4553A"
              />
              <StatCard
                label="R2 Pendentes"
                value={String(stats.r2)}
                sub="Medio prazo"
                color="#00B4D8"
              />
              <StatCard
                label="R3 Pendentes"
                value={String(stats.r3)}
                sub="Longo prazo"
                color="#0891B2"
              />
              <StatCard
                label="Concluidas"
                value={String(stats.concluidas)}
                color="var(--green)"
              />
              <StatCard
                label="Potencial Total"
                value={formatBRL(stats.potencialTotal)}
                color="var(--cyan)"
              />
            </>
          )}
        </div>

        {/* ---------- Filters & Search ---------- */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white border border-[var(--border)] rounded-xl px-5 py-3">
          {/* Phase filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wider">
              Fase:
            </span>
            {(["all", "R1", "R2", "R3", "Concluida"] as const).map((f) => {
              const labels: Record<string, string> = {
                all: "Todas",
                R1: "R1",
                R2: "R2",
                R3: "R3",
                Concluida: "Concluidas",
              };
              return (
                <button
                  key={f}
                  onClick={() => setPhaseFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    phaseFilter === f
                      ? "bg-[var(--navy)] text-white"
                      : "bg-gray-100 text-[var(--text2)] hover:bg-gray-200"
                  }`}
                >
                  {labels[f]}
                  {f !== "all" && (
                    <span className="ml-1 opacity-60">
                      ({f === "R1" ? stats.r1 : f === "R2" ? stats.r2 : f === "R3" ? stats.r3 : stats.concluidas})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar municipio..."
            className="w-full sm:w-64 px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[#00B4D8] bg-white text-[var(--text1)]"
          />

          {/* New consultoria button */}
          <Link
            href="/wizard"
            className="whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--cyan)] text-white hover:bg-[var(--cyan)]/80 transition-colors"
          >
            + Iniciar Nova Consultoria
          </Link>
        </div>

        {/* ---------- Table ---------- */}
        {isLoading ? (
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-xl p-12 text-center">
            <div className="text-4xl mb-3 opacity-30">{"\uD83D\uDCCB"}</div>
            <p className="text-[var(--text2)] font-medium">Nenhuma consultoria encontrada</p>
            <p className="text-[var(--text3)] text-sm mt-1">
              {search
                ? `Nenhum resultado para "${search}"`
                : "Inicie uma nova consultoria pelo botao acima"}
            </p>
            <Link
              href="/wizard"
              className="inline-block mt-4 px-5 py-2 rounded-lg text-sm font-semibold bg-[var(--cyan)] text-white hover:bg-[var(--cyan)]/80 transition-colors"
            >
              + Iniciar Nova Consultoria
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Municipio
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Fase
                    </th>
                    <th className="text-right py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Potencial R$
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] min-w-[120px]">
                      Compliance %
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] min-w-[120px]">
                      Plano %
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Ultima Atividade
                    </th>
                    <th className="text-center py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors"
                    >
                      {/* Municipio */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--text1)]">
                          {s.municipality?.nome ?? "-"}
                        </div>
                        <div className="text-[11px] text-[var(--text3)]">
                          {s.municipality?.totalMatriculas
                            ? `${Number(s.municipality.totalMatriculas).toLocaleString("pt-BR")} matriculas`
                            : ""}
                        </div>
                      </td>

                      {/* Fase */}
                      <td className="py-3 px-4">
                        <PhaseBadge phase={s.phase} />
                      </td>

                      {/* Potencial */}
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-[var(--cyan)]">
                        {formatBRL(s.potencial)}
                      </td>

                      {/* Compliance % */}
                      <td className="py-3 px-4">
                        <ProgressBar value={s.complianceProgress} color="var(--green)" />
                      </td>

                      {/* Plano % */}
                      <td className="py-3 px-4">
                        <ProgressBar value={s.actionPlanProgress} color="var(--cyan)" />
                      </td>

                      {/* Ultima Atividade */}
                      <td className="py-3 px-4 text-[var(--text2)] text-xs">
                        {formatDate(s.endDate ?? s.startDate)}
                      </td>

                      {/* Acoes */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/wizard/${s.id}/step-1-cidade`}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--navy)] text-white hover:bg-[var(--navy)]/80 transition-colors"
                          >
                            Wizard
                          </Link>
                          <Link
                            href={`/relatorios?sessionId=${s.id}`}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--cyan)]/10 text-[var(--cyan)] hover:bg-[var(--cyan)]/20 transition-colors"
                          >
                            Relatorio
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer summary */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-gray-50/50">
              <span className="text-xs text-[var(--text3)]">
                {filteredSessions.length} de {enriched.length} consultoria(s)
              </span>
              <span className="text-xs font-semibold text-[var(--text2)]">
                Potencial filtrado:{" "}
                <span className="text-[var(--cyan)]">
                  {formatBRL(filteredSessions.reduce((sum, s) => sum + s.potencial, 0))}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
