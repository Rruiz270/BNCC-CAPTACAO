"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { StepStatus } from "@/lib/wizard/steps";

export interface WizardStepState {
  step: number;
  status: StepStatus;
  payload?: Record<string, unknown>;
  blockReason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
}

interface WizardContextType {
  consultoriaId: number;
  steps: WizardStepState[];
  currentStep: number;
  loading: boolean;
  saving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  updateStep: (
    step: number,
    update: { status?: StepStatus; payload?: Record<string, unknown>; blockReason?: string | null }
  ) => Promise<void>;
  setCurrentStep: (step: number) => void;
  refresh: () => Promise<void>;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({
  consultoriaId,
  initialStep,
  children,
}: {
  consultoriaId: number;
  initialStep: number;
  children: ReactNode;
}) {
  const [steps, setSteps] = useState<WizardStepState[]>([]);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/wizard/${consultoriaId}`);
      if (!res.ok) throw new Error("Falha ao carregar wizard");
      const data = await res.json();
      setSteps(data.steps || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [consultoriaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateStep = useCallback(
    async (
      step: number,
      update: { status?: StepStatus; payload?: Record<string, unknown>; blockReason?: string | null }
    ) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/wizard/${consultoriaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step, ...update }),
        });
        if (!res.ok) throw new Error("Falha ao salvar wizard");
        const data = await res.json();
        setSteps(data.steps || []);
        setLastSavedAt(new Date());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setSaving(false);
      }
    },
    [consultoriaId]
  );

  return (
    <WizardContext.Provider
      value={{
        consultoriaId,
        steps,
        currentStep,
        loading,
        saving,
        lastSavedAt,
        error,
        updateStep,
        setCurrentStep,
        refresh,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard deve ser usado dentro de WizardProvider");
  return ctx;
}
