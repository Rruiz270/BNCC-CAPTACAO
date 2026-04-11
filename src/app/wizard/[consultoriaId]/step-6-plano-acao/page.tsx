"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

type TaskStatus = "done" | "progress" | "pending" | "late";

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: "done", label: "Done", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "progress", label: "Em andamento", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "pending", label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "late", label: "Atrasado", color: "bg-red-100 text-red-700 border-red-300" },
];

const PHASE_LABELS: Record<string, { label: string; desc: string }> = {
  curto: { label: "Curto prazo", desc: "Ate 7 semanas (Censo)" },
  medio: { label: "Medio prazo", desc: "7 a 20 semanas" },
  longo: { label: "Longo prazo", desc: "20+ semanas" },
};

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

export default function StepPlanoAcao() {
  const step = getStepById(6)!;
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
    fetch(`/api/action-plans?municipalityId=${muniId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks);
          setDirty(new Set());
        }
      })
      .catch((e) => setError(String(e)));
  }, [muniId]);

  useEffect(() => {
    load();
  }, [load]);

  const byPhase = useMemo(() => {
    const map: Record<string, Task[]> = { curto: [], medio: [], longo: [] };
    for (const t of tasks) {
      const p = t.phase ?? "curto";
      if (!map[p]) map[p] = [];
      map[p].push(t);
    }
    return map;
  }, [tasks]);

  const totals = useMemo(() => {
    const r: Record<string, { total: number; done: number }> = {
      curto: { total: 0, done: 0 },
      medio: { total: 0, done: 0 },
      longo: { total: 0, done: 0 },
    };
    for (const t of tasks) {
      const p = t.phase ?? "curto";
      if (!r[p]) r[p] = { total: 0, done: 0 };
      r[p].total++;
      if (t.status === "done") r[p].done++;
    }
    return r;
  }, [tasks]);

  const totalDone = tasks.filter((t) => t.status === "done").length;
  const totalPct = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0;
  const blockingCount = tasks.filter(
    (t) => t.phase === "curto" && (t.status === "pending" || t.status === "late")
  ).length;

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
      await updateStep(6, {
        status: "in_progress",
        payload: {
          totals: {
            curto:
              totals.curto.total > 0 ? Math.round((totals.curto.done / totals.curto.total) * 100) : 0,
            medio:
              totals.medio.total > 0 ? Math.round((totals.medio.done / totals.medio.total) * 100) : 0,
            longo:
              totals.longo.total > 0 ? Math.round((totals.longo.done / totals.longo.total) * 100) : 0,
            total_pct: totalPct,
          },
          blockingCount,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }, [muniId, dirty, tasks, consultoriaId, updateStep, totals, totalPct, blockingCount]);

  const canAdvance = tasks.length > 0 && dirty.size === 0 && blockingCount === 0;
  const blockReason =
    tasks.length === 0
      ? "Nenhuma tarefa de plano de acao cadastrada"
      : dirty.size > 0
      ? "Salve as alteracoes antes de avancar"
      : blockingCount > 0
      ? `${blockingCount} tarefa(s) de curto prazo ainda bloqueando`
      : undefined;

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Plano de Acao</h2>
      <p className="text-sm text-[var(--text3)] mb-4">
        Tarefas divididas em curto, medio e longo prazo. Salvar consolida via{" "}
        <code>sp_consolidar_plano_acao</code>.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Totals + save */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        {(["curto", "medio", "longo"] as const).map((p) => {
          const t = totals[p];
          const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
          return (
            <div key={p} className="border border-[var(--border)] rounded-lg p-3">
              <div className="text-[10px] uppercase text-[var(--text3)]">
                {PHASE_LABELS[p].label}
              </div>
              <div className="text-lg font-extrabold text-[#00B4D8] mt-0.5">{pct}%</div>
              <div className="text-[10px] text-[var(--text3)]">
                {t.done} / {t.total} tarefas
              </div>
            </div>
          );
        })}
        <div className="border border-[var(--border)] rounded-lg p-3 flex flex-col justify-between">
          <div className="text-[10px] uppercase text-[var(--text3)]">Dirty: {dirty.size}</div>
          <button
            onClick={salvar}
            disabled={submitting || dirty.size === 0}
            className="mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#00B4D8] text-white disabled:bg-gray-200 disabled:text-gray-400"
          >
            {submitting ? "Salvando..." : "Salvar + consolidar"}
          </button>
        </div>
      </div>

      {/* Listagem por fase */}
      {tasks.length === 0 ? (
        <div className="border border-[var(--border)] rounded-lg p-4 text-xs text-gray-400 mb-4">
          Nenhuma tarefa cadastrada. Rode o seed ou crie tarefas pelo admin.
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          {(["curto", "medio", "longo"] as const).map((p) => {
            const list = byPhase[p] ?? [];
            if (list.length === 0) return null;
            return (
              <div key={p} className="border border-[var(--border)] rounded-lg">
                <div className="px-3 py-2 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#00B4D8]">
                    {PHASE_LABELS[p].label}
                  </div>
                  <div className="text-[10px] text-[var(--text3)]">{PHASE_LABELS[p].desc}</div>
                </div>
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
                          <div className="text-[10px] text-[var(--text3)] mt-0.5">
                            {t.semanaLabel ?? `Semana ${t.semana ?? "-"}`}
                            {t.dueDate &&
                              ` · prazo ${new Date(t.dueDate).toLocaleDateString("pt-BR")}`}
                          </div>
                        </div>
                        <select
                          value={t.status}
                          onChange={(e) => update(t.id, { status: e.target.value as TaskStatus })}
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Responsavel"
                          value={t.responsavel ?? ""}
                          onChange={(e) => update(t.id, { responsavel: e.target.value })}
                          className="px-2 py-1 text-[10px] border border-[var(--border)] rounded"
                        />
                        <input
                          type="text"
                          placeholder="Notas"
                          value={t.notes ?? ""}
                          onChange={(e) => update(t.id, { notes: e.target.value })}
                          className="px-2 py-1 text-[10px] border border-[var(--border)] rounded"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {saving && <div className="mt-2 text-[10px] text-[#00B4D8]">salvando progresso...</div>}
    </StepShell>
  );
}
