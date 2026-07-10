/**
 * Geração e revisão de documentos oficiais com IA (minuta CME, decreto,
 * resolução), contextualizados ao município — substitui os placeholders
 * "[CONTEUDO]" do gerador por redação completa.
 *
 * POST /api/ai/documento
 *   { municipalityId, consultoriaId?, tipo: 'minuta_cme'|'decreto'|'resolucao',
 *     acao: 'gerar'|'revisar', conteudoAtual?, salvar? }
 */
import { neon } from '@neondatabase/serverless';
import { requireAuthApi, getApiUser } from '@/lib/guard';
import { aiDisponivel, aiErroResponse, aiIndisponivelResponse, anthropic, AI_MODEL } from '@/lib/ai/client';
import { montarContextoMunicipio, contextoParaPrompt, systemPromptBase } from '@/lib/ai/contexto';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const sql = neon(process.env.DATABASE_URL!);

const TIPOS: Record<string, { titulo: string; instrucao: string }> = {
  minuta_cme: {
    titulo: 'Minuta de Resolução CME — BNCC Computação',
    instrucao:
      'Minuta de Resolução do Conselho Municipal de Educação instituindo o componente curricular de Computação (BNCC) na rede municipal. Estrutura: cabeçalho com nº ___/2026, considerandos (Lei 14.113/2020, Parecer CNE/CEB 2/2022, Resolução CNE 1/2022, condicionalidade V do VAAR), artigos sobre objeto, abrangência (etapas e escolas da rede), eixos do componente (pensamento computacional, mundo digital, cultura digital), carga horária, formação docente mínima de 32h/ano, material didático, prazos de implementação e vigência.',
  },
  decreto: {
    titulo: 'Decreto Municipal — Comitê FUNDEB e captação',
    instrucao:
      'Decreto municipal instituindo o comitê de acompanhamento da captação FUNDEB e as responsabilidades sobre a qualidade da declaração do Censo Escolar (reclassificação de matrículas, AEE, localidade diferenciada, jornada integral). Estrutura: cabeçalho, considerandos, artigos com composição do comitê, atribuições, calendário anual espelhando as janelas regulatórias e vigência.',
  },
  resolucao: {
    titulo: 'Resolução SME — Procedimentos do Censo Escolar',
    instrucao:
      'Resolução da Secretaria Municipal de Educação padronizando os procedimentos de declaração do Censo Escolar nas unidades da rede: responsáveis por escola, conferência de categorias FUNDEB, registro de dupla matrícula AEE, classificação de localização (rural/indígena/quilombola), jornada integral e cronograma interno de conferência antes do dia do Censo.',
  },
};

export async function POST(request: Request) {
  const gate = await requireAuthApi();
  if (gate) return gate;
  if (!aiDisponivel()) return aiIndisponivelResponse();

  const body = await request.json().catch(() => ({}));
  const municipalityId = parseInt(body.municipalityId);
  const tipo = String(body.tipo ?? 'minuta_cme');
  const acao = String(body.acao ?? 'gerar');
  if (!municipalityId) return Response.json({ error: 'municipalityId obrigatório' }, { status: 400 });
  if (!TIPOS[tipo]) return Response.json({ error: `tipo inválido: ${tipo}` }, { status: 400 });

  const ctx = await montarContextoMunicipio(municipalityId);
  if (!ctx) return Response.json({ error: 'Município não encontrado' }, { status: 404 });
  const contexto = contextoParaPrompt(ctx);

  const prompt =
    acao === 'revisar'
      ? `Revise criticamente o documento abaixo (tipo: ${TIPOS[tipo].titulo}) para o município em contexto. Aponte em markdown: (1) lacunas jurídico-formais (referências legais faltantes ou erradas); (2) inconsistências com os dados reais do município; (3) itens que enfraquecem a comprovação da condicionalidade no SIMEC; (4) sugestões de redação, citando o trecho. Seja objetivo — lista numerada, sem reescrever o documento inteiro.

DOCUMENTO A REVISAR:
${String(body.conteudoAtual ?? '').slice(0, 30000)}

CONTEXTO DO MUNICÍPIO:
${contexto}`
      : `Redija o documento completo e pronto para protocolo: ${TIPOS[tipo].instrucao}

Regras: texto normativo em português formal de ato oficial municipal; use os dados reais do município (nome, rede, nº de escolas e matrículas) a partir do contexto; datas de prazos coerentes com as janelas regulatórias do contexto; onde faltar dado (ex.: nome do prefeito), use marcador [PREENCHER: descrição]. Formato: texto puro com títulos em maiúsculas e artigos numerados (Art. 1º, Art. 2º...), sem markdown.

CONTEXTO DO MUNICÍPIO:
${contexto}`;

  let msg;
  try {
    const stream = anthropic().messages.stream({
      model: AI_MODEL,
      max_tokens: 12000,
      thinking: { type: 'adaptive' },
      system: systemPromptBase(),
      messages: [{ role: 'user', content: prompt }],
    });
    msg = await stream.finalMessage();
  } catch (e) {
    return aiErroResponse(e);
  }
  const conteudo = msg.content
    .filter((b): b is Extract<typeof msg.content[number], { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  let documentId: number | null = null;
  if (acao === 'gerar' && body.salvar) {
    const user = await getApiUser();
    const [{ next_versao }] = await sql`
      SELECT COALESCE(MAX(versao), 0) + 1 AS next_versao
      FROM fundeb.documents WHERE municipality_id = ${municipalityId} AND tipo = ${tipo}`;
    const [doc] = await sql`
      INSERT INTO fundeb.documents (municipality_id, tipo, titulo, conteudo, status, versao)
      VALUES (${municipalityId}, ${tipo}, ${`${TIPOS[tipo].titulo} — ${ctx.municipality.nome}`}, ${conteudo}, 'rascunho', ${next_versao})
      RETURNING id`;
    documentId = doc.id as number;
    await sql`
      INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, after_state)
      VALUES (${user?.email ?? 'sistema'}, 'consultor', 'document.ia_gerado', 'document', ${documentId},
              ${JSON.stringify({ tipo, versao: next_versao })}::jsonb)`;
  }

  return Response.json({ conteudo, documentId, tipo, acao, model: AI_MODEL });
}
