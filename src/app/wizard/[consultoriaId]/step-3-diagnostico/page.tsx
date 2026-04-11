"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

interface SessionData {
  id: number;
  municipality?: { id: number; nome: string; slug?: string };
}

interface MuniDiagnostico {
  id: number;
  nome: string;
  pot_total: number | null;
  pct_pot_total: number | null;
  n_faltantes: number | null;
  updated_at?: string;
}

interface StepPayload {
  validated?: boolean;
  lastRecalcAt?: string;
  diagnostico?: MuniDiagnostico;
}

export default function StepDiagnostico() {
  const step = getStepById(3)!;
  const { consultoriaId, steps, updateStep, saving } = useWizard();
  const [session, setSession] = useState<SessionData | null>(null);
  const [localDiag, setLocalDiag] = useState<MuniDiagnostico | null>(null);
  const [localLastRecalcAt, setLocalLastRecalcAt] = useState<string | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca sessao para pegar o municipio
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
  const storedPayload = steps.find((s) => s.step === 3)?.payload as StepPayload | undefined;
  const diag: MuniDiagnostico | null = localDiag ?? storedPayload?.diagnostico ?? null;
  const lastRecalcAt: string | null = localLastRecalcAt ?? storedPayload?.lastRecalcAt ?? null;
  const validated = storedPayload?.validated === true;

  const recalcular = useCallback(async () => {
    const muniId = session?.municipality?.id;
    if (!muniId) return;
    setRecalcing(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/recalcular/${muniId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao recalcular");
      setLocalDiag(data.municipality);
      const now = new Date().toISOString();
      setLocalLastRecalcAt(now);
      await updateStep(3, {
        status: "in_progress",
        payload: {
          validated,
          lastRecalcAt: now,
          diagnostico: data.municipality,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setRecalcing(false);
    }
  }, [session, validated, updateStep]);

  async function handleValidate(next: boolean) {
    await updateStep(3, {
      status: next ? "in_progress" : "available",
      payload: {
        validated: next,
        lastRecalcAt,
        diagnostico: diag,
      },
    });
  }

  const muniId = session?.municipality?.id ?? null;
  const muniSlug = session?.municipality?.slug ?? null;
  const canAdvance = !!diag && validated;
  const blockReason = !diag
    ? "Rode o recalculo de potencial antes de avancar"
    : !validated
    ? "Marque o diagnostico como validado"
    : undefined;

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Diagnostico do municipio</h2>
      <p className="text-sm text-[var(--text3)] mb-6">
        O recalculo dispara <code>fundeb.sp_recalcular_potencial</code>, que le{" "}
        <code>enrollments</code>, soma o potencial por categoria subnotificada e atualiza as
        colunas <code>pot_total</code>, <code>pct_pot_total</code> e <code>n_faltantes</code>.
      </p>

      {/* Acao principal */}
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-0.5">
            Recalcular potencial
          </div>
          <div className="text-sm text-[var(--text2)]">
            {lastRecalcAt ? (
              <>Ultimo recalculo: {new Date(lastRecalcAt).toLocaleString("pt-BR")}</>
            ) : (
              <>Nenhum recalculo rodado ainda nesta sessao</>
            )}
          </div>
        </div>
        <button
          onClick={recalcular}
          disabled={recalcing || !muniId}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {recalcing ? "Rodando..." : "Rodar sp_recalcular_potencial"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          Erro: {error}
        </div>
      )}

      {/* Resultado */}
      {diag && (
        <div className="border border-[var(--border)] rounded-lg p-5 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8] mb-1">
            {diag.nome}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Kpi
              label="Potencial total"
              value={
                diag.pot_total != null
                  ? diag.pot_total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })
                  : "—"
              }
              tone="emerald"
            />
            <Kpi
              label="% sobre receita"
              value={diag.pct_pot_total != null ? `${diag.pct_pot_total}%` : "—"}
              tone="cyan"
            />
            <Kpi
              label="Categorias faltantes"
              value={diag.n_faltantes != null ? String(diag.n_faltantes) : "—"}
              tone={(diag.n_faltantes ?? 0) > 0 ? "amber" : "slate"}
            />
          </div>
        </div>
      )}

      {/* Painel embarcado: link para /diagnostico/[slug] */}
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 mb-4">
        <div className="text-xs text-[var(--text3)] mb-2">Painel detalhado (legado)</div>
        {muniId ? (
          <Link
            href={`/diagnostico/${muniSlug ?? muniId}`}
            target="_blank"
            className="text-sm font-semibold text-[#00B4D8] hover:underline"
          >
            Abrir diagnostico completo do municipio ↗
          </Link>
        ) : (
          <div className="text-xs text-gray-400">Carregando sessao...</div>
        )}
      </div>

      {/* Validacao */}
      <label className="border border-[var(--border)] rounded-lg p-3 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={validated}
          disabled={saving || !diag}
          onChange={(e) => handleValidate(e.target.checked)}
          className="mt-0.5"
        />
        <div>
          <div className="text-sm font-semibold text-[var(--text1)]">Diagnostico validado</div>
          <div className="text-xs text-[var(--text3)]">
            Eu revisei os KPIs, as categorias subnotificadas e os indicadores socioeducacionais
          </div>
        </div>
        {saving && <span className="text-xs text-[#00B4D8] ml-auto">salvando...</span>}
      </label>
    </StepShell>
  );
}

function Kpi({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "cyan" | "amber";
}) {
  const colors: Record<string, string> = {
    slate: "text-[var(--text1)]",
    emerald: "text-emerald-700",
    cyan: "text-cyan-700",
    amber: "text-amber-700",
  };
  return (
    <div className="bg-[var(--bg)] rounded-lg p-3">
      <div className="text-[10px] uppercase text-[var(--text3)]">{label}</div>
      <div className={`text-lg font-bold ${colors[tone]}`}>{value}</div>
    </div>
  );
}
