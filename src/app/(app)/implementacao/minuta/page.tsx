"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";
import { generateMinutaCME } from "@/lib/document-templates";
import { Markdown } from "@/components/ai/markdown";

interface DocumentRecord {
  id: number;
  conteudo: string;
  versao: number;
  status: string;
  createdAt: string;
}

const ARTIGOS = [
  { num: "Art. 1º", titulo: "Objeto", resumo: "Aprovação da inclusão do componente curricular de Computação no currículo municipal, em conformidade com a BNCC." },
  { num: "Art. 2º", titulo: "Abrangência", resumo: "Oferta em todas as unidades escolares: Educação Infantil (integrada), Anos Iniciais (integrado) e Anos Finais (específico)." },
  { num: "Art. 3º", titulo: "Componente Curricular", resumo: "Organização em 4 eixos: Pensamento Computacional, Mundo Digital, Cultura Digital e Tecnologia e Sociedade." },
  { num: "Art. 4º", titulo: "Carga Horária", resumo: "Mínimo de 1h/semana (Anos Iniciais) e 2h/semana (Anos Finais), com possibilidade de ampliação." },
  { num: "Art. 5º", titulo: "Formação Docente", resumo: "Programa de formação continuada com mínimo de 32h anuais, acompanhamento pedagógico e materiais didáticos." },
  { num: "Art. 6º", titulo: "Vigência e Comprovação", resumo: "Implementação gradual a partir de 2026 com conformidade plena até o ano letivo de 2027. Registro no SIMEC." },
];

