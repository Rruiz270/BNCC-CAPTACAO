"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

// fatorVaaf armazena o valor VAAF por aluno (ex: 10131.14 para Creche Integral),
// portanto NAO multiplicar por VAAF_BASE novamente.

interface Enrollment {
  id: number;
  categoria: string;
  categoriaLabel: string;
  fatorVaaf: number;
  quantidade: number;
  ativa: boolean;
  receitaEstimada: number | null;
}

interface SessionData {
  id: number;
  municipality?: { id: number; nome: string; slug?: string };
}

interface T2Item { de: string; para: string; mat: number; diff_por_aluno: number; ganho_total: number }
interface T3Item { cat: string; mat_especial: number; vaaf_aee: number; ganho_100pct: number }
interface T1Item { cat: string; vaaf_u: number; fator: number }

interface PotencialDetalhes {
  categorias_ativas?: string[];
  categorias_faltantes?: string[];
  pot_total_novo?: number;
  pct_pot_total?: number;
  t1?: { detalhe?: T1Item[] };
  t2?: { detalhe?: T2Item[]; ganho_total?: number };
  t3?: { detalhe?: T3Item[]; ganho_total?: number };
  t4?: { mat_urbano_total?: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface PotencialDetail {
  potTotal: number;
  pctPotTotal: number;
  nFaltantes: number;
  detalhes: PotencialDetalhes | null;
}

interface MuniResponse {
  id: number;
  nome: string;
  enrollments: Enrollment[];
  financials: { receitaTotal: number | null };
  potencial?: PotencialDetail;
}

interface Scenario {
  id: number;
  consultoriaId: number;
  nome: string;
  isTarget: boolean;
  parametros: {
    reclassificacoes: Record<string, number>;
    notes?: string;
  };
  resultado: {
    receitaBase: number;
    receitaProjetada: number;
    delta: number;
    deltaPct: number;
    categoriasTocadas: string[];
  };
  createdAt: string;
}

interface StepPayload {
  targetScenarioId?: number;
  lastDelta?: number;
  lastDeltaPct?: number;
}

export default function StepSimulacao() {
  const step = getStepById(4)!;
  const { consultoriaId, steps, updateStep, saving } = useWizard();

  const [session, setSession] = useState<SessionData | null>(null);
  const [muni, setMuni] = useState<MuniResponse | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [scenarioName, setScenarioName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1) Carrega sessao + municipio + scenarios em paralelo
  useEffect(() => {
    fetch(`/api/consultorias`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.sessions?.find((x: SessionData) => x.id === consultoriaId);
        setSession(s || null);
      })
      .catch(() => {});
  }, [consultoriaId]);

  useEffect(() => {
    if (!session?.municipality?.id) return;
    const slug = session.municipality.slug ?? String(session.municipality.id);
    fetch(`/api/municipalities/${slug}`)
      .then((r) => r.json())
      .then((data: MuniResponse) => setMuni(data))
      .catch((e) => setError(String(e)));
  }, [session]);

  const loadScenarios = useCallback(async () => {
    try {
      const res = await fetch(`/api/simulations?consultoriaId=${consultoriaId}`);
      const data = await res.json();
      if (Array.isArray(data.scenarios)) setScenarios(data.scenarios);
    } catch {
      // ignore
    }
  }, [consultoriaId]);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  // 2a) Build per-category metadata from potencial
  const catMeta = useMemo(() => {
    const meta: Record<string, { maxAdd: number; hint: string; tier: string; relevant: boolean }> = {};
    if (!muni) return meta;
    const det = muni.potencial?.detalhes;

    // Index enrollments by label for quick lookup
    const byLabel: Record<string, Enrollment> = {};
    for (const e of muni.enrollments) byLabel[e.categoriaLabel ?? e.categoria] = e;

    // T2 conversion: partial → integral (max = mat from partial category)
    if (det?.t2?.detalhe) {
      for (const item of det.t2.detalhe) {
        // The "para" category can gain up to "mat" students from the "de" category
        const target = muni.enrollments.find(
          (e) => (e.categoriaLabel ?? e.categoria) === item.para
        );
        if (target) {
          const key = target.categoria;
          meta[key] = {
            maxAdd: item.mat,
            hint: `Converter ${item.mat.toLocaleString("pt-BR")} de ${item.de} (+R$${(item.diff_por_aluno ?? 0).toLocaleString("pt-BR",{maximumFractionDigits:0})}/aluno)`,
            tier: "T2",
            relevant: true,
          };
        }
      }
    }

    // T3 AEE: special education double enrollment
    if (det?.t3?.detalhe) {
      for (const item of det.t3.detalhe) {
        const target = muni.enrollments.find(
          (e) => (e.categoriaLabel ?? e.categoria) === item.cat
        );
        if (target) {
          const key = target.categoria;
          if (!meta[key]) {
            meta[key] = { maxAdd: item.mat_especial, hint: "", tier: "T3", relevant: true };
          }
          meta[key].hint = `AEE dupla matrícula: ${item.mat_especial.toLocaleString("pt-BR")} alunos (+R$${item.ganho_100pct.toLocaleString("pt-BR",{maximumFractionDigits:0})})`;
        }
      }
    }

    // T1 missing categories — can be started
    if (det?.t1?.detalhe) {
      for (const item of det.t1.detalhe) {
        const target = muni.enrollments.find(
          (e) => (e.categoriaLabel ?? e.categoria) === item.cat
        );
        if (target) {
          const key = target.categoria;
          if (!meta[key]) {
            meta[key] = { maxAdd: 50, hint: "", tier: "T1", relevant: true };
          }
          meta[key].hint = `Categoria inexistente — pode ser criada (VAAF R$${item.vaaf_u.toLocaleString("pt-BR",{maximumFractionDigits:0})}/aluno)`;
        }
      }
    }

    // Mark all active categories with existing enrollment as relevant even without specific potential
    for (const e of muni.enrollments) {
      if (e.ativa && e.quantidade > 0 && !meta[e.categoria]) {
        meta[e.categoria] = { maxAdd: 0, hint: "", tier: "", relevant: true };
      }
    }

    return meta;
  }, [muni]);

  // 2b) Filter enrollments to only show relevant categories
  const visibleEnrollments = useMemo(() => {
    if (!muni) return [];
    return muni.enrollments.filter((e) => {
      // Always show if user already has an override for it
      if (overrides[e.categoria] != null) return true;
      // Show if it has potential metadata
      if (catMeta[e.categoria]?.relevant) return true;
      // Show if active with existing students
      if (e.ativa && (e.quantidade ?? 0) > 0) return true;
      return false;
    });
  }, [muni, catMeta, overrides]);

  // 2c) Calcula impacto em tempo real a partir dos overrides
  const baseReceita = useMemo(() => {
    if (!muni) return 0;
    return muni.enrollments.reduce(
      (sum, e) => sum + (e.quantidade ?? 0) * (e.fatorVaaf ?? 0),
      0
    );
  }, [muni]);

  const projecao = useMemo(() => {
    if (!muni) return { receitaProjetada: 0, delta: 0, deltaPct: 0, tocadas: [] as string[] };
    let receita = 0;
    const tocadas: string[] = [];
    for (const e of muni.enrollments) {
      const override = overrides[e.categoria];
      const qtd = override != null ? override : e.quantidade ?? 0;
      if (override != null && override !== (e.quantidade ?? 0)) tocadas.push(e.categoria);
      receita += qtd * (e.fatorVaaf ?? 0);
    }
    const delta = receita - baseReceita;
    const deltaPct = baseReceita > 0 ? (delta / baseReceita) * 100 : 0;
    return { receitaProjetada: receita, delta, deltaPct, tocadas };
  }, [muni, overrides, baseReceita]);

  // 3) Salvar cenario
  const salvarCenario = useCallback(
    async (markAsTarget: boolean) => {
      if (!scenarioName.trim()) {
        setError("Defina um nome para o cenario");
        return;
      }
      if (!muni || projecao.tocadas.length === 0) {
        setError("Mova pelo menos um slider antes de salvar");
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch(`/api/simulations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultoriaId,
            nome: scenarioName.trim(),
            isTarget: markAsTarget,
            parametros: { reclassificacoes: overrides },
            resultado: {
              receitaBase: baseReceita,
              receitaProjetada: projecao.receitaProjetada,
              delta: projecao.delta,
              deltaPct: Number(projecao.deltaPct.toFixed(2)),
              categoriasTocadas: projecao.tocadas,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Falha ao salvar cenario");

        setScenarioName("");
        await loadScenarios();

        if (markAsTarget) {
          await updateStep(4, {
            status: "in_progress",
            payload: {
              targetScenarioId: data.scenario.id,
              lastDelta: projecao.delta,
              lastDeltaPct: Number(projecao.deltaPct.toFixed(2)),
            },
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setSubmitting(false);
      }
    },
    [
      scenarioName,
      muni,
      projecao,
      consultoriaId,
      overrides,
      baseReceita,
      loadScenarios,
      updateStep,
    ]
  );

  // 4) Marcar cenario salvo como target
  const marcarComoTarget = useCallback(
    async (scenarioId: number) => {
      setSubmitting(true);
      try {
        const res = await fetch(`/api/simulations/${scenarioId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isTarget: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Falha");
        await loadScenarios();
        const sc = data.scenario as Scenario;
        await updateStep(4, {
          status: "in_progress",
          payload: {
            targetScenarioId: sc.id,
            lastDelta: sc.resultado.delta,
            lastDeltaPct: sc.resultado.deltaPct,
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setSubmitting(false);
      }
    },
    [loadScenarios, updateStep]
  );

  // 5) Estado derivado
  const storedPayload = steps.find((s) => s.step === 4)?.payload as StepPayload | undefined;
  const targetScenarioId = storedPayload?.targetScenarioId ?? null;
  const hasTarget = scenarios.some((s) => s.isTarget) || targetScenarioId != null;
  const canAdvance = hasTarget;
  const blockReason = !hasTarget ? "Marque um cenario como cenario-alvo antes de avancar" : undefined;

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Simulacao de cenarios</h2>
      <p className="text-sm text-[var(--text3)] mb-6">
        Ajuste a quantidade de matriculas por categoria e veja o impacto em receita FUNDEB.
        Salve cenarios nomeados e marque um deles como cenario-alvo da consultoria.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="Receita base" value={fmtBRL(baseReceita)} tone="slate" />
        <Kpi
          label="Receita projetada"
          value={fmtBRL(projecao.receitaProjetada)}
          tone={projecao.delta >= 0 ? "emerald" : "amber"}
        />
        <Kpi
          label="Delta"
          value={`${projecao.delta >= 0 ? "+" : ""}${fmtBRL(projecao.delta)} (${
            projecao.deltaPct >= 0 ? "+" : ""
          }${projecao.deltaPct.toFixed(1)}%)`}
          tone={projecao.delta > 0 ? "emerald" : projecao.delta < 0 ? "amber" : "slate"}
        />
      </div>

      {/* Teto de captação */}
      {muni?.potencial && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-0.5">
                Teto de captacao do municipio
              </div>
              <div className="text-sm font-bold text-blue-800">
                {fmtBRL(muni.potencial.potTotal ?? muni.potencial.detalhes?.pot_total_novo ?? 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-blue-600">Potencial</div>
              <div className="text-sm font-bold text-blue-800">
                +{(muni.potencial.pctPotTotal ?? muni.potencial.detalhes?.pct_pot_total ?? 0).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="text-[10px] text-blue-600 mt-1">
            {muni.potencial.nFaltantes} categorias faltantes · {visibleEnrollments.length} categorias com potencial de ajuste
          </div>
        </div>
      )}

      {/* Sliders por categoria */}
      <div className="border border-[var(--border)] rounded-lg p-4 mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
          Reclassificacoes ({projecao.tocadas.length} categoria{projecao.tocadas.length === 1 ? "" : "s"} modificada{projecao.tocadas.length === 1 ? "" : "s"})
        </div>
        {!muni ? (
          <div className="text-xs text-gray-400">Carregando matriculas do municipio...</div>
        ) : visibleEnrollments.length === 0 ? (
          <div className="text-xs text-gray-400">Municipio sem categorias com potencial de ajuste.</div>
        ) : (
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-2">
            {visibleEnrollments.map((e) => {
              const override = overrides[e.categoria];
              const current = override != null ? override : e.quantidade ?? 0;
              const base = e.quantidade ?? 0;
              const cm = catMeta[e.categoria];
              // Smart max: base + potential add from T2/T1/T3, or reasonable default
              const potAdd = cm?.maxAdd ?? 0;
              const max = Math.max(base + potAdd, base + 20, potAdd > 0 ? base + potAdd : base * 2);
              const modified = override != null && override !== base;
              const tierBadge = cm?.tier;
              return (
                <div
                  key={e.categoria}
                  className={`p-2 rounded ${
                    modified ? "bg-amber-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[var(--text1)] truncate flex items-center gap-1.5">
                        {e.categoriaLabel ?? e.categoria}
                        {tierBadge && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                            tierBadge === "T2" ? "bg-purple-100 text-purple-700" :
                            tierBadge === "T1" ? "bg-green-100 text-green-700" :
                            tierBadge === "T3" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {tierBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text3)]">
                        base: {base.toLocaleString("pt-BR")} · VAAF: {fmtBRL(e.fatorVaaf ?? 0)}/aluno ·{" "}
                        {e.ativa ? "ativa" : "inativa"}
                        {potAdd > 0 && <span className="text-blue-600"> · max +{potAdd.toLocaleString("pt-BR")}</span>}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={max}
                      step={1}
                      value={current}
                      onChange={(ev) =>
                        setOverrides((o) => ({ ...o, [e.categoria]: parseInt(ev.target.value, 10) }))
                      }
                      className="w-40"
                    />
                    <input
                      type="number"
                      min={0}
                      value={current}
                      onChange={(ev) =>
                        setOverrides((o) => ({
                          ...o,
                          [e.categoria]: Math.max(0, parseInt(ev.target.value, 10) || 0),
                        }))
                      }
                      className="w-16 px-1 py-0.5 border border-[var(--border)] rounded text-right text-xs"
                    />
                  </div>
                  {cm?.hint && (
                    <div className="text-[10px] text-blue-600 mt-0.5 ml-0.5">
                      {cm.hint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {projecao.tocadas.length > 0 && (
          <button
            type="button"
            onClick={() => setOverrides({})}
            className="mt-2 text-[10px] text-[#00B4D8] hover:underline"
          >
            Limpar overrides
          </button>
        )}
      </div>

      {/* Salvar cenario */}
      <div className="border border-[var(--border)] rounded-lg p-4 mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
          Salvar cenario
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Ex: Reclassificacao + AEE + integral"
            className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg"
            disabled={submitting}
          />
          <button
            onClick={() => salvarCenario(false)}
            disabled={submitting || projecao.tocadas.length === 0 || !scenarioName.trim()}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-[var(--border)] disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            onClick={() => salvarCenario(true)}
            disabled={submitting || projecao.tocadas.length === 0 || !scenarioName.trim()}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#00B4D8] text-white disabled:bg-gray-200 disabled:text-gray-400"
          >
            Salvar como cenario-alvo
          </button>
        </div>
      </div>

      {/* Lista de cenarios salvos */}
      {scenarios.length > 0 && (
        <div className="border border-[var(--border)] rounded-lg p-4 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
            Cenarios salvos ({scenarios.length})
          </div>
          <div className="space-y-2">
            {scenarios.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 text-xs p-2 rounded border ${
                  s.isTarget
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[var(--text1)] truncate">
                    {s.nome} {s.isTarget && <span className="text-emerald-700 text-[10px]">ALVO</span>}
                  </div>
                  <div className="text-[10px] text-[var(--text3)]">
                    {s.parametros.reclassificacoes
                      ? Object.keys(s.parametros.reclassificacoes).length
                      : 0}{" "}
                    categorias ·{" "}
                    {s.resultado.delta >= 0 ? "+" : ""}
                    {fmtBRL(s.resultado.delta)} ({s.resultado.deltaPct >= 0 ? "+" : ""}
                    {s.resultado.deltaPct.toFixed(1)}%)
                  </div>
                </div>
                {!s.isTarget && (
                  <button
                    onClick={() => marcarComoTarget(s.id)}
                    disabled={submitting}
                    className="px-2 py-1 text-[10px] font-semibold rounded border border-[#00B4D8] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white disabled:opacity-50"
                  >
                    Marcar como alvo
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link para o simulador legado */}
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3">
        <Link
          href="/simulador"
          target="_blank"
          className="text-xs font-semibold text-[#00B4D8] hover:underline"
        >
          Abrir simulador completo (legado) ↗
        </Link>
      </div>
      {saving && <div className="mt-2 text-[10px] text-[#00B4D8]">salvando...</div>}
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
  tone?: "slate" | "emerald" | "amber";
}) {
  const colors: Record<string, string> = {
    slate: "text-[var(--text1)]",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
  };
  return (
    <div className="bg-[var(--bg)] rounded-lg p-3">
      <div className="text-[10px] uppercase text-[var(--text3)]">{label}</div>
      <div className={`text-sm font-bold ${colors[tone]}`}>{value}</div>
    </div>
  );
}
