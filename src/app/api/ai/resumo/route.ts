/**
 * Resumo executivo narrativo do município, gerado pelo Claude.
 *
 * GET  /api/ai/resumo?municipalityId=X        → último resumo cacheado (ou 404)
 * POST /api/ai/resumo { municipalityId, consultoriaId?, force? }
 *       → gera (ou devolve cache válido), grava em fundeb.ai_outputs
 */
import { createHash } from 'crypto';
import { neon } from '@neondatabase/serverless';
import { requireAuthApi, getApiUser } from '@/lib/guard';
import { aiDisponivel, aiErroResponse, aiIndisponivelResponse, anthropic, AI_MODEL } from '@/lib/ai/client';
import { montarContextoMunicipio, contextoParaPrompt, systemPromptBase } from '@/lib/ai/contexto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  const gate = await requireAuthApi();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const municipalityId = parseInt(searchParams.get('municipalityId') ?? '');
  if (!municipalityId) return Response.json({ error: 'municipalityId obrigatório' }, { status: 400 });

  const rows = await sql`
    SELECT conteudo, model, created_at FROM fundeb.ai_outputs
    WHERE municipality_id = ${municipalityId} AND tipo = 'resumo_executivo'
    ORDER BY created_at DESC LIMIT 1`;
  if (!rows[0]) return Response.json({ error: 'sem_resumo' }, { status: 404 });
  return Response.json({ conteudo: rows[0].conteudo, model: rows[0].model, createdAt: rows[0].created_at, cached: true });
}

export async function POST(request: Request) {
  const gate = await requireAuthApi();
  if (gate) return gate;
  if (!aiDisponivel()) return aiIndisponivelResponse();

  const body = await request.json().catch(() => ({}));
  const municipalityId = parseInt(body.municipalityId);
  if (!municipalityId) return Response.json({ error: 'municipalityId obrigatório' }, { status: 400 });

  const ctx = await montarContextoMunicipio(municipalityId);
  if (!ctx) return Response.json({ error: 'Município não encontrado' }, { status: 404 });

  const contexto = contextoParaPrompt(ctx);
  const inputHash = createHash('sha256').update(contexto).digest('hex');

  if (!body.force) {
    const cached = await sql`
      SELECT conteudo, model, created_at FROM fundeb.ai_outputs
      WHERE municipality_id = ${municipalityId} AND tipo = 'resumo_executivo' AND input_hash = ${inputHash}
      ORDER BY created_at DESC LIMIT 1`;
    if (cached[0]) {
      return Response.json({ conteudo: cached[0].conteudo, model: cached[0].model, createdAt: cached[0].created_at, cached: true });
    }
  }

  let msg;
  try {
  const stream = anthropic().messages.stream({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    system: systemPromptBase(),
    messages: [
      {
        role: 'user',
        content: `Escreva o RESUMO EXECUTIVO de 1 página (markdown) da situação FUNDEB deste município, endereçado ao prefeito e ao secretário de educação.

Estrutura obrigatória:
1. Abertura de 2-3 frases: quanto o município deixa de captar por ano e por quê (número forte primeiro).
2. **As 3 ações de maior retorno** — para cada uma: o que fazer, valor estimado em R$/ano, prazo-limite e grau de dificuldade (cadastro vs. política pública).
3. **Situação VAAR** — recebe ou não, o que falta, o que está em jogo.
4. **Relógio regulatório** — a janela mais urgente e o que precisa estar pronto até lá.
5. Fechamento de 1-2 frases com o próximo passo imediato.

Regras: use APENAS os dados do contexto abaixo; não invente números; se a base indicar potencial zero em alguma alavanca, não a mencione; seja direto (máx. ~450 palavras).

CONTEXTO:
${contexto}`,
      },
    ],
  });
  msg = await stream.finalMessage();
  } catch (e) {
    return aiErroResponse(e);
  }

  const conteudo = msg.content
    .filter((b): b is Extract<typeof msg.content[number], { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const user = await getApiUser();
  const consultoriaId = parseInt(body.consultoriaId) || null;
  await sql`
    INSERT INTO fundeb.ai_outputs (municipality_id, consultoria_id, tipo, conteudo, input_hash, model, generated_by)
    VALUES (${municipalityId}, ${consultoriaId}, 'resumo_executivo', ${conteudo}, ${inputHash}, ${AI_MODEL}, ${user?.email ?? 'sistema'})`;

  return Response.json({ conteudo, model: AI_MODEL, cached: false });
}
