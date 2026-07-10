"use client";

/**
 * Card de resumo executivo narrativo gerado por IA.
 * Carrega o último resumo cacheado ao montar; botão gera/atualiza.
 */
import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/ai/markdown";

interface Props {
  municipalityId: number;
  consultoriaId?: number | null;
}

export function ResumoExecutivoIA({ municipalityId, consultoriaId }: Props) {
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/ai/resumo?municipalityId=${municipalityId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancel && d?.conteudo) {
          setConteudo(d.conteudo);
          setCreatedAt(d.createdAt ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [municipalityId]);

  const gerar = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/resumo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ municipalityId, consultoriaId, force }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message ?? data.error ?? "Falha ao gerar resumo");
        } else {
          setConteudo(data.conteudo);
          setCreatedAt(new Date().toISOString());
        }
      } catch {
        setError("Falha de rede ao gerar o resumo");
      } finally {
        setLoading(false);
      }
    },
    [municipalityId, consultoriaId],
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text1)] flex items-center gap-2">
            <span aria-hidden>✨</span> Resumo executivo (IA)
          </h3>
          <p className="text-xs text-[var(--text3)]">
            Narrativa de 1 página para prefeito e secretário — gerada com os dados atuais do município.
          </p>
        </div>
        <button
          onClick={() => gerar(Boolean(conteudo))}
          disabled={loading}
          className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 transition-colors"
        >
          {loading ? "Gerando…" : conteudo ? "Atualizar resumo" : "Gerar resumo"}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs p-3">
          {error}
        </div>
      )}

      {loading && !conteudo && (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 rounded bg-[var(--border)] animate-pulse" style={{ width: `${90 - i * 15}%` }} />
          ))}
        </div>
      )}

      {conteudo && (
        <>
          <Markdown content={conteudo} className="mt-2 text-sm text-[var(--text2,inherit)]" />
          {createdAt && (
            <p className="mt-3 text-[10px] text-[var(--text3)]">
              Gerado em {new Date(createdAt).toLocaleString("pt-BR")} · revise antes de compartilhar com a prefeitura.
            </p>
          )}
        </>
      )}

      {!conteudo && !loading && !error && (
        <p className="mt-2 text-xs text-[var(--text3)]">Nenhum resumo gerado ainda para este município.</p>
      )}
    </div>
  );
}
