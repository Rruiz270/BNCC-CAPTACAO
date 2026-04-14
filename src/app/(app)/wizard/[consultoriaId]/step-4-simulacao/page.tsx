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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CensusData = Record<string, any> | null;

interface MuniResponse {
  id: number;
  nome: string;
  enrollments: Enrollment[];
  financials: { receitaTotal: number | null };
  potencial?: PotencialDetail;
  censusData?: CensusData;
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

type TabKey = "active" | "missing" | "growth";

// ── Census hint generator ────────────────────────────────────────────────
function getCensusHint(
  e: Enrollment,
  tier: string,
  census: CensusData
): string | null {
  if (!census) return null;

  const pf = (k: string) => { const v = parseFloat(census[k]); return isNaN(v) ? null : v; };
  const label = (e.categoriaLabel ?? e.categoria).toLowerCase();

  // T1 missing categories
  if (tier === "T1") {
    const vaaf = e.fatorVaaf ?? 0;
    return `Categoria inexistente — VAAF R$${vaaf.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/aluno disponível`;
  }

  // T2 conversion (parcial → integral)
  if (tier === "T2") {
    const fundebTotal = pf("fundeb_tot_mat");
    const t6Pct = pf("t6_pct_integral");
    if (t6Pct != null) {
      return `Atualmente ${t6Pct.toFixed(0)}% integral. Conversão parcial→integral aumenta receita/aluno`;
    }
  }

  // T3 AEE special education
  if (tier === "T3") {
    const censoEsp = pf("censo_mat_esp");
    const fundebDm = pf("fundeb_dm_mat");
    if (censoEsp != null && fundebDm != null) {
      const gap = Math.max(0, censoEsp - fundebDm);
      if (gap > 0) {
        return `Censo: ${censoEsp.toLocaleString("pt-BR")} alunos especiais, FUNDEB capta ${fundebDm.toLocaleString("pt-BR")} = ${gap.toLocaleString("pt-BR")} não capturados`;
      }
    }
    if (censoEsp != null) {
      return `Censo: ${censoEsp.toLocaleString("pt-BR")} alunos com necessidades especiais no município`;
    }
  }

  // Divergence warning for active categories
  if (e.ativa && e.quantidade > 0) {
    const divPct = pf("div_mat_pct");
    if (divPct != null && Math.abs(divPct) > 10) {
      const censoTotal = pf("censo_mat_total");
      const fundebTotal = pf("fundeb_tot_mat");
      if (censoTotal != null && fundebTotal != null) {
        return `Atenção: Censo mostra ${censoTotal.toLocaleString("pt-BR")} matrículas vs FUNDEB ${fundebTotal.toLocaleString("pt-BR")} — divergência de ${divPct.toFixed(1)}%`;
      }
    }

    // EJA not captured
    if (label.includes("eja") && census["flag_eja_nao_captada"] === "True") {
      const censoEja = pf("censo_mat_eja");
      return censoEja
        ? `Censo: ${censoEja.toLocaleString("pt-BR")} alunos EJA — não captados no FUNDEB`
        : "EJA não captada no FUNDEB — verificar matrículas";
    }
  }

  return null;
}

// ── Pre-built scenario generators ────────────────────────────────────────
type ScenarioGenerator = (
  enrollments: Enrollment[],
  catMeta: Record<string, { maxAdd: number; tier: string }>,
  census: CensusData
) => { overrides: Record<string, number>; label: string };

const scenarioGenerators: Record<string, ScenarioGenerator> = {
  quickWins: (enrollments, catMeta) => {
    const overrides: Record<string, number> = {};
    for (const e of enrollments) {
      const cm = catMeta[e.categoria];
      if (!cm) continue;
      if (cm.tier === "T1") {
        overrides[e.categoria] = (e.quantidade ?? 0) + 10;
      }
      if (cm.tier === "T3") {
        overrides[e.categoria] = (e.quantidade ?? 0) + Math.round(cm.maxAdd);
      }
    }
    return { overrides, label: "Quick Wins 2026" };
  },
  fullCaptacao: (enrollments, catMeta) => {
    const overrides: Record<string, number> = {};
    for (const e of enrollments) {
      const cm = catMeta[e.categoria];
      if (!cm) continue;
      if (cm.tier === "T1") {
        overrides[e.categoria] = (e.quantidade ?? 0) + 50;
      }
      if (cm.tier === "T2") {
        overrides[e.categoria] = (e.quantidade ?? 0) + Math.round(cm.maxAdd);
      }
      if (cm.tier === "T3") {
        overrides[e.categoria] = (e.quantidade ?? 0) + Math.round(cm.maxAdd);
      }
    }
    return { overrides, label: "Captação Total 2027" };
  },
  conservative: (enrollments, catMeta) => {
    const overrides: Record<string, number> = {};
    for (const e of enrollments) {
      const cm = catMeta[e.categoria];
      if (!cm) continue;
      if (cm.tier === "T1") {
        overrides[e.categoria] = (e.quantidade ?? 0) + 10;
      }
      if (cm.tier === "T3") {
        overrides[e.categoria] = (e.quantidade ?? 0) + Math.round(cm.maxAdd * 0.5);
      }
    }
    return { overrides, label: "Conservador" };
  },
};

function computeGain(
  enrollments: Enrollment[],
  overrides: Record<string, number>,
  baseReceita: number
): number {
  let receita = 0;
  for (const e of enrollments) {
    const qtd = overrides[e.categoria] != null ? overrides[e.categoria] : (e.quantidade ?? 0);
    receita += qtd * (e.fatorVaaf ?? 0);
  }
  return receita - baseReceita;
}

// ── Main component ───────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [activeScenarioLabel, setActiveScenarioLabel] = useState<string | null>(null);
  const [refVaafMap, setRefVaafMap] = useState<Record<string, { urbano: number; campo: number }>>({});

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

