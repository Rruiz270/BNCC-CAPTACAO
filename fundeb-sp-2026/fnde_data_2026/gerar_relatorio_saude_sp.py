#!/usr/bin/env python3
"""
Gerador de Relatório PDF — Diagnóstico SUS 2026
Potencial de Captação de Recursos Federais — Municípios de SP

Usa dados do fundeb_2026_br.db (população estimada via matrículas)
+ parâmetros oficiais (Portarias GM/MS 3.493/2024, 5.500/2024, etc.)

Uso: python3 gerar_relatorio_saude_sp.py [codigo_ibge ...]
     python3 gerar_relatorio_saude_sp.py --all  (todos os 645 de SP)
"""

import sqlite3
import sys
import json
from pathlib import Path
from datetime import datetime

try:
    from weasyprint import HTML
except ImportError:
    print("pip install weasyprint"); sys.exit(1)

BASE = Path(__file__).parent
DB = BASE / "fundeb_2026_br.db"
OUT_DIR = Path("/Users/Raphael/Downloads/relatorios_saude_sp")
OUT_DIR.mkdir(exist_ok=True)

TODAY = datetime.now().strftime("%d/%m/%Y")

# ─── CONSTANTES OFICIAIS (Portarias GM/MS) ─────────────────────

# Portaria GM/MS 3.493/2024 — Cofinanciamento APS
# Componente Fixo por equipe/mês por estrato IED
ESF_FIXO = {1: 18000, 2: 16000, 3: 14000, 4: 12000}

# Componente Vínculo + Qualidade por classificação
VINCULO_QUAL = {
    "Otimo":      {"esf": 8000, "eap30": 4000},
    "Bom":        {"esf": 6000, "eap30": 3000},
    "Suficiente": {"esf": 4000, "eap30": 2000},
    "Regular":    {"esf": 2000, "eap30": 1000},
}

PER_CAPITA_APS = 5.95  # R$/hab/ano
INCENTIVO_IMPLANTACAO_ESF = 30000  # por equipe nova (único)
COB_POR_ESF = 3000  # pessoas cobertas por equipe eSF
META_COBERTURA = 0.80  # meta federal 80%

# Portaria GM/MS 5.500/2024 — CAPS
CAPS_CUSTEIO_MENSAL = {
    "CAPS I": 42994, "CAPS II": 50257, "CAPS III": 127797,
    "CAPSi": 48804, "CAPS AD": 60424, "CAPS AD III": 159492,
}
# Parâmetros populacionais para CAPS
CAPS_PARAMETROS = {
    "CAPS I": 15000, "CAPS II": 70000, "CAPS III": 200000,
}

# eMulti (Portaria 3.493/2024, Anexo IV)
EMULTI_AMP_BOM = 6750  # mês
EMULTI_COMP_BOM = 4500

# QUALIFAR-SUS
QUALIFAR_ANUAL = 24000

# CBAF per capita (Portaria 9.887/2025, IDHM Alto)
CBAF_PER_CAPITA = 8.20

# MAC subprodução estimada
MAC_SUBPRODUCAO_PCT = 0.10

# Emendas: benchmark per capita para municípios SP
EMENDA_BENCHMARK_PER_CAPITA = 30  # R$/hab/ano (municípios proativos)
EMENDA_MEDIA_ATUAL_PER_CAPITA = 8  # R$/hab/ano (média atual)

# PAC
PAC_UBS_NOVA = 1500000
PAC_REFORMA_UBS = 200000


def fmt(v):
    if abs(v) >= 1_000_000_000:
        return f"R$ {v/1_000_000_000:,.2f} bi".replace(",", "X").replace(".", ",").replace("X", ".")
    if abs(v) >= 1_000_000:
        return f"R$ {v/1_000_000:,.1f}M".replace(",", "X").replace(".", ",").replace("X", ".")
    if abs(v) >= 1_000:
        return f"R$ {v:,.0f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {v:,.0f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_n(v):
    return f"{v:,}".replace(",", ".")


def fmt_pct(v):
    return f"{v:.1f}".replace(".", ",")


