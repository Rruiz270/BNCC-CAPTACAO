"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TransferLeadModal } from "@/components/transfer-lead-modal";
import { formatCurrency, formatNumber } from "@/lib/utils";

type ViewMode = "mine" | "pool" | "all";

interface AssignedConsultor {
  id: string;
  name: string | null;
  email: string | null;
}

interface Session {
  id: number;
  municipalityId: number;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  assignedConsultor: AssignedConsultor | null;
  assignedAt: string | null;
  isMine: boolean;
  municipality: {
    id: number;
    nome: string;
    totalMatriculas: number | null;
    receitaTotal: number | null;
  };
  complianceProgress: number;
  actionPlanProgress: number;
}

interface Viewer {
  id: string;
  role: string;
  isAdmin: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
    paused: "bg-orange-50 text-orange-700 border-orange-200",
  };
  const labels: Record<string, string> = {
    active: "Ativa",
    completed: "Concluida",
    paused: "Pausada",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${styles[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {labels[status] || status}
    </span>
  );
}

function OwnerBadge({ owner, isMine }: { owner: AssignedConsultor | null; isMine: boolean }) {
  if (!owner) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        No pool
      </span>
    );
  }
  const label = owner.name || owner.email || owner.id;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
        isMine
          ? "bg-[var(--navy)]/10 text-[var(--navy)] border-[var(--navy)]/20"
          : "bg-gray-50 text-gray-600 border-gray-200"
      }`}
      title={isMine ? "Voce" : `Com ${label}`}
    >
      {isMine ? "Voce" : label}
    </span>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ConsultoriasPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("mine");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [actioning, setActioning] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [transferFor, setTransferFor] = useState<Session | null>(null);

  const load = useCallback(async (v: ViewMode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/consultorias?view=${v}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar");
      setSessions(data.sessions || []);
      setViewer(data.viewer || null);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(view); }, [view, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function claim(id: number) {
    setActioning(id);
    try {
      const res = await fetch(`/api/consultorias/${id}/claim`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Falha ao assumir");
      setToast("Lead assumido com sucesso");
      await load(view);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Erro");
    } finally {
      setActioning(null);
    }
  }

  async function release(id: number) {
    if (!confirm("Devolver este lead para o pool?")) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/consultorias/${id}/release`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Falha ao soltar");
      setToast("Lead devolvido ao pool");
      await load(view);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Erro");
    } finally {
      setActioning(null);
    }
  }

  const filtered = sessions
    .filter((s) => statusFilter === "all" || s.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === "name") return (a.municipality?.nome || "").localeCompare(b.municipality?.nome || "");
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

  const totalActive = sessions.filter((s) => s.status === "active").length;
  const totalCompleted = sessions.filter((s) => s.status === "completed").length;
  const avgCompliance = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + s.complianceProgress, 0) / sessions.length)
    : 0;
  const totalReceita = sessions.reduce((sum, s) => sum + (Number(s.municipality?.receitaTotal) || 0), 0);

  const viewChips: Array<{ key: ViewMode; label: string; visible: boolean }> = [
    { key: "mine", label: "Meus", visible: true },
    { key: "pool", label: "Pool", visible: true },
    { key: "all", label: "Todos", visible: !!viewer?.isAdmin },
  ];

  return (
    <div>
      <PageHeader
        label="Historico"
        title="Consultorias"
        description="Todas as consultorias realizadas - historico completo com metricas"
      />

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[var(--border)] rounded-xl p-5 animate-pulse">
                <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
                <div className="h-7 w-32 bg-gray-200 rounded" />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Total Consultorias" value={formatNumber(sessions.length)} icon="&#x1f4cb;" color="var(--navy)" />
              <StatCard label="Ativas" value={formatNumber(totalActive)} sub={`${totalCompleted} concluidas`} icon="&#x2705;" color="var(--green)" />
              <StatCard label="Compliance Medio" value={`${avgCompliance}%`} icon="&#x1f4ca;" color="var(--cyan)" />
              <StatCard label="Receita Total Atendida" value={formatCurrency(totalReceita)} icon="&#x1f4b0;" color="var(--navy)" />
            </>
          )}
        </div>

        {/* View chips */}
        <div className="flex items-center gap-4 bg-white border border-[var(--border)] rounded-xl px-5 py-3 flex-wrap">
          <span className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wider">Ver:</span>
          {viewChips.filter((v) => v.visible).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                view === v.key
                  ? "bg-[var(--navy)] text-white"
                  : "bg-gray-100 text-[var(--text2)] hover:bg-gray-200"
              }`}
            >
              {v.label}
            </button>
          ))}

          <div className="h-5 w-px bg-gray-200 mx-2" />

          <span className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wider">Status:</span>
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === f
                  ? "bg-[var(--navy)] text-white"
                  : "bg-gray-100 text-[var(--text2)] hover:bg-gray-200"
              }`}
            >
              {{ all: "Todas", active: "Ativas", completed: "Concluidas" }[f]}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wider">Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "name")}
            className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-white text-[var(--text2)]"
          >
            <option value="date">Data</option>
            <option value="name">Municipio</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 mb-4">
                <div className="h-4 flex-1 bg-gray-100 rounded" />
                <div className="h-4 w-20 bg-gray-100 rounded" />
                <div className="h-4 w-24 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-xl p-12 text-center">
            <div className="text-4xl mb-3 opacity-30">&#x1f4c4;</div>
            <p className="text-[var(--text2)] font-medium">
              {view === "mine" ? "Voce ainda nao assumiu nenhum lead." : "Nenhuma consultoria nesta visualizacao."}
            </p>
            <p className="text-[var(--text3)] text-sm mt-1">
              {view === "mine" ? "Va para o Pool e assuma um lead." : "Tente outra visualizacao."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Municipio</th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Responsavel</th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Status</th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Inicio</th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] min-w-[120px]">Compliance</th>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] min-w-[120px]">Plano</th>
                    <th className="text-right py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Receita Base</th>
                    <th className="text-center py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const inPool = !s.assignedConsultor;
                    const canSeeDetail = s.isMine || !!viewer?.isAdmin;
                    const canAct = s.isMine || !!viewer?.isAdmin;
                    return (
                      <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[var(--text)]">{s.municipality?.nome ?? "-"}</div>
                          <div className="text-[11px] text-[var(--text3)]">
                            {s.municipality?.totalMatriculas ? `${formatNumber(s.municipality.totalMatriculas)} matriculas` : ""}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <OwnerBadge owner={s.assignedConsultor} isMine={s.isMine} />
                        </td>
                        <td className="py-3 px-4"><StatusBadge status={s.status} /></td>
                        <td className="py-3 px-4 text-[var(--text2)]">{formatDate(s.startDate)}</td>
                        <td className="py-3 px-4"><ProgressBar value={s.complianceProgress} color="var(--green)" /></td>
                        <td className="py-3 px-4"><ProgressBar value={s.actionPlanProgress} color="var(--cyan)" /></td>
                        <td className="py-3 px-4 text-right font-medium text-[var(--text2)] tabular-nums">
                          {s.municipality?.receitaTotal ? formatCurrency(Number(s.municipality.receitaTotal)) : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {inPool && (
                              <button
                                onClick={() => claim(s.id)}
                                disabled={actioning === s.id}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--cyan)] text-white hover:bg-[var(--cyan)]/80 transition-colors disabled:opacity-50"
                              >
                                {actioning === s.id ? "..." : "Assumir"}
                              </button>
                            )}
                            {canSeeDetail && (
                              <Link
                                href={`/consultorias/${s.id}`}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--navy)] text-white hover:bg-[var(--navy)]/80 transition-colors"
                              >
                                Detalhes
                              </Link>
                            )}
                            {canAct && !inPool && (
                              <>
                                <button
                                  onClick={() => setTransferFor(s)}
                                  disabled={actioning === s.id}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gray-100 text-[var(--text)] hover:bg-gray-200 transition-colors disabled:opacity-50"
                                >
                                  Transferir
                                </button>
                                <button
                                  onClick={() => release(s.id)}
                                  disabled={actioning === s.id}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                >
                                  Soltar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Transfer modal */}
      {transferFor && (
        <TransferLeadModal
          open={!!transferFor}
          onOpenChange={(open) => { if (!open) setTransferFor(null); }}
          consultoriaId={transferFor.id}
          currentOwnerName={transferFor.assignedConsultor?.name || null}
          onTransferred={() => {
            setToast("Lead transferido com sucesso");
            load(view);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--navy)] text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
