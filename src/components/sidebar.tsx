"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useConsultoria } from "@/lib/consultoria-context";
import { IntakeResponseModal } from "@/components/intake-response-modal";

interface MuniOption {
  id: number;
  nome: string;
}

function SidebarMunicipalityPicker({ onSelect, creating }: { onSelect: (id: number) => void; creating: boolean }) {
  const [municipalities, setMunicipalities] = useState<MuniOption[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MuniOption | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    fetch("/api/municipalities?limit=645&sort=nome")
      .then((r) => r.json())
      .then((data) => {
        setMunicipalities(data.data || []);
        setLoaded(true);
      })
      .catch(() => {});
  }, [loaded]);

  const filtered = search.length > 0
    ? municipalities.filter((m) => m.nome.toLowerCase().includes(search.toLowerCase()))
    : municipalities;

  return (
    <div className="mt-3 p-2 bg-white/5 rounded-lg">
      <div className="text-[10px] text-white/50 mb-1.5">Selecione o municipio:</div>

      {selected ? (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 px-2 py-1.5 text-xs rounded bg-[#00B4D8]/20 text-white font-semibold truncate">
            {selected.nome}
          </div>
          <button
            onClick={() => { setSelected(null); setSearch(""); }}
            className="text-white/40 hover:text-white text-xs px-1"
          >
            x
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Buscar municipio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-2 py-1.5 text-xs rounded bg-white/10 text-white border border-white/20 placeholder-white/40 outline-none focus:border-[#00B4D8] mb-1.5"
          />
          <div className="max-h-40 overflow-y-auto rounded bg-white/5">
            {filtered.slice(0, 50).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="w-full text-left px-2 py-1.5 text-xs text-white/80 hover:bg-[#00B4D8]/20 hover:text-white transition-colors"
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
        </>
      )}

      <button
        onClick={() => selected && onSelect(selected.id)}
        disabled={!selected || creating}
        className="w-full mt-2 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#00B4D8] text-white hover:bg-[#00B4D8]/80"
      >
        {creating ? "Criando sessao..." : "Iniciar Consultoria"}
      </button>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { sessions, activeSession, startSession, switchSession, endSession, loading } = useConsultoria();
  const [showNewSession, setShowNewSession] = useState(false);
  const [creating, setCreating] = useState(false);
  const [intakeGenerating, setIntakeGenerating] = useState(false);
  const [intakeLink, setIntakeLink] = useState<string | null>(null);
  const [intakeCopied, setIntakeCopied] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [showIntakeModal, setShowIntakeModal] = useState(false);

  const activeSessions = sessions.filter((s) => s.status === "active");

  async function handleStartSession(municipalityId: number) {
    setCreating(true);
    await startSession(municipalityId);
    setCreating(false);
    setShowNewSession(false);
  }

  async function handleGenerateIntakeLink() {
    if (!activeSession) return;
    setIntakeGenerating(true);
    setIntakeError(null);
    setIntakeLink(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultoriaId: activeSession.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar link");

      const fullUrl = `${window.location.origin}${data.url}`;
      setIntakeLink(fullUrl);

      try {
        await navigator.clipboard.writeText(fullUrl);
        setIntakeCopied(true);
        setTimeout(() => setIntakeCopied(false), 3000);
      } catch {
        // Clipboard failed — link is still visible for manual copy
      }
    } catch (e) {
      setIntakeError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setIntakeGenerating(false);
    }
  }

  async function handleCopyLink() {
    if (!intakeLink) return;
    try {
      await navigator.clipboard.writeText(intakeLink);
      setIntakeCopied(true);
      setTimeout(() => setIntakeCopied(false), 2000);
    } catch {
      // Select text for manual copy as fallback
    }
  }

  const isActive = (href: string) => pathname?.startsWith(href);

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
        ) : activeSessions.length > 0 ? (
          <div>
            {/* Header with count */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#00B4D8]">
                {activeSessions.length === 1 ? "Consultoria Ativa" : `${activeSessions.length} Consultorias Ativas`}
              </div>
              <button
                onClick={() => setShowNewSession(!showNewSession)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#00B4D8]/20 text-[#00B4D8] hover:bg-[#00B4D8]/30 transition-colors"
              >
                + Nova
              </button>
            </div>

            {/* Session cards */}
            <div className="space-y-1.5">
              {activeSessions.map((s) => {
                const isCurrentSession = s.id === activeSession?.id;
                const comp = s.complianceProgress ?? 0;
                const plan = s.actionPlanProgress ?? 0;
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg transition-all ${
                      isCurrentSession
                        ? "bg-white/10 ring-1 ring-[#00B4D8]/40"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {/* Clickable area → navigate to wizard */}
                    <Link
                      href={`/wizard/${s.id}/step-1-cidade`}
                      onClick={() => { if (!isCurrentSession) switchSession(s.id); }}
                      className="block px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`text-xs truncate ${isCurrentSession ? "text-white font-semibold" : "text-white/70"}`}>
                          {s.municipality?.nome ?? `Sessao #${s.id}`}
                        </span>
                        {isCurrentSession && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#00E5A0]/20 text-[#00E5A0] font-bold uppercase shrink-0">
                            Atual
                          </span>
                        )}
                      </div>
                      {/* Mini progress bars */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[8px] text-white/40 uppercase">Compl.</span>
                            <span className="text-[9px] text-[#00E5A0] font-bold tabular-nums">{comp}%</span>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-[#00E5A0] rounded-full transition-all" style={{ width: `${comp}%` }} />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[8px] text-white/40 uppercase">Plano</span>
                            <span className="text-[9px] text-[#48CAE4] font-bold tabular-nums">{plan}%</span>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-[#48CAE4] rounded-full transition-all" style={{ width: `${plan}%` }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                    {/* Encerrar button — only for current session */}
                    {isCurrentSession && (
                      <div className="px-2.5 pb-2 flex gap-1.5">
                        <button
                          onClick={() => endSession(s.id)}
                          className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        >
                          Encerrar
                        </button>
                        <Link
                          href={`/consultorias/${s.id}`}
                          className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
                        >
                          Detalhes
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
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
        {/* CONSULTORIA ATIVA section — only when activeSession exists */}
        {activeSession && (
          <>
            <div className="pt-1 pb-1 px-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Consultoria Ativa
              </span>
            </div>
            <Link
              href={`/wizard/${activeSession.id}/step-1-cidade`}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive("/wizard")
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              Wizard
            </Link>
            <Link
              href="/dashboard"
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive("/dashboard")
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/simulador"
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive("/simulador")
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              Simulador
            </Link>

            {/* Intake actions */}
            <button
              onClick={handleGenerateIntakeLink}
              disabled={intakeGenerating}
              className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-all text-white/60 hover:bg-white/8 hover:text-white/90 disabled:opacity-40"
            >
              {intakeGenerating ? "Gerando..." : "Gerar Link Intake"}
            </button>

            {/* Generated link display */}
            {intakeLink && (
              <div className="mx-1 mt-1 p-2 bg-white/10 rounded-lg">
                <div className="text-[9px] text-[#00E5A0] font-semibold mb-1">
                  {intakeCopied ? "Copiado!" : "Link gerado:"}
                </div>
                <div
                  onClick={handleCopyLink}
                  className="text-[10px] text-white/80 bg-white/5 rounded px-2 py-1.5 break-all cursor-pointer hover:bg-white/10 transition-colors select-all"
                  title="Clique para copiar"
                >
                  {intakeLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="mt-1.5 w-full text-[9px] py-1 rounded bg-[#00B4D8]/30 text-[#00B4D8] hover:bg-[#00B4D8]/50 transition-colors font-semibold"
                >
                  {intakeCopied ? "Copiado!" : "Copiar Link"}
                </button>
              </div>
            )}

            {/* Error display */}
            {intakeError && (
              <div className="mx-1 mt-1 p-2 bg-red-500/20 rounded-lg text-[10px] text-red-300">
                {intakeError}
              </div>
            )}

            <button
              onClick={() => setShowIntakeModal(true)}
              className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-all text-white/60 hover:bg-white/8 hover:text-white/90"
            >
              Ver Resposta Intake
            </button>
          </>
        )}

        {/* FERRAMENTAS */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            Ferramentas
          </span>
        </div>
        <Link
          href="/comparativo"
          className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
            isActive("/comparativo")
              ? "bg-white/15 text-white font-semibold"
              : "text-white/60 hover:bg-white/8 hover:text-white/90"
          }`}
        >
          Comparativo
        </Link>
        <Link
          href="/catalogo"
          className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
            isActive("/catalogo")
              ? "bg-white/15 text-white font-semibold"
              : "text-white/60 hover:bg-white/8 hover:text-white/90"
          }`}
        >
          Catalogo i10
        </Link>

        {/* ADMIN */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            Admin
          </span>
        </div>
        <Link
          href="/consultorias"
          className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
            isActive("/consultorias")
              ? "bg-white/15 text-white font-semibold"
              : "text-white/60 hover:bg-white/8 hover:text-white/90"
          }`}
        >
          Historico Consultorias
        </Link>
        <Link
          href="/importar"
          className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all ${
            isActive("/importar")
              ? "bg-white/15 text-white font-semibold"
              : "text-white/60 hover:bg-white/8 hover:text-white/90"
          }`}
        >
          Importar Dados
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10 text-[10px] text-white/30">
        <div>FUNDEB SP 2026</div>
        <div>645 municipios - 15 categorias</div>
      </div>

      {/* Intake Response Modal */}
      {activeSession && (
        <IntakeResponseModal
          open={showIntakeModal}
          onOpenChange={setShowIntakeModal}
          consultoriaId={activeSession.id}
        />
      )}
    </aside>
  );
}