def get_ied_stratum(pop, nse):
    if nse and nse > 0.99:
        return 1
    if pop < 20000:
        return 3
    if pop < 100000:
        return 3
    return 4  # SP municipalities are mostly stratum 3-4


def get_quality_class(pop):
    # Até abr/2026 todos recebem "Bom"; a partir de mai/2026 varia
    # Para SP, assumimos "Bom" como conservador
    return "Bom"


def calc_saude(ibge, nome, pop, nse, receita_fundeb):
    stratum = get_ied_stratum(pop, nse)
    quality = get_quality_class(pop)

    fixo_esf = ESF_FIXO[stratum]
    vinc_qual = VINCULO_QUAL[quality]["esf"]
    total_esf_mes = fixo_esf + 2 * vinc_qual  # fixo + vínculo + qualidade
    total_esf_ano = total_esf_mes * 12

    # Cobertura APS
    esf_meta = max(1, int(pop * META_COBERTURA / COB_POR_ESF))
    # Estimar eSF atual: usar proporção nacional (~60% cobertura em SP)
    esf_estimado = max(1, int(pop * 0.55 / COB_POR_ESF))
    esf_gap = max(0, esf_meta - esf_estimado)
    cobertura_estimada = min(100, esf_estimado * COB_POR_ESF / pop * 100)

    # A — APS
    ganho_a = esf_gap * total_esf_ano
    implantacao_a = esf_gap * INCENTIVO_IMPLANTACAO_ESF

    # B — Habilitações (CAPS III para municípios >200k)
    ganho_b = 0
    caps3_gap = False
    emulti_gap = True
    if pop >= 200000:
        caps3_gap = True
        ganho_b += CAPS_CUSTEIO_MENSAL["CAPS III"] * 12
    elif pop >= 70000:
        ganho_b += CAPS_CUSTEIO_MENSAL["CAPS II"] * 12 * 0.3  # 30% chance de não ter
    # eMulti (2 equipes para >100k, 1 para <100k)
    n_emulti = 2 if pop >= 100000 else 1
    ganho_b += n_emulti * EMULTI_AMP_BOM * 12
    ganho_b = round(ganho_b)

    # C — MAC
    # Estimar MAC per capita: ~R$200-400/hab dependendo do porte
    mac_per_capita = 250 if pop < 50000 else 350 if pop < 200000 else 500
    mac_estimado = pop * mac_per_capita
    ganho_c = round(mac_estimado * MAC_SUBPRODUCAO_PCT)

    # D — QUALIFAR
    ganho_d = QUALIFAR_ANUAL

    # E — Emendas
    emenda_potencial = pop * EMENDA_BENCHMARK_PER_CAPITA
    emenda_atual = pop * EMENDA_MEDIA_ATUAL_PER_CAPITA
    ganho_e = round(emenda_potencial - emenda_atual)

    # F — PAC (pontual)
    n_ubs_reform = max(1, int(pop / 50000))
    ganho_f = PAC_UBS_NOVA + n_ubs_reform * PAC_REFORMA_UBS

    total_recorrente = ganho_a + ganho_b + ganho_c + ganho_d + ganho_e

    return {
        "ibge": ibge, "nome": nome, "pop": pop, "nse": nse,
        "stratum": stratum, "quality": quality,
        "fixo_esf": fixo_esf, "total_esf_mes": total_esf_mes,
        "esf_estimado": esf_estimado, "esf_meta": esf_meta, "esf_gap": esf_gap,
        "cobertura": cobertura_estimada,
        "a": ganho_a, "a_impl": implantacao_a,
        "b": ganho_b, "caps3_gap": caps3_gap, "emulti_gap": emulti_gap, "n_emulti": n_emulti,
        "c": ganho_c, "mac_est": mac_estimado,
        "d": ganho_d,
        "e": ganho_e,
        "f": ganho_f,
        "total_recorrente": total_recorrente,
        "total_com_pontuais": total_recorrente + ganho_f,
        "receita_fundeb": receita_fundeb,
    }


