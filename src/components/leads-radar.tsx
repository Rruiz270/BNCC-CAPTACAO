"use client";

/**
 * Radar de leads de consultoria FUNDEB — ranking de interesse (QUENTE/MORNO/
 * ENGAJADO/FRIO) importado do modelo de score de campanhas (CRM + webinars +
 * downloads). Fonte: fundeb.leads (scripts/import-leads.mjs).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Lead {
  id: number;
  municipality_id: number | null;
  nome: string;
  uf: string | null;
  score: string;
  pontos: number;
  sinais: string[] | null;
  pot_total: number | null;
  consultorias_ativas: number;
}

const SCORE_META: Record<string, { label: string; badge: string }> = {
  quente: { label: "🔥 Quente", badge: "bg-red-50 text-red-700 border-red-200" },
  morno: { label: "🟠 Morno", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  engajado: { label: "🟡 Engajado", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  frio: { label: "⚪ Frio", badge: "bg-gray-50 text-gray-500 border-gray-200" },
};

export function LeadsRadar() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads ?? []);
        setWarning(d.warning ?? null);
      })
      .catch(() => setWarning("Falha ao carregar leads"))
      .finally(() => setLoading(false));
  }, []);

  const visiveis = useMemo(
    () => (filtro === "todos" ? leads : leads.filter((l) => l.score === filtro)).slice(0, 60),
    [leads, filtro],
  );

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.score] = (c[l.score] ?? 0) + 1;
    return c;
  }, [leads]);

  if (loading) return null;
  if (!leads.length) {
    return warning ? (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">{warning}</div>
    ) : null;
  }

  return (
    <section className="bg-white border border-[var(--border)] rounded-xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--text1)]">Radar de leads — interesse em consultoria</h2>
          <p className="text-xs text-[var(--text3)]">
            Ranking consolidado de {leads.length} municípios (CRM + webinars + downloads de relatório).
          </p>
        </div>
        <div className="flex gap-1.5">
          {["todos", "quente", "morno", "engajado", "frio"].map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                filtro === f
                  ? "bg-[var(--navy)] text-white border-[var(--navy)]"
                  : "border-[var(--border)] text-[var(--text3)] hover:bg-[var(--bg)]"
              }`}
            >
              {f === "todos" ? `Todos (${leads.length})` : `${SCORE_META[f]?.label ?? f} (${contagem[f] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["#", "Município", "Score", "Pontos", "Potencial FUNDEB", "Sinais", ""].map((h) => (
                <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l, i) => (
              <tr key={l.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
                <td className="py-2 px-3 text-[var(--text3)] font-mono text-xs">{i + 1}</td>
                <td className="py-2 px-3 font-semibold text-[var(--text1)]">
                  {l.nome}
                  {l.uf ? <span className="text-[var(--text3)] font-normal"> · {l.uf}</span> : null}
                  {l.consultorias_ativas > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-700">
                      cliente
                    </span>
                  )}
                </td>
                <td className="py-2 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${SCORE_META[l.score]?.badge ?? ""}`}>
                    {SCORE_META[l.score]?.label ?? l.score}
                  </span>
                </td>
                <td className="py-2 px-3 font-bold text-[var(--text2)]">{l.pontos}</td>
                <td className="py-2 px-3 text-[var(--text2)]">
                  {l.pot_total ? formatCurrency(Number(l.pot_total)) : "—"}
                </td>
                <td className="py-2 px-3 text-[10px] text-[var(--text3)] max-w-xs truncate">
                  {(l.sinais ?? []).slice(0, 3).join(" · ")}
                </td>
                <td className="py-2 px-3">
                  {l.municipality_id && (
                    <Link href={`/diagnostico/${l.municipality_id}`} className="text-xs text-[#00B4D8] hover:underline">
                      diagnóstico
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
