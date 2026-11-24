// =====================================================================
// O "CÉREBRO" DO BLENDSELL
// Produtos, vendas, comissão e metas. Quem usa: o main.js.
//
// Dinheiro sempre em CENTAVOS (número inteiro), igual no Blendercash.
// Porcentagem sempre em "pontos-base": 1% = 100, 12,5% = 1250.
// Assim nenhuma conta usa número quebrado, e não aparece erro de arredondamento.
// =====================================================================
const fs = require("fs");
const path = require("path");
const C = require("../renderer/comissao");
const { converterValor, converterPercentual, acharTipo, percentualDoTipo, calcular } = C;

const ARQUIVO_PRODUTOS = "produtos.json";
const ARQUIVO_VENDAS = "vendas.json";
const ARQUIVO_CONFIG = "config.json";

// ===== Ler e salvar .json (salvar é "atômico": grava num temporário e troca) =====
function lerJSON(caminho, padrao) {
  if (!fs.existsSync(caminho)) return padrao;
  return JSON.parse(fs.readFileSync(caminho, "utf-8"));
}

// Antes de gravar, a versão atual vira ".anterior": se o arquivo novo estragar, dá pra voltar um passo
function salvarJSON(caminho, conteudo) {
  const temporario = caminho + ".tmp";
  fs.writeFileSync(temporario, JSON.stringify(conteudo, null, 2), "utf-8");
  if (fs.existsSync(caminho)) fs.copyFileSync(caminho, caminho + ".anterior");
  fs.renameSync(temporario, caminho);
}

// Avisos de arquivos estragados encontrados ao carregar (o main mostra pro usuário)
const problemas = [];

// Lê um arquivo de dados sem nunca derrubar o app:
// estragado → guarda uma cópia, tenta o ".anterior", e em último caso começa vazio
function lerDados(caminho, padrao, validar) {
  if (!fs.existsSync(caminho)) return padrao;
  try {
    const dados = JSON.parse(fs.readFileSync(caminho, "utf-8"));
    if (validar && !validar(dados)) throw new Error("formato inesperado");
    return dados;
  } catch (erro) {
    const nome = path.basename(caminho);
    const copia = caminho + ".corrompido-" + new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(caminho, copia);
    try {
      const anterior = JSON.parse(fs.readFileSync(caminho + ".anterior", "utf-8"));
      if (validar && !validar(anterior)) throw new Error("formato inesperado");
      fs.writeFileSync(caminho, JSON.stringify(anterior, null, 2), "utf-8");
      problemas.push(nome + " estava estragado e foi recuperado da versão anterior. A última alteração pode ter se perdido.");
      return anterior;
    } catch {
      fs.writeFileSync(caminho, JSON.stringify(padrao, null, 2), "utf-8");
      problemas.push(nome + " estava estragado e não deu pra recuperar. Use \"Restaurar backup\" se tiver um. O arquivo original foi guardado em " + path.basename(copia) + ".");
      return padrao;
    }
  }
}

function tirarProblemas() {
  return problemas.splice(0, problemas.length);
}