def build_html(d):
    nome = d["nome"]
    nome_title = nome.replace("'", "").title()

    tiers = [
        ("A — Cobertura APS", d["a"]),
        ("B — Habilitações SUS", d["b"]),
        ("C — Teto MAC", d["c"]),
        ("D — Assist. Farmacêutica", d["d"]),
        ("E — Emendas Parlam.", d["e"]),
    ]
    max_tier = max(t[1] for t in tiers) if tiers else 1

    tier_bars = ""
    for label, val in tiers:
        pct = val / max(1, max_tier) * 100
        tier_bars += f"""
        <div class="tier-row">
            <span class="tier-label">{label}</span>
            <div class="tier-bar-bg"><div class="tier-bar" style="width:{pct}%"></div></div>
            <span class="tier-value">{fmt(val)}</span>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<style>
@page {{ size: A4; margin: 1.8cm 2cm; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family: 'Segoe UI', system-ui, sans-serif; color: #2d3748; font-size: 9pt; line-height: 1.5; }}
.cover {{ background: linear-gradient(135deg, #1a5632, #2d8659); color: white; min-height: 100vh; padding: 3rem 2.5rem; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; }}
.cover .brand {{ color: #68d391; font-size: 14pt; font-weight: 700; margin-bottom: 2rem; }}
.cover .subtitle {{ font-size: 10pt; color: rgba(255,255,255,0.8); margin-bottom: 3rem; }}
.cover .entity {{ font-size: 26pt; font-weight: 800; margin-bottom: 0.5rem; }}
.cover .entity-sub {{ font-size: 9.5pt; color: rgba(255,255,255,0.7); margin-bottom: 4rem; }}
.cover .big-number {{ font-size: 42pt; font-weight: 800; color: #68d391; margin-bottom: 0.5rem; }}
.cover .big-label {{ font-size: 10pt; color: rgba(255,255,255,0.8); margin-bottom: 2rem; }}
.cover .pct-badge {{ display: inline-block; border: 2px solid #68d391; color: #68d391; padding: 0.4rem 1.5rem; border-radius: 8px; font-size: 12pt; font-weight: 700; }}
.cover .footer {{ font-size: 7.5pt; color: rgba(255,255,255,0.5); margin-top: 2rem; }}
.cover .footer .brand-small {{ color: #68d391; font-weight: 700; }}
.page {{ page-break-before: always; padding-top: 0.5rem; }}
h2 {{ font-size: 14pt; color: #1a5632; margin-bottom: 0.6rem; border-bottom: 2px solid #2d8659; padding-bottom: 0.25rem; }}
h3 {{ font-size: 10pt; color: #2d8659; margin: 0.8rem 0 0.3rem; }}
.metrics {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.8rem; }}
.metric {{ border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.4rem; text-align: center; }}
.metric .label {{ font-size: 6pt; text-transform: uppercase; color: #718096; }}
.metric .value {{ font-size: 12pt; font-weight: 700; color: #1a5632; }}
.metric .value.accent {{ color: #2d8659; }}
.metric .value.red {{ color: #e53e3e; }}
.metric .value.green {{ color: #38a169; }}
.tier-row {{ display: flex; align-items: center; margin: 0.3rem 0; }}
.tier-label {{ width: 120px; font-size: 8pt; font-weight: 600; color: #4a5568; }}
.tier-bar-bg {{ flex: 1; height: 16px; background: #edf2f7; border-radius: 4px; overflow: hidden; margin: 0 0.4rem; }}
.tier-bar {{ height: 100%; background: linear-gradient(90deg, #68d391, #2d8659); border-radius: 4px; }}
.tier-value {{ width: 90px; text-align: right; font-size: 8pt; font-weight: 700; color: #1a5632; }}
.tier-total {{ font-size: 12pt; font-weight: 800; color: #2d8659; margin-top: 0.4rem; }}
table {{ width: 100%; border-collapse: collapse; margin: 0.3rem 0; font-size: 8pt; }}
th {{ text-transform: uppercase; font-size: 6.5pt; color: #718096; border-bottom: 2px solid #e2e8f0; padding: 0.3rem 0.4rem; text-align: left; }}
td {{ padding: 0.3rem 0.4rem; border-bottom: 1px solid #edf2f7; }}
.right {{ text-align: right; }}
.bold {{ font-weight: 700; }}
.accent {{ color: #2d8659; }}
.red {{ color: #e53e3e; }}
.ctx {{ border-radius: 6px; padding: 0.4rem 0.7rem; margin: 0.2rem 0 0.3rem; font-size: 7.5pt; line-height: 1.45; page-break-inside: avoid; }}
.ctx-sit {{ background: #f7fafc; border-left: 3px solid #a0aec0; }}
.ctx-pot {{ background: #f0fff4; border-left: 3px solid #2d8659; }}
.ctx-acao {{ background: #f0fff4; border-left: 3px solid #38a169; }}
.ctx strong {{ font-size: 7pt; text-transform: uppercase; }}
.tag-prazo {{ display: inline-block; border-radius: 3px; padding: 0.1rem 0.4rem; font-size: 6.5pt; font-weight: 700; color: white; margin-left: 0.2rem; }}
.tag-curto {{ background: #38a169; }}
.tag-medio {{ background: #d69e2e; }}
.rec-item {{ border-left: 3px solid #e2e8f0; padding: 0.3rem 0.5rem; margin: 0.3rem 0; }}
.rec-prio {{ display: inline-block; border: 1.5px solid; border-radius: 3px; padding: 0.05rem 0.3rem; font-size: 6pt; font-weight: 700; margin-right: 0.2rem; }}
.rec-tier {{ display: inline-block; background: #edf2f7; border-radius: 3px; padding: 0.05rem 0.3rem; font-size: 6pt; font-weight: 600; color: #4a5568; margin-right: 0.2rem; }}
.rec-desc {{ font-size: 7.5pt; color: #718096; margin-top: 0.1rem; }}
.cta {{ background: linear-gradient(135deg, #1a5632, #2d8659); color: white; border-radius: 12px; padding: 1.2rem 1.5rem; text-align: center; margin-top: 1rem; }}
.cta h3 {{ color: #68d391; font-size: 11pt; margin-bottom: 0.2rem; }}
.cta p {{ font-size: 8pt; color: rgba(255,255,255,0.8); margin-bottom: 0.5rem; }}
.cta .services {{ display: flex; justify-content: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.5rem; }}
.cta .svc {{ border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; padding: 0.2rem 0.5rem; font-size: 7pt; }}
.cta .email {{ color: #68d391; font-weight: 700; font-size: 9pt; }}
.page-footer {{ text-align: center; font-size: 7pt; color: #a0aec0; margin-top: 1rem; padding-top: 0.3rem; border-top: 1px solid #e2e8f0; }}
.source {{ font-size: 6pt; color: #a0aec0; font-style: italic; margin-top: 0.1rem; }}
</style></head><body>

<div class="cover">
    <div>
        <div class="brand">INSTITUTO i10</div>
        <div class="subtitle">Diagnóstico SUS 2026 · Potencial de Captação de Recursos Federais e Estaduais</div>
        <div class="entity">{nome}</div>
        <div class="entity-sub">SP · {fmt_n(d['pop'])} habitantes · Estrato IED {d['stratum']} · {d['esf_estimado']} equipes eSF estimadas</div>
    </div>
    <div>
        <div class="big-number">{fmt(d['total_recorrente'])}</div>
        <div class="big-label">em recursos federais de saúde que {nome_title} pode captar adicionalmente por ano</div>
        <div><span class="pct-badge">+ {fmt(d['f'])} em investimentos pontuais (PAC/UBS)</span></div>
    </div>
    <div class="footer">
        <span class="brand-small">Instituto i10</span> — Orquestrando o Futuro da Saúde Pública<br>
        Relatório gerado em {TODAY} · Fontes: Portarias GM/MS 3.493/2024, 5.500/2024, 9.887/2025 · Parâmetros SUS 2026
    </div>
</div>

<div class="page">
    <h2>Resumo Executivo</h2>
    <div class="metrics">
        <div class="metric"><div class="label">População Estimada</div><div class="value">{fmt_n(d['pop'])}</div></div>
        <div class="metric"><div class="label">Potencial Não Captado</div><div class="value accent">{fmt(d['total_recorrente'])}/ano</div></div>
        <div class="metric"><div class="label">Cobertura APS Estimada</div><div class="value red">{fmt_pct(d['cobertura'])}%</div></div>
        <div class="metric"><div class="label">Estrato IED / Classificação</div><div class="value">{d['stratum']} / {d['quality']}</div></div>
    </div>
    <div class="metrics">
        <div class="metric"><div class="label">Equipes eSF Estimadas</div><div class="value">{d['esf_estimado']}</div></div>
        <div class="metric"><div class="label">eSF Necessárias (80%)</div><div class="value">{d['esf_meta']}</div></div>
        <div class="metric"><div class="label">Gap de Equipes</div><div class="value red">{d['esf_gap']}</div></div>
        <div class="metric"><div class="label">Valor/eSF/mês ({d['quality']})</div><div class="value">{fmt(d['total_esf_mes'])}</div></div>
    </div>

    <h3>Decomposição do Potencial por Alavanca</h3>
    {tier_bars}
    <div class="tier-total">RECORRENTE &nbsp; {fmt(d['total_recorrente'])}/ano</div>
    <div style="font-size:7.5pt;color:#718096;margin-top:0.2rem">+ {fmt(d['f'])} em investimentos pontuais (PAC Saúde / Requalifica UBS)</div>

    <h3>Detalhamento</h3>
    <table>
        <tr><th>Alavanca</th><th class="right">Valor/Ano</th><th>Base de Cálculo</th><th class="right">Prazo</th></tr>
        <tr><td><strong>A — Expansão APS</strong></td><td class="right bold accent">{fmt(d['a'])}</td><td>{d['esf_gap']} equipes × {fmt(d['total_esf_mes'] * 12)}/ano</td><td class="right">Permanente</td></tr>
        <tr><td><strong>B — Habilitações</strong></td><td class="right bold accent">{fmt(d['b'])}</td><td>{"CAPS III + " if d['caps3_gap'] else ""}{d['n_emulti']} eMulti</td><td class="right">6–18 meses</td></tr>
        <tr><td><strong>C — Teto MAC</strong></td><td class="right bold accent">{fmt(d['c'])}</td><td>10% subprodução sobre MAC estimado {fmt(d['mac_est'])}</td><td class="right">0–6 meses</td></tr>
        <tr><td><strong>D — QUALIFAR-SUS</strong></td><td class="right bold">{fmt(d['d'])}</td><td>Habilitação Eixo Estrutura</td><td class="right">0–3 meses</td></tr>
        <tr><td><strong>E — Emendas</strong></td><td class="right bold accent">{fmt(d['e'])}</td><td>Benchmark R$ 30/hab − atual R$ 8/hab</td><td class="right">Ago-Set/2026</td></tr>
        <tr><td><strong>F — PAC (pontual)</strong></td><td class="right bold">{fmt(d['f'])}</td><td>1 UBS nova + reformas</td><td class="right">Próx. edital</td></tr>
    </table>

    <h3>Recomendações</h3>
    <div class="rec-item">
        <span class="rec-prio" style="border-color:#e53e3e;color:#e53e3e">ALTO</span>
        <span class="rec-tier">A</span>
        <strong>Credenciar {d['esf_gap']} novas equipes eSF</strong>
        <p class="rec-desc">Cobertura de {fmt_pct(d['cobertura'])}% → 80%. Ganho de {fmt(d['a'])}/ano. Janela permanente via e-Gestor APS.</p>
    </div>
    <div class="rec-item">
        <span class="rec-prio" style="border-color:#e53e3e;color:#e53e3e">ALTO</span>
        <span class="rec-tier">E</span>
        <strong>Articular emendas parlamentares para saúde</strong>
        <p class="rec-desc">Potencial de {fmt(d['e'])}/ano com articulação proativa. Janela do PLOA 2027: ago-set/2026.</p>
    </div>
    {"<div class='rec-item'><span class='rec-prio' style='border-color:#d69e2e;color:#d69e2e'>MEDIO</span><span class='rec-tier'>B</span><strong>Habilitar CAPS III (24h)</strong><p class='rec-desc'>Obrigatório para municípios acima de 200 mil hab. Incentivo: R$ 127.797/mês.</p></div>" if d['caps3_gap'] else ""}

    <div class="cta">
        <h3>O Instituto i10 pode implementar este plano para {nome_title}</h3>
        <p>Tecnologia · Dados · Pessoas · Suporte Jurídico para maximizar a captação de recursos federais em saúde</p>
        <div class="services">
            <div class="svc">Inteligência SUS</div>
            <div class="svc">Gestão de Emendas</div>
            <div class="svc">Auditoria MAC</div>
            <div class="svc">Credenciamento eSF</div>
        </div>
        <div class="email">contato@institutoi10.org.br</div>
    </div>

    <div class="page-footer">Instituto i10 — Orquestrando o Futuro da Saúde Pública</div>
</div>

</body></html>"""
    return html


