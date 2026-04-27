"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Resumo {
  consultoria: {
    id: number;
    status: string;
    startDate: string;
    endDate: string | null;
    notes: string | null;
  };
  municipio: {
    id: number;
    nome: string;
    codigoIbge: string;
    receitaTotal: number;
    totalMatriculas: number;
    populacao: number | null;
    regiao: string | null;
  };
  cenarioAlvo: {
    id: number;
    nome: string;
    receitaBase: number;
    receitaProjetada: number;
    delta: number;
    deltaPct: number;
    reclassificacoes: Record<string, unknown>;
  } | null;
  compliance: {
    total: number;
    done: number;
    late: number;
    porSecao: {
      section: string;
      sectionName: string;
      total: number;
      done: number;
      items: {
        id: number;
        itemKey: string;
        itemText: string;
        status: string;
        evidenceUrl: string | null;
        notes: string | null;
      }[];
    }[];
  };
  plano: Record<string, {
    total: number;
    done: number;
    tarefas: {
      id: number;
      taskKey: string;
      tarefa: string;
      descricao: string | null;
      responsavel: string | null;
      status: string;
      dueDate: string | null;
      notes: string | null;
      completedAt: string | null;
      semana: number;
      semanaLabel: string;
    }[];
  }>;
  categorias: {
    categoria: string;
    label: string;
    fator: number;
    qtdAtual: number;
    qtdProjetada: number;
    receitaAtual: number;
    receitaProjetada: number;
    delta: number;
    ativa: boolean;
  }[];
  documentos: {
    id: number;
    tipo: string;
    titulo: string;
    status: string;
    versao: number;
  }[];
  snapshot: {
    id: number;
    hash: string;
    signedBy: string;
    signedAt: string;
    reason: string | null;
  } | null;
  acoesCenso2026: AcaoCenso[];
  roadmap2027: RoadmapItem[];
}

interface AcaoCenso {
  tarefa: string;
  status: string;
  completedAt: string | null;
}

