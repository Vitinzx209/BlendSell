// =====================================================================
// A TELA DO BLENDSELL
// Desenha as telas e reage aos cliques. Pede tudo pela ponte (window.blendsell).
// =====================================================================

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const NOMES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const COR_COMISSAO = "#22a884";

const estado = {
  tela: "visao",
  mes: null,
  ano: null,
  produtos: [],
  vendas: [],
  config: { metaComissao: 0 },
  tipos: [],
  privado: lerPreferencia("privado") === "sim",
  filtros: { busca: "", periodo: "mes", produto: "" },
  animarAbertura: true,
  graficos: [],
};

const conteudo = document.getElementById("conteudo");

// =====================================================================
// AJUDANTES
// =====================================================================
function lerPreferencia(nome) { try { return localStorage.getItem("blendsell." + nome); } catch (e) { return null; } }
function salvarPreferencia(nome, valor) { try { localStorage.setItem("blendsell." + nome, valor); } catch (e) { /* tudo bem */ } }

function dinheiro(centavos) {
  if (estado.privado) return "R$ •••••";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dinheiroSempre(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dinheiroCurto(centavos) {
  if (estado.privado) return "•••";
  const reais = centavos / 100;
  if (reais >= 1000) return "R$ " + (reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
  return "R$ " + Math.round(reais);
}
// 1250 → "12,5%"
function percentual(pontosBase) {
  return (pontosBase / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
}
// Pra preencher campos: 19990 → "199,90" e 1250 → "12,5"
function valorParaCampo(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pctParaCampo(pontosBase) {
  return (pontosBase / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function dois(n) { return String(n).padStart(2, "0"); }
function dataCurta(d) { return dois(d.dia) + "/" + dois(d.mes); }
function dataLonga(d) { return dois(d.dia) + "/" + dois(d.mes) + "/" + d.ano; }
function hojeISO() { const h = new Date(); return h.getFullYear() + "-" + dois(h.getMonth() + 1) + "-" + dois(h.getDate()); }

// As contas vêm de comissao.js, o mesmo arquivo que o main usa pra salvar a venda.
// Aqui só devolvem null (em vez de erro) enquanto o que foi digitado ainda não é um número válido.
function lerValor(texto) {
  try { return Comissao.converterValor(texto); } catch { return null; }
}
function lerPct(texto) {
  try { return Comissao.converterPercentual(texto); } catch { return null; }
}
const calcular = Comissao.calcular;

// Os tipos de comissão são cadastrados pelo usuário (tela Produtos). "Outro" sempre existe.
function todosOsTipos() { return Comissao.listaDeTipos(estado.tipos); }
function acharTipo(id) { return todosOsTipos().find((t) => t.id === id) || null; }
function nomeDoTipo(id) { const t = acharTipo(id); return t ? t.nome : "Outro"; }
function nomeDaVenda(v) { return (v.tipoNome || nomeDoTipo(v.tipo)).split(" (")[0]; }
function tipoPadrao() { return estado.tipos.length > 0 ? estado.tipos[0].id : "outro"; }
function pctDoTipo(id, valorDeUma, pctManual) {
  try { return Comissao.percentualDoTipo(estado.tipos, id, valorDeUma, pctManual); } catch { return null; }
}
// Por que deu essa %? Ex.: "acessórios abaixo de R$ 1.000,00"
function motivoDaPct(id, valorDeUma) {
  const t = acharTipo(id);
  if (!t || t.manual) return "% digitada";
  if (t.limite) return t.nome.toLowerCase() + (valorDeUma >= t.limite ? " de " + dinheiroSempre(t.limite) + " pra cima" : " abaixo de " + dinheiroSempre(t.limite));
  return t.nome.toLowerCase();
}
function explicacaoDoTipo(t) {
  if (t.limite) return percentual(t.pctAcima) + " de " + dinheiroSempre(t.limite) + " pra cima · " + percentual(t.pctAbaixo) + " abaixo";
  return percentual(t.pct) + " em qualquer valor";
}
// Texto curto da regra pro select. Ex.: "Acessórios · 4%"
function rotuloDoTipo(t) {
  if (t.manual) return t.nome;
  if (t.limite) return t.nome + " · " + percentual(t.pctAcima) + " ou " + percentual(t.pctAbaixo);
  return t.nome + " · " + percentual(t.pct);
}
function selectDeTipos(campo, escolhido) {
  for (const t of todosOsTipos()) campo.appendChild(opcao(t.id, rotuloDoTipo(t), t.id === escolhido));
}

function criar(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined && texto !== null) el.textContent = texto;
  return el;
}

function icone(caminho) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  for (const [k, val] of Object.entries({ width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, val);
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", caminho);
  svg.appendChild(p);
  return svg;
}

const SVG_MAIS = "M12 5v14M5 12h14";
const SVG_ANTERIOR = "M15 18l-6-6 6-6";
const SVG_PROXIMO = "M9 18l6-6-6-6";
const SVG_IR = "M5 12h14M13 6l6 6-6 6";
const SVG_EDITAR = "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z";
const SVG_BAIXAR = "M12 4v12M7 11l5 5 5-5M5 20h14";
const SVG_ALVO = "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z";
const SVG_OLHO = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const SVG_OLHO_FECHADO = "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2";

function botao(texto, classe, aoClicar, svg) {
  const b = criar("button", "glass btn " + (classe || ""));
  b.type = "button";
  if (svg) b.appendChild(icone(svg));
  if (texto) b.appendChild(document.createTextNode(texto));
  b.addEventListener("click", aoClicar);
  return b;
}

function botaoCard(topo, texto, svg, aoClicar) {
  topo.classList.add("painel-topo-com-botao");
  const b = botao(texto, "btn-destaque", aoClicar, svg);
  topo.appendChild(b);
  return b;
}

function campoComEtiqueta(etiqueta, tag, atributos) {
  const grupo = criar("div", "campo-grupo");
  const id = "campo-" + Math.random().toString(36).slice(2, 8);
  const rotulo = criar("label", "rotulo", etiqueta);
  rotulo.htmlFor = id;
  const campo = criar(tag, "campo");
  campo.id = id;
  for (const [k, val] of Object.entries(atributos || {})) campo.setAttribute(k, val);
  grupo.appendChild(rotulo);
  grupo.appendChild(campo);
  return { grupo: grupo, campo: campo };
}

function opcao(valor, texto, selecionada) {
  const o = criar("option", "", texto);
  o.value = valor;
  if (selecionada) o.selected = true;
  return o;
}

function numeroDinheiro(classe, centavos) {
  const el = criar("span", classe, dinheiro(centavos));
  el.dataset.centavos = String(centavos);
  return el;
}

function produtosAtivos() {
  return estado.produtos.filter((p) => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// =====================================================================
// JANELINHA (MODAL)
// =====================================================================
const janela = document.getElementById("janela");
const janelaErro = document.getElementById("janela-erro");
let janelaAoConfirmar = null;
let focoAntes = null;

function abrirJanela(opcoes) {
  focoAntes = document.activeElement;
  document.getElementById("janela-titulo").textContent = opcoes.titulo;
  document.getElementById("janela-corpo").replaceChildren(opcoes.corpo);
  janelaErro.hidden = true;
  const botoes = document.getElementById("janela-botoes");
  botoes.replaceChildren();
  for (const extra of opcoes.extras || []) botoes.appendChild(extra);
  botoes.appendChild(criar("div", "espaco-flex"));
  botoes.appendChild(botao("Cancelar", "", fecharJanela));
  const ok = criar("button", "glass btn btn-main", opcoes.textoOk || "Salvar");
  ok.type = "submit";
  botoes.appendChild(ok);
  janelaAoConfirmar = opcoes.aoConfirmar;
  janela.hidden = false;
  const primeiro = opcoes.corpo.querySelector("input:not([type=radio]), select") || ok;
  primeiro.focus();
}
function fecharJanela() {
  janela.hidden = true;
  janelaAoConfirmar = null;
  if (focoAntes && focoAntes.focus) focoAntes.focus();
}
function mostrarErroJanela(texto) { janelaErro.textContent = texto; janelaErro.hidden = false; }

document.getElementById("janela-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!janelaAoConfirmar) return;
  try {
    const fechar = await janelaAoConfirmar();
    if (fechar !== false) fecharJanela();
  } catch (erro) {
    mostrarErroJanela(erro.message);
  }
});
janela.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharJanela(); });
janela.addEventListener("mousedown", (e) => { if (e.target === janela) fecharJanela(); });

async function pedir(promessa) {
  const r = await promessa;
  if (r && r.ok === false) throw new Error(r.mensagem);
  return r;
}

let temporizadorAviso;
function mostrarAviso(texto) {
  const aviso = document.getElementById("aviso");
  aviso.textContent = texto;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 5000);
}

// =====================================================================
// CARREGAR E DESENHAR
// =====================================================================
async function recarregar() {
  const tudo = await pedir(window.blendsell.obterTudo());
  estado.produtos = tudo.produtos;
  estado.vendas = tudo.vendas;
  estado.config = tudo.config;
  estado.tipos = tudo.tipos;
  if (estado.mes === null) {
    const h = new Date();
    estado.mes = h.getMonth() + 1;
    estado.ano = h.getFullYear();
  }
  atualizarMenu();
  await desenhar();
}

function atualizarMenu() {
  const nv = estado.vendas.length;
  const np = produtosAtivos().length;
  document.getElementById("info-total").textContent =
    nv + (nv === 1 ? " venda" : " vendas") + " · " + np + (np === 1 ? " produto" : " produtos");
  for (const item of document.querySelectorAll(".nav")) {
    const ativo = item.dataset.tela === estado.tela;
    item.classList.toggle("nav-on", ativo);
    if (ativo) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
  }
}

async function desenhar() {
  conteudo.replaceChildren();
  estado.graficos = [];
  if (estado.tela === "visao") await desenharVisao();
  else if (estado.tela === "vendas") desenharVendas();
  else if (estado.tela === "produtos") desenharProdutos();

  if (estado.animarAbertura) {
    estado.animarAbertura = false;
    animarEntrada();
    contarNumeros();
  }
}

function irPara(tela) {
  estado.tela = tela;
  estado.animarAbertura = true;
  window.scrollTo(0, 0);
  atualizarMenu();
  desenhar();
}
for (const item of document.querySelectorAll(".nav")) item.addEventListener("click", () => irPara(item.dataset.tela));

function nomeDoMes() {
  const n = NOMES_MES[estado.mes - 1];
  return n.charAt(0).toUpperCase() + n.slice(1) + " de " + estado.ano;
}

function mudarMes(passo) {
  estado.animarAbertura = true;
  estado.mes += passo;
  if (estado.mes < 1) { estado.mes = 12; estado.ano -= 1; }
  if (estado.mes > 12) { estado.mes = 1; estado.ano += 1; }
  desenhar();
}

function cabecalho(titulo, comMes) {
  const topo = criar("header", "cabecalho");
  const bloco = criar("div", "titulo-bloco");
  const hora = new Date().getHours();
  bloco.appendChild(criar("span", "rotulo", (hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite") + "!"));
  bloco.appendChild(criar("h1", "", titulo));
  topo.appendChild(bloco);

  const botoes = criar("div", "botoes");
  const olho = botao("", "btn-redondo", () => { estado.privado = !estado.privado; salvarPreferencia("privado", estado.privado ? "sim" : "nao"); desenhar(); },
    estado.privado ? SVG_OLHO_FECHADO : SVG_OLHO);
  olho.setAttribute("aria-label", estado.privado ? "Mostrar valores" : "Esconder valores");
  olho.setAttribute("aria-pressed", estado.privado ? "true" : "false");
  botoes.appendChild(olho);
  if (comMes) {
    const a = botao("", "btn-redondo", () => mudarMes(-1), SVG_ANTERIOR);
    a.setAttribute("aria-label", "Mês anterior");
    const p = botao("", "btn-redondo", () => mudarMes(1), SVG_PROXIMO);
    p.setAttribute("aria-label", "Próximo mês");
    botoes.appendChild(a);
    botoes.appendChild(p);
  }
  botoes.appendChild(botao("Nova venda", "btn-main", () => abrirNovaVenda(), SVG_MAIS));
  topo.appendChild(botoes);
  return topo;
}

// =====================================================================
// TELA 1: VISÃO GERAL
// =====================================================================
async function desenharVisao() {
  const rel = await pedir(window.blendsell.relatorio(estado.mes, estado.ano));
  conteudo.appendChild(cabecalho(nomeDoMes(), true));

  // --- Calculadora: coloque o valor e veja na hora quanto você recebe ---
  conteudo.appendChild(painelCalculadora());

  // --- Os 4 cards ---
  const cards = criar("section", "cards");
  cards.setAttribute("aria-label", "Resumo do mês");
  const r = rel.resumo;
  const ant = rel.anterior;
  cards.appendChild(cardResumo("Sua comissão", r.comissao, "positivo saldo-positivo",
    r.vendido > 0 ? percentual(r.percentualMedio) + " do que você vendeu" : "Nenhuma venda neste mês",
    etiquetaVariacao(r.comissao, ant.comissao, ant.temDados)));
  cards.appendChild(cardResumo("Total vendido", r.vendido, "", r.itens + (r.itens === 1 ? " item" : " itens") + " vendidos",
    etiquetaVariacao(r.vendido, ant.vendido, ant.temDados)));
  cards.appendChild(cardContagem("Vendas", r.vendas, r.vendas === 1 ? "venda no mês" : "vendas no mês"));
  cards.appendChild(cardResumo("Ticket médio", r.ticketMedio, "", "Valor médio de cada venda"));
  conteudo.appendChild(cards);

  // --- Meta ---
  conteudo.appendChild(painelMeta(rel.meta));

  // --- Gráfico ---
  conteudo.appendChild(painelGrafico(rel.serie));

  // --- Produtos que mais renderam + últimas vendas ---
  const paineis = criar("section", "paineis");
  paineis.appendChild(painelRanking(rel.porTipo));
  paineis.appendChild(painelVendas("Últimas vendas", rel.vendas.slice(0, 6), true));
  conteudo.appendChild(paineis);
}

function cardResumo(titulo, valor, classeCor, legenda, etiqueta) {
  const card = criar("div", "glass lift card");
  if (classeCor.includes("saldo-positivo") && valor > 0) card.classList.add("card-positivo");
  const topo = criar("div", "card-topo");
  topo.appendChild(criar("span", "rotulo", titulo));
  if (etiqueta) topo.appendChild(etiqueta);
  card.appendChild(topo);
  card.appendChild(numeroDinheiro("numero " + (valor > 0 ? classeCor : ""), valor));
  card.appendChild(criar("span", "rotulo legenda", legenda));
  return card;
}

function cardContagem(titulo, n, legenda) {
  const card = criar("div", "glass lift card");
  card.appendChild(criar("span", "rotulo", titulo));
  const numero = criar("span", "numero", String(n));
  numero.dataset.contagem = String(n);
  card.appendChild(numero);
  card.appendChild(criar("span", "rotulo legenda", legenda));
  return card;
}

// Etiqueta "▲ 12% vs. out". % só até 200%; acima disso, a diferença em reais.
function etiquetaVariacao(atual, anterior, temDados) {
  if (!temDados) return null;
  const diferenca = atual - anterior;
  const ant = estado.mes === 1 ? 12 : estado.mes - 1;
  const nome = NOMES_CURTOS[ant - 1];
  if (diferenca === 0) return criar("span", "tag tag-neutra", "= " + nome);
  const pct = anterior > 0 ? Math.round((diferenca / anterior) * 100) : null;
  const texto = (diferenca > 0 ? "▲ " : "▼ ") +
    (pct !== null && Math.abs(pct) <= 200 ? Math.abs(pct) + "%" : dinheiroCurto(Math.abs(diferenca))) + " vs. " + nome;
  return criar("span", "tag " + (diferenca > 0 ? "tag-boa" : "tag-ruim"), texto);
}

// ===== A CALCULADORA =====
// Você escolhe o tipo, digita o valor, e a sua parte aparece na hora.
function painelCalculadora() {
  const painel = criar("section", "glass painel calculadora");
  painel.setAttribute("aria-label", "Calculadora de comissão");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Quanto eu recebo?"));
  painel.appendChild(topo);

  const linha = criar("div", "calc-campos");
  const tipo = campoComEtiqueta("Tipo de venda", "select");
  selectDeTipos(tipo.campo, tipoPadrao());
  tipo.grupo.classList.add("calc-tipo");
  const preco = campoComEtiqueta("Valor (R$)", "input", { type: "text", inputmode: "decimal", placeholder: "15.000,00", autocomplete: "off" });
  const qtd = campoComEtiqueta("Quantidade", "input", { type: "number", min: "1", value: "1" });
  const pct = campoComEtiqueta("Comissão (%)", "input", { type: "text", inputmode: "decimal", placeholder: "3", autocomplete: "off" });
  for (const c of [tipo, preco, qtd, pct]) linha.appendChild(c.grupo);
  painel.appendChild(linha);

  const resultado = criar("div", "calc-resultado");
  const textos = criar("div", "calc-textos");
  textos.appendChild(criar("span", "rotulo", "Você recebe"));
  const valor = criar("span", "calc-valor", "R$ 0,00");
  const detalhe = criar("span", "rotulo calc-detalhe", "");
  textos.appendChild(valor);
  textos.appendChild(detalhe);
  resultado.appendChild(textos);
  const registrar = botao("Registrar como venda", "btn-destaque", () => {
    abrirNovaVenda({ tipo: tipo.campo.value, preco: preco.campo.value, quantidade: qtd.campo.value, comissao: pct.campo.value });
  }, SVG_MAIS);
  resultado.appendChild(registrar);
  painel.appendChild(resultado);

  function atualizar() {
    const t = acharTipo(tipo.campo.value);
    pct.grupo.hidden = !t.manual;
    const p = lerValor(preco.campo.value);
    const q = Math.max(1, parseInt(qtd.campo.value, 10) || 1);
    const c = p ? pctDoTipo(t.id, p, lerPct(pct.campo.value)) : null;
    registrar.disabled = !p || c === null;
    if (!p) {
      valor.textContent = estado.privado ? "R$ •••••" : "R$ 0,00";
      detalhe.textContent = preco.campo.value.trim() !== "" ? "Esse valor não é um número." : "Digite o valor da venda.";
      return;
    }
    if (c === null) {
      valor.textContent = "R$ 0,00";
      detalhe.textContent = "Digite a % de comissão (de 0 a 100).";
      return;
    }
    const conta = calcular(p, q, c, 0);
    valor.textContent = dinheiro(conta.comissao);
    detalhe.textContent = percentual(c) + " (" + motivoDaPct(t.id, p) + ") de " + dinheiro(conta.total) +
      (q > 1 ? " · " + q + " × " + dinheiro(p) : "");
  }
  tipo.campo.addEventListener("change", atualizar);
  for (const c of [preco, qtd, pct]) c.campo.addEventListener("input", atualizar);
  atualizar();
  return painel;
}

// ===== META =====
function painelMeta(meta) {
  const painel = criar("section", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Meta do mês"));
  botaoCard(topo, meta.meta > 0 ? "Mudar meta" : "Definir meta", meta.meta > 0 ? SVG_EDITAR : SVG_ALVO, abrirMeta);
  painel.appendChild(topo);

  if (!meta.meta) {
    painel.appendChild(criar("span", "rotulo dica", "Defina quanto você quer ganhar de comissão por mês, e o app mostra quanto falta e se o seu ritmo vai bater a meta."));
    return painel;
  }

  const fracao = Math.min(1, meta.fracao);
  const linha = criar("div", "meta-linha");
  linha.appendChild(criar("span", "forte", dinheiro(meta.atingido) + " de " + dinheiro(meta.meta)));
  linha.appendChild(criar("span", "rotulo", estado.privado ? "" : Math.round(meta.fracao * 100) + "%"));
  painel.appendChild(linha);

  const trilho = criar("div", "trilho trilho-meta");
  const barra = criar("div", "barra " + (meta.fracao >= 1 ? "barra-ok" : meta.fracao >= 0.7 ? "barra-ok" : "barra-atencao"));
  barra.style.width = "0%";
  trilho.appendChild(barra);
  painel.appendChild(trilho);
  requestAnimationFrame(() => { barra.style.width = Math.max(2, Math.round(fracao * 100)) + "%"; });

  let texto;
  if (meta.fracao >= 1) {
    texto = "🎉 Meta batida! Você passou " + dinheiro(meta.atingido - meta.meta) + " da meta.";
  } else if (meta.ehMesAtual) {
    texto = "Faltam " + dinheiro(meta.falta) + (meta.diasRestantes > 0 ? " · cerca de " + dinheiro(meta.porDiaParaBater) + " por dia nos próximos " +
      meta.diasRestantes + " dias" : "") + ". Nesse ritmo, você fecha o mês com " + dinheiro(meta.projecao) +
      (meta.projecao >= meta.meta ? " e bate a meta. 💪" : ".");
  } else {
    texto = "Faltaram " + dinheiro(meta.falta) + " pra bater a meta neste mês.";
  }
  painel.appendChild(criar("span", "rotulo dica meta-texto", texto));
  return painel;
}

function abrirMeta() {
  const corpo = criar("div", "formulario");
  const valor = campoComEtiqueta("Quanto você quer ganhar de comissão por mês (R$)", "input",
    { type: "text", inputmode: "decimal", placeholder: "3.000,00", autocomplete: "off" });
  if (estado.config.metaComissao) valor.campo.value = valorParaCampo(estado.config.metaComissao);
  corpo.appendChild(valor.grupo);
  corpo.appendChild(criar("span", "rotulo dica", "Deixe vazio pra tirar a meta. Ela vale pra todos os meses."));
  abrirJanela({
    titulo: "Meta de comissão", corpo: corpo, textoOk: "Salvar meta",
    aoConfirmar: async () => {
      await pedir(window.blendsell.salvarMeta(valor.campo.value));
      mostrarAviso(valor.campo.value.trim() === "" ? "Meta removida" : "Meta salva!");
      await recarregar();
    },
  });
}

// ===== DE ONDE VEIO A COMISSÃO (por tipo de venda) =====
function painelRanking(porTipo) {
  const painel = criar("div", "glass painel painel-estreito");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "De onde veio sua comissão"));
  painel.appendChild(topo);
  if (porTipo.length === 0) {
    painel.appendChild(criar("span", "rotulo", "Nenhuma venda neste mês."));
    return painel;
  }
  const lista = criar("div", "lista-categorias");
  const maior = porTipo[0].comissao || 1;
  for (const item of porTipo) {
    const linha = criar("div", "categoria-ano");
    const textos = criar("div", "categoria-linha");
    textos.appendChild(criar("span", "", item.nome.split(" (")[0] + " · " + item.quantidade + (item.quantidade === 1 ? " item" : " itens")));
    textos.appendChild(criar("span", "forte positivo", dinheiro(item.comissao)));
    linha.appendChild(textos);
    linha.appendChild(criar("span", "rotulo pequena", dinheiro(item.vendido) + " vendidos"));
    const trilho = criar("div", "trilho");
    const barra = criar("div", "barra barra-ok");
    barra.style.width = "0%";
    trilho.appendChild(barra);
    linha.appendChild(trilho);
    lista.appendChild(linha);
    requestAnimationFrame(() => { barra.style.width = Math.max(3, Math.round((item.comissao / maior) * 100)) + "%"; });
  }
  painel.appendChild(lista);
  return painel;
}

// ===== LISTA DE VENDAS =====
function painelVendas(titulo, lista, comLink) {
  const painel = criar("div", "glass painel painel-largo");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", titulo));
  if (comLink) botaoCard(topo, "Ver todas", SVG_IR, () => irPara("vendas"));
  painel.appendChild(topo);
  if (lista.length === 0) {
    painel.appendChild(criar("span", "rotulo", "Nenhuma venda neste mês. Use a calculadora ali em cima ou o botão “Nova venda”."));
    return painel;
  }
  for (const v of lista) painel.appendChild(linhaVenda(v));
  return painel;
}

function linhaVenda(v) {
  const linha = criar("button", "transacao venda");
  linha.type = "button";
  linha.addEventListener("click", () => abrirDetalhesVenda(v));
  linha.appendChild(criar("span", "rotulo esconder-pequeno", dataCurta(v.data)));
  const textos = criar("span", "transacao-textos");
  textos.appendChild(criar("span", "transacao-desc", (v.quantidade > 1 ? v.quantidade + "× " : "") + v.produto));
  textos.appendChild(criar("span", "transacao-banco", [v.tipo ? nomeDaVenda(v) : "", v.cliente, "venda de " + dinheiro(v.total)].filter(Boolean).join(" · ")));
  linha.appendChild(textos);
  linha.appendChild(criar("span", "etiqueta esconder-pequeno", percentual(v.comissaoPct)));
  linha.appendChild(criar("span", "valor positivo", "+" + dinheiro(v.comissao)));
  return linha;
}

// =====================================================================
// GRÁFICO: comissão dos últimos 6 meses (uma série só: o título já diz o que é)
// =====================================================================
function painelGrafico(serie) {
  const painel = criar("div", "glass painel painel-grafico");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Sua comissão · últimos 6 meses"));
  painel.appendChild(topo);
  const area = criar("div", "grafico-area");
  const balao = criar("div", "grafico-balao");
  balao.hidden = true;
  area.appendChild(balao);
  painel.appendChild(area);

  const detalhes = criar("details", "grafico-tabela");
  detalhes.appendChild(criar("summary", "", "Ver em tabela"));
  const tabela = criar("table");
  const cab = criar("tr");
  for (const t of ["Mês", "Vendas", "Vendido", "Comissão"]) cab.appendChild(criar("th", "", t));
  tabela.appendChild(cab);
  for (const m of serie) {
    const tr = criar("tr");
    tr.appendChild(criar("td", "", NOMES_CURTOS[m.mes - 1] + "/" + m.ano));
    tr.appendChild(criar("td", "num", String(m.vendas)));
    tr.appendChild(criar("td", "num", dinheiro(m.vendido)));
    tr.appendChild(criar("td", "num", dinheiro(m.comissao)));
    tabela.appendChild(tr);
  }
  detalhes.appendChild(tabela);
  painel.appendChild(detalhes);

  const redesenhar = () => desenharBarras(area, balao, serie);
  estado.graficos.push(redesenhar);
  requestAnimationFrame(redesenhar);
  return painel;
}

function escalaRedonda(valor) {
  if (valor <= 0) return { passo: 10000, linhas: 4 };
  const bruto = valor / 5;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  let passo = 10 * potencia;
  for (const f of [1, 2, 2.5, 5]) { if (f * potencia >= bruto) { passo = f * potencia; break; } }
  return { passo: passo, linhas: Math.max(1, Math.ceil(valor / passo)) };
}

function caminhoBarra(x, y, l, a) {
  const r = Math.min(4, a, l / 2);
  return "M" + x + "," + (y + a) + " V" + (y + r) + " Q" + x + "," + y + " " + (x + r) + "," + y +
    " H" + (x + l - r) + " Q" + (x + l) + "," + y + " " + (x + l) + "," + (y + r) + " V" + (y + a) + " Z";
}

function desenharBarras(area, balao, serie) {
  const ns = "http://www.w3.org/2000/svg";
  const W = Math.max(280, area.clientWidth);
  const H = 220;
  const m = { esquerda: 62, direita: 8, topo: 10, baixo: 28 };
  const lu = W - m.esquerda - m.direita;
  const au = H - m.topo - m.baixo;
  const esc = escalaRedonda(Math.max(...serie.map((s) => s.comissao)));
  const maior = esc.passo * esc.linhas;
  const y = (val) => m.topo + au - (val / maior) * au;
  const novo = (tag, at) => { const el = document.createElementNS(ns, tag); for (const [k, val] of Object.entries(at)) el.setAttribute(k, val); return el; };

  const antigo = area.querySelector("svg");
  if (antigo) antigo.remove();
  const svg = novo("svg", { width: W, height: H, role: "img", "aria-label": "Gráfico de barras com a sua comissão por mês. Os números estão na tabela logo abaixo." });

  for (let i = 0; i <= esc.linhas; i++) {
    const ly = Math.round(y(esc.passo * i)) + 0.5;
    svg.appendChild(novo("line", { x1: m.esquerda, x2: W - m.direita, y1: ly, y2: ly, stroke: i === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)" }));
    const t = novo("text", { x: m.esquerda - 10, y: ly + 4, "text-anchor": "end", class: "eixo" });
    t.textContent = dinheiroCurto(esc.passo * i);
    svg.appendChild(t);
  }

  const lg = lu / serie.length;
  const lb = Math.min(36, Math.max(10, lg * 0.42));
  serie.forEach((s, i) => {
    const centro = m.esquerda + lg * i + lg / 2;
    const destaque = s.mes === estado.mes && s.ano === estado.ano;
    const fundo = novo("rect", { x: centro - lg / 2 + 2, y: m.topo, width: lg - 4, height: au, rx: 6, fill: destaque ? "rgba(255,255,255,0.035)" : "transparent", class: "grafico-alvo" });
    svg.appendChild(fundo);
    const alt = au * (s.comissao / maior);
    if (alt > 0) svg.appendChild(novo("path", { d: caminhoBarra(centro - lb / 2, y(s.comissao), lb, alt), fill: COR_COMISSAO, "pointer-events": "none" }));
    const nome = novo("text", { x: centro, y: H - 8, "text-anchor": "middle", class: "eixo" + (destaque ? " eixo-destaque" : "") });
    nome.textContent = NOMES_CURTOS[s.mes - 1] + (s.mes === 1 ? " " + String(s.ano).slice(2) : "");
    svg.appendChild(nome);

    fundo.addEventListener("mouseenter", () => {
      fundo.setAttribute("fill", "rgba(255,255,255,0.06)");
      balao.replaceChildren();
      const t = criar("div", "balao-linha balao-titulo");
      const c = criar("span", "legenda-cor");
      c.style.background = COR_COMISSAO;
      t.appendChild(c);
      t.appendChild(criar("span", "", "Comissão · " + NOMES_MES[s.mes - 1] + " de " + s.ano));
      balao.appendChild(t);
      balao.appendChild(criar("span", "balao-total", dinheiro(s.comissao)));
      balao.appendChild(criar("span", "rotulo pequena", s.vendas + (s.vendas === 1 ? " venda · " : " vendas · ") + dinheiro(s.vendido) + " vendidos"));
      balao.hidden = false;
      const larg = balao.offsetWidth;
      const topoBarra = y(s.comissao);
      if (topoBarra - balao.offsetHeight - 10 >= 0) {
        balao.style.left = Math.min(Math.max(centro - larg / 2, 0), W - larg) + "px";
        balao.style.top = topoBarra - balao.offsetHeight - 10 + "px";
      } else {
        const dir = centro + lb / 2 + 10;
        balao.style.left = (dir + larg <= W ? dir : Math.max(0, centro - lb / 2 - larg - 10)) + "px";
        balao.style.top = Math.max(0, topoBarra) + "px";
      }
    });
    fundo.addEventListener("mouseleave", () => {
      fundo.setAttribute("fill", destaque ? "rgba(255,255,255,0.035)" : "transparent");
      balao.hidden = true;
    });
  });
  area.insertBefore(svg, balao);
}

let temporizadorTamanho;
window.addEventListener("resize", () => {
  clearTimeout(temporizadorTamanho);
  temporizadorTamanho = setTimeout(() => { for (const g of estado.graficos) g(); }, 150);
});

// =====================================================================
// TELA 2: VENDAS
// =====================================================================
function desenharVendas() {
  conteudo.appendChild(cabecalho("Vendas", true));
  const f = estado.filtros;

  const barra = criar("div", "glass filtros");
  barra.setAttribute("role", "search");
  const busca = campoComEtiqueta("Buscar", "input", { type: "search", placeholder: "Produto ou cliente", autocomplete: "off" });
  busca.campo.value = f.busca;
  busca.grupo.classList.add("filtro-busca");
  barra.appendChild(busca.grupo);
  const periodo = campoComEtiqueta("Período", "select");
  periodo.campo.appendChild(opcao("mes", nomeDoMes(), f.periodo === "mes"));
  periodo.campo.appendChild(opcao("ano", "Ano de " + estado.ano, f.periodo === "ano"));
  periodo.campo.appendChild(opcao("todos", "Tudo", f.periodo === "todos"));
  barra.appendChild(periodo.grupo);
  const produto = campoComEtiqueta("Produto", "select");
  produto.campo.appendChild(opcao("", "Todos", f.produto === ""));
  for (const nome of [...new Set(estado.vendas.map((v) => v.produto))].sort()) produto.campo.appendChild(opcao(nome, nome, f.produto === nome));
  barra.appendChild(produto.grupo);
  conteudo.appendChild(barra);

  const resultado = criar("div", "glass painel");
  conteudo.appendChild(resultado);

  function atualizarLista() {
    const termo = f.busca.trim().toUpperCase();
    const lista = estado.vendas.filter((v) => {
      if (f.periodo === "mes" && (v.data.mes !== estado.mes || v.data.ano !== estado.ano)) return false;
      if (f.periodo === "ano" && v.data.ano !== estado.ano) return false;
      if (f.produto && v.produto !== f.produto) return false;
      if (termo && !v.produto.toUpperCase().includes(termo) && !(v.cliente || "").toUpperCase().includes(termo)) return false;
      return true;
    });
    let vendido = 0;
    let comissao = 0;
    for (const v of lista) { vendido += v.total; comissao += v.comissao; }

    resultado.replaceChildren();
    const topo = criar("div", "painel-topo");
    topo.appendChild(criar("h2", "", lista.length + (lista.length === 1 ? " venda" : " vendas")));
    if (lista.length > 0) botaoCard(topo, "Exportar CSV", SVG_BAIXAR, () => exportarCSV(lista));
    resultado.appendChild(topo);
    resultado.appendChild(criar("span", "rotulo dica", "Vendido " + dinheiro(vendido) + " · Sua comissão " + dinheiro(comissao)));
    if (lista.length === 0) {
      resultado.appendChild(criar("span", "rotulo", "Nenhuma venda com esses filtros."));
      return;
    }
    for (const v of lista) resultado.appendChild(linhaVenda(v));
  }

  busca.campo.addEventListener("input", () => { f.busca = busca.campo.value; atualizarLista(); });
  periodo.campo.addEventListener("change", () => { f.periodo = periodo.campo.value; atualizarLista(); });
  produto.campo.addEventListener("change", () => { f.produto = produto.campo.value; atualizarLista(); });
  atualizarLista();
}

async function exportarCSV(lista) {
  const f = estado.filtros;
  const nome = ("blendsell-" + (f.periodo === "mes" ? estado.ano + "-" + dois(estado.mes) : f.periodo === "ano" ? estado.ano : "tudo") +
    (f.produto ? "-" + f.produto : "")).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9-]+/g, "-").toLowerCase();
  try {
    const r = await pedir(window.blendsell.exportarCSV(lista.map((v) => v.id), nome));
    if (!r.cancelado) mostrarAviso(r.quantidade + " vendas exportadas em CSV");
  } catch (e) {
    mostrarAviso("Não deu pra exportar: " + e.message);
  }
}

// =====================================================================
// TELA 3: PRODUTOS
// =====================================================================
function desenharProdutos() {
  conteudo.appendChild(cabecalho("Produtos", false));

  // As regras de comissão, cadastradas pelo usuário
  const regras = criar("div", "glass painel");
  const topoR = criar("div", "painel-topo");
  topoR.appendChild(criar("h2", "", "Suas regras de comissão"));
  botaoCard(topoR, "Novo tipo", SVG_MAIS, () => abrirTipo(null));
  regras.appendChild(topoR);
  regras.appendChild(criar("span", "rotulo dica", estado.tipos.length === 0
    ? "Cadastre cada tipo de venda e quanto você ganha nele (ex.: “Acessórios · 4%”). A % pode ser fixa ou mudar conforme o preço. Enquanto não tiver nenhum, use “Outro” e digite a % na hora."
    : "Clique num tipo pra mudar a % ou remover. Vendas já registradas guardam a % da época e não mudam."));
  const gradeR = criar("div", "regras");
  for (const t of estado.tipos) {
    const r = criar("button", "regra regra-botao");
    r.type = "button";
    r.addEventListener("click", () => abrirTipo(t));
    r.appendChild(criar("span", "regra-pct", t.limite ? percentual(t.pctAcima) + " / " + percentual(t.pctAbaixo) : percentual(t.pct)));
    r.appendChild(criar("span", "forte", t.nome));
    r.appendChild(criar("span", "rotulo pequena", explicacaoDoTipo(t)));
    gradeR.appendChild(r);
  }
  regras.appendChild(gradeR);
  conteudo.appendChild(regras);

  const painel = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  const ativos = produtosAtivos();
  topo.appendChild(criar("h2", "", ativos.length + (ativos.length === 1 ? " produto salvo" : " produtos salvos")));
  botaoCard(topo, "Novo produto", SVG_MAIS, () => abrirProduto(null));
  painel.appendChild(topo);
  painel.appendChild(criar("span", "rotulo dica",
    "Opcional: salve aqui o que você vende sempre (um modelo, um serviço). Na hora da venda é só escolher, e o preço e o tipo vêm prontos."));

  const grade = criar("div", "grade");
  for (const p of ativos) {
    const tipoId = p.tipo || "outro";
    const pct = pctDoTipo(tipoId, p.preco, p.comissao);
    const item = criar("button", "glass lift item item-botao produto");
    item.type = "button";
    item.addEventListener("click", () => abrirProduto(p));
    item.appendChild(criar("span", "item-titulo", p.nome));
    item.appendChild(criar("span", "rotulo", dinheiro(p.preco) + " · " + nomeDoTipo(tipoId).split(" (")[0] + " · " + percentual(pct)));
    const ganho = criar("span", "produto-ganho");
    ganho.appendChild(criar("span", "rotulo pequena", "Você ganha por unidade"));
    ganho.appendChild(criar("span", "numero numero-menor positivo", dinheiro(calcular(p.preco, 1, pct, 0).comissao)));
    item.appendChild(ganho);
    grade.appendChild(item);
  }
  painel.appendChild(grade);
  conteudo.appendChild(painel);
}

// ===== Novo tipo de comissão / editar =====
function abrirTipo(t) {
  const corpo = criar("div", "formulario");
  const nome = campoComEtiqueta("Nome do tipo", "input", { type: "text", placeholder: "Ex.: Acessórios, Serviço, Produto premium", autocomplete: "off", maxlength: "60" });
  corpo.appendChild(nome.grupo);

  const modo = criar("div", "segmento");
  modo.setAttribute("role", "radiogroup");
  for (const [valor, texto] of [["fixa", "% fixa"], ["faixa", "% muda pelo preço"]]) {
    const rotulo = criar("label", "segmento-opcao");
    const radio = criar("input");
    radio.type = "radio";
    radio.name = "modo-tipo";
    radio.value = valor;
    radio.checked = valor === (t && t.limite ? "faixa" : "fixa");
    rotulo.appendChild(radio);
    rotulo.appendChild(criar("span", "", texto));
    modo.appendChild(rotulo);
  }
  corpo.appendChild(modo);

  const pct = campoComEtiqueta("Comissão (%)", "input", { type: "text", inputmode: "decimal", placeholder: "4", autocomplete: "off" });
  corpo.appendChild(pct.grupo);

  const faixa = criar("div", "formulario");
  const limite = campoComEtiqueta("A partir de qual preço (de UMA unidade)?", "input", { type: "text", inputmode: "decimal", placeholder: "20.000,00", autocomplete: "off" });
  const linha = criar("div", "linha-dupla");
  const acima = campoComEtiqueta("% desse preço pra cima", "input", { type: "text", inputmode: "decimal", placeholder: "2", autocomplete: "off" });
  const abaixo = campoComEtiqueta("% abaixo desse preço", "input", { type: "text", inputmode: "decimal", placeholder: "2,5", autocomplete: "off" });
  linha.appendChild(acima.grupo);
  linha.appendChild(abaixo.grupo);
  faixa.appendChild(limite.grupo);
  faixa.appendChild(linha);
  corpo.appendChild(faixa);

  const previa = criar("div", "previa-comissao");
  corpo.appendChild(previa);

  if (t) {
    nome.campo.value = t.nome;
    if (t.limite) {
      limite.campo.value = valorParaCampo(t.limite);
      acima.campo.value = pctParaCampo(t.pctAcima);
      abaixo.campo.value = pctParaCampo(t.pctAbaixo);
    } else {
      pct.campo.value = pctParaCampo(t.pct);
    }
  }

  function modoAtual() { return corpo.querySelector("input[name=modo-tipo]:checked").value; }
  function atualizar() {
    const ehFaixa = modoAtual() === "faixa";
    pct.grupo.hidden = ehFaixa;
    faixa.hidden = !ehFaixa;
    if (ehFaixa) {
      const l = lerValor(limite.campo.value);
      const a = lerPct(acima.campo.value);
      const b = lerPct(abaixo.campo.value);
      previa.textContent = l && a !== null && b !== null
        ? "Ex.: uma venda de " + dinheiroSempre(l) + " rende " + dinheiroSempre(calcular(l, 1, a, 0).comissao) + " (" + percentual(a) + "). Abaixo desse preço, " + percentual(b) + "."
        : "";
    } else {
      const p = lerPct(pct.campo.value);
      previa.textContent = p !== null ? "Ex.: numa venda de R$ 1.000,00 você recebe " + dinheiroSempre(calcular(100000, 1, p, 0).comissao) + "." : "";
    }
  }
  modo.addEventListener("change", atualizar);
  for (const c of [pct, limite, acima, abaixo]) c.campo.addEventListener("input", atualizar);
  atualizar();

  const extras = [];
  if (t) {
    let confirmando = false;
    const remover = botao("Remover", "btn-perigo", async () => {
      if (!confirmando) { confirmando = true; remover.lastChild.textContent = "Clique de novo pra remover"; return; }
      try {
        await pedir(window.blendsell.removerTipo(t.id));
        fecharJanela();
        mostrarAviso("Tipo removido. As vendas antigas dele continuam como estavam.");
        await recarregar();
      } catch (e) { mostrarErroJanela(e.message); }
    });
    extras.push(remover);
  }

  abrirJanela({
    titulo: t ? "Editar tipo de comissão" : "Novo tipo de comissão", corpo: corpo, textoOk: "Salvar tipo", extras: extras,
    aoConfirmar: async () => {
      const r = await pedir(window.blendsell.salvarTipo({
        id: t ? t.id : null, nome: nome.campo.value, modo: modoAtual(),
        pct: pct.campo.value, limite: limite.campo.value, pctAcima: acima.campo.value, pctAbaixo: abaixo.campo.value,
      }));
      mostrarAviso("Tipo salvo: " + r.tipo.nome);
      await recarregar();
    },
  });
}

function abrirProduto(p) {
  const corpo = criar("div", "formulario");
  const nome = campoComEtiqueta("Nome", "input", { type: "text", placeholder: "Ex.: Modelo X", autocomplete: "off" });
  const preco = campoComEtiqueta("Preço (R$)", "input", { type: "text", inputmode: "decimal", placeholder: "15.000,00", autocomplete: "off" });
  const tipo = campoComEtiqueta("Tipo", "select");
  selectDeTipos(tipo.campo, p ? p.tipo || "outro" : tipoPadrao());
  const pct = campoComEtiqueta("Comissão (%)", "input", { type: "text", inputmode: "decimal", autocomplete: "off" });
  if (p) {
    nome.campo.value = p.nome;
    preco.campo.value = valorParaCampo(p.preco);
    if (p.comissao) pct.campo.value = pctParaCampo(p.comissao);
  }
  corpo.appendChild(nome.grupo);
  const linha = criar("div", "linha-dupla");
  linha.appendChild(preco.grupo);
  linha.appendChild(tipo.grupo);
  corpo.appendChild(linha);
  corpo.appendChild(pct.grupo);
  const previa = criar("div", "previa-comissao");
  corpo.appendChild(previa);
  function atualizar() {
    const t = acharTipo(tipo.campo.value);
    pct.grupo.hidden = !t.manual;
    const v = lerValor(preco.campo.value);
    const c = v ? pctDoTipo(t.id, v, lerPct(pct.campo.value)) : null;
    previa.textContent = v && c !== null ? "A cada unidade vendida, você recebe " + dinheiro(calcular(v, 1, c, 0).comissao) + " (" + percentual(c) + ")." : "";
  }
  tipo.campo.addEventListener("change", atualizar);
  preco.campo.addEventListener("input", atualizar);
  pct.campo.addEventListener("input", atualizar);
  atualizar();

  const extras = [];
  if (p) {
    let confirmando = false;
    const remover = botao("Remover", "btn-perigo", async () => {
      if (!confirmando) { confirmando = true; remover.lastChild.textContent = "Clique de novo pra remover"; return; }
      try {
        const r = await pedir(window.blendsell.removerProduto(p.id));
        fecharJanela();
        mostrarAviso(r.arquivado ? "Produto arquivado (as vendas antigas dele continuam salvas)" : "Produto removido");
        await recarregar();
      } catch (e) { mostrarErroJanela(e.message); }
    });
    extras.push(remover);
  }

  abrirJanela({
    titulo: p ? "Editar produto" : "Novo produto", corpo: corpo, textoOk: "Salvar produto", extras: extras,
    aoConfirmar: async () => {
      const r = await pedir(window.blendsell.salvarProduto({ id: p ? p.id : null, nome: nome.campo.value, preco: preco.campo.value, tipo: tipo.campo.value, comissao: pct.campo.value }));
      mostrarAviso("Produto salvo: " + r.produto.nome);
      await recarregar();
    },
  });
}

// =====================================================================
// NOVA VENDA (com a sua parte calculada ao vivo)
// =====================================================================
function abrirNovaVenda(inicial) {
  inicial = inicial || {};
  const corpo = criar("div", "formulario");

  const produto = campoComEtiqueta("Produto salvo (opcional)", "select");
  produto.campo.appendChild(opcao("", "Nenhum, vou digitar"));
  for (const p of produtosAtivos()) produto.campo.appendChild(opcao(p.id, p.nome, p.id === inicial.produtoId));
  const tipo = campoComEtiqueta("Tipo de venda", "select");
  selectDeTipos(tipo.campo, inicial.tipo || tipoPadrao());
  const descricao = campoComEtiqueta("O que foi vendido", "input", { type: "text", placeholder: "Ex.: Modelo X", autocomplete: "off" });
  const preco = campoComEtiqueta("Preço unitário (R$)", "input", { type: "text", inputmode: "decimal", autocomplete: "off" });
  const qtd = campoComEtiqueta("Quantidade", "input", { type: "number", min: "1", value: inicial.quantidade || "1" });
  const pct = campoComEtiqueta("Comissão (%)", "input", { type: "text", inputmode: "decimal", autocomplete: "off" });
  const desconto = campoComEtiqueta("Desconto (R$, opcional)", "input", { type: "text", inputmode: "decimal", placeholder: "0,00", autocomplete: "off" });
  const cliente = campoComEtiqueta("Cliente (opcional)", "input", { type: "text", autocomplete: "off" });
  const data = campoComEtiqueta("Data", "input", { type: "date" });
  data.campo.value = hojeISO();

  const l0 = criar("div", "linha-dupla");
  l0.appendChild(produto.grupo); l0.appendChild(tipo.grupo);
  corpo.appendChild(l0);
  corpo.appendChild(descricao.grupo);
  const l1 = criar("div", "linha-tripla");
  l1.appendChild(preco.grupo); l1.appendChild(qtd.grupo); l1.appendChild(pct.grupo); l1.appendChild(desconto.grupo);
  corpo.appendChild(l1);
  const l2 = criar("div", "linha-dupla");
  l2.appendChild(cliente.grupo); l2.appendChild(data.grupo);
  corpo.appendChild(l2);

  const previa = criar("div", "calc-resultado calc-resultado-modal");
  const textos = criar("div", "calc-textos");
  textos.appendChild(criar("span", "rotulo", "Você recebe"));
  const valor = criar("span", "calc-valor", "R$ 0,00");
  const detalhe = criar("span", "rotulo calc-detalhe", "");
  textos.appendChild(valor);
  textos.appendChild(detalhe);
  previa.appendChild(textos);
  corpo.appendChild(previa);

  function preencherDoProduto() {
    const p = estado.produtos.find((x) => x.id === produto.campo.value);
    descricao.grupo.hidden = !!p;
    if (p) {
      preco.campo.value = valorParaCampo(p.preco);
      tipo.campo.value = p.tipo || "outro";
      if (p.comissao) pct.campo.value = pctParaCampo(p.comissao);
    }
  }
  function atualizar() {
    const t = acharTipo(tipo.campo.value);
    pct.grupo.hidden = !t.manual;
    const p = lerValor(preco.campo.value);
    const q = Math.max(1, parseInt(qtd.campo.value, 10) || 1);
    const d = lerValor(desconto.campo.value) || 0;
    if (!p) { valor.textContent = "R$ 0,00"; detalhe.textContent = "Digite o preço."; return; }
    const deUma = Comissao.valorDeUma(p, q, d);
    const c = pctDoTipo(t.id, deUma, lerPct(pct.campo.value));
    if (c === null) { valor.textContent = "R$ 0,00"; detalhe.textContent = "Digite a % de comissão (de 0 a 100)."; return; }
    const conta = calcular(p, q, c, d);
    valor.textContent = dinheiro(conta.comissao);
    detalhe.textContent = percentual(c) + " (" + motivoDaPct(t.id, deUma) + ") de " + dinheiro(conta.total) +
      (d ? " · já com " + dinheiro(d) + " de desconto" : "");
  }

  produto.campo.addEventListener("change", () => { preencherDoProduto(); atualizar(); });
  tipo.campo.addEventListener("change", atualizar);
  for (const c of [preco, qtd, pct, desconto]) c.campo.addEventListener("input", atualizar);
  preencherDoProduto();
  if (inicial.preco) preco.campo.value = inicial.preco;
  if (inicial.comissao) pct.campo.value = inicial.comissao;
  atualizar();

  abrirJanela({
    titulo: "Nova venda", corpo: corpo, textoOk: "Registrar venda",
    aoConfirmar: async () => {
      const r = await pedir(window.blendsell.adicionarVenda({
        produtoId: produto.campo.value, descricao: descricao.campo.value, tipo: tipo.campo.value, preco: preco.campo.value,
        quantidade: qtd.campo.value, comissao: pct.campo.value, desconto: desconto.campo.value, cliente: cliente.campo.value, data: data.campo.value,
      }));
      mostrarAviso("Venda registrada · você recebe " + dinheiro(r.venda.comissao));
      estado.mes = r.venda.data.mes;
      estado.ano = r.venda.data.ano;
      await recarregar();
    },
  });
}

function abrirDetalhesVenda(v) {
  const corpo = criar("div", "formulario");
  const resumo = criar("div", "resumo-transacao");
  resumo.appendChild(criar("span", "item-titulo", (v.quantidade > 1 ? v.quantidade + "× " : "") + v.produto));
  resumo.appendChild(criar("span", "rotulo", dataLonga(v.data) + (v.cliente ? " · " + v.cliente : "")));
  corpo.appendChild(resumo);
  const linhas = [
    ["Tipo", v.tipo ? nomeDaVenda(v) : "—"],
    ["Preço unitário", dinheiro(v.precoUnitario)],
    ["Quantidade", String(v.quantidade)],
    ["Desconto", dinheiro(v.desconto || 0)],
    ["Total da venda", dinheiro(v.total)],
    ["Sua comissão (" + percentual(v.comissaoPct) + ")", dinheiro(v.comissao)],
  ];
  const tabela = criar("div", "detalhes-venda");
  for (const [k, val] of linhas) {
    const l = criar("div", "detalhe-linha");
    l.appendChild(criar("span", "rotulo", k));
    l.appendChild(criar("span", "forte", val));
    tabela.appendChild(l);
  }
  corpo.appendChild(tabela);

  let confirmando = false;
  const excluir = botao("Excluir venda", "btn-perigo", async () => {
    if (!confirmando) { confirmando = true; excluir.lastChild.textContent = "Clique de novo pra excluir"; return; }
    try {
      await pedir(window.blendsell.excluirVenda(v.id));
      fecharJanela();
      mostrarAviso("Venda excluída");
      await recarregar();
    } catch (e) { mostrarErroJanela(e.message); }
  });
  abrirJanela({ titulo: "Venda", corpo: corpo, textoOk: "Fechar", extras: [excluir], aoConfirmar: async () => true });
}

// =====================================================================
// BACKUP
// =====================================================================
document.getElementById("botao-exportar").addEventListener("click", async () => {
  try {
    const r = await pedir(window.blendsell.exportarBackup());
    if (!r.cancelado) mostrarAviso("Backup salvo com " + r.quantidade + " vendas");
  } catch (e) { mostrarAviso("Não deu pra salvar o backup: " + e.message); }
});

document.getElementById("botao-restaurar").addEventListener("click", async () => {
  let escolhido;
  try { escolhido = await pedir(window.blendsell.escolherBackup()); } catch (e) { mostrarAviso(e.message); return; }
  if (escolhido.cancelado) return;
  const corpo = criar("div", "formulario");
  corpo.appendChild(criar("p", "", "Isso troca as suas " + estado.vendas.length + " vendas e os produtos atuais pelo que está no backup (" + escolhido.quantidade + " vendas)."));
  corpo.appendChild(criar("p", "rotulo", "Antes de trocar, o app guarda uma cópia dos dados de agora."));
  abrirJanela({
    titulo: "Restaurar backup?", corpo: corpo, textoOk: "Restaurar",
    aoConfirmar: async () => {
      const r = await pedir(window.blendsell.restaurarBackup(escolhido.caminho));
      mostrarAviso("Backup restaurado: " + r.quantidade + " vendas");
      await recarregar();
    },
  });
});

// =====================================================================
// ANIMAÇÕES, LUZ DO MOUSE E BARRA DE ROLAGEM (iguais às do Blendercash)
// =====================================================================
const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;

function animarEntrada() {
  if (!suave) return;
  const alvos = [];
  for (const filho of conteudo.children) {
    if (filho.matches(".cards, .paineis")) alvos.push(...filho.children); else alvos.push(filho);
  }
  alvos.forEach((el, i) => {
    el.style.setProperty("--atraso", Math.min(i * 70, 770) + "ms");
    el.classList.add("entrando");
    el.addEventListener("animationend", () => el.classList.remove("entrando"), { once: true });
  });
}

function contarNumeros() {
  if (estado.privado || !suave) return;
  const inicio = performance.now();
  const alvos = [...conteudo.querySelectorAll("[data-centavos], [data-contagem]")].map((el) => {
    const bloco = el.closest(".entrando");
    const atraso = bloco ? parseFloat(bloco.style.getPropertyValue("--atraso")) || 0 : 0;
    const ehDinheiro = el.dataset.centavos !== undefined;
    el.textContent = ehDinheiro ? dinheiro(0) : "0";
    return { el: el, alvo: Number(ehDinheiro ? el.dataset.centavos : el.dataset.contagem), dinheiro: ehDinheiro, comeca: inicio + atraso };
  });
  if (alvos.length === 0) return;
  function quadro(agora) {
    let terminou = true;
    for (const n of alvos) {
      const t = Math.min(1, Math.max(0, (agora - n.comeca) / 720));
      const freio = 1 - Math.pow(1 - t, 3);
      const atual = Math.round(n.alvo * freio);
      n.el.textContent = n.dinheiro ? dinheiro(atual) : String(atual);
      if (t < 1) terminou = false;
    }
    if (!terminou) requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}

let quadroLuz = null;
document.addEventListener("pointermove", (e) => {
  if (quadroLuz) return;
  quadroLuz = requestAnimationFrame(() => {
    quadroLuz = null;
    let vidro = e.target.closest ? e.target.closest(".glass") : null;
    while (vidro) {
      const caixa = vidro.getBoundingClientRect();
      const escala = vidro.offsetWidth / caixa.width || 1;
      vidro.style.setProperty("--mx", (e.clientX - caixa.left) * escala + "px");
      vidro.style.setProperty("--my", (e.clientY - caixa.top) * escala + "px");
      vidro = vidro.parentElement ? vidro.parentElement.closest(".glass") : null;
    }
  });
});

const rolagem = document.getElementById("rolagem");
const traco = document.getElementById("rolagem-traco");
let posAtual = 0, posAlvo = 0, alturaTraco = 40, animandoTraco = false, arrastando = false, esconderTraco;
function medirRolagem() {
  const total = document.documentElement.scrollHeight;
  const visivel = window.innerHeight;
  if (total <= visivel + 1) { rolagem.classList.add("sem-rolagem"); return false; }
  rolagem.classList.remove("sem-rolagem");
  const trilho = visivel - 16;
  alturaTraco = Math.max(40, (trilho * visivel) / total);
  posAlvo = (window.scrollY / (total - visivel)) * (trilho - alturaTraco);
  traco.style.height = alturaTraco + "px";
  return true;
}
function animarTraco() {
  posAtual = suave ? posAtual + (posAlvo - posAtual) * 0.2 : posAlvo;
  if (Math.abs(posAlvo - posAtual) < 0.25) posAtual = posAlvo;
  traco.style.transform = "translateY(" + posAtual.toFixed(2) + "px)";
  if (posAtual !== posAlvo) requestAnimationFrame(animarTraco); else animandoTraco = false;
}
function mostrarRolagem() {
  if (!medirRolagem()) return;
  rolagem.classList.add("visivel");
  if (!animandoTraco) { animandoTraco = true; requestAnimationFrame(animarTraco); }
  clearTimeout(esconderTraco);
  esconderTraco = setTimeout(() => { if (!arrastando && !rolagem.matches(":hover")) rolagem.classList.remove("visivel"); }, 1000);
}
window.addEventListener("scroll", mostrarRolagem, { passive: true });
window.addEventListener("resize", mostrarRolagem);
document.addEventListener("mousemove", (e) => { if (window.innerWidth - e.clientX < 28) mostrarRolagem(); });
new ResizeObserver(() => { medirRolagem(); posAtual = posAlvo; traco.style.transform = "translateY(" + posAtual + "px)"; }).observe(document.body);
let inicioY = 0, inicioScroll = 0;
traco.addEventListener("pointerdown", (e) => { arrastando = true; inicioY = e.clientY; inicioScroll = window.scrollY; traco.setPointerCapture(e.pointerId); rolagem.classList.add("arrastando"); e.preventDefault(); });
traco.addEventListener("pointermove", (e) => {
  if (!arrastando) return;
  const total = document.documentElement.scrollHeight, visivel = window.innerHeight;
  window.scrollTo(0, inicioScroll + (e.clientY - inicioY) * (total - visivel) / (visivel - 16 - alturaTraco));
});
traco.addEventListener("pointerup", () => { arrastando = false; rolagem.classList.remove("arrastando"); mostrarRolagem(); });

// ===== Começar! =====
recarregar();
