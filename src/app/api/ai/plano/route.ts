/**
 * Recomendador de plano de ação: gera tarefas priorizadas a partir do
 * diagnóstico T1-T6 + gaps de compliance + janelas regulatórias.
 *
 * POST /api/ai/plano { municipalityId, consultoriaId?, gravar? }
 *   → { diagnostico, tarefas[] } e, com gravar=true, insere as tarefas
 *     sugeridas em fundeb.action_plans (task_key com prefixo "ia_").
 */
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { requireAuthApi, getApiUser } from '@/lib/guard';
import { aiDisponivel, aiErroResponse, aiIndisponivelResponse, anthropic, AI_MODEL } from '@/lib/ai/client';
import { montarContextoMunicipio, contextoParaPrompt, systemPromptBase } from '@/lib/ai/contexto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const sql = neon(process.env.DATABASE_URL!);

const PlanoSchema = z.object({
  diagnostico: z.string().describe('Síntese de 2-3 frases da situação e da estratégia recomendada'),
  tarefas: z
    .array(
      z.object({
        fase: z.enum(['curto', 'medio', 'longo']),
        tarefa: z.string().describe('Título imperativo curto'),
        descricao: z.string().describe('O que fazer, concretamente, em 1-2 frases'),
        responsavelSugerido: z.string().describe('Papel responsável, ex.: Secretaria de Educação, equipe do Censo'),
        prazo: z.string().describe('Data-limite ISO yyyy-mm-dd, coerente com as janelas regulatórias'),
        valorEstimadoReais: z.number().nullable().describe('Valor anual estimado em R$ que a tarefa ajuda a captar; null se não quantificável'),
        alavanca: z.string().describe('T1..T6, compliance-A..E ou "gestao"'),
      }),
    )
    .describe('8 a 14 tarefas, ordenadas por prioridade decrescente (valor × urgência)'),
});

export async function POST(request: Request) {
  const gate = await requireAuthApi();
  if (gate) return gate;
  if (!aiDisponivel()) return aiIndisponivelResponse();

  const body = await request.json().catch(() => ({}));
  const municipalityId = parseInt(body.municipalityId);
  if (!municipalityId) return Response.json({ error: 'municipalityId obrigatório' }, { status: 400 });

  const ctx = await montarContextoMunicipio(municipalityId);
  if (!ctx) return Response.json({ error: 'Município não encontrado' }, { status: 404 });

  let response;
  try {
  response = await anthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 8000,
    system: systemPromptBase(),
    messages: [
      {
        role: 'user',
        content: `Monte o plano de ação FUNDEB deste município. Priorize por (valor em R$ × proximidade de prazo); quick wins de cadastro primeiro; só inclua alavancas com potencial > 0 no contexto; tarefas de compliance devem citar a condicionalidade pendente específica. Datas devem ser posteriores a hoje e anteriores (ou iguais) à janela regulatória correspondente.

CONTEXTO:
${contextoParaPrompt(ctx)}`,
      },
    ],
    output_config: { format: zodOutputFormat(PlanoSchema) },
  });
  } catch (e) {
    return aiErroResponse(e);
  }

  const plano = response.parsed_output;
  if (!plano) return Response.json({ error: 'Falha ao estruturar o plano' }, { status: 502 });

  let gravadas = 0;
  if (body.gravar) {
    const user = await getApiUser();
    const consultoriaId = parseInt(body.consultoriaId) || null;
    const stamp = Date.now();
    for (let i = 0; i < plano.tarefas.length; i++) {
      const t = plano.tarefas[i];
      await sql`
        INSERT INTO fundeb.action_plans
          (municipality_id, phase, semana, task_key, tarefa, descricao, responsavel, status, due_date, notes)
        VALUES
          (${municipalityId}, ${t.fase}, 0, ${`ia_${stamp}_${i}`}, ${t.tarefa}, ${t.descricao},
           ${t.responsavelSugerido}, 'pending', ${t.prazo},
           ${`Sugerida pela IA (${t.alavanca}${t.valorEstimadoReais ? ` · ~R$ ${Math.round(t.valorEstimadoReais).toLocaleString('pt-BR')}/ano` : ''})`})`;
      gravadas++;
    }
    await sql`
      INSERT INTO audit.event_log (actor_id, actor_role, action, entity_type, entity_id, consultoria_id, after_state)
      VALUES (${user?.email ?? 'sistema'}, 'consultor', 'plano.ia_gerado', 'municipality', ${municipalityId}, ${consultoriaId},
              ${JSON.stringify({ tarefas: gravadas })}::jsonb)`;
  }

  return Response.json({ ...plano, gravadas, model: AI_MODEL });
}
