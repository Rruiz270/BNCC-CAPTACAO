"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

type DocTipo = "minuta_cme" | "decreto" | "resolucao";

const DOC_DEFS: Array<{
  tipo: DocTipo;
  label: string;
  desc: string;
  obrigatorio?: boolean;
  link: string;
}> = [
  {
    tipo: "minuta_cme",
    label: "Minuta CME",
    desc: "Resolução do Conselho Municipal de Educação para BNCC Computação",
    obrigatorio: true,
    link: "/implementacao/minuta",
  },
  {
    tipo: "decreto",
    label: "Decreto Municipal",
    desc: "Decreto de regulamentação FUNDEB",
    link: "/implementacao/curriculo",
  },
  {
    tipo: "resolucao",
    label: "Resolução SME",
    desc: "Resolução da Secretaria Municipal de Educação",
    link: "/implementacao/simec",
  },
];

interface DocRow {
  id: number;
  municipalityId: number;
  tipo: string;
  titulo: string;
  status: string;
  versao: number;
  createdAt: string;
  updatedAt: string;
}

interface SessionData {
  id: number;
  municipality?: { id: number; nome: string };
}

export default function StepDocumentos() {
  const step = getStepById(7)!;
  const { consultoriaId, updateStep, saving } = useWizard();

  const [session, setSession] = useState<SessionData | null>(null);
  const [docs, setDocs] = useState<Record<DocTipo, DocRow | null>>({
    minuta_cme: null,
    decreto: null,
    resolucao: null,
  });
  const [busy, setBusy] = useState<Record<DocTipo, boolean>>({
    minuta_cme: false,
    decreto: false,
    resolucao: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/consultorias`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.sessions?.find((x: SessionData) => x.id === consultoriaId);
        setSession(s || null);
      })
      .catch(() => {});
  }, [consultoriaId]);

  const muniId = session?.municipality?.id ?? null;

  const loadDocs = useCallback(async () => {
    if (!muniId) return;
    try {
      const res = await fetch(`/api/documents?municipalityId=${muniId}`);
      const data = await res.json();
      const map: Record<DocTipo, DocRow | null> = {
        minuta_cme: null,
        decreto: null,
        resolucao: null,
      };
      for (const d of (data.documents ?? []) as DocRow[]) {
        if (d.tipo === "minuta_cme" || d.tipo === "decreto" || d.tipo === "resolucao") {
          const key = d.tipo as DocTipo;
          if (!map[key] || (map[key] as DocRow).versao < d.versao) {
            map[key] = d;
          }
        }
      }
      setDocs(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [muniId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const gerar = useCallback(
    async (tipo: DocTipo) => {
      setBusy((b) => ({ ...b, [tipo]: true }));
      setError(null);
      try {
        const res = await fetch(`/api/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generate: true, consultoriaId, tipo }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Falha ao gerar documento");
        await loadDocs();
        const willHaveMinuta = tipo === "minuta_cme" || docs.minuta_cme != null;
        await updateStep(7, {
          status: willHaveMinuta ? "in_progress" : "available",
          payload: {
            lastGenerated: tipo,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy((b) => ({ ...b, [tipo]: false }));
      }
    },
    [consultoriaId, docs.minuta_cme, loadDocs, updateStep]
  );

  const hasMinuta = docs.minuta_cme != null;
  const canAdvance = hasMinuta;
  const blockReason = !hasMinuta ? "Gere ao menos a Minuta CME para avançar" : undefined;

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Documentos oficiais</h2>
      <p className="text-sm text-[var(--text3)] mb-4">
        Gere a Minuta CME (BNCC Computação), o Decreto e a Resolução via{" "}
        <code>fundeb.sp_gerar_minuta</code>. A minuta CME é obrigatória para avançar.
      </p>

      {!muniId && (
        <div className="text-xs text-gray-400 mb-4">Carregando dados do município...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {DOC_DEFS.map((def) => (
          <DocCard
            key={def.tipo}
            tipo={def.label}
            desc={def.desc}
            obrigatorio={def.obrigatorio}
            doc={docs[def.tipo]}
            busy={busy[def.tipo]}
            disabled={!muniId}
            onGerar={() => gerar(def.tipo)}
            link={def.link}
          />
        ))}
      </div>

      {saving && <div className="mt-3 text-[10px] text-[#00B4D8]">salvando progresso...</div>}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4 text-xs text-yellow-800">
        <strong>Atenção:</strong> documentos são criados como <code>rascunho</code>. Publicação
        ocorre após aprovação do coordenador.
      </div>
    </StepShell>
  );
}

function DocCard({
  tipo,
  desc,
  obrigatorio,
  doc,
  busy,
  disabled,
  onGerar,
  link,
}: {
  tipo: string;
  desc: string;
  obrigatorio?: boolean;
  doc: DocRow | null;
  busy: boolean;
  disabled: boolean;
  onGerar: () => void;
  link: string;
}) {
  return (
    <div className="border border-[var(--border)] rounded-lg p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-[var(--text1)]">{tipo}</div>
          {obrigatorio && (
            <span className="text-[10px] uppercase font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              Obrigatório
            </span>
          )}
          {doc && (
            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              Gerado v{doc.versao}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--text3)]">{desc}</div>
        {doc && (
          <div className="text-[10px] text-[var(--text3)] mt-0.5 truncate">
            {doc.titulo} - {new Date(doc.createdAt).toLocaleString("pt-BR")}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={onGerar}
        className="text-xs px-3 py-1.5 rounded-lg bg-[#00B4D8] text-white font-semibold hover:bg-[#0096B4] disabled:opacity-60 whitespace-nowrap"
      >
        {busy ? "Gerando..." : doc ? "Regerar" : "Gerar"}
      </button>
      <Link
        href={link}
        target="_blank"
        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:bg-white whitespace-nowrap"
      >
        Template ↗
      </Link>
    </div>
  );
}
