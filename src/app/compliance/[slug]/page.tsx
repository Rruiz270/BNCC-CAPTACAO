"use client";

import { use, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { COMPLIANCE_SECTIONS } from "@/lib/constants";

type ItemStatus = "pending" | "progress" | "done";

interface ItemState {
  checked: boolean;
  status: ItemStatus;
  notes: string;
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pendente", bg: "bg-gray-100", text: "text-gray-600" },
  progress: { label: "Em andamento", bg: "bg-amber-50", text: "text-amber-700" },
  done: { label: "Concluido", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const STATUS_CYCLE: ItemStatus[] = ["pending", "progress", "done"];

export default function ComplianceSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const section = COMPLIANCE_SECTIONS.find((s) => s.id === slug.toUpperCase());

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
    if (!section) return {};
    const initial: Record<string, ItemState> = {};
    for (const item of section.items) {
      initial[item.key] = { checked: false, status: "pending", notes: "" };
    }
    return initial;
  });

  if (!section) {
    return (
      <div>
        <PageHeader title="Secao nao encontrada" />
        <div className="max-w-7xl mx-auto px-8 py-12 text-center">
          <p className="text-[var(--text2)] mb-4">
            A secao &quot;{slug}&quot; nao foi encontrada.
          </p>
          <Link
            href="/compliance"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Compliance
          </Link>
        </div>
      </div>
    );
  }

  const toggleCheck = (key: string) => {
    setItemStates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        checked: !prev[key].checked,
        status: !prev[key].checked ? "done" : "pending",
      },
    }));
  };

  const cycleStatus = (key: string) => {
    setItemStates((prev) => {
      const current = prev[key].status;
      const idx = STATUS_CYCLE.indexOf(current);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      return {
        ...prev,
        [key]: {
          ...prev[key],
          status: next,
          checked: next === "done",
        },
      };
    });
  };

  const updateNotes = (key: string, notes: string) => {
    setItemStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], notes },
    }));
  };

  const completedCount = Object.values(itemStates).filter((s) => s.status === "done").length;
  const totalCount = section.items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={`Secao ${section.id}: ${section.name}`}
        description={`Prazo: ${section.deadline} - ${totalCount} itens`}
      />

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        {/* Back link */}
        <Link
          href="/compliance"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar ao Compliance
        </Link>

        {/* Checklist Items */}
        <div className="space-y-3">
          {section.items.map((item) => {
            const state = itemStates[item.key];
            const statusCfg = STATUS_CONFIG[state.status];

            return (
              <div
                key={item.key}
                className={`bg-white border rounded-xl p-4 transition-all animate-fade-in ${
                  state.checked
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleCheck(item.key)}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
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

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Item Key */}
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--navy)] text-white">
                        {item.key}
                      </span>

                      {/* Item Text */}
                      <span
                        className={`text-sm ${
                          state.checked ? "line-through text-[var(--text3)]" : "text-[var(--text)]"
                        }`}
                      >
                        {item.text}
                      </span>
                    </div>

                    {/* Notes input */}
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Adicionar observacao..."
                        value={state.notes}
                        onChange={(e) => updateNotes(item.key, e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--cyan)] bg-[var(--bg)] placeholder:text-[var(--text3)]"
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <button
                    onClick={() => cycleStatus(item.key)}
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
                Progresso da Secao {section.id}
              </div>
              <div className="text-xl font-extrabold mt-1 text-[var(--text)]">
                {completedCount} de {totalCount} concluidos
              </div>
            </div>
            <div className="text-2xl font-extrabold" style={{ color: progressPercent === 100 ? "var(--green)" : "var(--cyan)" }}>
              {progressPercent}%
            </div>
          </div>
          <div className="w-full bg-[var(--bg)] rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? "var(--green)" : "var(--cyan)",
              }}
            />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-[var(--text3)]">
            <span>
              {Object.values(itemStates).filter((s) => s.status === "pending").length} pendentes
            </span>
            <span>
              {Object.values(itemStates).filter((s) => s.status === "progress").length} em andamento
            </span>
            <span>
              {Object.values(itemStates).filter((s) => s.status === "done").length} concluidos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
