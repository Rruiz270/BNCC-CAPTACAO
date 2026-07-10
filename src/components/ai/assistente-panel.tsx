"use client";

/**
 * Assistente FUNDEB — painel de chat flutuante presente em todas as telas
 * autenticadas. Conhece o município da consultoria ativa e responde com
 * streaming; simulações usam a engine calculateGain via tool use no backend.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useConsultoria } from "@/lib/consultoria-context";
import { Markdown } from "@/components/ai/markdown";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGESTOES = [
  "Quais os 3 maiores ganhos possíveis aqui?",
  "Por que este município não recebe VAAR?",
  "E se convertermos 200 alunos para tempo integral?",
  "O que vence até 31/08 e o que falta?",
];

export function AssistentePanel() {
  const { activeSession, municipality } = useConsultoria();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, toolStatus]);

  const enviar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || busy) return;
      setInput("");
      setBusy(true);
      setToolStatus(null);

      const history = [...msgs, { role: "user" as const, content: pergunta }];
      setMsgs([...history, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            municipalityId: municipality?.id ?? null,
            messages: history,
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setMsgs([
            ...history,
            { role: "assistant", content: data.message ?? "Não consegui responder agora. Verifique se a IA está configurada (ANTHROPIC_API_KEY)." },
          ]);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const ev of events) {
            const line = ev.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.type === "text") {
                acc += payload.text;
                setToolStatus(null);
                setMsgs([...history, { role: "assistant", content: acc }]);
              } else if (payload.type === "tool") {
                setToolStatus(
                  payload.name === "simular_ganho" ? "Simulando cenário na engine FUNDEB…" : "Consultando base de municípios…",
                );
              } else if (payload.type === "error") {
                acc += `\n\n_${payload.message}_`;
                setMsgs([...history, { role: "assistant", content: acc }]);
              }
            } catch {
              // evento malformado — ignora
            }
          }
        }
      } catch {
        setMsgs((prev) => {
          const copy = [...prev];
          if (copy.length && copy[copy.length - 1].content === "") {
            copy[copy.length - 1] = { role: "assistant", content: "Falha de conexão com o assistente." };
          }
          return copy;
        });
      } finally {
        setBusy(false);
        setToolStatus(null);
      }
    },
    [busy, msgs, municipality?.id],
  );

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente FUNDEB"}
        className="fixed bottom-5 right-5 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 transition-transform hover:scale-105"
        style={{ height: 52, width: 52 }}
      >
        {open ? (
          <span className="text-xl leading-none" aria-hidden>×</span>
        ) : (
          <span className="text-xl leading-none" aria-hidden>✨</span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[min(620px,calc(100vh-120px))] w-[min(420px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card,#0f172a)] shadow-2xl">
          <div className="border-b border-[var(--border)] bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-3">
            <p className="text-sm font-semibold text-white">Assistente FUNDEB</p>
            <p className="text-[11px] text-blue-100">
              {municipality
                ? `Contexto: ${municipality.nome}${activeSession ? ` · consultoria #${activeSession.id}` : ""}`
                : "Sem consultoria ativa — posso buscar qualquer município da base"}
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text3)]">
                  Pergunte sobre regras do FUNDEB, compliance VAAR, prazos ou peça simulações de cenário.
                </p>
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--text2)] hover:border-blue-500 hover:text-blue-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-xs text-white"
                      : "max-w-[92%] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-black/20 px-3 py-2 text-xs text-[var(--text2)]"
                  }
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <Markdown content={m.content} />
                    ) : (
                      <span className="inline-block animate-pulse">▍</span>
                    )
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {toolStatus && (
              <p className="text-[11px] text-blue-400 animate-pulse pl-1">⚙ {toolStatus}</p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(input);
            }}
            className="flex items-center gap-2 border-t border-[var(--border)] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte ou simule um cenário…"
              disabled={busy}
              className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs text-[var(--text1)] outline-none focus:border-blue-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? "…" : "Enviar"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
