"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";
import { ACTION_PLAN_WEEKS, ACTION_PLAN_PHASES } from "@/lib/constants";

type TaskStatus = "pending" | "progress" | "done";

interface TaskItem {
  id: number;
  phase: string;
  semana: number;
  semanaLabel: string;
  taskKey: string;
  tarefa: string;
  descricao: string | null;
  responsavel: string | null;
  status: TaskStatus;
  dueDate: string | null;
  notes: string | null;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pendente", bg: "bg-gray-100", text: "text-gray-600" },
  progress: { label: "Em andamento", bg: "bg-amber-50", text: "text-amber-700" },
  done: { label: "Concluido", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const STATUS_CYCLE: TaskStatus[] = ["pending", "progress", "done"];

export default function PlanoDeAcaoPage() {
  const { activeSession, municipality } = useConsultoria();
  const municipalityId = activeSession?.municipalityId;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load tasks from DB (fetch-on-key-change pattern)
  useEffect(() => {
    if (!municipalityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset tasks when session cleared
      setTasks([]);
      return;
    }
    setLoading(true);
    fetch(`/api/action-plans?municipalityId=${municipalityId}`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [municipalityId]);

  // Debounced save
  const saveTask = useCallback(
    (taskId: number, updates: Partial<TaskItem>) => {
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
    []
  );

  const cycleStatus = (taskId: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const idx = STATUS_CYCLE.indexOf(t.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        saveTask(taskId, { status: next });
        return { ...t, status: next };
      })
    );
  };

  const updateNotes = (taskId: number, notes: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        saveTask(taskId, { notes });
        return { ...t, notes };
      })
    );
  };

  // Phase stats
  const getPhaseStats = (phaseId: string) => {
    const phaseTasks = tasks.filter((t) => t.phase === phaseId);
    const total = phaseTasks.length;
    const done = phaseTasks.filter((t) => t.status === "done").length;
    return { total, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const overallStats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    progress: tasks.length > 0 ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0,
  };

  return (
    <div>
      <PageHeader
        title="Plano de Acao"
        description="Cronograma de implementacao FUNDEB em 3 horizontes"
      />

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Session info */}
        {!activeSession ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-amber-800 text-sm font-semibold">Nenhuma consultoria ativa</p>
            <p className="text-amber-600 text-xs mt-1">Inicie uma consultoria na sidebar para acompanhar o plano de acao.</p>
          </div>
        ) : (
          <div className="bg-[#00B4D8]/5 border border-[#00B4D8]/20 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#00E5A0]" />
            <span className="font-semibold text-[var(--navy)]">{municipality?.nome}</span>
            {saving && <span className="text-[var(--text3)] text-xs animate-pulse-slow ml-auto">Salvando...</span>}
          </div>
        )}

