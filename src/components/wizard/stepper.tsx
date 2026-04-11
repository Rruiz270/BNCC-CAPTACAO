"use client";

import Link from "next/link";
import { WIZARD_STEPS, type StepStatus } from "@/lib/wizard/steps";

interface StepperProps {
  consultoriaId: number;
  currentStep: number;
  stepsState: Array<{ step: number; status: StepStatus }>;
}

const STATUS_COLORS: Record<StepStatus, string> = {
  locked: "bg-white/10 text-white/30 border-white/10",
  available: "bg-white/10 text-white/70 border-white/20 hover:bg-white/20",
  in_progress: "bg-[#00B4D8]/20 text-[#00B4D8] border-[#00B4D8] ring-2 ring-[#00B4D8]/40",
  completed: "bg-[#00E5A0]/20 text-[#00E5A0] border-[#00E5A0]/60",
  blocked: "bg-red-500/20 text-red-300 border-red-500/60",
};

const STATUS_ICON: Record<StepStatus, string> = {
  locked: "·",
  available: "○",
  in_progress: "●",
  completed: "✓",
  blocked: "!",
};

export function Stepper({ consultoriaId, currentStep, stepsState }: StepperProps) {
  const stateMap = new Map(stepsState.map((s) => [s.step, s.status]));
  const completed = stepsState.filter((s) => s.status === "completed").length;
  const totalProgress = Math.round((completed / WIZARD_STEPS.length) * 100);

  return (
    <div className="bg-[#0A2463] text-white">
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8]">
              Wizard de Consultoria FUNDEB SP 2026
            </div>
            <div className="text-xs text-white/50 mt-0.5">
              Sessao #{consultoriaId} · Etapa {currentStep + 1} de {WIZARD_STEPS.length}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-white/40">Progresso</div>
            <div className="text-lg font-bold text-[#00E5A0]">{totalProgress}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#00B4D8] to-[#00E5A0] transition-all"
            style={{ width: `${totalProgress}%` }}
          />
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {WIZARD_STEPS.map((step, idx) => {
            const status = (stateMap.get(step.id) ?? "locked") as StepStatus;
            const isCurrent = step.id === currentStep;
            const clickable = status !== "locked";
            const cls = STATUS_COLORS[status];
            const icon = STATUS_ICON[status];

            const node = (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${cls} ${
                  isCurrent ? "scale-105" : ""
                } ${clickable ? "cursor-pointer" : "cursor-not-allowed"}`}
                title={step.description}
              >
                <span className="text-sm">{icon}</span>
                <span className="hidden sm:inline">
                  {step.id}. {step.short}
                </span>
                <span className="inline sm:hidden">{step.id}</span>
              </div>
            );

            return (
              <div key={step.id} className="flex items-center">
                {clickable ? (
                  <Link href={`/wizard/${consultoriaId}/${step.slug}`}>{node}</Link>
                ) : (
                  node
                )}
                {idx < WIZARD_STEPS.length - 1 && (
                  <span className="text-white/20 px-1 text-xs">›</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
