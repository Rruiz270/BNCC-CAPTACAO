"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WizardProvider, useWizard } from "@/components/wizard/wizard-provider";
import { Stepper } from "@/components/wizard/stepper";
import { GainTracker } from "@/components/gain-tracker";
import { WIZARD_STEPS } from "@/lib/wizard/steps";
import type { StepStatus } from "@/lib/wizard/steps";

function WizardChrome({ children }: { children: ReactNode }) {
  const { consultoriaId, steps, loading, error } = useWizard();
  const pathname = usePathname() ?? "";
  const slug = pathname.split("/").pop() ?? "";
  const currentStepDef = WIZARD_STEPS.find((s) => s.slug === slug);
  const currentStep = currentStepDef?.id ?? 1;

  const stepsState = steps.map((s) => ({
    step: s.step,
    status: s.status as StepStatus,
  }));

  const stepLabel = currentStepDef ? `Etapa ${currentStep} de ${WIZARD_STEPS.length - 1} · ${currentStepDef.short}` : undefined;

  return (
    <div>
      <GainTracker consultoriaId={consultoriaId} stepLabel={stepLabel} />
      <Stepper consultoriaId={consultoriaId} currentStep={currentStep} stepsState={stepsState} />
      {error && (
        <div className="bg-red-50 border-y border-red-200 px-8 py-2 text-xs text-red-700">
          Erro: {error}
        </div>
      )}
      {loading ? (
        <div className="max-w-7xl mx-auto px-8 py-12 text-center text-sm text-gray-400">
          Carregando wizard...
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function WizardLayoutClient({
  consultoriaId,
  children,
}: {
  consultoriaId: number;
  children: ReactNode;
}) {
  return (
    <WizardProvider consultoriaId={consultoriaId} initialStep={1}>
      <WizardChrome>{children}</WizardChrome>
    </WizardProvider>
  );
}