        {/* Overall Progress */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Progresso Geral do Plano
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--text)]">
                {loading ? "..." : `${overallStats.progress}%`}
              </div>
              <div className="text-xs text-[var(--text2)] mt-0.5">
                {overallStats.done} de {overallStats.total} tarefas concluidas
              </div>
            </div>
            <div>
              <svg className="w-10 h-10 text-[var(--cyan)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 w-full bg-[var(--bg)] rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[var(--cyan)] transition-all duration-500"
              style={{ width: `${overallStats.progress}%` }}
            />
          </div>
        </div>

        {/* 3-Tab Layout */}
        {loading ? (
          <div className="text-center py-16 text-[var(--text3)] text-sm animate-pulse-slow">
            Carregando plano de acao...
          </div>
        ) : tasks.length === 0 && activeSession ? (
          <div className="text-center py-16 text-[var(--text3)] text-sm">
            Nenhuma tarefa encontrada. As tarefas serao criadas automaticamente ao iniciar a sessao.
          </div>
        ) : tasks.length > 0 ? (
          <Tabs.Root defaultValue="curto" className="space-y-4">
            <Tabs.List className="flex gap-2 border-b border-[var(--border)] pb-0">
              {ACTION_PLAN_PHASES.map((phase) => {
                const stats = getPhaseStats(phase.id);
                return (
                  <Tabs.Trigger
                    key={phase.id}
                    value={phase.id}
                    className="px-4 py-3 text-sm font-semibold border-b-2 border-transparent data-[state=active]:border-current transition-colors text-[var(--text3)] data-[state=active]:text-[var(--navy)]"
                    style={{ "--tw-border-opacity": 1 } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: phase.color }}
                      />
                      <span>{phase.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg)] text-[var(--text3)]">
                        {stats.progress}%
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text3)] font-normal mt-0.5">{phase.sublabel}</div>
                  </Tabs.Trigger>
                );
              })}
            </Tabs.List>

            {/* Curto Prazo Tab - Week Timeline */}
            <Tabs.Content value="curto" className="space-y-3">
              {ACTION_PLAN_WEEKS.map((week) => {
                const weekTasks = tasks.filter(
                  (t) => t.phase === "curto" && t.semana === week.semana
                );
                const weekDone = weekTasks.filter((t) => t.status === "done").length;
                const weekProgress = weekTasks.length > 0 ? Math.round((weekDone / weekTasks.length) * 100) : 0;

                return (
                  <div key={week.semana} className="animate-fade-in">
                    <div className="relative flex items-stretch gap-4">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center w-8 flex-shrink-0">
                        <div
                          className="w-4 h-4 rounded-full border-2 mt-5 flex-shrink-0"
                          style={{
                            borderColor: week.color,
                            backgroundColor: weekProgress === 100 ? week.color : "white",
                          }}
                        />
                        {week.semana < 7 && (
                          <div
                            className="w-0.5 flex-1 mt-1"
                            style={{ backgroundColor: `${week.color}33` }}
                          />
                        )}
                      </div>

                      {/* Week Card */}
                      <div
                        className="flex-1 bg-white border rounded-xl p-5 mb-2"
                        style={{ borderColor: `${week.color}40` }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-bold"
                            style={{ backgroundColor: week.color }}
                          >
                            {week.semana}
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-[var(--text)]">{week.label}</h3>
                            <div className="text-xs text-[var(--text3)]">{week.dates}</div>
                          </div>
                          <span className="ml-auto text-xs font-bold" style={{ color: week.color }}>
                            {weekProgress}%
                          </span>
                        </div>

                        {/* Tasks */}
                        <div className="space-y-2">
                          {weekTasks.map((task) => {
                            const statusCfg = STATUS_CONFIG[task.status];
                            return (
                              <div
                                key={task.id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                                  task.status === "done" ? "border-emerald-200 bg-emerald-50/30" : "border-[var(--border)]"
                                }`}
                              >
                                <button
                                  onClick={() => cycleStatus(task.id)}
                                  className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                    task.status === "done"
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "border-[var(--border)] hover:border-[var(--cyan)]"
                                  }`}
                                >
                                  {task.status === "done" && (
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                                <span className={`flex-1 text-xs ${task.status === "done" ? "line-through text-[var(--text3)]" : "text-[var(--text)]"}`}>
                                  {task.tarefa}
                                </span>
                                <button
                                  onClick={() => cycleStatus(task.id)}
                                  className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusCfg.bg} ${statusCfg.text}`}
                                >
                                  {statusCfg.label}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Link to detail page */}
                        <Link
                          href={`/plano-de-acao/${week.semana}`}
                          className="inline-flex items-center gap-1 text-xs text-[var(--cyan)] font-semibold mt-2 hover:underline"
                        >
                          Ver detalhes
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Tabs.Content>

            {/* Medio Prazo Tab */}
            <Tabs.Content value="medio" className="space-y-3">
              <PhaseTaskList
                tasks={tasks.filter((t) => t.phase === "medio")}
                onCycleStatus={cycleStatus}
                onUpdateNotes={updateNotes}
                color="#8b5cf6"
              />
            </Tabs.Content>

            {/* Longo Prazo Tab */}
            <Tabs.Content value="longo" className="space-y-3">
              <PhaseTaskList
                tasks={tasks.filter((t) => t.phase === "longo")}
                onCycleStatus={cycleStatus}
                onUpdateNotes={updateNotes}
                color="#06b6d4"
              />
            </Tabs.Content>
          </Tabs.Root>
        ) : null}
      </div>
    </div>
  );
}

// Reusable task list for medio/longo prazo
function PhaseTaskList({
  tasks,
  onCycleStatus,
  onUpdateNotes,
  color,
}: {
  tasks: TaskItem[];
  onCycleStatus: (id: number) => void;
  onUpdateNotes: (id: number, notes: string) => void;
  color: string;
}) {
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Phase progress bar */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Progresso</span>
          <span className="text-sm font-bold" style={{ color }}>{progress}%</span>
        </div>
        <div className="w-full bg-[var(--bg)] rounded-full h-2">
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
        <div className="text-xs text-[var(--text3)] mt-1">{done} de {tasks.length} tarefas concluidas</div>
      </div>

      {/* Tasks */}
      {tasks.map((task) => {
        const statusCfg = STATUS_CONFIG[task.status];
        return (
          <div
            key={task.id}
            className={`bg-white border rounded-xl p-4 transition-all ${
              task.status === "done" ? "border-emerald-300 bg-emerald-50/30" : "border-[var(--border)]"
            }`}
          >
            <div className="flex items-start gap-4">
              <button
                onClick={() => onCycleStatus(task.id)}
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
                <div className={`text-sm font-medium ${task.status === "done" ? "line-through text-[var(--text3)]" : "text-[var(--text)]"}`}>
                  {task.tarefa}
                </div>
                {task.descricao && (
                  <div className="text-xs text-[var(--text2)] mt-1 leading-relaxed">{task.descricao}</div>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-[10px] text-[var(--text3)] mt-1.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Prazo: {task.dueDate}
                  </div>
                )}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Observacao..."
                    value={task.notes || ""}
                    onChange={(e) => onUpdateNotes(task.id, e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--cyan)] bg-[var(--bg)] placeholder:text-[var(--text3)]"
                  />
                </div>
              </div>

              <button
                onClick={() => onCycleStatus(task.id)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusCfg.bg} ${statusCfg.text} hover:opacity-80 transition-opacity`}
              >
                {statusCfg.label}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
