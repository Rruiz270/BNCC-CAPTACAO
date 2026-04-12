"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface EnrollmentEntry {
  categoria: string;
  publicValue: number;
  realValue: number;
  difference: number;
}

interface IntakeResponseData {
  id: number;
  respondentName: string;
  respondentRole: string;
  respondentEmail: string;
  submittedAt: string;
  data: {
    enrollmentData?: Record<string, EnrollmentEntry>;
    schoolsTotal?: number;
    schoolsRural?: number;
    observations?: string;
  };
}

interface IntakeResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultoriaId: number;
}

export function IntakeResponseModal({ open, onOpenChange, consultoriaId }: IntakeResponseModalProps) {
  const [response, setResponse] = useState<IntakeResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/intake?consultoriaId=${consultoriaId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.response) {
          setResponse(data.response);
        } else {
          setError("Nenhuma resposta de intake encontrada para esta consultoria.");
        }
      })
      .catch(() => setError("Erro ao carregar resposta."))
      .finally(() => setLoading(false));
  }, [open, consultoriaId]);

  const enrollmentEntries = response?.data?.enrollmentData
    ? Object.entries(response.data.enrollmentData)
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[100]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[700px] max-h-[85vh] overflow-y-auto z-[101] p-6">
          <Dialog.Title className="text-lg font-bold text-[var(--navy)] mb-1">
            Resposta Intake
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--text2)] mb-4">
            Dados enviados pela secretaria do municipio
          </Dialog.Description>

          {loading && (
            <div className="py-12 text-center text-sm text-[var(--text3)]">Carregando...</div>
          )}

          {error && (
            <div className="py-12 text-center text-sm text-[var(--text2)]">{error}</div>
          )}

          {response && !loading && (
            <div className="space-y-5">
              {/* Respondent info */}
              <div className="bg-[var(--bg)] rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
                  Responsavel
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] text-[var(--text3)] uppercase">Nome</div>
                    <div className="font-semibold">{response.respondentName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text3)] uppercase">Cargo</div>
                    <div className="font-semibold">{response.respondentRole || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text3)] uppercase">Email</div>
                    <div className="font-semibold">{response.respondentEmail || "—"}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-[var(--text3)]">
                  Enviado em {new Date(response.submittedAt).toLocaleDateString("pt-BR")}{" "}
                  as {new Date(response.submittedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {/* Schools */}
              {(response.data?.schoolsTotal || response.data?.schoolsRural) && (
                <div className="bg-[var(--bg)] rounded-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
                    Escolas
                  </div>
                  <div className="flex gap-6 text-sm">
                    {response.data.schoolsTotal != null && (
                      <div>
                        <span className="text-[var(--text3)]">Total:</span>{" "}
                        <span className="font-semibold">{response.data.schoolsTotal}</span>
                      </div>
                    )}
                    {response.data.schoolsRural != null && (
                      <div>
                        <span className="text-[var(--text3)]">Rurais:</span>{" "}
                        <span className="font-semibold">{response.data.schoolsRural}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Enrollment comparison */}
              {enrollmentEntries.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
                    Matriculas — Publico vs Real
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-[var(--navy)] text-white text-xs uppercase">
                          <th className="text-left px-3 py-2 rounded-tl-lg">Categoria</th>
                          <th className="text-right px-3 py-2">Publico</th>
                          <th className="text-right px-3 py-2">Real</th>
                          <th className="text-right px-3 py-2 rounded-tr-lg">Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollmentEntries.map(([key, entry]) => {
                          const diff = entry.difference;
                          const pct = entry.publicValue > 0
                            ? Math.abs(diff / entry.publicValue * 100)
                            : diff !== 0 ? 100 : 0;
                          const warnClass = pct > 10 ? "bg-red-50" : "";
                          return (
                            <tr key={key} className={`border-b border-[var(--border)] ${warnClass}`}>
                              <td className="px-3 py-2 font-medium">{key}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-[var(--text2)]">
                                {entry.publicValue.toLocaleString("pt-BR")}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                {entry.realValue.toLocaleString("pt-BR")}
                              </td>
                              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${
                                diff > 0 ? "text-[var(--green-dark)]" : diff < 0 ? "text-[var(--red)]" : "text-[var(--text3)]"
                              }`}>
                                {diff > 0 ? "+" : ""}{diff.toLocaleString("pt-BR")}
                                {pct > 0 && (
                                  <span className="text-[10px] text-[var(--text3)] ml-1">({pct.toFixed(0)}%)</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Observations */}
              {response.data?.observations && (
                <div className="bg-[var(--bg)] rounded-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-2">
                    Observacoes
                  </div>
                  <p className="text-sm text-[var(--text)]">{response.data.observations}</p>
                </div>
              )}
            </div>
          )}

          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)] transition-colors">
              &times;
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
