"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { WIZARD_STEPS, type StepStatus, type WizardStepDef } from "@/lib/wizard/steps";
import { useWizard } from "./wizard-provider";

interface StepShellProps {
  step: WizardStepDef;
  children: ReactNode;
  /** Quando true, o botao "Avancar" fica habilitado e ao clicar marca a etapa como completa. */
  canAdvance?: boolean;
  /** Texto do bloqueio quando canAdvance = false. */
  blockReason?: string;
  /** Callback opcional ao avancar (ex: persistir payload da etapa). */
  onAdvance?: () => Promise<void> | void;
}

const STATUS_LABELS: Record<StepStatus, string> = {
  locked: "Bloqueado",
  available: "Disponivel",
  in_progress: "Em andamento",
  completed: "Concluido",
  blocked: "Bloqueado",
};

const STATUS_BG: Record<StepStatus, string> = {
  locked: "bg-gray-100 text-gray-500",
  available: "bg-blue-50 text-blue-700",
  in_progress: "bg-cyan-50 text-cyan-700",
  completed: "bg-emerald-50 text-emerald-700",
  blocked: "bg-red-50 text-red-700",
};

export function StepShell({ step, children, canAdvance = false, blockReason, onAdvance }: StepShellProps) {
  const router = useRouter();
  const { consultoriaId, steps, saving, lastSavedAt, updateStep } = useWizard();
  const stepState = steps.find((s) => s.step === step.id);
  const status = (stepState?.status ?? "available") as StepStatus;

  const prev = WIZARD_STEPS.find((s) => s.id === step.id - 1);
  const next = WIZARD_STEPS.find((s) => s.id === step.id + 1);

  async function handleAdvance() {
    if (!canAdvance) return;
    if (onAdvance) await onAdvance();
    await updateStep(step.id, { status: "completed", blockReason: null });
    if (next) router.push(`/wizard/${consultoriaId}/${next.slug}`);
  }

  async function handleMarkInProgress() {
    if (status === "available") {
      await updateStep(step.id, { status: "in_progress" });
    }
  }

  return (
    <div onMouseEnter={handleMarkInProgress}>
      <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] text-white px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[#00B4D8] text-xs font-bold uppercase tracking-widest mb-1">
                Etapa {step.id} de {WIZARD_STEPS.length - 1}
              </div>
              <h1 className="text-2xl font-bold">{step.title}</h1>
              <p className="text-white/60 text-sm mt-1 max-w-2xl">{step.description}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_BG[status]}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          {step.gates.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {step.gates.map((g, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-white/10 text-white/70 px-2 py-1 rounded border border-white/10"
                >
                  Gate · {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="bg-white border border-[var(--border)] rounded-xl p-6 mb-6">{children}</div>

        {/* Footer de navegacao */}
        <div className="flex items-center justify-between gap-4 sticky bottom-4">
          <div className="bg-white border border-[var(--border)] rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
            {prev ? (
              <Link
                href={`/wizard/${consultoriaId}/${prev.slug}`}
                className="text-sm text-[var(--text2)] hover:text-[var(--text1)]"
              >
                ← {prev.short}
              </Link>
            ) : (
              <span className="text-sm text-gray-300">← Inicio</span>
            )}
          </div>

          <div className="bg-white border border-[var(--border)] rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 text-xs">
            {saving ? (
              <span className="text-[#00B4D8]">Salvando...</span>
            ) : lastSavedAt ? (
              <span className="text-emerald-600">
                Salvo as {lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : (
              <span className="text-gray-400">Sem alteracoes</span>
            )}
          </div>

          <div className="bg-white border border-[var(--border)] rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
            {!canAdvance && blockReason && (
              <span className="text-xs text-red-600 max-w-[260px] truncate" title={blockReason}>
                Bloqueio: {blockReason}
              </span>
            )}
            <button
              onClick={handleAdvance}
              disabled={!canAdvance}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {next ? `Avancar para ${next.short} →` : "Concluir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