interface RoadmapItem {
  tarefa: string;
  descricao: string | null;
  status: string;
  dueDate: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; text: string; label: string }> = {
    done: { bg: "bg-green-50", text: "text-green-700", label: "Concluido" },
    progress: { bg: "bg-blue-50", text: "text-blue-700", label: "Em andamento" },
    pending: { bg: "bg-gray-50", text: "text-gray-600", label: "Pendente" },
    late: { bg: "bg-red-50", text: "text-red-700", label: "Atrasado" },
    active: { bg: "bg-green-50", text: "text-green-700", label: "Ativa" },
    completed: { bg: "bg-blue-50", text: "text-blue-700", label: "Concluida" },
    rascunho: { bg: "bg-gray-50", text: "text-gray-600", label: "Rascunho" },
    aprovado: { bg: "bg-green-50", text: "text-green-700", label: "Aprovado" },
    publicado: { bg: "bg-blue-50", text: "text-blue-700", label: "Publicado" },
  };
  const s = m[status] || { bg: "bg-gray-50", text: "text-gray-600", label: status };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-[var(--navy)] uppercase tracking-wider mb-3 flex items-center gap-2">
      {children}
    </h2>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrencyFull(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface ForbiddenOwner {
  id: string;
  name: string | null;
  email: string | null;
}

export default function ConsultoriaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbiddenOwner, setForbiddenOwner] = useState<ForbiddenOwner | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/consultorias/${id}/resumo`)
      .then(async (r) => {
        if (r.status === 403) {
          const data = await r.json().catch(() => ({}));
          setForbiddenOwner(data.owner ?? null);
          throw new Error("FORBIDDEN");
        }
        if (!r.ok) throw new Error("Falha ao carregar dados");
        return r.json();
      })
      .then(setResumo)
      .catch((err) => {
        if (err.message !== "FORBIDDEN") setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Carregando..." description="Buscando dados da consultoria" />
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[var(--border)] rounded-xl p-5 animate-pulse">
                <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
                <div className="h-7 w-32 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (forbiddenOwner !== undefined) {
    const ownerName = forbiddenOwner?.name || forbiddenOwner?.email || "outro consultor";
    return (
      <div>
        <PageHeader title="Lead atribuido" description="Este lead esta com outro consultor" />
        <div className="max-w-2xl mx-auto px-8 py-12">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
            <div className="text-5xl mb-4 opacity-40">&#x1f512;</div>
            <h2 className="text-lg font-bold text-amber-900 mb-2">Este lead esta com {ownerName}</h2>
            <p className="text-sm text-amber-800 mb-6">
              Apenas o responsavel atual ou um admin/gestor pode ver os detalhes. Voce pode ver o pool de leads disponiveis.
            </p>
            <Link
              href="/consultorias?view=pool"
              className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold bg-[var(--navy)] text-white hover:bg-[var(--navy)]/80 transition-colors"
            >
              Ver Pool de Leads
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !resumo) {
    return (
      <div>
        <PageHeader title="Erro" description="Não foi possível carregar a consultoria" />
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-semibold">{error || "Consultoria não encontrada"}</p>
          </div>
        </div>
      </div>
    );
  }

  const { consultoria, municipio, cenarioAlvo, compliance, plano, categorias, documentos, snapshot, acoesCenso2026, roadmap2027 } = resumo;

  const receitaBase = cenarioAlvo?.receitaBase ?? municipio.receitaTotal;
  const receitaProj = cenarioAlvo?.receitaProjetada ?? receitaBase;
  const delta = cenarioAlvo?.delta ?? 0;
  const deltaPct = cenarioAlvo?.deltaPct ?? 0;
  const compliancePct = compliance.total > 0 ? Math.round((compliance.done / compliance.total) * 100) : 0;

  return (
    <div>
      {/* A. Header */}
      <PageHeader
        label={`Consultoria #${consultoria.id}`}
        title={municipio.nome}
        description={`${formatDate(consultoria.startDate)} - ${formatDate(consultoria.endDate)} | IBGE: ${municipio.codigoIbge || "-"}`}
      >
        <StatusBadge status={consultoria.status} />
        <Link
          href={`/consultorias/${consultoria.id}/telao`}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#00B4D8] text-white hover:bg-[#009fc0] transition-colors"
        >
          Modo Telão
        </Link>
        <Link
          href={`/consultorias/${consultoria.id}/relatorio`}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          Gerar Relatório
        </Link>
        <Link
          href="/consultorias"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          Voltar
        </Link>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* B. KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Receita Base" value={formatCurrency(receitaBase)} icon="&#x1f4b0;" color="var(--navy)" />
          <StatCard label="Receita Projetada 2027" value={formatCurrency(receitaProj)} icon="&#x1f680;" color="var(--cyan)" />
          <StatCard
            label="Delta Projetado"
            value={delta > 0 ? `+${formatCurrency(delta)}` : formatCurrency(delta)}
            sub={deltaPct > 0 ? `+${deltaPct.toFixed(1)}%` : `${deltaPct.toFixed(1)}%`}
            icon="&#x1f4c8;"
            color={delta > 0 ? "var(--green)" : "var(--red)"}
          />
          <StatCard label="Compliance VAAR" value={`${compliancePct}%`} sub={`${compliance.done}/${compliance.total} itens`} icon="&#x2705;" color="var(--green)" />
        </div>

        {/* Snapshot info */}
        {snapshot && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center gap-4 text-xs">
            <span className="font-bold text-blue-700">Snapshot</span>
            <span className="text-blue-600 font-mono">{snapshot.hash.slice(0, 16)}...</span>
            <span className="text-blue-500">por {snapshot.signedBy} em {formatDate(snapshot.signedAt)}</span>
          </div>
        )}

        {/* C. Tabela de Categorias */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <SectionTitle>Categorias FUNDEB - Projeção 2027</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Categoria</th>
                  <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Fator VAAF</th>
                  <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Qtd Atual</th>
                  <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Qtd Projetada</th>
                  <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Receita Atual</th>
                  <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Receita 2027</th>
                  <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Ganho</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((cat) => (
                  <tr key={cat.categoria} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[var(--text)]">{cat.label || cat.categoria}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--text2)] tabular-nums">{cat.fator.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--text2)] tabular-nums">{formatNumber(cat.qtdAtual)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium" style={{ color: cat.qtdProjetada > cat.qtdAtual ? "var(--green)" : "var(--text2)" }}>
                      {formatNumber(cat.qtdProjetada)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text2)] tabular-nums">{formatCurrencyFull(cat.receitaAtual)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium text-[var(--cyan)]">{formatCurrencyFull(cat.receitaProjetada)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold" style={{ color: cat.delta > 0 ? "var(--green)" : cat.delta < 0 ? "var(--red)" : "var(--text3)" }}>
                      {cat.delta > 0 ? "+" : ""}{formatCurrencyFull(cat.delta)}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="border-t-2 border-[var(--navy)] bg-[var(--bg)]">
                  <td className="py-3 px-3 font-bold text-[var(--navy)]">TOTAL</td>
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3 text-right font-bold tabular-nums">{formatNumber(categorias.reduce((s, c) => s + c.qtdAtual, 0))}</td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums text-[var(--green)]">{formatNumber(categorias.reduce((s, c) => s + c.qtdProjetada, 0))}</td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums">{formatCurrencyFull(categorias.reduce((s, c) => s + c.receitaAtual, 0))}</td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums text-[var(--cyan)]">{formatCurrencyFull(categorias.reduce((s, c) => s + c.receitaProjetada, 0))}</td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums text-[var(--green)]">
                    +{formatCurrencyFull(categorias.reduce((s, c) => s + c.delta, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* D. Ações Censo 2026 */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <SectionTitle>Ações para o Censo 2026 (Corrigidos)</SectionTitle>
          {acoesCenso2026.length === 0 ? (
            <p className="text-sm text-[var(--text3)]">Nenhuma ação de curto prazo concluída ainda.</p>
          ) : (
            <div className="space-y-2">
              {acoesCenso2026.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
                  <span className="text-green-600 text-lg">&#x2705;</span>
                  <span className="text-sm font-medium text-green-800 flex-1">{a.tarefa}</span>
                  <span className="text-[11px] text-green-600">{formatDate(a.completedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* E. Roadmap 2027 */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <SectionTitle>Roadmap 2027 (Pendentes)</SectionTitle>
          {roadmap2027.length === 0 ? (
            <p className="text-sm text-[var(--text3)]">Todas as tarefas de médio/longo prazo foram concluídas.</p>
          ) : (
            <div className="space-y-2">
              {roadmap2027.map((t, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                  <span className="text-[var(--cyan)] text-lg mt-0.5">&#x23F3;</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--text)]">{t.tarefa}</div>
                    {t.descricao && (
                      <div className="text-xs text-[var(--text3)] mt-0.5">{t.descricao}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <StatusBadge status={t.status} />
                    {t.dueDate && (
                      <div className="text-[10px] text-[var(--text3)] mt-1">Prazo: {t.dueDate}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* F. Compliance VAAR */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <SectionTitle>Compliance VAAR</SectionTitle>
          <div className="space-y-6">
            {compliance.porSecao.map((sec) => (
              <div key={sec.section}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    {sec.section}. {sec.sectionName}
                  </h3>
                  <span className="text-xs font-bold tabular-nums" style={{ color: sec.done === sec.total ? "var(--green)" : "var(--text3)" }}>
                    {sec.done}/{sec.total}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${sec.total > 0 ? (sec.done / sec.total) * 100 : 0}%`,
                      background: sec.done === sec.total ? "var(--green)" : "var(--cyan)",
                    }}
                  />
                </div>
                <div className="space-y-1">
                  {sec.items.map((item) => (
                    <div key={item.itemKey} className="flex items-center gap-3 px-3 py-1.5 rounded text-sm">
                      <span className={item.status === "done" ? "text-green-500" : item.status === "late" ? "text-red-500" : "text-gray-300"}>
                        {item.status === "done" ? "\u2713" : item.status === "late" ? "!" : "\u25CB"}
                      </span>
                      <span className={`flex-1 ${item.status === "done" ? "text-[var(--text2)] line-through" : "text-[var(--text)]"}`}>
                        {item.itemText}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* G. Documentos */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-6">
          <SectionTitle>Documentos Gerados</SectionTitle>
          {documentos.length === 0 ? (
            <p className="text-sm text-[var(--text3)]">Nenhum documento gerado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Tipo</th>
                    <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Título</th>
                    <th className="text-center py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Status</th>
                    <th className="text-center py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Versão</th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((doc) => (
                    <tr key={doc.id} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 font-medium">{doc.tipo}</td>
                      <td className="py-2 px-3 text-[var(--text2)]">{doc.titulo || "-"}</td>
                      <td className="py-2 px-3 text-center"><StatusBadge status={doc.status} /></td>
                      <td className="py-2 px-3 text-center text-[var(--text3)]">v{doc.versao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
