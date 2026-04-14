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

      {/* T1-T6 Breakdown */}
      <TierBreakdown muniId={muniId} />

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

const TIERS = [
  { key: "pot_t1", label: "T1 - Categorias Zeradas", desc: "Ativar categorias FUNDEB que tem zero matriculas registradas", color: "#ef4444", difficulty: "Facil" },
  { key: "pot_t2", label: "T2 - Reclassificacao Integral", desc: "Converter matriculas parciais para integral (maior fator VAAF)", color: "#f59e0b", difficulty: "Medio" },
  { key: "pot_t3", label: "T3 - AEE/Ed. Especial", desc: "Captar dupla matricula AEE e Ed. Especial nao registrada", color: "#8b5cf6", difficulty: "Medio" },
  { key: "pot_t4", label: "T4 - Campo/Indigena", desc: "Aplicar multiplicadores de localizacao diferenciada (1.15x campo, 1.40x indigena)", color: "#22c55e", difficulty: "Facil" },
  { key: "pot_t5", label: "T5 - VAAR/VAAT", desc: "Otimizar complementacoes federais por condicionalidades", color: "#3b82f6", difficulty: "Complexo" },
  { key: "pot_t6", label: "T6 - EC 135 Integral", desc: "Expansao obrigatoria de escola integral (4%/ano) com ganho FUNDEB", color: "#06b6d4", difficulty: "Longo Prazo" },
];

interface VaafEntry {
  secao: string;
  categoria: string;
  localidade: string;
  matriculas: number;
  vaafValor: number;
  subtotal: number;
}

interface FatorEntry {
  segmento: string;
  descricao: string;
  fpVaaf: number | null;
  fpVaat: number | null;
  fMulti: number | null;
  fpFinalVaaf: number | null;
  fpFinalVaat: number | null;
}

interface TierData {
  pot_t1?: number; pot_t2?: number; pot_t3?: number; pot_t4?: number;
  pot_t5_vaar?: number; pot_t5_vaat?: number; pot_t6?: number;
  cats_faltantes?: string; estrategias_resumo?: string; n_estrategias?: number;
}

function TierBreakdown({ muniId }: { muniId: number | null }) {
  const [data, setData] = useState<TierData | null>(null);
  const [vaafData, setVaafData] = useState<VaafEntry[]>([]);
  const [fatores, setFatores] = useState<FatorEntry[]>([]);

  useEffect(() => {
    if (!muniId) return;
    fetch(`/api/municipalities/${muniId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
    // Fetch ref data for context
    fetch(`/api/ref/matriculas-vaaf?municipalityId=${muniId}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setVaafData(d.data); })
      .catch(() => {});
    fetch(`/api/ref/fatores`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setFatores(d.data); })
      .catch(() => {});
  }, [muniId]);

  if (!muniId || !data) return null;

  const tierValues = [
    data.pot_t1 || 0,
    data.pot_t2 || 0,
    data.pot_t3 || 0,
    data.pot_t4 || 0,
    (data.pot_t5_vaar || 0) + (data.pot_t5_vaat || 0),
    data.pot_t6 || 0,
  ];

  const totalTiers = tierValues.reduce((s, v) => s + v, 0);
  if (totalTiers === 0) return null;

  const maxTier = Math.max(...tierValues, 1);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const diffColors: Record<string, string> = {
    "Facil": "bg-emerald-100 text-emerald-800",
    "Medio": "bg-amber-100 text-amber-800",
    "Complexo": "bg-red-100 text-red-800",
    "Longo Prazo": "bg-blue-100 text-blue-800",
  };

  return (
    <div className="border border-[var(--border)] rounded-lg p-5 mb-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8] mb-1">
        Potencial por Tier (T1-T6)
      </div>
      <div className="text-xs text-[var(--text3)] mb-4">
        Detalhamento de onde esta o ganho financeiro FUNDEB, organizado por estrategia
      </div>

      <div className="space-y-3">
        {TIERS.map((tier, i) => {
          // Build contextual info from ref data for each tier
          const tierKey = `T${i + 1}`;
          const relevantVaaf = vaafData.filter((v) => {
            if (tierKey === "T1") return v.matriculas === 0;
            if (tierKey === "T2") return v.categoria?.toLowerCase().includes("integral");
            if (tierKey === "T3") return v.categoria?.toLowerCase().includes("especial") || v.categoria?.toLowerCase().includes("aee");
            if (tierKey === "T4") return v.localidade?.toLowerCase() === "campo" || v.localidade?.toLowerCase() === "indigena";
            return false;
          }).slice(0, 3);

          const relevantFatores = fatores.filter((f) => {
            if (tierKey === "T2") return f.segmento?.toLowerCase().includes("integral");
            if (tierKey === "T3") return f.segmento?.toLowerCase().includes("especial") || f.segmento?.toLowerCase().includes("aee");
            if (tierKey === "T4") return f.fMulti != null && f.fMulti > 1;
            return false;
          }).slice(0, 3);

          return (
            <div key={tier.key}>
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5"
                  style={{ background: tier.color }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text1)]">{tier.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${diffColors[tier.difficulty]}`}>
                        {tier.difficulty}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums" style={{ color: tier.color }}>
                      {fmt(tierValues[i])}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text3)] mb-1.5">{tier.desc}</div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max((tierValues[i] / maxTier) * 100, 2)}%`, background: tier.color }}
                    />
                  </div>
                </div>
              </div>
              {/* Contextual VAAF/factor info */}
              {(relevantVaaf.length > 0 || relevantFatores.length > 0) && tierValues[i] > 0 && (
                <div className="ml-11 mt-1 mb-1 text-[10px] text-[var(--text3)] bg-gray-50 rounded p-2 space-y-0.5">
                  {relevantVaaf.map((v, vi) => (
                    <div key={vi}>
                      {v.categoria}: {v.localidade} — {Number(v.matriculas).toLocaleString("pt-BR")} mat · VAAF {fmt(v.vaafValor || 0)}
                    </div>
                  ))}
                  {relevantFatores.map((f, fi) => (
                    <div key={`f-${fi}`} className="text-blue-600">
                      Fator {f.segmento}: VAAF {f.fpFinalVaaf?.toFixed(4) || '-'} · VAAT {f.fpFinalVaat?.toFixed(4) || '-'}{f.fMulti && f.fMulti > 1 ? ` · Multi ${f.fMulti}x` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-3 border-t border-[var(--border)] flex justify-between">
        <span className="text-sm font-bold text-[var(--text1)]">Total Potencial T1-T6</span>
        <span className="text-lg font-bold text-emerald-700">{fmt(totalTiers)}</span>
      </div>

      {/* Categories and strategies */}
      {data.cats_faltantes && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          <span className="font-bold">Categorias nao captadas:</span> {data.cats_faltantes}
        </div>
      )}
      {data.estrategias_resumo && (
        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
          <span className="font-bold">Estrategias ({data.n_estrategias || 0}):</span> {data.estrategias_resumo}
        </div>
      )}
    </div>
  );
}
