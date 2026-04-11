"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";
import { ACTION_PLAN_WEEKS } from "@/lib/constants";

type TaskStatus = "done" | "progress" | "pending" | "late";

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: "done", label: "Done", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "progress", label: "Em andamento", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "pending", label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "late", label: "Atrasado", color: "bg-red-100 text-red-700 border-red-300" },
];

interface Task {
  id: number;
  phase: string;
  semana: number | null;
  semanaLabel: string | null;
  taskKey: string | null;
  tarefa: string;
  descricao: string | null;
  responsavel: string | null;
  status: TaskStatus;
  dueDate: string | null;
  notes: string | null;
}

interface SessionData {
  id: number;
  municipality?: { id: number; nome: string };
}

export default function StepExecucao() {
  const step = getStepById(8)!;
  const { consultoriaId, updateStep, saving } = useWizard();

  const [session, setSession] = useState<SessionData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/consultorias`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.sessions?.find((x: SessionData) => x.id === consultoriaId);
        setSession(s || null);
      })
      .catch(() => {});
  }, [consultoriaId]);

  const muniId = session?.municipality?.id ?? null;

  const load = useCallback(() => {
    if (!muniId) return;
    fetch(`/api/action-plans?municipalityId=${muniId}&phase=curto`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks.filter((t: Task) => t.phase === "curto"));
          setDirty(new Set());
        }
      })
      .catch((e) => setError(String(e)));
  }, [muniId]);

  useEffect(() => {
    load();
  }, [load]);

  const bySemana = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of tasks) {
      const k = t.semana ?? 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [tasks]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const late = tasks.filter((t) => t.status === "late").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Contagem regressiva
  const censo = new Date("2026-05-27");
  const today = new Date();
  const diasRestantes = Math.max(
    0,
    Math.ceil((censo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

  const update = (id: number, patch: Partial<Task>) => {
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty((cur) => new Set(cur).add(id));
  };

  const salvar = useCallback(async () => {
    if (!muniId || dirty.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = tasks
        .filter((t) => dirty.has(t.id))
        .map((t) => ({
          id: t.id,
          status: t.status,
          notes: t.notes,
          responsavel: t.responsavel,
        }));
      const res = await fetch(`/api/action-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipalityId: muniId,
          consultoriaId,
          tasks: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao salvar");
      setDirty(new Set());
      await updateStep(8, {
        status: "in_progress",
        payload: {
          pct_curto: pct,
          done_curto: done,
          late_curto: late,
          total_curto: total,
          updated_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }, [muniId, dirty, tasks, consultoriaId, updateStep, pct, done, late, total]);

  const canAdvance = dirty.size === 0;
  const blockReason =
    dirty.size > 0 ? "Salve as alteracoes antes de avancar" : undefined;

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Acompanhamento semanal</h2>
      <p className="text-sm text-[var(--text3)] mb-4">
        Acompanhe o progresso das 7 semanas ate o Dia do Censo Escolar (27/Mai/2026). Marque
        tarefas como concluidas, atualize notas e salve para consolidar.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Contagem regressiva + totais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] text-white rounded-lg p-4 md:col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-[#00B4D8]">
            Contagem regressiva
          </div>
          <div className="text-3xl font-extrabold mt-1">{diasRestantes} dias</div>
          <div className="text-xs text-white/60 mt-1">ate 27/05/2026</div>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-3">
          <div className="text-[10px] uppercase text-[var(--text3)]">Progresso curto</div>
          <div className="text-2xl font-extrabold text-[#00B4D8] mt-0.5">{pct}%</div>
          <div className="text-[10px] text-[var(--text3)]">
            {done} / {total} tarefas
          </div>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase text-[var(--text3)]">Atrasadas</div>
            <div className="text-2xl font-extrabold text-red-600 mt-0.5">{late}</div>
          </div>
          <button
            onClick={salvar}
            disabled={submitting || dirty.size === 0}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-[#00B4D8] text-white font-semibold hover:bg-[#0096B4] disabled:opacity-60"
          >
            {submitting ? "Salvando..." : `Salvar (${dirty.size})`}
          </button>
        </div>
      </div>

      {/* Semanas */}
      <h3 className="text-sm font-bold text-[var(--text1)] mb-3">
        7 semanas do plano de curto prazo
      </h3>

      {tasks.length === 0 ? (
        <div className="border border-[var(--border)] rounded-lg p-4 text-xs text-gray-400 mb-4">
          Nenhuma tarefa de curto prazo encontrada. Volte ao Step 6 para cadastrar ou rode o seed.
        </div>
      ) : (
        <div className="space-y-3">
          {ACTION_PLAN_WEEKS.map((w) => {
            const list = bySemana.get(w.semana) ?? [];
            const wDone = list.filter((t) => t.status === "done").length;
            const wPct = list.length > 0 ? Math.round((wDone / list.length) * 100) : 0;
            return (
              <div
                key={w.semana}
                className="border border-[var(--border)] rounded-lg overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3 bg-[var(--bg)] border-b border-[var(--border)]">
                  <div
                    className="w-2 h-10 rounded-full"
                    style={{ backgroundColor: w.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text1)] truncate">
                      {w.label}
                    </div>
                    <div className="text-[10px] text-[var(--text3)]">
                      {w.dates} · {wDone}/{list.length} tarefas · {wPct}%
                    </div>
                  </div>
                </div>
                {list.length === 0 ? (
                  <div className="p-3 text-[10px] text-[var(--text3)]">
                    Sem tarefas cadastradas para esta semana.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {list.map((t) => (
                      <div key={t.id} className="p-3 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[var(--text1)]">{t.tarefa}</div>
                            {t.descricao && (
                              <div className="text-[10px] text-[var(--text3)] mt-0.5">
                                {t.descricao}
                              </div>
                            )}
                            {t.dueDate && (
                              <div className="text-[10px] text-[var(--text3)] mt-0.5">
                                prazo {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                              </div>
                            )}
                          </div>
                          <select
                            value={t.status}
                            onChange={(e) =>
                              update(t.id, { status: e.target.value as TaskStatus })
                            }
                            className={`px-2 py-1 text-[10px] font-bold rounded border ${
                              STATUS_OPTIONS.find((s) => s.value === t.status)?.color ?? ""
                            }`}
                          >
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          placeholder="Notas / evidencia"
                          value={t.notes ?? ""}
                          onChange={(e) => update(t.id, { notes: e.target.value })}
                          className="w-full px-2 py-1 text-[10px] border border-[var(--border)] rounded"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {saving && <div className="mt-3 text-[10px] text-[#00B4D8]">salvando progresso...</div>}
    </StepShell>
  );
}
