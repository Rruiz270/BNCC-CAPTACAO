"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface MuniOption {
  id: number;
  nome: string;
}

interface IntakeItem {
  id: number;
  token: string;
  municipalityId: number;
  municipioNome: string;
  consultoriaId: number | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  respondentName: string | null;
  status: "respondido" | "pendente" | "expirado";
}

interface IntakeResponseDetail {
  respondentName: string;
  respondentRole: string;
  respondentEmail: string;
  submittedAt: string;
  data: {
    enrollmentData?: Record<string, { publicValue: number; realValue: number; difference: number }>;
    schoolsTotal?: number;
    schoolsRural?: number;
    observations?: string;
  };
}

export default function CaptacaoPage() {
  const [municipalities, setMunicipalities] = useState<MuniOption[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MuniOption | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [generatedUrl, setGeneratedUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tokens, setTokens] = useState<IntakeItem[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<IntakeResponseDetail | null>(null);
  const [toast, setToast] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load municipalities
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

  // Load all tokens
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/intake?list=all");
      const data = await res.json();
      setTokens(data.tokens || []);
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search.length > 0
    ? municipalities.filter((m) => m.nome.toLowerCase().includes(search.toLowerCase()))
    : municipalities;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    showToast("Link copiado!");
  };

  async function gerarLink() {
    if (!selected) return;
    setGenerating(true);
    setGeneratedUrl("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipalityId: selected.id }),
      });
      const data = await res.json();
      if (res.ok) {
        const fullUrl = `${window.location.origin}${data.url}`;
        setGeneratedUrl(fullUrl);
        // Auto-copy
        try {
          await navigator.clipboard.writeText(fullUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        } catch { /* clipboard failed, link visible */ }
        showToast(`Link gerado para ${selected.nome}!`);
        fetchTokens();
      } else {
        showToast(`Erro: ${data.error}`);
      }
    } catch {
      showToast("Erro ao gerar link");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleDetail(item: IntakeItem) {
    if (expandedId === item.id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(item.id);
    try {
      const res = await fetch(`/api/intake?consultoriaId=${item.consultoriaId || ""}&municipalityId=${item.municipalityId}`);
      const data = await res.json();
      setExpandedData(data.response || null);
    } catch {
      setExpandedData(null);
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text1)] mb-1">Captacao Pre-Consultoria</h1>
        <p className="text-sm text-[var(--text3)]">
          Gere links de intake para qualquer municipio. Quando o secretario responder, os dados ficam prontos para a consultoria.
        </p>
      </div>

      {/* Section A: Generate Link */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-6 mb-6">
        <h2 className="text-base font-bold text-[var(--text1)] mb-1 flex items-center gap-2">
          <span className="text-lg">&#128279;</span> Gerar Link de Intake
        </h2>
        <p className="text-xs text-[var(--text3)] mb-4">Selecione um municipio para gerar um link de diagnostico.</p>

        <div className="flex gap-3 items-end flex-wrap">
          {/* Municipality picker */}
          <div ref={dropdownRef} className="relative flex-1 min-w-[280px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1">
              Municipio
            </label>
            {selected ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 text-sm rounded-lg bg-[#00B4D8]/10 text-[var(--text1)] font-semibold border border-[#00B4D8]/30">
                  {selected.nome}
                </div>
                <button
                  onClick={() => { setSelected(null); setSearch(""); setGeneratedUrl(""); }}
                  className="text-[var(--text3)] hover:text-[var(--text1)] text-sm px-2 py-2 rounded-lg border border-[var(--border)] hover:bg-gray-50 transition-colors"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Buscar municipio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text1)] placeholder-[var(--text3)] outline-none focus:border-[#00B4D8] transition-colors"
                />
                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
                    {filtered.slice(0, 50).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSelected(m); setSearch(""); setDropdownOpen(false); setGeneratedUrl(""); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--text2)] hover:bg-[#00B4D8]/5 hover:text-[var(--text1)] transition-colors border-b border-gray-50 last:border-0"
                      >
                        {m.nome}
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-4 py-3 text-xs text-[var(--text3)]">Nenhum encontrado</div>
                    )}
                    {filtered.length > 50 && (
                      <div className="px-4 py-2 text-[10px] text-[var(--text3)] text-center bg-gray-50">
                        +{filtered.length - 50} municipios. Refine a busca.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={gerarLink}
            disabled={!selected || generating}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90"
          >
            {generating ? "Gerando..." : "Gerar Link"}
          </button>
        </div>

        {/* Generated link */}
        {generatedUrl && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="text-xs font-semibold text-emerald-700 mb-2">
              {copied ? "Link gerado e copiado!" : "Link gerado com sucesso!"}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs text-[var(--text1)] font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {generatedUrl}
              </div>
              <button
                onClick={() => copyUrl(generatedUrl)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0A2463] text-white hover:bg-[#0A2463]/90 transition-colors whitespace-nowrap"
              >
                Copiar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section B: All Intake Links Table */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-base font-bold text-[var(--text1)] mb-1 flex items-center gap-2">
          <span className="text-lg">&#128203;</span> Todos os Links de Intake
        </h2>
        <p className="text-xs text-[var(--text3)] mb-4">Historico de links gerados e status das respostas.</p>

        {loadingTokens ? (
          <div className="text-center py-12 text-[var(--text3)]">
            <div className="inline-block w-8 h-8 border-3 border-[var(--border)] border-t-[#00B4D8] rounded-full animate-spin mb-3" />
            <p className="text-sm">Carregando...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12 text-[var(--text3)] text-sm">
            Nenhum link gerado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[10px] uppercase text-white bg-[#0A2463]">
                  <th className="text-left px-4 py-3 font-semibold tracking-wider">Municipio</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider">Gerado em</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider">Expira</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider">Responsavel</th>
                  <th className="text-left px-4 py-3 font-semibold tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((item) => {
                  const intakeUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/intake/${item.token}`;
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[var(--text1)]">{item.municipioNome}</td>
                      <td className="px-4 py-3 text-[var(--text2)]">{fmtDate(item.createdAt)}</td>
                      <td className="px-4 py-3 text-[var(--text2)]">{fmtDate(item.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "respondido"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "expirado"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {item.status === "respondido" ? "Respondido" : item.status === "expirado" ? "Expirado" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text2)]">{item.respondentName || "\u2014"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => copyUrl(intakeUrl)}
                            className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-[#00B4D8]/10 text-[#00B4D8] hover:bg-[#00B4D8]/20 transition-colors"
                          >
                            Copiar
                          </button>
                          {item.status === "respondido" && (
                            <button
                              onClick={() => toggleDetail(item)}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              {expandedId === item.id ? "Fechar" : "Ver"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded response detail */}
        {expandedId && expandedData && (
          <div className="mt-4 border border-[var(--border)] rounded-lg p-5 bg-gray-50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8] mb-3">
              Detalhes da Resposta
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {expandedData.respondentName && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-[var(--text3)]">Responsavel</div>
                  <div className="text-sm font-medium">{expandedData.respondentName} {expandedData.respondentRole && `(${expandedData.respondentRole})`}</div>
                </div>
              )}
              {expandedData.respondentEmail && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-[var(--text3)]">Email</div>
                  <div className="text-sm">{expandedData.respondentEmail}</div>
                </div>
              )}
              {expandedData.data?.schoolsTotal != null && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-[var(--text3)]">Escolas Total</div>
                  <div className="text-sm font-semibold">{expandedData.data.schoolsTotal}</div>
                </div>
              )}
              {expandedData.data?.schoolsRural != null && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-[var(--text3)]">Escolas Rurais</div>
                  <div className="text-sm font-semibold">{expandedData.data.schoolsRural}</div>
                </div>
              )}
            </div>

            {/* Enrollment table */}
            {expandedData.data?.enrollmentData && Object.keys(expandedData.data.enrollmentData).length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] mb-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase text-[var(--text3)] bg-gray-100 border-b border-[var(--border)]">
                      <th className="text-left px-3 py-2">Categoria</th>
                      <th className="text-right px-3 py-2">Publico</th>
                      <th className="text-right px-3 py-2">Real</th>
                      <th className="text-right px-3 py-2">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(expandedData.data.enrollmentData).map(([cat, d]) => {
                      const diff = d.difference;
                      return (
                        <tr key={cat} className="border-b border-gray-100">
                          <td className="px-3 py-1.5 font-medium">{cat}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text2)]">{d.publicValue?.toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{d.realValue?.toLocaleString("pt-BR")}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${
                            diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-700" : "text-gray-400"
                          }`}>
                            {diff > 0 ? "+" : ""}{diff?.toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {expandedData.data?.observations && (
              <div className="text-xs text-[var(--text2)] bg-white rounded-lg p-3 border border-[var(--border)]">
                <strong>Observacoes:</strong> {expandedData.data.observations}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0A2463] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
