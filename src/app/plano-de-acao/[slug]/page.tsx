"use client";

import { use, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ACTION_PLAN_WEEKS } from "@/lib/constants";

type TaskStatus = "pending" | "progress" | "done";

interface TaskState {
  checked: boolean;
  status: TaskStatus;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pendente", bg: "bg-gray-100", text: "text-gray-600" },
  progress: { label: "Em andamento", bg: "bg-amber-50", text: "text-amber-700" },
  done: { label: "Concluido", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const STATUS_CYCLE: TaskStatus[] = ["pending", "progress", "done"];

const WEEK_TASKS: Record<number, string[]> = {
  1: [
    "Coletar dados atuais",
    "Identificar categorias faltantes",
    "Mapear escolas rurais",
    "Reuniao com equipe pedagogica",
  ],
  2: [
    "Aprovar plano com secretario",
    "Iniciar reclassificacao de matriculas",
    "Contatar escolas conveniadas",
  ],
  3: [
    "Registrar AEE dupla matricula",
    "Reclassificar escolas rurais",
    "Verificar integral",
  ],
  4: [
    "Expandir matriculas integrais",
    "Formalizar parcerias conveniadas",
    "Documentar evidencias",
  ],
  5: [
    "Verificar registros no sistema",
    "Corrigir inconsistencias",
    "Preparar relatorio",
  ],
  6: [
    "Ultima verificacao",
    "Validar com equipe",
    "Backup de documentos",
  ],
  7: [
    "Verificacao final do Censo",
    "Confirmar envio",
  ],
};

export default function PlanoDeAcaoSemanaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const weekNumber = parseInt(slug, 10);

  const week = ACTION_PLAN_WEEKS.find((w) => w.semana === weekNumber);
  const tasks = WEEK_TASKS[weekNumber] || [];

  const [taskStates, setTaskStates] = useState<Record<number, TaskState>>(() => {
    const initial: Record<number, TaskState> = {};
    tasks.forEach((_, idx) => {
      initial[idx] = { checked: false, status: "pending" };
    });
    return initial;
  });

  if (!week) {
    return (
      <div>
        <PageHeader title="Semana nao encontrada" />
        <div className="max-w-7xl mx-auto px-8 py-12 text-center">
          <p className="text-[var(--text2)] mb-4">
            A semana &quot;{slug}&quot; nao foi encontrada no plano de acao.
          </p>
          <Link
            href="/plano-de-acao"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Plano de Acao
          </Link>
        </div>
      </div>
    );
  }

  const toggleCheck = (idx: number) => {
    setTaskStates((prev) => ({
      ...prev,
      [idx]: {
        checked: !prev[idx].checked,
        status: !prev[idx].checked ? "done" : "pending",
      },
    }));
  };

  const cycleStatus = (idx: number) => {
    setTaskStates((prev) => {
      const current = prev[idx].status;
      const currentIdx = STATUS_CYCLE.indexOf(current);
      const next = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
      return {
        ...prev,
        [idx]: {
          status: next,
          checked: next === "done",
        },
      };
    });
  };

  const completedCount = Object.values(taskStates).filter((s) => s.status === "done").length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={week.label}
        description={`Periodo: ${week.dates}`}
      />

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        {/* Back link */}
        <Link
          href="/plano-de-acao"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Plano de Acao
        </Link>

        {/* Week color banner */}
        <div
          className="rounded-xl p-4 text-white flex items-center gap-3 animate-fade-in"
          style={{ backgroundColor: week.color }}
        >
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
          {tasks.map((task, idx) => {
            const state = taskStates[idx];
            const statusCfg = STATUS_CONFIG[state.status];

            return (
              <div
                key={idx}
                className={`bg-white border rounded-xl p-4 transition-all animate-fade-in ${
                  state.checked
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleCheck(idx)}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      state.checked
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-[var(--border)] hover:border-[var(--cyan)]"
                    }`}
                  >
                    {state.checked && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Task number */}
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: week.color }}
                  >
                    {idx + 1}
                  </span>

                  {/* Task text */}
                  <span
                    className={`flex-1 text-sm ${
                      state.checked ? "line-through text-[var(--text3)]" : "text-[var(--text)]"
                    }`}
                  >
                    {task}
                  </span>

                  {/* Status Badge */}
                  <button
                    onClick={() => cycleStatus(idx)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusCfg.bg} ${statusCfg.text} hover:opacity-80 transition-opacity`}
                    title="Clique para alterar o status"
                  >
                    {statusCfg.label}
                  </button>
                </div>
              </div>
            );
          })}
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
            <div
              className="text-2xl font-extrabold"
              style={{ color: progressPercent === 100 ? "var(--green)" : week.color }}
            >
              {progressPercent}%
            </div>
          </div>
          <div className="w-full bg-[var(--bg)] rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? "var(--green)" : week.color,
              }}
            />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-[var(--text3)]">
            <span>
              {Object.values(taskStates).filter((s) => s.status === "pending").length} pendentes
            </span>
            <span>
              {Object.values(taskStates).filter((s) => s.status === "progress").length} em andamento
            </span>
            <span>
              {Object.values(taskStates).filter((s) => s.status === "done").length} concluidas
            </span>
          </div>
        </div>

        {/* Navigation between weeks */}
        <div className="flex items-center justify-between pt-2">
          {weekNumber > 1 ? (
            <Link
              href={`/plano-de-acao/${weekNumber - 1}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--cyan)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Semana {weekNumber - 1}
            </Link>
          ) : (
            <div />
          )}
          {weekNumber < 7 ? (
            <Link
              href={`/plano-de-acao/${weekNumber + 1}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--cyan)] transition-colors"
            >
              Semana {weekNumber + 1}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
