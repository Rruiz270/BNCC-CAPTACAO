"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";
import { ACTION_PLAN_WEEKS } from "@/lib/constants";

type TaskStatus = "pending" | "progress" | "done";

interface TaskItem {
  id: number;
  tarefa: string;
  status: TaskStatus;
  notes: string | null;
  responsavel: string | null;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pendente", bg: "bg-gray-100", text: "text-gray-600" },
  progress: { label: "Em andamento", bg: "bg-amber-50", text: "text-amber-700" },
  done: { label: "Concluido", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const STATUS_CYCLE: TaskStatus[] = ["pending", "progress", "done"];

// Fallback tasks for when no session is active
const WEEK_TASKS: Record<number, string[]> = {
  1: ["Coletar dados atuais", "Identificar categorias faltantes", "Mapear escolas rurais", "Reuniao com equipe pedagogica"],
  2: ["Aprovar plano com secretario", "Iniciar reclassificacao de matriculas", "Contatar escolas conveniadas"],
  3: ["Registrar AEE dupla matricula", "Reclassificar escolas rurais", "Verificar integral"],
  4: ["Expandir matriculas integrais", "Formalizar parcerias conveniadas", "Documentar evidencias"],
  5: ["Verificar registros no sistema", "Corrigir inconsistencias", "Preparar relatorio"],
  6: ["Ultima verificacao", "Validar com equipe", "Backup de documentos"],
  7: ["Verificacao final do Censo", "Confirmar envio"],
};

export default function PlanoDeAcaoSemanaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const weekNumber = parseInt(slug, 10);
  const { activeSession, municipality } = useConsultoria();
  const municipalityId = activeSession?.municipalityId;

  const week = ACTION_PLAN_WEEKS.find((w) => w.semana === weekNumber);

  const [dbTasks, setDbTasks] = useState<TaskItem[]>([]);
  const [localStates, setLocalStates] = useState<Record<number, { status: TaskStatus; notes: string }>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB or use fallback (fetch-on-key-change with fallback init)
  useEffect(() => {
    if (!municipalityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset DB tasks when no session
      setDbTasks([]);
      // Init local states for fallback tasks
      const fallback = WEEK_TASKS[weekNumber] || [];
      const states: Record<number, { status: TaskStatus; notes: string }> = {};
      fallback.forEach((_, i) => {
        states[i] = { status: "pending", notes: "" };
      });
      setLocalStates(states);
      setLoaded(true);
      return;
    }

    fetch(`/api/action-plans?municipalityId=${municipalityId}&phase=curto`)
      .then((r) => r.json())
      .then((data) => {
        const weekTasks = (data.tasks || []).filter(
          (t: TaskItem & { semana: number }) => t.semana === weekNumber
        );
        setDbTasks(weekTasks);
      })
      .catch(() => setDbTasks([]))
      .finally(() => setLoaded(true));
  }, [municipalityId, weekNumber]);

  const saveTask = useCallback(
    (taskId: number, updates: Partial<TaskItem>) => {
      if (!municipalityId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSaving(true);
        fetch(`/api/action-plans/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
          .catch(() => {})
          .finally(() => setSaving(false));
      }, 500);
    },
    [municipalityId]
  );

  if (!week) {
    return (
      <div>
        <PageHeader title="Semana nao encontrada" />
        <div className="max-w-7xl mx-auto px-8 py-12 text-center">
          <p className="text-[var(--text2)] mb-4">A semana &quot;{slug}&quot; nao foi encontrada.</p>
          <Link href="/plano-de-acao" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Plano de Acao
          </Link>
        </div>
      </div>
    );
  }

  // Use DB tasks if available, else fallback
  const useDb = dbTasks.length > 0;
  const fallbackTasks = WEEK_TASKS[weekNumber] || [];

  const cycleStatusDb = (taskId: number) => {
    setDbTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const idx = STATUS_CYCLE.indexOf(t.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        saveTask(taskId, { status: next });
        return { ...t, status: next };
      })
    );
  };

  const updateNotesDb = (taskId: number, notes: string) => {
    setDbTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        saveTask(taskId, { notes });
        return { ...t, notes };
      })
    );
  };

  const cycleStatusLocal = (idx: number) => {
    setLocalStates((prev) => {
      const current = prev[idx]?.status || "pending";
      const cidx = STATUS_CYCLE.indexOf(current);
      const next = STATUS_CYCLE[(cidx + 1) % STATUS_CYCLE.length];
      return { ...prev, [idx]: { ...prev[idx], status: next } };
    });
  };

  const completedCount = useDb
    ? dbTasks.filter((t) => t.status === "done").length
    : Object.values(localStates).filter((s) => s.status === "done").length;
  const totalCount = useDb ? dbTasks.length : fallbackTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (!loaded) {
    return (
      <div>
        <PageHeader title={week.label} description={`Periodo: ${week.dates}`} />
        <div className="max-w-5xl mx-auto px-8 py-12 text-center text-[var(--text3)] text-sm animate-pulse-slow">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={week.label} description={`Periodo: ${week.dates}`} />

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        {/* Back link + session */}
        <div className="flex items-center justify-between">
          <Link href="/plano-de-acao" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Plano de Acao
          </Link>
          {municipality && (
            <div className="flex items-center gap-2 text-xs text-[var(--text2)]">
              <span className="w-2 h-2 rounded-full bg-[#00E5A0]" />
              {municipality.nome}
              {saving && <span className="text-[var(--text3)] animate-pulse-slow ml-2">Salvando...</span>}
            </div>
          )}
        </div>

        {/* Week banner */}
        <div className="rounded-xl p-4 text-white flex items-center gap-3 animate-fade-in" style={{ backgroundColor: week.color }}>
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-lg font-bold">
            {week.semana}
          </span>
          <div>
            <div className="font-bold text-sm">{week.label}</div>
            <div className="text-white/80 text-xs">{week.dates}</div>
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          {useDb ? (
            dbTasks.map((task) => {
              const statusCfg = STATUS_CONFIG[task.status];
              return (
                <div
                  key={task.id}
                  className={`bg-white border rounded-xl p-4 transition-all animate-fade-in ${
                    task.status === "done" ? "border-emerald-300 bg-emerald-50/30" : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => cycleStatusDb(task.id)}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        task.status === "done"
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-[var(--border)] hover:border-[var(--cyan)]"
                      }`}
                    >
                      {task.status === "done" && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${task.status === "done" ? "line-through text-[var(--text3)]" : "text-[var(--text)]"}`}>
                        {task.tarefa}
                      </span>
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Observacao..."
                          value={task.notes || ""}
                          onChange={(e) => updateNotesDb(task.id, e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--cyan)] bg-[var(--bg)] placeholder:text-[var(--text3)]"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => cycleStatusDb(task.id)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusCfg.bg} ${statusCfg.text} hover:opacity-80 transition-opacity`}
                    >
                      {statusCfg.label}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            fallbackTasks.map((task, idx) => {
              const state = localStates[idx] || { status: "pending" as TaskStatus, notes: "" };
              const statusCfg = STATUS_CONFIG[state.status];
              return (
                <div
                  key={idx}
                  className={`bg-white border rounded-xl p-4 transition-all animate-fade-in ${
                    state.status === "done" ? "border-emerald-300 bg-emerald-50/30" : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => cycleStatusLocal(idx)}
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        state.status === "done"
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-[var(--border)] hover:border-[var(--cyan)]"
                      }`}
                    >
                      {state.status === "done" && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${state.status === "done" ? "line-through text-[var(--text3)]" : "text-[var(--text)]"}`}>
                      {task}
                    </span>
                    <button
                      onClick={() => cycleStatusLocal(idx)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusCfg.bg} ${statusCfg.text} hover:opacity-80 transition-opacity`}
                    >
                      {statusCfg.label}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Progress Summary */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Progresso da Semana {week.semana}
              </div>
              <div className="text-xl font-extrabold mt-1 text-[var(--text)]">
                {completedCount} de {totalCount} tarefas concluidas
              </div>
            </div>
            <div className="text-2xl font-extrabold" style={{ color: progressPercent === 100 ? "var(--green)" : week.color }}>
              {progressPercent}%
            </div>
          </div>
          <div className="w-full bg-[var(--bg)] rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? "var(--green)" : week.color }}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          {weekNumber > 1 ? (
            <Link href={`/plano-de-acao/${weekNumber - 1}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--cyan)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Semana {weekNumber - 1}
            </Link>
          ) : <div />}
          {weekNumber < 7 ? (
            <Link href={`/plano-de-acao/${weekNumber + 1}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--cyan)] transition-colors">
              Semana {weekNumber + 1}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
