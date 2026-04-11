"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";

interface SessionRow {
  id: number;
  status: string;
  startDate: string;
  municipality?: { id: number; nome: string };
  complianceProgress?: number;
  actionPlanProgress?: number;
}

interface MuniOption {
  id: number;
  nome: string;
}

export default function WizardLanding() {
  const router = useRouter();
  const { sessions, startSession, refreshSessions } = useConsultoria();
  const [municipalities, setMunicipalities] = useState<MuniOption[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/municipalities?limit=645&sort=nome")
      .then((r) => r.json())
      .then((data) => setMunicipalities(data.data || []))
      .catch(() => {});
    refreshSessions();
  }, [refreshSessions]);

  const filtered = search
    ? municipalities.filter((m) => m.nome.toLowerCase().includes(search.toLowerCase()))
    : municipalities.slice(0, 30);

  async function handleStart(municipalityId: number) {
    setCreating(true);
    const session = await startSession(municipalityId);
    setCreating(false);
    if (session) {
      router.push(`/wizard/${session.id}/step-1-cidade`);
    }
  }

  const active = (sessions as SessionRow[]).filter((s) => s.status === "active");

  return (
    <div>
      <PageHeader
        label="Wizard"
        title="Iniciar consultoria"
        description="Escolha um municipio para abrir uma nova sessao ou retome uma consultoria em andamento."
      />

      <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nova consultoria */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-[var(--text1)] mb-1">Nova consultoria</h2>
          <p className="text-xs text-[var(--text3)] mb-4">Selecione um dos 645 municipios de SP</p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar municipio..."
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[#00B4D8] mb-3"
          />

          <div className="max-h-80 overflow-y-auto border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => handleStart(m.id)}
                disabled={creating}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg)] disabled:opacity-50 transition-colors"
              >
                {m.nome}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-gray-400">Nenhum municipio encontrado</div>
            )}
          </div>
          {creating && <div className="text-xs text-[#00B4D8] mt-2">Criando sessao...</div>}
        </div>

        {/* Consultorias em andamento */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-[var(--text1)] mb-1">Consultorias em andamento</h2>
          <p className="text-xs text-[var(--text3)] mb-4">{active.length} sessao(oes) ativa(s)</p>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {active.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-6">Nenhuma consultoria ativa</div>
            )}
            {active.map((s) => (
              <Link
                key={s.id}
                href={`/wizard/${s.id}/step-1-cidade`}
                className="block border border-[var(--border)] rounded-lg p-3 hover:bg-[var(--bg)] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-[var(--text1)]">
                    {s.municipality?.nome ?? `Sessao #${s.id}`}
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Ativa
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] text-[var(--text3)]">
                  <span>Compliance {s.complianceProgress ?? 0}%</span>
                  <span>Plano {s.actionPlanProgress ?? 0}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