def generate_report(ibge, nome, pop, nse, receita_fundeb):
    d = calc_saude(ibge, nome, pop, nse, receita_fundeb)
    html = build_html(d)

    safe_name = nome.replace(" ", "_").replace("'", "").replace("/", "_")
    out_pdf = OUT_DIR / f"SAUDE_{safe_name}_SP.pdf"

    HTML(string=html).write_pdf(str(out_pdf))
    return d


def main():
    conn = sqlite3.connect(str(DB))
    c = conn.cursor()

    if "--all" in sys.argv:
        c.execute("""
            SELECT e.codigo_ibge, e.nome, m.mat_total, n.ponderador_nse, r.total_receitas_previstas
            FROM entes e
            JOIN matriculas_municipio m ON e.codigo_ibge = m.codigo_ibge
            LEFT JOIN nse_municipio n ON e.codigo_ibge = n.codigo_ibge
            LEFT JOIN receita_municipio r ON e.codigo_ibge = r.codigo_ibge
            WHERE e.uf = 'SP' AND e.tipo = 'MUNICIPIO'
            ORDER BY m.mat_total DESC
        """)
        rows = c.fetchall()
    else:
        ibges = [int(x) for x in sys.argv[1:] if x.isdigit()]
        if not ibges:
            print("Uso: python3 gerar_relatorio_saude_sp.py --all")
            print("  ou: python3 gerar_relatorio_saude_sp.py 3549805 3543402")
            sys.exit(1)
        placeholders = ",".join(["?"] * len(ibges))
        c.execute(f"""
            SELECT e.codigo_ibge, e.nome, m.mat_total, n.ponderador_nse, r.total_receitas_previstas
            FROM entes e
            JOIN matriculas_municipio m ON e.codigo_ibge = m.codigo_ibge
            LEFT JOIN nse_municipio n ON e.codigo_ibge = n.codigo_ibge
            LEFT JOIN receita_municipio r ON e.codigo_ibge = r.codigo_ibge
            WHERE e.codigo_ibge IN ({placeholders})
        """, ibges)
        rows = c.fetchall()

    conn.close()

    total_pot = 0
    print(f"\n{'='*70}")
    print(f"  GERANDO RELATÓRIOS SUS — {len(rows)} municípios de SP")
    print(f"{'='*70}\n")

    for i, (ibge, nome, mat_total, nse, receita) in enumerate(rows):
        pop = mat_total * 5  # estimativa: matrículas × 5 ≈ população
        d = generate_report(ibge, nome, pop, nse, receita or 0)
        total_pot += d["total_recorrente"]

        if (i + 1) % 50 == 0 or (i + 1) == len(rows):
            print(f"  [{i+1}/{len(rows)}] {nome}: {fmt(d['total_recorrente'])}/ano ({d['esf_gap']} eSF gap)")

    print(f"\n{'='*70}")
    print(f"  TOTAL POTENCIAL NÃO CAPTADO (SP): {fmt(total_pot)}/ano")
    print(f"  Relatórios salvos em: {OUT_DIR}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
