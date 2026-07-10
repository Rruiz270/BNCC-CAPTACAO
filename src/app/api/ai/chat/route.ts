/**
 * Assistente de consultoria FUNDEB — chat contextual com streaming (SSE)
 * e tool use (simulação de ganho com a engine local + consulta a municípios).
 *
 * POST /api/ai/chat { municipalityId?, messages: [{ role, content }] }
 * Resposta: text/event-stream com eventos {type:'text'|'tool'|'done'|'error'}
 */
import Anthropic from '@anthropic-ai/sdk';
import { neon } from '@neondatabase/serverless';
import { requireAuthApi } from '@/lib/guard';
import { aiDisponivel, aiIndisponivelResponse, anthropic, AI_MODEL } from '@/lib/ai/client';
import { montarContextoMunicipio, contextoParaPrompt, systemPromptBase } from '@/lib/ai/contexto';
import { calculateGain, type IntakeInput } from '@/lib/fundeb/gain';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const sql = neon(process.env.DATABASE_URL!);

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'simular_ganho',
    description:
      'Simula o impacto financeiro FUNDEB de um cenário para o município em contexto, usando a engine oficial calculateGain. Use quando o usuário perguntar "e se..." (converter alunos para integral, declarar alunos do campo/indígenas, registrar AEE, reclassificar matrículas por categoria).',
    input_schema: {
      type: 'object' as const,
      properties: {
        alunosIntegral: { type: 'number', description: 'Total de alunos em jornada integral no cenário' },
        alunosCampo: { type: 'number', description: 'Alunos em escolas do campo corretamente declaradas' },
        alunosIndigena: { type: 'number', description: 'Alunos em escolas indígenas' },
        alunosQuilombola: { type: 'number', description: 'Alunos em escolas quilombolas' },
        enrollmentDeltas: {
          type: 'object',
          description:
            'Matrículas por categoria FUNDEB no cenário (chaves: creche_integral, creche_parcial, pre_integral, pre_parcial, ef_inicial, ef_final, ef_integral, eja, aee, ed_esp_creche, ed_esp_pre, ed_esp_demais)',
          additionalProperties: { type: 'number' },
        },
      },
    },
  },
  {
    name: 'dados_municipio',
    description:
      'Busca o resumo FUNDEB de qualquer município da base nacional (5.569 municípios) por nome ou código IBGE. Use para comparações ("como está a cidade vizinha X?") ou quando não houver município em contexto.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nomeOuIbge: { type: 'string', description: 'Nome do município (com UF se ambíguo, ex.: "Marília SP") ou código IBGE de 7 dígitos' },
      },
      required: ['nomeOuIbge'],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>, municipalityId: number | null): Promise<string> {
  if (name === 'simular_ganho') {
    if (!municipalityId) return JSON.stringify({ erro: 'Nenhum município em contexto para simular.' });
    const ctx = await montarContextoMunicipio(municipalityId);
    if (!ctx) return JSON.stringify({ erro: 'Município não encontrado.' });
    const m = ctx.municipality;
    const intake: IntakeInput = {
      alunosIntegral: (input.alunosIntegral as number) ?? null,
      alunosCampo: (input.alunosCampo as number) ?? null,
      alunosIndigena: (input.alunosIndigena as number) ?? null,
      alunosQuilombola: (input.alunosQuilombola as number) ?? null,
      enrollmentDeltas: (input.enrollmentDeltas as Record<string, number>) ?? undefined,
    };
    const r = calculateGain(
      {
        id: m.id as number,
        nome: m.nome as string,
        totalMatriculas: m.total_matriculas as number | null,
        receitaTotal: m.receita_total as number | null,
        vaat: m.vaat as number | null,
        vaar: m.vaar as number | null,
        potTotal: m.pot_total as number | null,
        idebAi: m.ideb_ai as number | null,
        idebAf: m.ideb_af as number | null,
        escolasRurais: m.escolas_rurais as number | null,
        eiMat: m.ei_mat as number | null,
        efMat: m.ef_mat as number | null,
        complianceASectionDone: ctx.gain.vaar.complianceScore * 5,
        complianceASectionTotal: 5,
        vaarMedioUf: null,
      },
      intake,
    );
    return JSON.stringify({
      ganhoGarantido: Math.round(r.ganhoGarantido),
      potencialDestravarVaar: Math.round(r.potencialDestravar),
      peti: { ganho: Math.round(r.peti.ganho), alunosIntegralCenario: r.peti.alunosIntegralOtimizado },
      multiplicadores: {
        campo: Math.round(r.multiplicadores.campo.ganho),
        indigena: Math.round(r.multiplicadores.indigena.ganho),
        quilombola: Math.round(r.multiplicadores.quilombola.ganho),
      },
      vaafGanhoReclassificacao: Math.round(r.vaaf.ganho),
      observacao: 'Valores anuais estimados em R$ com parâmetros FUNDEB 2026.',
    });
  }

  if (name === 'dados_municipio') {
    const q = String(input.nomeOuIbge ?? '').trim();
    // "Marília SP" → nome "Marília" + filtro uf=SP
    const ufMatch = q.match(/\s+([a-zA-Z]{2})$/);
    const uf = ufMatch ? ufMatch[1].toUpperCase() : null;
    const nome = ufMatch ? q.slice(0, ufMatch.index).trim() : q;

    const rows = /^\d{7}$/.test(q)
      ? await sql`SELECT id, nome, uf, total_matriculas, receita_total, vaar, vaat, pot_total, pct_pot_total, ideb_ai, recebe_vaar
                  FROM fundeb.municipalities WHERE codigo_ibge = ${q} LIMIT 3`
      : uf
        ? await sql`SELECT id, nome, uf, total_matriculas, receita_total, vaar, vaat, pot_total, pct_pot_total, ideb_ai, recebe_vaar
                    FROM fundeb.municipalities WHERE nome ILIKE ${'%' + nome + '%'} AND uf = ${uf}
                    ORDER BY total_matriculas DESC NULLS LAST LIMIT 5`
        : await sql`SELECT id, nome, uf, total_matriculas, receita_total, vaar, vaat, pot_total, pct_pot_total, ideb_ai, recebe_vaar
                    FROM fundeb.municipalities WHERE nome ILIKE ${'%' + nome + '%'}
                    ORDER BY total_matriculas DESC NULLS LAST LIMIT 5`;
    if (!rows.length) return JSON.stringify({ erro: `Município "${q}" não encontrado na base.` });
    return JSON.stringify(rows);
  }

  return JSON.stringify({ erro: `Ferramenta desconhecida: ${name}` });
}

