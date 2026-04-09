"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useConsultoria } from "@/lib/consultoria-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/diagnostico", label: "Diagnostico" },
  { href: "/simulador", label: "Simulador" },
  { href: "/comparativo", label: "Comparativo" },
  { href: "/compliance", label: "Compliance" },
  { href: "/plano-de-acao", label: "Plano de Acao" },
  { type: "divider", label: "Implementacao" },
  { href: "/implementacao/curriculo", label: "Curriculo BNCC" },
  { href: "/implementacao/minuta", label: "Minuta CME" },
  { href: "/implementacao/simec", label: "Guia SIMEC" },
  { href: "/implementacao/formacao", label: "Formacao Docente" },
  { type: "divider", label: "Dados" },
  { href: "/importar", label: "Importar Dados" },
  { href: "/relatorios", label: "Relatorios" },
  { type: "divider", label: "" },
  { href: "/catalogo", label: "Catalogo i10" },
];

interface MuniOption {
  id: number;
  nome: string;
}

function SidebarMunicipalityPicker({ onSelect, creating }: { onSelect: (id: number) => void; creating: boolean }) {
  const [municipalities, setMunicipalities] = useState<MuniOption[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/municipalities?limit=645")
      .then((r) => r.json())
      .then((data) => setMunicipalities(data.data || []))
      .catch(() => {});
  }, []);

  const filtered = search.length > 0
    ? municipalities.filter((m) => m.nome.toLowerCase().includes(search.toLowerCase()))
    : municipalities;

  return (
    <div className="mt-3 p-2 bg-white/5 rounded-lg">
      <div className="text-[10px] text-white/50 mb-1.5">Selecione o municipio:</div>
      <input
        type="text"
        placeholder="Buscar municipio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-2 py-1.5 text-xs rounded bg-white/10 text-white border border-white/20 placeholder-white/40 outline-none focus:border-[#00B4D8] mb-1.5"
      />
      <div className="max-h-40 overflow-y-auto rounded bg-white/5">
        {filtered.slice(0, 50).map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            disabled={creating}
            className="w-full text-left px-2 py-1.5 text-xs text-white/80 hover:bg-[#00B4D8]/20 hover:text-white transition-colors disabled:opacity-50"
          >
            {m.nome}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-2 text-xs text-white/40">Nenhum encontrado</div>
        )}
        {filtered.length > 50 && (
          <div className="px-2 py-1 text-[10px] text-white/30 text-center">
            +{filtered.length - 50} municipios. Refine a busca.
          </div>
        )}
      </div>
      {creating && (
        <div className="text-[10px] text-[#00B4D8] mt-2 animate-pulse-slow">Criando sessao...</div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { sessions, activeSession, municipality, startSession, switchSession, endSession, loading } = useConsultoria();
  const [showNewSession, setShowNewSession] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [creating, setCreating] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler() {
      setShowSessionList(false);
    }
    if (showSessionList) {
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [showSessionList]);

  const activeSessions = sessions.filter((s) => s.status === "active");

  async function handleStartSession(municipalityId: number) {
    setCreating(true);
    await startSession(municipalityId);
    setCreating(false);
    setShowNewSession(false);
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0A2463] text-white flex flex-col z-50 overflow-y-auto">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-[#00B4D8] font-extrabold text-sm tracking-wider uppercase">Instituto i10</div>
        <div className="text-white/50 text-xs mt-0.5">Plataforma FUNDEB 2026</div>
      </div>

      {/* Session Panel */}
      <div className="px-4 py-3 border-b border-white/10">
        {loading ? (
          <div className="text-white/30 text-xs animate-pulse-slow">Carregando...</div>
        ) : activeSession && municipality ? (
          <div>
            {/* Active municipality */}
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#00B4D8] mb-1">
              Consultoria Ativa
            </div>
            <div className="text-sm font-semibold text-white truncate">{municipality.nome}</div>

            {/* Progress badges */}
            <div className="flex gap-2 mt-2">
              <div className="flex-1 bg-white/10 rounded px-2 py-1">
                <div className="text-[9px] text-white/50 uppercase">Compliance</div>
                <div className="text-xs font-bold text-[#00E5A0]">{activeSession.complianceProgress ?? 0}%</div>
              </div>
              <div className="flex-1 bg-white/10 rounded px-2 py-1">
                <div className="text-[9px] text-white/50 uppercase">Plano</div>
                <div className="text-xs font-bold text-[#48CAE4]">{activeSession.actionPlanProgress ?? 0}%</div>
              </div>
            </div>

            {/* Session actions */}
            <div className="flex gap-2 mt-2">
              {activeSessions.length > 1 && (
                <div className="relative flex-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSessionList(!showSessionList); }}
                    className="w-full text-[10px] px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/15 transition-colors"
                  >
                    Trocar
                  </button>
                  {showSessionList && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-[#0A2463] border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      {activeSessions.filter((s) => s.id !== activeSession.id).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { switchSession(s.id); setShowSessionList(false); }}
                          className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors"
                        >
                          {s.municipality?.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => endSession(activeSession.id)}
                className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/50 hover:bg-red-500/20 hover:text-red-300 transition-colors"
              >
                Encerrar
              </button>
              <button
                onClick={() => setShowNewSession(!showNewSession)}
                className="text-[10px] px-2 py-1 rounded bg-[#00B4D8]/20 text-[#00B4D8] hover:bg-[#00B4D8]/30 transition-colors"
              >
                + Nova
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setShowNewSession(!showNewSession)}
              className="w-full text-center py-2 px-3 rounded-lg bg-[#00B4D8]/20 text-[#00B4D8] text-sm font-semibold hover:bg-[#00B4D8]/30 transition-colors"
            >
              Iniciar Consultoria
            </button>
          </div>
        )}

        {/* New session form */}
        {showNewSession && (
          <SidebarMunicipalityPicker
            onSelect={(id) => handleStartSession(id)}
            creating={creating}
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item, i) => {
          if ('type' in item && item.type === 'divider') {
            return (
              <div key={i} className="pt-4 pb-1 px-3">
                {item.label && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {item.label}
                  </span>
                )}
              </div>
            );
          }

          const isActive = item.href && pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10 text-[10px] text-white/30">
        <div>FUNDEB SP 2026</div>
        <div>645 municipios - 15 categorias</div>
      </div>
    </aside>
  );
}
