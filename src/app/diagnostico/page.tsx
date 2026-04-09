"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import Link from "next/link";

interface Municipality {
  id: number;
  nome: string;
  totalMatriculas: number | null;
  receitaTotal: number | null;
  ganhoPerda: number | null;
  potTotal: number | null;
  pctPotTotal: number | null;
  nFaltantes: number | null;
  categoriasAtivas: number | null;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  totalPages: number;
  currentPage: number;
}

interface ApiResponse {
  data: Municipality[];
  pagination: PaginationInfo;
  stats: {
    totalMunicipalities: number;
    gaining: number;
    losing: number;
    totalGanhoPerda: number | null;
    totalPotencial: number | null;
    avgPotPct: number | null;
    totalEnrollments: number | null;
    totalRevenue: number | null;
  } | null;
}

type SortColumn =
  | "nome"
  | "total_matriculas"
  | "receita_total"
  | "ganho_perda"
  | "pot_total"
  | "pct_pot_total";

type FilterGp = "" | "gain" | "loss";

const PAGE_SIZE = 20;

export default function DiagnosticoPage() {
  const [data, setData] = useState<Municipality[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState<ApiResponse["stats"]>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortColumn>("nome");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [filterGp, setFilterGp] = useState<FilterGp>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filterGp]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
        order,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterGp) params.set("filter_gp", filterGp);

      const res = await fetch(`/api/municipalities?${params.toString()}`);
      const json: ApiResponse = await res.json();

      setData(json.data || []);
      setPagination(json.pagination || null);
      setStats(json.stats || null);
    } catch (err) {
      console.error("Failed to fetch municipalities:", err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, debouncedSearch, filterGp]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSort(col: SortColumn) {
    if (sort === col) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setOrder(col === "nome" ? "asc" : "desc");
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortColumn }) {
    if (sort !== col) {
      return (
        <svg
          className="w-3.5 h-3.5 opacity-30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-3.5 h-3.5 text-[var(--cyan)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {order === "asc" ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        )}
      </svg>
    );
  }

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div>
      <PageHeader
        title="Diagnostico Municipal"
        description="Analise detalhada dos 645 municipios paulistas"
      />

      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Stats summary */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 animate-fade-in">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Total Municipios
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--navy)]">
                {formatNumber(stats.totalMunicipalities)}
              </div>
            </div>
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 animate-fade-in">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Ganham FUNDEB
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--green)]">
                {formatNumber(stats.gaining)}
              </div>
            </div>
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 animate-fade-in">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Perdem FUNDEB
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--red)]">
                {formatNumber(stats.losing)}
              </div>
            </div>
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 animate-fade-in">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Potencial Total
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--cyan)]">
                {stats.totalPotencial
                  ? formatCurrency(Number(stats.totalPotencial))
                  : "--"}
              </div>
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar municipio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-[var(--border)] rounded-lg bg-white focus:outline-none focus:border-[var(--cyan)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-lg p-1">
            {(
              [
                { value: "", label: "Todos" },
                { value: "gain", label: "Ganham" },
                { value: "loss", label: "Perdem" },
              ] as { value: FilterGp; label: string }[]
            ).map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterGp(f.value)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  filterGp === f.value
                    ? "bg-[var(--navy)] text-white"
                    : "text-[var(--text2)] hover:bg-[var(--bg)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {pagination && (
            <div className="text-xs text-[var(--text3)] ml-auto">
              {formatNumber(pagination.total)} resultados
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] w-12">
                    #
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] cursor-pointer hover:text-[var(--navy)] select-none"
                    onClick={() => handleSort("nome")}
                  >
                    <span className="flex items-center gap-1.5">
                      Municipio
                      <SortIcon col="nome" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] cursor-pointer hover:text-[var(--navy)] select-none"
                    onClick={() => handleSort("total_matriculas")}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      Matriculas
                      <SortIcon col="total_matriculas" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] cursor-pointer hover:text-[var(--navy)] select-none"
                    onClick={() => handleSort("receita_total")}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      Receita FUNDEB
                      <SortIcon col="receita_total" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] cursor-pointer hover:text-[var(--navy)] select-none"
                    onClick={() => handleSort("ganho_perda")}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      Ganho/Perda
                      <SortIcon col="ganho_perda" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] cursor-pointer hover:text-[var(--navy)] select-none"
                    onClick={() => handleSort("pot_total")}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      Potencial
                      <SortIcon col="pot_total" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] cursor-pointer hover:text-[var(--navy)] select-none"
                    onClick={() => handleSort("pct_pot_total")}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      %
                      <SortIcon col="pct_pot_total" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-16 text-center text-[var(--text3)]"
                    >
                      <div className="animate-pulse-slow">
                        Carregando municipios...
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-16 text-center text-[var(--text3)]"
                    >
                      Nenhum municipio encontrado
                    </td>
                  </tr>
                ) : (
                  data.map((muni, idx) => {
                    const rowNum =
                      ((pagination?.currentPage ?? 1) - 1) * PAGE_SIZE +
                      idx +
                      1;
                    const gp = muni.ganhoPerda ?? 0;
                    const gpColor =
                      gp > 0
                        ? "text-[var(--green-dark)]"
                        : gp < 0
                        ? "text-[var(--red)]"
                        : "text-[var(--text3)]";
                    const gpPrefix = gp > 0 ? "+" : "";

                    return (
                      <tr
                        key={muni.id}
                        className="border-b border-[var(--border)] last:border-b-0 hover:bg-[#00B4D8]/3 transition-colors"
                      >
                        <td className="px-4 py-3 text-[var(--text3)] text-xs font-mono">
                          {rowNum}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/diagnostico/${muni.id}`}
                            className="text-sm font-medium text-[var(--navy)] hover:text-[var(--cyan)] transition-colors"
                          >
                            {muni.nome}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {muni.totalMatriculas != null
                            ? formatNumber(muni.totalMatriculas)
                            : "--"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {muni.receitaTotal != null
                            ? formatCurrency(muni.receitaTotal)
                            : "--"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${gpColor}`}
                        >
                          {gp !== 0
                            ? `${gpPrefix}${formatCurrency(Math.abs(gp))}`
                            : "--"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {muni.potTotal != null
                            ? formatCurrency(muni.potTotal)
                            : "--"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {muni.pctPotTotal != null
                            ? formatPercent(muni.pctPotTotal)
                            : "--"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)]">
              <div className="text-xs text-[var(--text3)]">
                Pagina {pagination.currentPage} de {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg)] transition-colors"
                >
                  Primeira
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg)] transition-colors"
                >
                  Anterior
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 text-xs font-medium rounded-md border transition-colors ${
                        page === pageNum
                          ? "bg-[var(--navy)] text-white border-[var(--navy)]"
                          : "border-[var(--border)] bg-white hover:bg-[var(--bg)]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg)] transition-colors"
                >
                  Proxima
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg)] transition-colors"
                >
                  Ultima
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
