"use client";

import { use, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MunicipalityDetail {
  id: number;
  nome: string;
  codigoIbge: string | null;
  populacao: number | null;
  regiao: string | null;
  financials: {
    receitaTotal: number | null;
    contribuicao: number | null;
    recursosReceber: number | null;
    vaat: number | null;
    vaar: number | null;
    ganhoPerda: number | null;
    destRemuneracao: number | null;
    destInfantil: number | null;
    destCapital: number | null;
    coeficiente: number | null;
    nse: number | null;
  };
  revenue: {
    icms: number | null;
    ipva: number | null;
    ipiExp: number | null;
    totalEstado: number | null;
    fpm: number | null;
    itr: number | null;
    totalUniao: number | null;
  };
  historico: Record<string, number | null>;
  enrollmentSummary: {
    totalMatriculas: number | null;
    categoriasAtivas: number | null;
    eiMat: number | null;
    efMat: number | null;
    dmMat: number | null;
  };
  potencial: {
    potTotal: number | null;
    pctPotTotal: number | null;
    nFaltantes: number | null;
  };
  schools: {
    total: number;
    municipais: number | null;
    urbanas: number;
    rurais: number;
    totalDocentes: number;
  };
  infrastructure: {
    pctInternet: number | null;
    pctBiblioteca: number | null;
    pctQuadra: number | null;
    pctLabInfo: number | null;
  };
  educationMetrics: {
    idebAi: number | null;
    idebAf: number | null;
    saebPort5: number | null;
    saebMat5: number | null;
    saebPort9: number | null;
    saebMat9: number | null;
  };
}

export default function MunicipalityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [muni, setMuni] = useState<MunicipalityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMunicipality() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/municipalities/${slug}`);
        if (!res.ok) {
          const errData = await res.json();
          setError(errData.error || "Municipio nao encontrado");
          return;
        }
        const data: MunicipalityDetail = await res.json();
        setMuni(data);
      } catch (err) {
        console.error("Failed to fetch municipality:", err);
        setError("Erro ao carregar dados do municipio");
      } finally {
        setLoading(false);
      }
    }
    fetchMunicipality();
  }, [slug]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Carregando..." />
        <div className="max-w-7xl mx-auto px-8 py-16 text-center">
          <div className="animate-pulse-slow text-[var(--text3)]">
            Carregando dados do municipio...
          </div>
        </div>
      </div>
    );
  }

  if (error || !muni) {
    return (
      <div>
        <PageHeader title="Erro" />
        <div className="max-w-7xl mx-auto px-8 py-16 text-center">
          <p className="text-[var(--red)] mb-4">{error || "Municipio nao encontrado"}</p>
          <Link
            href="/diagnostico"
            className="text-sm text-[var(--cyan)] hover:underline"
          >
            Voltar ao diagnostico
          </Link>
        </div>
      </div>
    );
  }

  const gp = muni.financials.ganhoPerda ?? 0;
  const gpColor = gp > 0 ? "var(--green)" : gp < 0 ? "var(--red)" : "var(--text3)";
  const gpPrefix = gp > 0 ? "+" : "";

  // Revenue breakdown data
  const revenueData = [
    { name: "ICMS", value: muni.revenue.icms ?? 0 },
    { name: "IPVA", value: muni.revenue.ipva ?? 0 },
    { name: "IPI-Exp", value: muni.revenue.ipiExp ?? 0 },
    { name: "FPM", value: muni.revenue.fpm ?? 0 },
    { name: "ITR", value: muni.revenue.itr ?? 0 },
  ].filter((d) => d.value > 0);

  // Historical FUNDEB data
  const histData = Object.entries(muni.historico || {})
    .filter(([, v]) => v != null)
    .map(([year, value]) => ({
      year,
      value: value as number,
    }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Infrastructure data
  const infraItems = [
    { label: "Internet", value: muni.infrastructure.pctInternet },
    { label: "Biblioteca", value: muni.infrastructure.pctBiblioteca },
    { label: "Quadra Esportiva", value: muni.infrastructure.pctQuadra },
    { label: "Lab. Informatica", value: muni.infrastructure.pctLabInfo },
  ];

  return (
    <div>
      <PageHeader
        title={muni.nome}
        description={
          [
            muni.regiao ? `Regiao: ${muni.regiao}` : null,
            muni.codigoIbge ? `IBGE: ${muni.codigoIbge}` : null,
            muni.populacao
              ? `Pop: ${formatNumber(muni.populacao)}`
              : null,
          ]
            .filter(Boolean)
            .join(" | ") || undefined
        }
      >
        <Link
          href="/diagnostico"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Voltar
        </Link>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-8">
        {/* Section 1: Financial Overview */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
            Visao Financeira
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Receita Total FUNDEB"
              value={
                muni.financials.receitaTotal != null
                  ? formatCurrency(muni.financials.receitaTotal)
                  : "--"
              }
              sub={
                muni.enrollmentSummary.totalMatriculas != null
                  ? `${formatNumber(muni.enrollmentSummary.totalMatriculas)} matriculas`
                  : undefined
              }
              icon="$"
              color="var(--navy)"
            />
            <StatCard
              label="Contribuicao"
              value={
                muni.financials.contribuicao != null
                  ? formatCurrency(muni.financials.contribuicao)
                  : "--"
              }
              sub={
                muni.financials.coeficiente != null
                  ? `Coef: ${muni.financials.coeficiente.toFixed(4)}`
                  : undefined
              }
              icon="C"
              color="var(--text)"
            />
            <StatCard
              label="Ganho / Perda"
              value={
                gp !== 0
                  ? `${gpPrefix}${formatCurrency(Math.abs(gp))}`
                  : "--"
              }
              sub={gp > 0 ? "Municipio ganha" : gp < 0 ? "Municipio perde" : undefined}
              icon={gp >= 0 ? "+" : "-"}
              color={gpColor}
            />
            <StatCard
              label="Potencial de Captacao"
              value={
                muni.potencial.potTotal != null
                  ? formatCurrency(muni.potencial.potTotal)
                  : "--"
              }
              sub={
                muni.potencial.pctPotTotal != null
                  ? `${formatPercent(muni.potencial.pctPotTotal)} da receita`
                  : undefined
              }
              icon="P"
              color="var(--cyan)"
            />
          </div>
        </section>

        {/* Section 2: Revenue Breakdown */}
        {revenueData.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
              Composicao da Receita
            </h2>
            <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-fade-in">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={revenueData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--text3)" }}
                    tickFormatter={(v: number) => formatCurrency(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--text2)" }}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Valor",
                    ]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--cyan)"
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex items-center gap-6 text-xs text-[var(--text3)]">
                <span>
                  Total Estado:{" "}
                  <strong className="text-[var(--text)]">
                    {muni.revenue.totalEstado != null
                      ? formatCurrency(muni.revenue.totalEstado)
                      : "--"}
                  </strong>
                </span>
                <span>
                  Total Uniao:{" "}
                  <strong className="text-[var(--text)]">
                    {muni.revenue.totalUniao != null
                      ? formatCurrency(muni.revenue.totalUniao)
                      : "--"}
                  </strong>
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Historical FUNDEB */}
        {histData.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
              Historico FUNDEB (2022-2026)
            </h2>
            <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-fade-in">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={histData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12, fill: "var(--text2)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text3)" }}
                    tickFormatter={(v: number) => formatCurrency(v)}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Receita FUNDEB",
                    ]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--navy)"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: "var(--navy)", stroke: "white", strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: "var(--cyan)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Section 4 & 5: Education Metrics + Enrollment */}
        <div className="grid grid-cols-2 gap-6">
          {/* Education Metrics */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
              Indicadores Educacionais
            </h2>
            <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-fade-in space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-[var(--bg)] rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1">
                    IDEB Anos Iniciais
                  </div>
                  <div className="text-3xl font-extrabold text-[var(--navy)]">
                    {muni.educationMetrics.idebAi != null
                      ? muni.educationMetrics.idebAi.toFixed(1)
                      : "--"}
                  </div>
                </div>
                <div className="text-center p-4 bg-[var(--bg)] rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1">
                    IDEB Anos Finais
                  </div>
                  <div className="text-3xl font-extrabold text-[var(--navy)]">
                    {muni.educationMetrics.idebAf != null
                      ? muni.educationMetrics.idebAf.toFixed(1)
                      : "--"}
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-3">
                  SAEB - Proficiencia Media
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Portugues 5o ano", value: muni.educationMetrics.saebPort5 },
                    { label: "Matematica 5o ano", value: muni.educationMetrics.saebMat5 },
                    { label: "Portugues 9o ano", value: muni.educationMetrics.saebPort9 },
                    { label: "Matematica 9o ano", value: muni.educationMetrics.saebMat9 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-2.5 bg-[var(--bg)] rounded-lg"
                    >
                      <span className="text-xs text-[var(--text2)]">
                        {item.label}
                      </span>
                      <span className="text-sm font-bold text-[var(--navy)] tabular-nums">
                        {item.value != null ? item.value.toFixed(1) : "--"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Enrollment Breakdown */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
              Matriculas por Segmento
            </h2>
            <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-fade-in space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-[var(--bg)] rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1">
                    Ed. Infantil
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--cyan)]">
                    {muni.enrollmentSummary.eiMat != null
                      ? formatNumber(muni.enrollmentSummary.eiMat)
                      : "--"}
                  </div>
                </div>
                <div className="text-center p-4 bg-[var(--bg)] rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1">
                    Ens. Fundamental
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--navy)]">
                    {muni.enrollmentSummary.efMat != null
                      ? formatNumber(muni.enrollmentSummary.efMat)
                      : "--"}
                  </div>
                </div>
                <div className="text-center p-4 bg-[var(--bg)] rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1">
                    Demais
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--green-dark)]">
                    {muni.enrollmentSummary.dmMat != null
                      ? formatNumber(muni.enrollmentSummary.dmMat)
                      : "--"}
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-3">
                  Escolas e Docentes
                </div>
                <div className="space-y-2.5">
                  {[
                    {
                      label: "Escolas Municipais",
                      value: muni.schools.municipais ?? muni.schools.total,
                    },
                    {
                      label: "Escolas Rurais",
                      value: muni.schools.rurais,
                    },
                    {
                      label: "Total de Docentes",
                      value: muni.schools.totalDocentes,
                    },
                    {
                      label: "Categorias Ativas",
                      value: muni.enrollmentSummary.categoriasAtivas,
                    },
                    {
                      label: "Categorias Faltantes",
                      value: muni.potencial.nFaltantes,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-2.5 bg-[var(--bg)] rounded-lg"
                    >
                      <span className="text-xs text-[var(--text2)]">
                        {item.label}
                      </span>
                      <span className="text-sm font-bold text-[var(--navy)] tabular-nums">
                        {item.value != null ? formatNumber(item.value) : "--"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Section 6: Infrastructure */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
            Infraestrutura Escolar
          </h2>
          <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              {infraItems.map((item) => {
                const pct = item.value ?? 0;
                const barColor =
                  pct >= 80
                    ? "var(--green)"
                    : pct >= 50
                    ? "var(--orange)"
                    : "var(--red)";
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[var(--text2)]">
                        {item.label}
                      </span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
                        {item.value != null ? formatPercent(item.value) : "--"}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Back link */}
        <div className="pb-8">
          <Link
            href="/diagnostico"
            className="inline-flex items-center gap-2 text-sm text-[var(--cyan)] hover:underline font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Voltar para lista de municipios
          </Link>
        </div>
      </div>
    </div>
  );
}