export async function POST(request: Request) {
  const gate = await requireAuthApi();
  if (gate) return gate;
  if (!aiDisponivel()) return aiIndisponivelResponse();

  const body = await request.json().catch(() => ({}));
  const municipalityId: number | null = parseInt(body.municipalityId) || null;
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body.messages) ? body.messages : [];
  if (!history.length) return Response.json({ error: 'messages obrigatório' }, { status: 400 });

  let contexto = '';
  if (municipalityId) {
    const ctx = await montarContextoMunicipio(municipalityId);
    if (ctx) contexto = `\n\n# MUNICÍPIO EM CONTEXTO (tela atual do consultor)\n${contextoParaPrompt(ctx)}`;
  }

  const system = `${systemPromptBase()}${contexto}\n\nVocê está em um painel de chat lateral. Respostas curtas e diretas (2-6 frases ou lista breve), a menos que o usuário peça detalhe. Quando simular cenários, use a ferramenta simular_ganho — nunca calcule de cabeça.`;

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for (let round = 0; round < 6; round++) {
          const stream = anthropic().messages.stream({
            model: AI_MODEL,
            max_tokens: 4000,
            thinking: { type: 'adaptive' },
            system,
            tools: TOOLS,
            messages,
          });

          stream.on('text', (delta) => send({ type: 'text', text: delta }));
          const msg = await stream.finalMessage();

          if (msg.stop_reason !== 'tool_use') {
            send({ type: 'done' });
            break;
          }

          const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
          messages.push({ role: 'assistant', content: msg.content });

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            send({ type: 'tool', name: tu.name });
            let out: string;
            try {
              out = await runTool(tu.name, tu.input as Record<string, unknown>, municipalityId);
            } catch (e) {
              out = JSON.stringify({ erro: String(e) });
            }
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
          }
          messages.push({ role: 'user', content: results });
        }
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : 'Erro no assistente' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