function novoId(prefixo) {
  return prefixo + "|" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// "2026-11-17" → { dia, mes, ano }
function converterData(texto) {
  const partes = String(texto || "").split("-").map(Number);
  const [ano, mes, dia] = partes;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  if (partes.length !== 3 || !Number.isInteger(ano) || ano < 2000 || mes < 1 || mes > 12 || !Number.isInteger(dia) || dia < 1 || dia > ultimoDia) {
    throw new Error("Data inválida.");
  }
  return { dia: dia, mes: mes, ano: ano };
}

function numeroDaData(d) {
  return d.ano * 10000 + d.mes * 100 + d.dia;
}

function somarMeses(d, quantos) {
  const total = d.ano * 12 + (d.mes - 1) + quantos;
  return { dia: 1, mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}

function hojeComoData() {
  const agora = new Date();
  return { dia: agora.getDate(), mes: agora.getMonth() + 1, ano: agora.getFullYear() };
}

// =====================================================================
// PRODUTOS
// =====================================================================
function carregarProdutos(pasta) {
  return lerDados(path.join(pasta, ARQUIVO_PRODUTOS), [], Array.isArray);
}

function salvarProdutos(pasta, produtos) {
  salvarJSON(path.join(pasta, ARQUIVO_PRODUTOS), produtos);
}

// form = { id?, nome, preco: "199,90", tipo: "equipamento", comissao?: "12,5" (só no tipo "outro") }
function montarProduto(form, tipos) {
  const nome = String(form.nome || "").trim();
  if (nome === "") throw new Error("Escreva o nome do produto.");
  const tipo = acharTipo(tipos, form.tipo);
  return {
    id: form.id || novoId("prod"),
    nome: nome,
    preco: converterValor(form.preco),
    tipo: tipo.id,
    comissao: tipo.manual ? converterPercentual(form.comissao) : 0,
    ativo: true,
  };
}

// Cria um produto novo ou atualiza um que já existe (pelo id)
function salvarProduto(produtos, form, tipos) {
  const produto = montarProduto(form, tipos);
  const repetido = produtos.find((p) => p.ativo && p.id !== produto.id && p.nome.toUpperCase() === produto.nome.toUpperCase());
  if (repetido) throw new Error("Já existe um produto chamado “" + produto.nome + "”.");

  const posicao = produtos.findIndex((p) => p.id === produto.id);
  if (posicao >= 0) produtos[posicao] = produto;
  else produtos.push(produto);
  return produto;
}

// Produto que já tem venda não some: só fica "arquivado" (as vendas antigas guardam o nome dele)
function removerProduto(produtos, vendas, id) {
  const temVenda = vendas.some((v) => v.produtoId === id);
  if (temVenda) {
    const p = produtos.find((x) => x.id === id);
    if (p) p.ativo = false;
    return { arquivado: true };
  }
  const posicao = produtos.findIndex((p) => p.id === id);
  if (posicao >= 0) produtos.splice(posicao, 1);
  return { arquivado: false };
}

// =====================================================================
// VENDAS
// =====================================================================
function carregarVendas(pasta) {
  return lerDados(path.join(pasta, ARQUIVO_VENDAS), [], Array.isArray);
}

function salvarVendas(pasta, vendas) {
  salvarJSON(path.join(pasta, ARQUIVO_VENDAS), vendas);
}

// form = { produtoId | "" (venda avulsa), descricao?, tipo: "<id do tipo>", preco: "199,90", quantidade: "2",
//          comissao?: "12,5" (só no tipo "outro"), desconto?: "10,00", cliente?, data: "2026-11-17" }
// O tipo decide a %. A venda GUARDA o tipo e a % usados: se a regra mudar um dia, as vendas antigas não mudam.
function criarVenda(form, produtos, tipos) {
  const produto = form.produtoId ? produtos.find((p) => p.id === form.produtoId) : null;
  if (form.produtoId && !produto) throw new Error("Produto não encontrado.");

  const nome = produto ? produto.nome : String(form.descricao || "").trim();
  if (nome === "") throw new Error("Escolha um produto ou escreva o que foi vendido.");

  const quantidade = Number(String(form.quantidade || "1").replace(",", "."));
  if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error("A quantidade tem que ser um número inteiro, 1 ou mais.");

  const precoUnitario = converterValor(form.preco);
  if (precoUnitario === 0) throw new Error("O preço não pode ser zero.");
  const desconto = String(form.desconto || "").trim() === "" ? 0 : converterValor(form.desconto);
  if (desconto >= precoUnitario * quantidade) throw new Error("O desconto não pode ser maior que o valor da venda.");

  const tipo = acharTipo(tipos, form.tipo || (produto && produto.tipo));
  const pctManual = tipo.manual ? converterPercentual(form.comissao) : 0;
  const comissaoPct = percentualDoTipo(tipos, tipo.id, C.valorDeUma(precoUnitario, quantidade, desconto), pctManual);
  const conta = calcular(precoUnitario, quantidade, comissaoPct, desconto);

  return {
    id: novoId("venda"),
    data: converterData(form.data),
    produtoId: produto ? produto.id : null,
    produto: nome,
    tipo: tipo.id,
    tipoNome: tipo.nome,
    quantidade: quantidade,
    precoUnitario: precoUnitario,
    desconto: desconto,
    comissaoPct: comissaoPct,
    total: conta.total,
    comissao: conta.comissao,
    cliente: String(form.cliente || "").trim(),
    criadaEm: new Date().toISOString(),
  };
}

function ordenarPorData(vendas) {
  return vendas.slice().sort((a, b) => numeroDaData(b.data) - numeroDaData(a.data) || (b.criadaEm || "").localeCompare(a.criadaEm || ""));
}

function vendasDoMes(vendas, mes, ano) {
  return vendas.filter((v) => v.data.mes === mes && v.data.ano === ano);
}

// =====================================================================
// RELATÓRIOS
// =====================================================================
function resumo(lista) {
  let vendido = 0;
  let comissao = 0;
  let itens = 0;
  for (const v of lista) {
    vendido += v.total;
    comissao += v.comissao;
    itens += v.quantidade;
  }
  return {
    vendido: vendido,
    comissao: comissao,
    vendas: lista.length,
    itens: itens,
    ticketMedio: lista.length > 0 ? Math.round(vendido / lista.length) : 0,
    percentualMedio: vendido > 0 ? Math.round((comissao / vendido) * 10000) : 0, // em pontos-base
  };
}

// Comissão e vendido mês a mês (do mais antigo pro mais novo), terminando em mes/ano
function serieMensal(vendas, mes, ano, quantos) {
  const serie = [];
  for (let k = quantos - 1; k >= 0; k--) {
    const m = somarMeses({ dia: 1, mes: mes, ano: ano }, -k);
    const r = resumo(vendasDoMes(vendas, m.mes, m.ano));
    serie.push({ mes: m.mes, ano: m.ano, comissao: r.comissao, vendido: r.vendido, vendas: r.vendas });
  }
  return serie;
}

// Quais produtos mais te renderam comissão
function rankingProdutos(lista) {
  const grupos = {};
  for (const v of lista) {
    const g = grupos[v.produto] || (grupos[v.produto] = { produto: v.produto, quantidade: 0, vendido: 0, comissao: 0 });
    g.quantidade += v.quantidade;
    g.vendido += v.total;
    g.comissao += v.comissao;
  }
  return Object.values(grupos).sort((a, b) => b.comissao - a.comissao);
}

// O nome do tipo fica guardado na venda; se for uma venda antiga sem ele, procura nos tipos atuais
function nomeDoTipoDaVenda(venda, tipos) {
  if (venda.tipoNome) return venda.tipoNome;
  const t = C.listaDeTipos(tipos).find((x) => x.id === venda.tipo);
  return t ? t.nome : "Outro";
}

// Quanto de comissão veio de cada tipo
function comissaoPorTipo(lista, tipos) {
  const grupos = {};
  for (const v of lista) {
    const id = v.tipo || "outro";
    const g = grupos[id] || (grupos[id] = { tipo: id, nome: nomeDoTipoDaVenda(v, tipos), quantidade: 0, vendido: 0, comissao: 0 });
    g.quantidade += v.quantidade;
    g.vendido += v.total;
    g.comissao += v.comissao;
  }
  return Object.values(grupos).sort((a, b) => b.comissao - a.comissao);
}

// ===== Tipos de comissão (cadastrados pelo usuário, guardados em config.tipos) =====
function tiposDe(config) {
  return Array.isArray(config.tipos) ? config.tipos : [];
}

function salvarTipo(config, form) {
  const tipos = tiposDe(config);
  if (form.id && !tipos.some((t) => t.id === form.id)) throw new Error("Tipo não encontrado.");
  const tipo = C.montarTipo(form, tipos, form.id || null);
  const posicao = tipos.findIndex((t) => t.id === tipo.id);
  if (posicao >= 0) tipos[posicao] = tipo;
  else tipos.push(tipo);
  config.tipos = tipos;
  return tipo;
}

// Vendas antigas guardam a % e o nome do tipo, então não mudam.
// Só não deixa apagar um tipo que algum produto salvo ainda usa.
function removerTipo(config, produtos, id) {
  const tipos = tiposDe(config);
  if (!tipos.some((t) => t.id === id)) throw new Error("Tipo não encontrado.");
  const usando = produtos.filter((p) => p.ativo && p.tipo === id);
  if (usando.length > 0) {
    throw new Error("Esse tipo é usado por " + usando.length + (usando.length === 1 ? " produto" : " produtos") +
      " (" + usando.slice(0, 3).map((p) => p.nome).join(", ") + "). Troque o tipo deles antes.");
  }
  config.tipos = tipos.filter((t) => t.id !== id);
}

// Meta do mês + projeção ("nesse ritmo, você fecha o mês com...")
function progressoMeta(comissaoDoMes, meta, mes, ano, hoje) {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const ehMesAtual = mes === hoje.mes && ano === hoje.ano;
  const ehPassado = ano * 12 + mes < hoje.ano * 12 + hoje.mes;
  const diasPassados = ehMesAtual ? hoje.dia : ehPassado ? diasNoMes : 0;

  const projecao = ehMesAtual && diasPassados > 0 ? Math.round((comissaoDoMes / diasPassados) * diasNoMes) : comissaoDoMes;
  const falta = meta > 0 ? Math.max(0, meta - comissaoDoMes) : 0;
  const diasRestantes = ehMesAtual ? diasNoMes - hoje.dia : 0;

  return {
    meta: meta,
    atingido: comissaoDoMes,
    fracao: meta > 0 ? comissaoDoMes / meta : 0,
    falta: falta,
    projecao: projecao,
    diasRestantes: diasRestantes,
    porDiaParaBater: diasRestantes > 0 ? Math.ceil(falta / diasRestantes) : falta,
    ehMesAtual: ehMesAtual,
  };
}

// =====================================================================
// CONFIGURAÇÕES (meta) E BACKUP
// =====================================================================
function carregarConfig(pasta) {
  return lerDados(path.join(pasta, ARQUIVO_CONFIG), { metaComissao: 0 }, (c) => c !== null && typeof c === "object" && !Array.isArray(c));
}

function salvarConfig(pasta, config) {
  salvarJSON(path.join(pasta, ARQUIVO_CONFIG), config);
}

function formatarDinheiro(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(pontosBase) {
  return (pontosBase / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
}

function gerarCSV(lista, tipos) {
  const campo = (t) => (/[;"\r\n]/.test(String(t)) ? '"' + String(t).replaceAll('"', '""') + '"' : String(t));
  const valor = (c) => (c / 100).toFixed(2).replace(".", ",");
  const data = (d) => String(d.dia).padStart(2, "0") + "/" + String(d.mes).padStart(2, "0") + "/" + d.ano;
  const linhas = ["Data;Tipo;Produto;Cliente;Quantidade;Preço unitário;Desconto;Total;% comissão;Comissão"];
  for (const v of lista) {
    linhas.push([data(v.data), campo(nomeDoTipoDaVenda(v, tipos)), campo(v.produto), campo(v.cliente || ""), v.quantidade, valor(v.precoUnitario),
      valor(v.desconto || 0), valor(v.total), (v.comissaoPct / 100).toFixed(2).replace(".", ","), valor(v.comissao)].join(";"));
  }
  return "﻿" + linhas.join("\r\n") + "\r\n";
}

function montarBackup(produtos, vendas, config) {
  return { app: "BlendSell", versao: 1, exportadoEm: new Date().toISOString(), produtos: produtos, vendas: vendas, config: config };
}

function validarBackup(b) {
  if (!b || !["BlendSell", "Vendacash"].includes(b.app) || !Array.isArray(b.produtos) || !Array.isArray(b.vendas)) {
    throw new Error("Esse arquivo não é um backup do BlendSell.");
  }
  for (const p of b.produtos) {
    if (!p || !p.id || typeof p.nome !== "string" || typeof p.preco !== "number") throw new Error("O backup tem um produto estragado.");
  }
  if (b.config !== undefined && (b.config === null || typeof b.config !== "object")) throw new Error("O backup tem configurações estragadas.");
  if (b.config && b.config.tipos !== undefined) {
    const ok = Array.isArray(b.config.tipos) && b.config.tipos.every((t) => t && t.id && typeof t.nome === "string" &&
      (typeof t.pct === "number" || (typeof t.limite === "number" && typeof t.pctAcima === "number" && typeof t.pctAbaixo === "number")));
    if (!ok) throw new Error("O backup tem um tipo de comissão estragado.");
  }
  for (const v of b.vendas) {
    if (!v || !v.id || !v.data || typeof v.total !== "number" || typeof v.comissao !== "number") {
      throw new Error("O backup tem uma venda estragada.");
    }
  }
  return b;
}

module.exports = {
  lerJSON, salvarJSON, lerDados, tirarProblemas, converterValor, converterPercentual, converterData, numeroDaData, hojeComoData,
  acharTipo, percentualDoTipo, comissaoPorTipo, nomeDoTipoDaVenda, tiposDe, salvarTipo, removerTipo,
  calcular, carregarProdutos, salvarProdutos, salvarProduto, removerProduto,
  carregarVendas, salvarVendas, criarVenda, ordenarPorData, vendasDoMes,
  resumo, serieMensal, rankingProdutos, progressoMeta,
  carregarConfig, salvarConfig, formatarDinheiro, formatarPercentual, gerarCSV, montarBackup, validarBackup,
};
