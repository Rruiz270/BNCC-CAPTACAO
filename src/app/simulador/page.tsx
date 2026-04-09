"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { MunicipalitySelector } from "@/components/municipality-selector";
import { StatCard } from "@/components/stat-card";
import { CATEGORIAS_FUNDEB, VAAF_BASE } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Municipality {
  id: number;
  nome: string;
  totalMatriculas: number | null;
  receitaTotal: number | null;
}

interface Enrollment {
  categoria: string;
  categoriaLabel: string;
  fatorVaaf: number;
  quantidade: number;
  receitaEstimada: number;
  ativa: boolean;
}

interface MunicipalityDetail {
  id: number;
  nome: string;
  enrollments: Enrollment[];
  financials: {
    receitaTotal: number | null;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function shortLabel(label: string): string {
  return label
    .replace("Publica ", "Pub. ")
    .replace("Conveniada ", "Conv. ")
    .replace("Pre-escola", "Pre")
    .replace("Integral", "Int.")
    .replace("Parcial", "Parc.")
    .replace("(BASE)", "")
    .replace("Ed. Especial", "Ed.Esp.")
    .replace("(Dupla Matricula)", "")
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function SimuladorPage() {
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [detail, setDetail] = useState<MunicipalityDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Map from category id -> simulated enrollment count
  const [simulated, setSimulated] = useState<Record<string, number>>({});

  /* ---------- fetch detail when municipality changes ---------- */

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setSimulated({});
      return;
    }
    setLoading(true);
    fetch(`/api/municipalities/${selectedId}`)
      .then((r) => r.json())
      .then((data: MunicipalityDetail) => {
        setDetail(data);

        // Seed simulated values with current enrollments
        const seed: Record<string, number> = {};
        for (const cat of CATEGORIAS_FUNDEB) {
          const enrollment = data.enrollments?.find(
            (e: Enrollment) => e.categoria === cat.id
          );
          seed[cat.id] = enrollment ? Number(enrollment.quantidade) || 0 : 0;
        }
        setSimulated(seed);
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  /* ---------- current enrollment lookup ---------- */

  const currentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of CATEGORIAS_FUNDEB) {
      const enrollment = detail?.enrollments?.find(
        (e) => e.categoria === cat.id
      );
      map[cat.id] = enrollment ? Number(enrollment.quantidade) || 0 : 0;
    }
    return map;
  }, [detail]);

  /* ---------- revenue computations ---------- */

  const currentRevenue = useMemo(() => {
    let total = 0;
    for (const cat of CATEGORIAS_FUNDEB) {
      total += currentCounts[cat.id] * cat.porAluno;
    }
    return total;
  }, [currentCounts]);

  const simulatedRevenue = useMemo(() => {
    let total = 0;
    for (const cat of CATEGORIAS_FUNDEB) {
      total += (simulated[cat.id] || 0) * cat.porAluno;
    }
    return total;
  }, [simulated]);

  const difference = simulatedRevenue - currentRevenue;
  const pctChange =
    currentRevenue > 0 ? (difference / currentRevenue) * 100 : 0;

  /* ---------- chart data ---------- */

  const chartData = useMemo(() => {
    return CATEGORIAS_FUNDEB.map((cat) => ({
      name: shortLabel(cat.label),
      atual: currentCounts[cat.id] * cat.porAluno,
      simulado: (simulated[cat.id] || 0) * cat.porAluno,
    })).filter((d) => d.atual > 0 || d.simulado > 0);
  }, [currentCounts, simulated]);

  /* ---------- handlers ---------- */

  const handleMunicipalityChange = useCallback(
    (_id: number, muni: Municipality) => {
      setSelectedId(muni.id);
    },
    []
  );

  const handleSliderChange = useCallback((catId: string, value: number) => {
    setSimulated((prev) => ({ ...prev, [catId]: Math.max(0, value) }));
  }, []);

  const handleReset = useCallback(() => {
    setSimulated({ ...currentCounts });
  }, [currentCounts]);

  /* ---------- custom tooltip ---------- */

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-[var(--text)] mb-1">{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span className="text-[var(--text3)]">
              {p.dataKey === "atual" ? "Atual" : "Simulado"}
            </span>
            <span className="font-semibold">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Simulador de Impacto"
        description="Simule cenarios de matricula e veja o impacto na receita FUNDEB"
      />

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Municipality Selector */}
        <div className="max-w-md">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text3)] mb-2">
            Municipio
          </label>
          <MunicipalitySelector
            value={selectedId}
            onChange={handleMunicipalityChange}
          />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-[var(--text3)] text-sm animate-pulse-slow">
            Carregando dados do municipio...
          </div>
        )}

        {/* Empty state */}
        {!selectedId && !loading && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 opacity-30">🎛️</div>
            <div className="text-[var(--text3)] text-sm">
              Selecione um municipio para iniciar a simulacao
            </div>
          </div>
        )}

        {/* Main content - two columns */}
        {detail && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Category inputs (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">
                  Categorias de Matricula
                </h2>
                <button
                  onClick={handleReset}
                  className="text-xs font-semibold text-[var(--cyan)] hover:text-[var(--cyan-light)] transition-colors"
                >
                  Resetar Valores
                </button>
              </div>

              <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                  <div className="col-span-3">Categoria</div>
                  <div className="col-span-1 text-center">Atual</div>
                  <div className="col-span-4 text-center">Ajuste</div>
                  <div className="col-span-1 text-center">Simulado</div>
                  <div className="col-span-1 text-center">Fator</div>
                  <div className="col-span-2 text-right">Receita Est.</div>
                </div>

                {/* Category rows */}
                {CATEGORIAS_FUNDEB.map((cat, idx) => {
                  const current = currentCounts[cat.id];
                  const sim = simulated[cat.id] || 0;
                  const diff = sim - current;
                  const catRevenue = sim * cat.porAluno;
                  const maxSlider = Math.max(current * 3, 500);

                  return (
                    <div
                      key={cat.id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-[var(--bg)]/50"
                      } ${diff !== 0 ? "ring-1 ring-inset ring-[var(--cyan)]/20" : ""}`}
                    >
                      {/* Category label */}
                      <div className="col-span-3">
                        <div className="text-xs font-medium text-[var(--text)] leading-tight">
                          {cat.label}
                        </div>
                      </div>

                      {/* Current count */}
                      <div className="col-span-1 text-center text-xs text-[var(--text3)] tabular-nums">
                        {formatNumber(current)}
                      </div>

                      {/* Slider + input */}
                      <div className="col-span-4 flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={maxSlider}
                          step={1}
                          value={sim}
                          onChange={(e) =>
                            handleSliderChange(cat.id, parseInt(e.target.value))
                          }
                          className="flex-1 h-1.5 accent-[var(--cyan)] cursor-pointer"
                        />
                        <input
                          type="number"
                          min={0}
                          value={sim}
                          onChange={(e) =>
                            handleSliderChange(
                              cat.id,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 text-xs text-center border border-[var(--border)] rounded-md px-1 py-1 focus:outline-none focus:border-[var(--cyan)] tabular-nums"
                        />
                      </div>

                      {/* Simulated count + diff badge */}
                      <div className="col-span-1 text-center">
                        {diff !== 0 && (
                          <span
                            className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              diff > 0
                                ? "bg-[var(--green)]/15 text-[var(--green-dark)]"
                                : "bg-[var(--red)]/10 text-[var(--red)]"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {formatNumber(diff)}
                          </span>
                        )}
                      </div>

                      {/* VAAF factor */}
                      <div className="col-span-1 text-center text-xs text-[var(--text3)] tabular-nums">
                        {cat.fator.toFixed(2)}
                      </div>

                      {/* Estimated revenue */}
                      <div className="col-span-2 text-right">
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            diff > 0
                              ? "text-[var(--green-dark)]"
                              : diff < 0
                                ? "text-[var(--red)]"
                                : "text-[var(--text)]"
                          }`}
                        >
                          {formatCurrency(catRevenue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VAAF base reference */}
              <div className="text-[10px] text-[var(--text3)] text-right">
                Valor base VAAF (EF Anos Iniciais Parcial):{" "}
                <span className="font-semibold">
                  R$ {VAAF_BASE.toLocaleString("pt-BR")}
                </span>{" "}
                por aluno/ano
              </div>
            </div>

            {/* RIGHT: Results panel (1/3 width) */}
            <div className="space-y-4">
              {/* Summary stat cards */}
              <StatCard
                label="Receita Atual"
                value={formatCurrency(currentRevenue)}
                sub={`${formatNumber(Object.values(currentCounts).reduce((a, b) => a + b, 0))} matriculas`}
                icon="📊"
              />

              <StatCard
                label="Receita Simulada"
                value={formatCurrency(simulatedRevenue)}
                sub={`${formatNumber(Object.values(simulated).reduce((a, b) => a + b, 0))} matriculas`}
                color={
                  difference > 0
                    ? "var(--green-dark)"
                    : difference < 0
                      ? "var(--red)"
                      : "var(--cyan)"
                }
                icon="🎯"
              />

              {/* Difference card */}
              <div
                className={`border rounded-xl p-5 animate-fade-in ${
                  difference > 0
                    ? "bg-[var(--green)]/5 border-[var(--green)]/30"
                    : difference < 0
                      ? "bg-[var(--red)]/5 border-[var(--red)]/30"
                      : "bg-white border-[var(--border)]"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                  Diferenca
                </div>
                <div
                  className={`text-2xl font-extrabold mt-1 ${
                    difference > 0
                      ? "text-[var(--green-dark)]"
                      : difference < 0
                        ? "text-[var(--red)]"
                        : "text-[var(--text)]"
                  }`}
                >
                  {difference > 0 ? "+" : ""}
                  {formatCurrency(difference)}
                </div>
                <div className="text-xs text-[var(--text2)] mt-0.5">
                  {pctChange > 0 ? "+" : ""}
                  {pctChange.toFixed(1)}% em relacao ao atual
                </div>
              </div>

              {/* Impact breakdown */}
              <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] mb-3">
                  Maiores Impactos
                </div>
                <div className="space-y-2">
                  {CATEGORIAS_FUNDEB.map((cat) => {
                    const d =
                      ((simulated[cat.id] || 0) - currentCounts[cat.id]) *
                      cat.porAluno;
                    return { ...cat, diff: d };
                  })
                    .filter((c) => c.diff !== 0)
                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
                    .slice(0, 5)
                    .map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[var(--text2)] truncate mr-2">
                          {shortLabel(cat.label)}
                        </span>
                        <span
                          className={`font-semibold tabular-nums whitespace-nowrap ${
                            cat.diff > 0
                              ? "text-[var(--green-dark)]"
                              : "text-[var(--red)]"
                          }`}
                        >
                          {cat.diff > 0 ? "+" : ""}
                          {formatCurrency(cat.diff)}
                        </span>
                      </div>
                    ))}
                  {CATEGORIAS_FUNDEB.every(
                    (cat) =>
                      (simulated[cat.id] || 0) === currentCounts[cat.id]
                  ) && (
                    <div className="text-xs text-[var(--text3)] text-center py-2">
                      Ajuste os valores para ver o impacto
                    </div>
                  )}
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] mb-3">
                    Comparativo por Categoria
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 9, fill: "var(--text3)" }}
                          tickFormatter={(v: number) => formatCurrency(v)}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={90}
                          tick={{ fontSize: 9, fill: "var(--text3)" }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="atual"
                          name="Atual"
                          fill="var(--navy)"
                          radius={[0, 2, 2, 0]}
                          barSize={8}
                        />
                        <Bar
                          dataKey="simulado"
                          name="Simulado"
                          fill="var(--cyan)"
                          radius={[0, 2, 2, 0]}
                          barSize={8}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-[var(--text3)]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-[var(--navy)]" />
                      Atual
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-[var(--cyan)]" />
                      Simulado
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
