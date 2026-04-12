"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

interface SessionData {
  id: number;
  municipality?: {
    id: number;
    nome: string;
    totalMatriculas: number | null;
    receitaTotal: number | null;
    totalEscolas: number | null;
    codigoIbge: string | null;
  };
}

interface StepPayload {
  confirmed?: boolean;
  muniId?: number;
  muniNome?: string;
  confirmedAt?: string;
}

export default function StepCidade() {
  const step = getStepById(1)!;
  const { consultoriaId, steps, updateStep, saving } = useWizard();
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    fetch(`/api/consultorias`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.sessions?.find((x: SessionData) => x.id === consultoriaId);
        setSession(s || null);
      })
      .catch(() => {});
  }, [consultoriaId]);

  // Estado derivado do wizard_progress.payload (server como source of truth)
  const serverPayload = steps.find((s) => s.step === 1)?.payload as StepPayload | undefined;
  const confirmed = serverPayload?.confirmed === true;

  const muni = session?.municipality;
  const canAdvance = !!muni && confirmed;
  const blockReason = !muni
    ? "Sessao sem municipio vinculado"
    : !confirmed
    ? "Confirme o municipio para liberar o avanco"
    : undefined;

  async function handleToggle(next: boolean) {
    if (!muni) return;
    await updateStep(1, {
      status: next ? "in_progress" : "available",
      payload: {
        confirmed: next,
        muniId: muni.id,
        muniNome: muni.nome,
        confirmedAt: next ? new Date().toISOString() : null,
      },
    });
  }

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Municipio da consultoria</h2>
      <p className="text-sm text-[var(--text3)] mb-6">
        Esta sessao esta vinculada ao municipio abaixo. Confirme antes de prosseguir para o Discovery.
      </p>

      {!muni ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Nao foi possivel carregar o municipio desta sessao. Verifique se a sessao #{consultoriaId} existe.
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8] mb-1">
            Municipio
          </div>
          <div className="text-2xl font-extrabold text-[var(--text1)]">{muni.nome}</div>
          <div className="text-xs text-[var(--text3)] mt-1">IBGE {muni.codigoIbge ?? "—"}</div>

          <div className="grid grid-cols-3 gap-4 mt-5">
            <div className="bg-[var(--bg)] rounded-lg p-3">
              <div className="text-[10px] uppercase text-[var(--text3)]">Matriculas</div>
              <div className="text-base font-bold text-[var(--text1)]">
                {muni.totalMatriculas?.toLocaleString("pt-BR") ?? "—"}
              </div>
            </div>
            <div className="bg-[var(--bg)] rounded-lg p-3">
              <div className="text-[10px] uppercase text-[var(--text3)]">Receita FUNDEB Municipal</div>
              <div className="text-base font-bold text-[var(--text1)]">
                {muni.receitaTotal
                  ? muni.receitaTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "—"}
              </div>
            </div>
            <div className="bg-[var(--bg)] rounded-lg p-3">
              <div className="text-[10px] uppercase text-[var(--text3)]">Escolas Municipais</div>
              <div className="text-base font-bold text-[var(--text1)]">
                {muni.totalEscolas ?? "—"}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={saving}
              onChange={(e) => handleToggle(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[var(--text2)]">
              Confirmo que este e o municipio correto desta consultoria
            </span>
            {saving && <span className="text-xs text-[#00B4D8] ml-2">salvando...</span>}
          </label>
        </div>
      )}

      <div className="mt-6 text-xs text-[var(--text3)]">
        Caso precise mudar de municipio, encerre a sessao atual e abra uma nova em{" "}
        <Link href="/wizard" className="text-[#00B4D8] underline">
          /wizard
        </Link>
        .
      </div>
    </StepShell>
  );
}