    // Fetch ref_matriculas_vaaf for contextual info
    fetch(`/api/ref/matriculas-vaaf?municipalityId=${session.municipality.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.data) return;
        const map: Record<string, { urbano: number; campo: number }> = {};
        for (const row of d.data as Array<{ categoria: string; localidade: string; matriculas: number }>) {
          const cat = row.categoria;
          if (!map[cat]) map[cat] = { urbano: 0, campo: 0 };
          const loc = (row.localidade || '').toLowerCase();
          if (loc.includes('campo') || loc.includes('rural')) {
            map[cat].campo += row.matriculas || 0;
          } else {
            map[cat].urbano += row.matriculas || 0;
          }
        }
        setRefVaafMap(map);
      })
      .catch(() => {});
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

    // T2 conversion: partial → integral
    if (det?.t2?.detalhe) {
      for (const item of det.t2.detalhe) {
        const target = muni.enrollments.find(
          (e) => (e.categoriaLabel ?? e.categoria) === item.para
        );
        if (target) {
          const key = target.categoria;
          meta[key] = {
            maxAdd: item.mat,
            hint: `Converter ${item.mat.toLocaleString("pt-BR")} de ${item.de} (+R$${(item.diff_por_aluno ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/aluno)`,
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
          meta[key].hint = `AEE dupla matrícula: ${item.mat_especial.toLocaleString("pt-BR")} alunos (+R$${item.ganho_100pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })})`;
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
          meta[key].hint = `Categoria inexistente — pode ser criada (VAAF R$${item.vaaf_u.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/aluno)`;
        }
      }
    }

    // Mark all active categories with existing enrollment as relevant
    for (const e of muni.enrollments) {
      if (e.ativa && e.quantidade > 0 && !meta[e.categoria]) {
        meta[e.categoria] = { maxAdd: 0, hint: "", tier: "", relevant: true };
      }
    }

    return meta;
  }, [muni]);

  // 2b) Filter enrollments to relevant ones
  const visibleEnrollments = useMemo(() => {
    if (!muni) return [];
    return muni.enrollments.filter((e) => {
      if (overrides[e.categoria] != null) return true;
      if (catMeta[e.categoria]?.relevant) return true;
      if (e.ativa && (e.quantidade ?? 0) > 0) return true;
      return false;
    });
  }, [muni, catMeta, overrides]);

  // 2b-ii) Split into 3 tabs
  const tabData = useMemo(() => {
    const active: Enrollment[] = [];
    const missing: Enrollment[] = [];
    const growth: Enrollment[] = [];

    for (const e of visibleEnrollments) {
      const cm = catMeta[e.categoria];
      const tier = cm?.tier || "";
      const qty = e.quantidade ?? 0;

      // T1 missing categories (or inactive with no students)
      if (tier === "T1" || (!e.ativa && qty === 0)) {
        missing.push(e);
        continue;
      }

      // T2/T3 growth opportunities
      if (tier === "T2" || tier === "T3") {
        growth.push(e);
        continue;
      }

      // Active category with students
      if (e.ativa && qty > 0) {
        active.push(e);
        continue;
      }

      // Default: active
      active.push(e);
    }

    return { active, missing, growth };
  }, [visibleEnrollments, catMeta]);

  // 2c) Calcula impacto em tempo real
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

  // Pre-compute scenario gains for button labels
  const scenarioGains = useMemo(() => {
    if (!muni) return { quickWins: 0, fullCaptacao: 0, conservative: 0 };
    const census = muni.censusData ?? null;
    return {
      quickWins: computeGain(muni.enrollments, scenarioGenerators.quickWins(muni.enrollments, catMeta, census).overrides, baseReceita),
      fullCaptacao: computeGain(muni.enrollments, scenarioGenerators.fullCaptacao(muni.enrollments, catMeta, census).overrides, baseReceita),
      conservative: computeGain(muni.enrollments, scenarioGenerators.conservative(muni.enrollments, catMeta, census).overrides, baseReceita),
    };
  }, [muni, catMeta, baseReceita]);

  // Apply a pre-built scenario
  const applyScenario = useCallback((key: string) => {
    if (!muni) return;
    const gen = scenarioGenerators[key];
    if (!gen) return;
    const census = muni.censusData ?? null;
    const { overrides: newOverrides, label } = gen(muni.enrollments, catMeta, census);
    setOverrides(newOverrides);
    setActiveScenarioLabel(label);
  }, [muni, catMeta]);

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

  const currentTabEnrollments = tabData[activeTab];

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

      {/* Pre-built scenario buttons */}
      <div className="flex gap-2 mb-4">
        <ScenarioBtn
          label="Quick Wins 2026"
          gain={scenarioGains.quickWins}
          active={activeScenarioLabel === "Quick Wins 2026"}
          onClick={() => applyScenario("quickWins")}
          fmtBRL={fmtBRL}
          color="emerald"
        />
        <ScenarioBtn
          label="Captação Total 2027"
          gain={scenarioGains.fullCaptacao}
          active={activeScenarioLabel === "Captação Total 2027"}
          onClick={() => applyScenario("fullCaptacao")}
          fmtBRL={fmtBRL}
          color="blue"
        />
        <ScenarioBtn
          label="Conservador"
          gain={scenarioGains.conservative}
          active={activeScenarioLabel === "Conservador"}
          onClick={() => applyScenario("conservative")}
          fmtBRL={fmtBRL}
          color="amber"
        />
      </div>

      {/* Tabs */}
      <div className="border border-[var(--border)] rounded-lg mb-4">
        <div className="flex border-b border-[var(--border)]">
          <TabButton
            active={activeTab === "active"}
            onClick={() => setActiveTab("active")}
            label={`Ativas (${tabData.active.length})`}
          />
          <TabButton
            active={activeTab === "missing"}
            onClick={() => setActiveTab("missing")}
            label={`Faltantes (${tabData.missing.length})`}
          />
          <TabButton
            active={activeTab === "growth"}
            onClick={() => setActiveTab("growth")}
            label={`Crescimento (${tabData.growth.length})`}
          />
        </div>

        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
            {activeTab === "active" && "Categorias ativas no FUNDEB"}
            {activeTab === "missing" && "Categorias faltantes — oportunidade de criação"}
            {activeTab === "growth" && "Oportunidades de crescimento (conversão/AEE)"}
            {" "}({projecao.tocadas.length} categoria{projecao.tocadas.length === 1 ? "" : "s"} modificada{projecao.tocadas.length === 1 ? "" : "s"})
          </div>
          {!muni ? (
            <div className="text-xs text-gray-400">Carregando matriculas do municipio...</div>
          ) : currentTabEnrollments.length === 0 ? (
            <div className="text-xs text-gray-400">
              {activeTab === "active" && "Nenhuma categoria ativa encontrada."}
              {activeTab === "missing" && "Nenhuma categoria faltante — município já capta todas as categorias."}
              {activeTab === "growth" && "Nenhuma oportunidade de crescimento identificada."}
            </div>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-2">
              {currentTabEnrollments.map((e) => {
                const override = overrides[e.categoria];
                const current = override != null ? override : e.quantidade ?? 0;
                const base = e.quantidade ?? 0;
                const cm = catMeta[e.categoria];
                const tier = cm?.tier || "";
                const potAdd = cm?.maxAdd ?? 0;
                const max = Math.max(base + potAdd, base + 20, potAdd > 0 ? base + potAdd : base * 2 || 100);
                const modified = override != null && override !== base;
                const census = muni.censusData ?? null;
                const censusHint = getCensusHint(e, tier, census);

                // Compute per-card revenue info
                const cardRevenue = current * (e.fatorVaaf ?? 0);
                const totalRevenue = projecao.receitaProjetada || baseReceita || 1;
                const cardPct = ((cardRevenue / totalRevenue) * 100);

                return (
                  <div
                    key={e.categoria}
                    className={`p-2.5 rounded-lg border ${
                      modified ? "bg-amber-50 border-amber-200" : "border-transparent"
                    }`}
                  >
                    {/* Line 1: Name + tier badge */}
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[var(--text1)] truncate flex items-center gap-1.5">
                          {e.categoriaLabel ?? e.categoria}
                          {tier && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              tier === "T2" ? "bg-purple-100 text-purple-700" :
                              tier === "T1" ? "bg-green-100 text-green-700" :
                              tier === "T3" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                            }`}>
                              {tier}
                            </span>
                          )}
                        </div>

                        {/* Line 2: Context based on tab */}
                        <div className="text-[10px] text-[var(--text3)] mt-0.5">
                          {activeTab === "active" && (
                            <>
                              atual: {base.toLocaleString("pt-BR")} · receita: {fmtBRL(cardRevenue)} · {cardPct.toFixed(1)}% do total
                            </>
                          )}
                          {activeTab === "missing" && (
                            <>
                              VAAF: {fmtBRL(e.fatorVaaf ?? 0)}/aluno · ganho com +10: {fmtBRL((e.fatorVaaf ?? 0) * 10)} · com +50: {fmtBRL((e.fatorVaaf ?? 0) * 50)}
                            </>
                          )}
                          {activeTab === "growth" && (
                            <>
                              base: {base.toLocaleString("pt-BR")}
                              {potAdd > 0 && <> · max +{potAdd.toLocaleString("pt-BR")}</>}
                              {tier === "T3" && <> (AEE)</>}
                              {" "}· VAAF: {fmtBRL(e.fatorVaaf ?? 0)}/aluno
                            </>
                          )}
                        </div>
                      </div>

                      {/* Slider + input */}
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

                    {/* Line 3: Potential hint from catMeta (blue) */}
                    {cm?.hint && (
                      <div className="text-[10px] text-blue-600 mt-0.5 ml-0.5">
                        {cm.hint}
                      </div>
                    )}

                    {/* Line 4: Census divergence hint (amber) */}
                    {censusHint && (
                      <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 ml-0.5">
                        {censusHint}
                      </div>
                    )}

                    {/* Line 5: VAAF ref data badge */}
                    {(() => {
                      // Match enrollment label to ref_matriculas_vaaf
                      const label = (e.categoriaLabel ?? e.categoria).toLowerCase();
                      const matchedKey = Object.keys(refVaafMap).find((k) => label.includes(k.toLowerCase()) || k.toLowerCase().includes(label));
                      const refEntry = matchedKey ? refVaafMap[matchedKey] : null;
                      if (!refEntry || (refEntry.urbano === 0 && refEntry.campo === 0)) return null;
                      return (
                        <div className="text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-0.5 mt-0.5 ml-0.5">
                          VAAF: Urbano {refEntry.urbano.toLocaleString("pt-BR")} · Campo {refEntry.campo.toLocaleString("pt-BR")}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Clear overrides */}
          {projecao.tocadas.length > 0 && (
            <button
              type="button"
              onClick={() => { setOverrides({}); setActiveScenarioLabel(null); }}
              className="mt-2 text-[10px] text-[#00B4D8] hover:underline"
            >
              Limpar overrides
            </button>
          )}
        </div>
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

      {/* Lista de cenarios salvos — radio group for target selection */}
      {scenarios.length > 0 && (
        <div className="border border-[var(--border)] rounded-lg p-4 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
            Cenarios salvos ({scenarios.length}) — selecione o cenario-alvo
          </div>
          <div className="space-y-2">
            {scenarios.map((s) => (
              <label
                key={s.id}
                className={`flex items-center gap-3 text-xs p-2 rounded border cursor-pointer transition-colors ${
                  s.isTarget
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-[var(--border)] hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="target-scenario"
                  checked={s.isTarget}
                  disabled={submitting}
                  onChange={() => {
                    if (!s.isTarget) marcarComoTarget(s.id);
                  }}
                  className="accent-emerald-600"
                />
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
              </label>
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

// ── Sub-components ───────────────────────────────────────────────────────

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

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
        active
          ? "text-[#00B4D8] border-b-2 border-[#00B4D8] bg-white"
          : "text-[var(--text3)] hover:text-[var(--text1)] hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function ScenarioBtn({
  label,
  gain,
  active,
  onClick,
  fmtBRL,
  color,
}: {
  label: string;
  gain: number;
  active: boolean;
  onClick: () => void;
  fmtBRL: (v: number) => string;
  color: "emerald" | "blue" | "amber";
}) {
  const colorClasses = {
    emerald: active
      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    blue: active
      ? "border-blue-500 bg-blue-50 text-blue-800"
      : "border-blue-200 text-blue-700 hover:bg-blue-50",
    amber: active
      ? "border-amber-500 bg-amber-50 text-amber-800"
      : "border-amber-200 text-amber-700 hover:bg-amber-50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-left transition-colors ${colorClasses[color]}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider">{label}</div>
      <div className="text-xs font-semibold mt-0.5">
        +{fmtBRL(gain)}
      </div>
    </button>
  );
}
