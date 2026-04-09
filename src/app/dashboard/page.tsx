"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Municipality {
  id: number;
  nome: string;
  receitaTotal: number;
  totalMatriculas: number;
  potTotal: number;
  pctPotTotal: number;
  ganhoPerda: number;
  hist: {
    "2022": number;
    "2023": number;
    "2024": number;
    "2025": number;
    "2026": number;
  };
}

interface Stats {
  totalMunicipalities: number;
  gaining: number;
  losing: number;
  totalGanhoPerda: number;
  totalPotencial: number;
  avgPotPct: number;
  totalEnrollments: number;
  totalRevenue: number;
}

interface ApiResponse {
  data: Municipality[];
  stats: Stats;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-20 bg-gray-100 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-pulse">
      <div className="h-5 w-48 bg-gray-200 rounded mb-6" />
      <div className="h-64 bg-gray-100 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-pulse">
      <div className="h-5 w-56 bg-gray-200 rounded mb-6" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          <div className="h-4 flex-1 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-4 w-16 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

const COLORS_PIE = ["#00E5A0", "#D4553A"];

export default function DashboardPage() {
  const [data, setData] = useState<Municipality[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/municipalities?limit=645");
        if (!res.ok) throw new Error("Falha ao carregar dados");
        const json: ApiResponse = await res.json();
        setData(json.data);
        setStats(json.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Aggregate revenue history across all municipalities
  const revenueHistory = data.length > 0
    ? (["2022", "2023", "2024", "2025", "2026"] as const).map((year) => ({
        year,
        total: data.reduce((sum, m) => sum + (Number(m.hist[year]) || 0), 0),
      }))
    : [];

  // Top 10 municipalities by potTotal descending
  const top10 = [...data]
    .sort((a, b) => (Number(b.potTotal) || 0) - (Number(a.potTotal) || 0))
    .slice(0, 10);

  // Pie chart data
  const pieData =
    stats
      ? [
          { name: "Ganham", value: stats.gaining },
          { name: "Perdem", value: stats.losing },
        ]
      : [];

  if (error) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Visão geral do FUNDEB SP 2026 - 645 municípios"
        />
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-semibold">Erro ao carregar dados</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral do FUNDEB SP 2026 - 645 municípios"
      />

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* KPI Stats Row - 4 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : stats ? (
            <>
              <StatCard
                label="Total Municípios"
                value={formatNumber(stats.totalMunicipalities)}
                icon="🏛️"
                color="#0A2463"
              />
              <StatCard
                label="Total Matrículas"
                value={formatNumber(Number(stats.totalEnrollments))}
                icon="🎓"
                color="#0A2463"
              />
              <StatCard
                label="Receita Total FUNDEB"
                value={formatCurrency(Number(stats.totalRevenue))}
                icon="💰"
                color="#00B4D8"
              />
              <StatCard
                label="Potencial de Captação"
                value={formatCurrency(Number(stats.totalPotencial))}
                sub="Valor total recuperável"
                icon="🚀"
                color="#00E5A0"
              />
            </>
          ) : null}
        </div>

        {/* Second row - 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : stats ? (
            <>
              <StatCard
                label="Municípios que Ganham"
                value={formatNumber(stats.gaining)}
                sub={`${((stats.gaining / stats.totalMunicipalities) * 100).toFixed(1)}% do total`}
                icon="📈"
                color="#00E5A0"
              />
              <StatCard
                label="Municípios que Perdem"
                value={formatNumber(stats.losing)}
                sub={`${((stats.losing / stats.totalMunicipalities) * 100).toFixed(1)}% do total`}
                icon="📉"
                color="#D4553A"
              />
              <StatCard
                label="Impacto Médio"
                value={formatPercent(Number(stats.avgPotPct))}
                sub="% médio de potencial sobre receita"
                icon="⚡"
                color="#0A2463"
              />
            </>
          ) : null}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue History Chart */}
          {loading ? (
            <div className="lg:col-span-2">
              <SkeletonChart />
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-sm font-bold text-[var(--text1)] mb-1">
                Histórico de Receita FUNDEB
              </h2>
              <p className="text-xs text-[var(--text3)] mb-4">
                Receita total agregada por ano (todos os municípios)
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueHistory}
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatCurrency(v)}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      width={90}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Receita Total",
                      ]}
                      labelFormatter={(label) => `Ano ${label}`}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "13px",
                      }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {revenueHistory.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.year === "2026" ? "#00B4D8" : "#0A2463"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Gain/Loss Pie Chart */}
          {loading ? (
            <SkeletonChart />
          ) : (
            <div className="bg-white border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-sm font-bold text-[var(--text1)] mb-1">
                Distribuição Ganho/Perda
              </h2>
              <p className="text-xs text-[var(--text3)] mb-4">
                Municípios que ganham vs. perdem com o FUNDEB
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="value"
                      stroke="none"
                      label={({ name, value }) =>
                        `${name ?? ""}: ${value ?? ""}`
                      }
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={`pie-${index}`}
                          fill={COLORS_PIE[index]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatNumber(Number(value)),
                        String(name),
                      ]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "13px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#00E5A0]" />
                  <span className="text-xs text-[var(--text2)]">
                    Ganham ({stats?.gaining ?? 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#D4553A]" />
                  <span className="text-xs text-[var(--text2)]">
                    Perdem ({stats?.losing ?? 0})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top 10 Municipalities Table */}
        {loading ? (
          <SkeletonTable />
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--text1)] mb-1">
              Top 10 Municípios por Potencial de Captação
            </h2>
            <p className="text-xs text-[var(--text3)] mb-4">
              Municípios com maior potencial de recuperação de recursos FUNDEB
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      #
                    </th>
                    <th className="text-left py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Município
                    </th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Matrículas
                    </th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Receita Total
                    </th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      Potencial
                    </th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                      % Potencial
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((m, i) => (
                    <Link
                      key={m.id}
                      href={`/diagnostico/${m.id}`}
                      className="contents"
                    >
                      <tr className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer">
                        <td className="py-3 px-3 text-[var(--text3)] font-mono text-xs">
                          {i + 1}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[var(--text1)]">
                          {m.nome}
                        </td>
                        <td className="py-3 px-3 text-right text-[var(--text2)]">
                          {formatNumber(Number(m.totalMatriculas))}
                        </td>
                        <td className="py-3 px-3 text-right text-[var(--text2)]">
                          {formatCurrency(Number(m.receitaTotal))}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-[#00B4D8]">
                          {formatCurrency(Number(m.potTotal))}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              Number(m.pctPotTotal) > 0
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {formatPercent(Number(m.pctPotTotal))}
                          </span>
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
