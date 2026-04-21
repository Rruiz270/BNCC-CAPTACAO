"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface ConsultorOption {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

interface TransferLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultoriaId: number;
  currentOwnerName?: string | null;
  onTransferred?: (newOwner: { id: string; name: string | null }) => void;
}

export function TransferLeadModal({
  open,
  onOpenChange,
  consultoriaId,
  currentOwnerName,
  onTransferred,
}: TransferLeadModalProps) {
  const [consultores, setConsultores] = useState<ConsultorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedId("");
    setReason("");
    setLoading(true);
    fetch("/api/consultores")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setConsultores(data.consultores || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSubmit() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/consultorias/${consultoriaId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toConsultorId: selectedId, reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Falha na transferencia");
      const newOwner = consultores.find((c) => c.id === selectedId);
      onTransferred?.({ id: selectedId, name: newOwner?.name ?? null });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,92vw)] bg-white rounded-xl shadow-xl border border-[var(--border)]">
          <div className="p-6">
            <Dialog.Title className="text-lg font-bold text-[var(--navy)] mb-1">
              Transferir lead
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--text3)] mb-4">
              {currentOwnerName
                ? `Atualmente com ${currentOwnerName}. Selecione o novo responsavel.`
                : "Selecione o novo responsavel para este lead."}
            </Dialog.Description>

            {loading ? (
              <div className="py-8 text-center text-sm text-[var(--text3)]">Carregando consultores...</div>
            ) : consultores.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--text3)]">
                Nenhum consultor disponivel para transferencia.
              </div>
            ) : (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text3)] mb-1">
                  Novo responsavel
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm mb-4 bg-white"
                >
                  <option value="">Selecione um consultor</option>
                  {consultores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.email || c.id}
                      {c.role !== "consultor" ? ` (${c.role})` : ""}
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text3)] mb-1">
                  Motivo (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Ex: Realocacao de carteira, ferias, etc."
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm mb-4 resize-none"
                />
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--text2)] hover:bg-gray-100 transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedId || submitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--navy)] text-white hover:bg-[var(--navy)]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Transferindo..." : "Transferir"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