export default function MinutaPage() {
  const { activeSession, municipality } = useConsultoria();
  const municipalityId = activeSession?.municipalityId;

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [generatedText, setGeneratedText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iaBusy, setIaBusy] = useState<null | "gerar" | "revisar">(null);
  const [revisao, setRevisao] = useState<string | null>(null);
  const [iaError, setIaError] = useState<string | null>(null);

  // Load existing document
  useEffect(() => {
    if (!municipalityId) {
      setDocument(null);
      setGeneratedText("");
      return;
    }

    fetch(`/api/documents?municipalityId=${municipalityId}&tipo=minuta_cme`)
      .then((r) => r.json())
      .then((data) => {
        if (data.documents && data.documents.length > 0) {
          const doc = data.documents[0];
          setDocument(doc);
          setGeneratedText(doc.conteudo || "");
        } else {
          setDocument(null);
          setGeneratedText("");
        }
      })
      .catch(() => {});
  }, [municipalityId]);

  // Generate document
  async function handleGenerate() {
    if (!municipality || !municipalityId) return;

    setLoading(true);
    const text = generateMinutaCME({
      nome: municipality.nome,
      codigoIbge: municipality.codigoIbge,
      totalEscolas: municipality.totalEscolas,
      totalMatriculas: municipality.totalMatriculas,
      totalDocentes: municipality.totalDocentes,
      pctInternet: municipality.pctInternet,
      pctBiblioteca: municipality.pctBiblioteca,
      receitaTotal: municipality.receitaTotal,
    });

    setGeneratedText(text);

    // Save to DB
    try {
      setSaving(true);
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipalityId,
          tipo: "minuta_cme",
          titulo: `Minuta CME - ${municipality.nome}`,
          conteudo: text,
        }),
      });
      const data = await res.json();
      if (data.document) {
        setDocument({ ...data.document, conteudo: text });
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }

  // Save edits
  async function handleSaveEdits() {
    if (!document) return;
    setSaving(true);
    try {
      await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: generatedText }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  // Geração completa com IA (redação contextualizada, sem placeholders)
  async function handleGenerateIA() {
    if (!municipalityId) return;
    setIaBusy("gerar");
    setIaError(null);
    try {
      const res = await fetch("/api/ai/documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipalityId,
          consultoriaId: activeSession?.id,
          tipo: "minuta_cme",
          acao: "gerar",
          salvar: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Falha na geração com IA");
      setGeneratedText(data.conteudo);
      if (data.documentId) {
        setDocument({ id: data.documentId, conteudo: data.conteudo, versao: (document?.versao ?? 0) + 1, status: "rascunho", createdAt: new Date().toISOString() });
      }
    } catch (e) {
      setIaError(e instanceof Error ? e.message : "Erro na geração com IA");
    } finally {
      setIaBusy(null);
    }
  }

  // Revisão crítica do texto atual com IA
  async function handleRevisarIA() {
    if (!municipalityId || !generatedText) return;
    setIaBusy("revisar");
    setIaError(null);
    setRevisao(null);
    try {
      const res = await fetch("/api/ai/documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipalityId,
          tipo: "minuta_cme",
          acao: "revisar",
          conteudoAtual: generatedText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Falha na revisão com IA");
      setRevisao(data.conteudo);
    } catch (e) {
      setIaError(e instanceof Error ? e.message : "Erro na revisão com IA");
    } finally {
      setIaBusy(null);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  function handlePrint() {
    window.print();
  }

  const hasDocument = generatedText.length > 0;

  return (
    <div>
      <PageHeader
        title="Minuta de Resolução CME"
        description="Modelo de resolução para aprovação do currículo computacional"
      />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Session info */}
        {activeSession && municipality ? (
          <div className="bg-[#00B4D8]/5 border border-[#00B4D8]/20 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00E5A0]" />
              <span className="font-semibold text-[var(--navy)]">{municipality.nome}</span>
            </div>
            {document && (
              <span className="text-[10px] text-[var(--text3)]">
                Versão {document.versao} - {document.status}
              </span>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-amber-800 text-sm font-semibold">Nenhuma consultoria ativa</p>
            <p className="text-amber-600 text-xs mt-1">Inicie uma consultoria para gerar o documento com dados reais do município.</p>
          </div>
        )}

        {/* Generate buttons */}
        {activeSession && !hasDocument && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading || iaBusy !== null}
                className="px-6 py-3 rounded-xl bg-[var(--navy)] text-white font-semibold hover:bg-[var(--navy-dark)] transition-colors disabled:opacity-50"
              >
                {loading ? "Gerando..." : "Gerar do modelo"}
              </button>
              <button
                onClick={handleGenerateIA}
                disabled={loading || iaBusy !== null}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {iaBusy === "gerar" ? "Redigindo com IA..." : "✨ Redigir com IA"}
              </button>
            </div>
            <p className="text-xs text-[var(--text3)] mt-2">
              O modelo preenche placeholders; a IA redige o documento completo com os dados e prazos reais do município.
            </p>
          </div>
        )}

        {iaError && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">{iaError}</div>
        )}

        {/* Article summary cards */}
        <section className="animate-fade-in print:hidden">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-3">Estrutura da Resolução</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ARTIGOS.map((art) => (
              <div
                key={art.num}
                className="bg-white border border-[var(--border)] rounded-xl p-4 hover:border-[var(--cyan)] transition-colors"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)]">{art.num}</div>
                <div className="font-semibold text-sm text-[var(--navy)] mt-1">{art.titulo}</div>
                <p className="text-xs text-[var(--text2)] mt-1 leading-relaxed">{art.resumo}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Document content */}
        {hasDocument && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-3 print:hidden">
              <h2 className="text-lg font-bold text-[var(--navy)]">Documento Completo</h2>
              <div className="flex items-center gap-2">
                {saving && <span className="text-xs text-[var(--text3)] animate-pulse-slow">Salvando...</span>}
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    copied ? "bg-[var(--green)] text-white" : "bg-[var(--navy)] text-white hover:bg-[var(--navy-dark)]"
                  }`}
                >
                  {copied ? "Copiado!" : "Copiar Texto"}
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--cyan)] text-white hover:bg-[var(--cyan-light)] transition-all"
                >
                  Exportar PDF
                </button>
                {activeSession && (
                  <>
                    <button
                      onClick={handleRevisarIA}
                      disabled={iaBusy !== null}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-50"
                    >
                      {iaBusy === "revisar" ? "Revisando..." : "✨ Revisar com IA"}
                    </button>
                    <button
                      onClick={handleGenerateIA}
                      disabled={iaBusy !== null}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-blue-400 text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50"
                    >
                      {iaBusy === "gerar" ? "Redigindo..." : "✨ Nova versão com IA"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={loading || iaBusy !== null}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--bg)] transition-all disabled:opacity-50"
                    >
                      Regenerar modelo
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border-2 border-[var(--navy)]/20 rounded-xl p-8 shadow-sm print:border-none print:shadow-none print:p-0">
              <textarea
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                onBlur={handleSaveEdits}
                className="w-full min-h-[600px] text-sm leading-relaxed text-[var(--text)] bg-transparent border-none outline-none resize-y print:hidden"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
              />
              {/* Print-only version */}
              <pre
                className="hidden print:block whitespace-pre-wrap text-sm leading-relaxed text-black"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
              >
                {generatedText}
              </pre>
            </div>
          </section>
        )}

        {/* Revisão da IA */}
        {revisao && (
          <section className="animate-fade-in print:hidden">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-blue-900">✨ Revisão da IA</h3>
                <button onClick={() => setRevisao(null)} className="text-xs text-blue-500 hover:underline">
                  fechar
                </button>
              </div>
              <Markdown content={revisao} className="text-xs text-blue-900" />
            </div>
          </section>
        )}

        {/* Instructions */}
        <section className="animate-fade-in print:hidden">
          <div className="bg-[var(--cyan)]/5 border border-[var(--cyan)]/20 rounded-xl p-5">
            <h3 className="text-sm font-bold text-[var(--navy)] mb-2">Como utilizar este modelo</h3>
            <ul className="text-xs text-[var(--text2)] space-y-1.5 list-disc list-inside leading-relaxed">
              <li>O documento é preenchido automaticamente com dados do município selecionado na consultoria.</li>
              <li>Você pode editar o texto diretamente no campo acima — as alterações são salvas automaticamente.</li>
              <li>Use &quot;Exportar PDF&quot; para imprimir ou salvar como PDF (Ctrl/Cmd+P).</li>
              <li>Submeta ao CME com parecer técnico da Secretaria de Educação.</li>
              <li>Após aprovação, publique no Diário Oficial do município.</li>
              <li>Registre a resolução aprovada no SIMEC como comprovação VAAR.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
