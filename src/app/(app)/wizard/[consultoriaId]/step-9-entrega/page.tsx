"use client";

import { useCallback, useEffect, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

interface SnapshotRow {
  id: number;
  consultoriaId: number;
  hash: string;
  signedBy: string;
  reason: string;
  createdAt: string;
}

export default function StepEntrega() {
  const step = getStepById(9)!;
  const { steps, consultoriaId, updateStep, saving } = useWizard();

  const [signed, setSigned] = useState(false);
  const [signedBy, setSignedBy] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredCompleted = [1, 2, 3, 4, 5, 6, 7].every((id) => {
    const s = steps.find((x) => x.step === id);
    return s?.status === "completed";
  });

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`/api/snapshots?consultoriaId=${consultoriaId}`);
      const data = await res.json();
      const list = (data.snapshots ?? []) as SnapshotRow[];
      if (list.length > 0) {
        setSnapshot(list[0]);
      }
    } catch {
      // ignore
    }
  }, [consultoriaId]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const gerarSnapshot = useCallback(async () => {
    if (!requiredCompleted) {
      setError("Etapas 1 a 7 ainda nao foram concluidas");
      return;
    }
    if (!signed || !signedBy.trim()) {
      setError("Assine o checklist e informe o nome do signatario");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultoriaId,
          signedBy: signedBy.trim(),
          reason: "closing",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao gerar snapshot");
      const snap = data.snapshot as SnapshotRow;
      setSnapshot(snap);
      await updateStep(9, {
        status: "in_progress",
        payload: {
          snapshotId: snap.id,
          hash: snap.hash,
          signedBy: snap.signedBy,
          createdAt: snap.createdAt,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [requiredCompleted, signed, signedBy, consultoriaId, updateStep]);

  const canAdvance = requiredCompleted && signed && snapshot !== null;
  const blockReason = !requiredCompleted
    ? "Etapas 1 a 7 ainda nao foram concluidas"
    : !signed
    ? "Assine o checklist final"
    : !snapshot
    ? "Gere o snapshot antes de concluir"
    : undefined;

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Entrega & Snapshot</h2>
      <p className="text-sm text-[var(--text3)] mb-6">
        Encerre a consultoria com snapshot imutavel via{" "}
        <code>audit.sp_snapshot_sessao</code>. O snapshot gera um hash SHA-256 do payload
        consolidado (consultoria + compliance + plano + documentos + cenarios + wizard).
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="border border-[var(--border)] rounded-lg p-5 mb-4">
        <h3 className="text-sm font-bold text-[var(--text1)] mb-3">Checklist final</h3>
        <ul className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((id) => {
            const s = steps.find((x) => x.step === id);
            const ok = s?.status === "completed";
            return (
              <li key={id} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {ok ? "OK" : "!"}
                </span>
                <span className={ok ? "text-[var(--text1)]" : "text-[var(--text3)]"}>
                  Etapa {id} {ok ? "concluida" : "pendente"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <label className="border border-[var(--border)] rounded-lg p-4 flex items-start gap-3 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={signed}
          onChange={(e) => setSigned(e.target.checked)}
          className="mt-0.5"
          disabled={!requiredCompleted}
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--text1)]">
            Eu assino e confirmo o encerramento desta consultoria
          </div>
          <div className="text-xs text-[var(--text3)]">
            Apos encerrar, o snapshot e o hash imutavel serao gerados. Reabertura exige
            justificativa formal.
          </div>
          <input
            type="text"
            placeholder="Nome do signatario"
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            disabled={!signed}
            className="mt-2 w-full max-w-sm px-2 py-1 text-xs border border-[var(--border)] rounded disabled:bg-gray-50"
          />
        </div>
      </label>

      {!snapshot ? (
        <button
          type="button"
          onClick={gerarSnapshot}
          disabled={!requiredCompleted || !signed || !signedBy.trim() || busy}
          className="w-full text-sm px-4 py-3 rounded-lg bg-[#00B4D8] text-white font-bold hover:bg-[#0096B4] disabled:opacity-60"
        >
          {busy ? "Gerando snapshot..." : "Gerar snapshot imutavel"}
        </button>
      ) : (
        <div className="border border-emerald-300 bg-emerald-50 rounded-lg p-4 text-xs text-emerald-900 space-y-1">
          <div className="text-[10px] uppercase tracking-widest font-bold">Snapshot #{snapshot.id}</div>
          <div>
            <span className="font-semibold">Hash:</span>{" "}
            <code className="break-all">{snapshot.hash}</code>
          </div>
          <div>
            <span className="font-semibold">Assinado por:</span> {snapshot.signedBy}
          </div>
          <div>
            <span className="font-semibold">Criado em:</span>{" "}
            {new Date(snapshot.createdAt).toLocaleString("pt-BR")}
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={gerarSnapshot}
              disabled={busy}
              className="text-[10px] px-2 py-1 rounded border border-emerald-300 bg-white hover:bg-emerald-100 disabled:opacity-60"
            >
              {busy ? "Regerando..." : "Regerar"}
            </button>
          </div>
        </div>
      )}

      {saving && <div className="mt-3 text-[10px] text-[#00B4D8]">salvando progresso...</div>}
    </StepShell>
  );
}
