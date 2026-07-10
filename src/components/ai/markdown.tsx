"use client";

/**
 * Renderizador markdown mínimo (sem dependência externa) para as saídas da IA:
 * títulos, negrito, itálico, listas, linhas horizontais e parágrafos.
 */
import { useMemo } from "react";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-black/20 text-[0.9em]">$1</code>');
}

export function renderMarkdown(md: string): string {
  const lines = escapeHtml(md).split("\n");
  const out: string[] = [];
  let inList = false;
  let inOl = false;

  const closeLists = () => {
    if (inList) { out.push("</ul>"); inList = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const li = line.match(/^\s*[-*]\s+(.*)/);
    const oli = line.match(/^\s*(\d+)[.)]\s+(.*)/);

    if (h) {
      closeLists();
      const lvl = Math.min(h[1].length + 2, 5);
      out.push(`<h${lvl} class="font-bold mt-4 mb-1.5 text-[var(--text1,inherit)]">${inline(h[2])}</h${lvl}>`);
    } else if (li) {
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inList) { out.push('<ul class="list-disc pl-5 space-y-1 my-2">'); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (oli) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (!inOl) { out.push('<ol class="list-decimal pl-5 space-y-1 my-2">'); inOl = true; }
      out.push(`<li>${inline(oli[2])}</li>`);
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      closeLists();
      out.push('<hr class="my-3 border-[var(--border,#334155)]" />');
    } else if (line.trim() === "") {
      closeLists();
    } else {
      closeLists();
      out.push(`<p class="my-1.5 leading-relaxed">${inline(line)}</p>`);
    }
  }
  closeLists();
  return out.join("\n");
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
