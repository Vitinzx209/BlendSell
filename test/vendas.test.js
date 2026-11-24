const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const C = require("../renderer/comissao");
const v = require("../src/vendas");

function pastaTemporaria() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "blendsell-teste-"));
}

const config = { metaComissao: 0 };
const T = {
  faixa: v.salvarTipo(config, { nome: "Premium", modo: "faixa", limite: "20.000,00", pctAcima: "2", pctAbaixo: "2,5" }).id,
  semi: v.salvarTipo(config, { nome: "Usado", modo: "fixa", pct: "2,5" }).id,
  acess: v.salvarTipo(config, { nome: "Acessório", modo: "fixa", pct: "4" }).id,
  serv: v.salvarTipo(config, { nome: "Serviço", modo: "fixa", pct: "5" }).id,
};
const tipos = v.tiposDe(config);
const venda = (campos) => v.criarVenda({ descricao: "Item", quantidade: "1", data: "2026-11-10", ...campos }, [], tipos);

describe("converterValor: texto → centavos", () => {
  const casos = [
    ["10,50", 1050], ["10.50", 1050], ["10.5", 1050], ["10,5", 1050],
    ["1.234,56", 123456], ["1,234.56", 123456], ["15.000", 1500000], ["15.000,00", 1500000],
    ["1.000.000", 100000000], ["R$ 99", 9900], ["R$ 1.299,90", 129990], ["0,01", 1], ["0,29", 29], ["1,15", 115],
  ];
  for (const [texto, esperado] of casos) {
    test(texto + " → " + esperado, () => assert.equal(C.converterValor(texto), esperado));
  }

  test("recusa vazio, negativo, letras e 3 casas decimais", () => {
    assert.throws(() => C.converterValor(""), /Digite um valor/);
    assert.throws(() => C.converterValor("-10"), /negativo/);
    assert.throws(() => C.converterValor("10abc"), /inválido/);
    assert.throws(() => C.converterValor("10,555"), /2 casas/);
    assert.throws(() => C.converterValor("1,2.3,4"), /inválido|2 casas/);
  });
});

describe("converterPercentual: texto → pontos-base", () => {
  test("12,5 / 12.5% / 8 / 0", () => {
    assert.equal(C.converterPercentual("12,5"), 1250);
    assert.equal(C.converterPercentual("12.5%"), 1250);
    assert.equal(C.converterPercentual("8"), 800);
    assert.equal(C.converterPercentual("0"), 0);
  });
  test("recusa acima de 100, negativo e lixo", () => {
    assert.throws(() => C.converterPercentual("101"), /entre 0 e 100/);
    assert.throws(() => C.converterPercentual("-1"), /inválida/);
    assert.throws(() => C.converterPercentual("abc"), /inválida/);
  });
});

describe("regras de comissão da loja", () => {
  test("tipo por faixa: de R$ 20 mil pra cima paga 2%", () => {
    const r = venda({ tipo: T.faixa, preco: "20.000,00" });
    assert.equal(r.comissaoPct, 200);
    assert.equal(r.comissao, 40000);
  });
  test("tipo por faixa: abaixo de R$ 20 mil paga 2,5%", () => {
    const r = venda({ tipo: T.faixa, preco: "19.999,99" });
    assert.equal(r.comissaoPct, 250);
    assert.equal(r.comissao, 50000);
  });
  test("o desconto pode tirar a venda da faixa de 2%", () => {
    const r = venda({ tipo: T.faixa, preco: "20.500,00", desconto: "1.000,00" });
    assert.equal(r.comissaoPct, 250);
    assert.equal(r.total, 1950000);
  });
  test("a faixa olha o preço de UMA unidade, não do total", () => {
    const r = venda({ tipo: T.faixa, preco: "12.000,00", quantidade: "2" });
    assert.equal(r.comissaoPct, 250);
  });
  test("seminova 2,5% · equipamento 4% · serviço 5%", () => {
    assert.equal(venda({ tipo: T.semi, preco: "1.000" }).comissao, 2500);
    assert.equal(venda({ tipo: T.acess, preco: "100" }).comissao, 400);
    assert.equal(venda({ tipo: T.serv, preco: "300" }).comissao, 1500);
  });
  test("tipo 'outro' usa a % digitada", () => {
    assert.equal(venda({ tipo: "outro", preco: "200", comissao: "12,5" }).comissao, 2500);
  });
  test("comissão arredonda pro centavo mais próximo", () => {
    assert.equal(C.calcular(333, 1, 250, 0).comissao, 8);
  });
  test("a venda guarda a % usada (se a regra mudar, a venda antiga não muda)", () => {
    const r = venda({ tipo: T.acess, preco: "50" });
    assert.equal(r.comissaoPct, 400);
    assert.equal(r.tipo, T.acess);
    assert.equal(r.tipoNome, "Acessório");
  });
});

describe("tipos de comissão cadastrados pelo usuário", () => {
  test("começa sem tipos: só existe “Outro”", () => {
    assert.deepEqual(v.tiposDe({ metaComissao: 0 }), []);
    assert.deepEqual(C.listaDeTipos([]).map((t) => t.id), ["outro"]);
  });
  test("cria, edita e remove um tipo", () => {
    const cfg = {};
    const t = v.salvarTipo(cfg, { nome: "Peças", modo: "fixa", pct: "3" });
    assert.equal(t.pct, 300);
    v.salvarTipo(cfg, { id: t.id, nome: "Peças", modo: "fixa", pct: "3,5" });
    assert.equal(cfg.tipos.length, 1);
    assert.equal(cfg.tipos[0].pct, 350);
    v.removerTipo(cfg, [], t.id);
    assert.equal(cfg.tipos.length, 0);
  });
  test("tipo por faixa de preço guarda limite e as duas %", () => {
    const cfg = {};
    const t = v.salvarTipo(cfg, { nome: "Caro", modo: "faixa", limite: "1.000", pctAcima: "1", pctAbaixo: "2" });
    assert.deepEqual([t.limite, t.pctAcima, t.pctAbaixo], [100000, 100, 200]);
  });
  test("recusa nome vazio, repetido (inclusive “Outro”) e % inválida", () => {
    const cfg = {};
    v.salvarTipo(cfg, { nome: "Peças", modo: "fixa", pct: "3" });
    assert.throws(() => v.salvarTipo(cfg, { nome: " ", modo: "fixa", pct: "3" }), /nome/);
    assert.throws(() => v.salvarTipo(cfg, { nome: "peças", modo: "fixa", pct: "3" }), /Já existe/);
    assert.throws(() => v.salvarTipo(cfg, { nome: "Outro (% na mão)", modo: "fixa", pct: "3" }), /Já existe/);
    assert.throws(() => v.salvarTipo(cfg, { nome: "X", modo: "fixa", pct: "150" }), /entre 0 e 100/);
    assert.throws(() => v.salvarTipo(cfg, { nome: "Y", modo: "faixa", limite: "0", pctAcima: "1", pctAbaixo: "2" }), /zero/);
  });
  test("não remove tipo usado por produto ativo", () => {
    const cfg = {};
    const t = v.salvarTipo(cfg, { nome: "Peças", modo: "fixa", pct: "3" });
    const produtos = [];
    v.salvarProduto(produtos, { nome: "Corrente", preco: "100", tipo: t.id }, cfg.tipos);
    assert.throws(() => v.removerTipo(cfg, produtos, t.id), /usado por 1 produto/);
  });
  test("venda antiga continua com o nome e a % de quando foi feita", () => {
    const cfg = {};
    const t = v.salvarTipo(cfg, { nome: "Peças", modo: "fixa", pct: "3" });
    const antiga = v.criarVenda({ descricao: "X", tipo: t.id, preco: "100", data: "2026-11-10" }, [], cfg.tipos);
    v.salvarTipo(cfg, { id: t.id, nome: "Peças novas", modo: "fixa", pct: "10" });
    v.removerTipo(cfg, [], t.id);
    assert.equal(antiga.comissao, 300);
    assert.equal(v.nomeDoTipoDaVenda(antiga, cfg.tipos), "Peças");
    assert.equal(v.comissaoPorTipo([antiga], cfg.tipos)[0].nome, "Peças");
  });
  test("tipo inexistente é recusado na venda", () => {
    assert.throws(() => venda({ tipo: "nao-existe", preco: "10" }), /Escolha o tipo/);
  });
});

describe("validações da venda", () => {
  test("quantidade precisa ser inteira e ≥ 1", () => {
    assert.throws(() => venda({ tipo: T.acess, preco: "10", quantidade: "1,5" }), /quantidade/);
    assert.throws(() => venda({ tipo: T.acess, preco: "10", quantidade: "0" }), /quantidade/);
  });
  test("preço zero e desconto maior que a venda são recusados", () => {
    assert.throws(() => venda({ tipo: T.acess, preco: "0" }), /zero/);
    assert.throws(() => venda({ tipo: T.acess, preco: "10", desconto: "10" }), /desconto/);
  });
  test("sem produto e sem descrição é recusado", () => {
    assert.throws(() => v.criarVenda({ tipo: T.acess, preco: "10", data: "2026-11-10" }, [], tipos), /Escolha um produto/);
  });
});

describe("converterData", () => {
  test("data normal e 29/02 em ano bissexto", () => {
    assert.deepEqual(v.converterData("2026-11-17"), { dia: 17, mes: 11, ano: 2026 });
    assert.deepEqual(v.converterData("2028-02-29"), { dia: 29, mes: 2, ano: 2028 });
  });
  test("recusa datas impossíveis", () => {
    for (const d of ["2026-02-31", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "", "abc"]) {
      assert.throws(() => v.converterData(d), /Data inválida/, d);
    }
  });
});

describe("produtos", () => {
  test("produto com venda é arquivado, sem venda é apagado", () => {
    const produtos = [];
    const a = v.salvarProduto(produtos, { nome: "Capacete", preco: "200", tipo: T.acess }, tipos);
    const b = v.salvarProduto(produtos, { nome: "Luva", preco: "80", tipo: T.acess }, tipos);
    const vendas = [v.criarVenda({ produtoId: a.id, preco: "200", quantidade: "1", data: "2026-11-10" }, produtos, tipos)];
    assert.deepEqual(v.removerProduto(produtos, vendas, a.id), { arquivado: true });
    assert.deepEqual(v.removerProduto(produtos, vendas, b.id), { arquivado: false });
    assert.equal(produtos.length, 1);
    assert.equal(produtos[0].ativo, false);
  });
  test("não deixa dois produtos ativos com o mesmo nome", () => {
    const produtos = [];
    v.salvarProduto(produtos, { nome: "Capacete", preco: "200", tipo: T.acess }, tipos);
    assert.throws(() => v.salvarProduto(produtos, { nome: "capacete", preco: "150", tipo: T.acess }, tipos), /Já existe/);
  });
});

describe("relatórios", () => {
  const lista = [
    venda({ tipo: T.acess, preco: "100" }),
    venda({ tipo: T.serv, preco: "200" }),
  ];
  test("resumo soma vendido, comissão e ticket médio", () => {
    const r = v.resumo(lista);
    assert.equal(r.vendido, 30000);
    assert.equal(r.comissao, 1400);
    assert.equal(r.ticketMedio, 15000);
  });
  test("série mensal atravessa a virada do ano", () => {
    const s = v.serieMensal([], 2, 2026, 3);
    assert.deepEqual(s.map((m) => m.mes + "/" + m.ano), ["12/2025", "1/2026", "2/2026"]);
  });
  test("projeção da meta no meio do mês", () => {
    const p = v.progressoMeta(10000, 30000, 11, 2026, { dia: 15, mes: 11, ano: 2026 });
    assert.equal(p.projecao, 20000);
    assert.equal(p.falta, 20000);
    assert.equal(p.diasRestantes, 15);
  });
  test("CSV usa ; e vírgula decimal, e protege aspas", () => {
    const csv = v.gerarCSV([{ ...lista[0], cliente: 'João "Loja"' }]);
    assert.match(csv, /"João ""Loja"""/);
    assert.match(csv, /100,00;4,00;4,00/);
  });
});

describe("arquivo de dados estragado não derruba o app", () => {
  test("recupera da versão anterior", () => {
    const pasta = pastaTemporaria();
    v.salvarVendas(pasta, [venda({ tipo: T.acess, preco: "10" })]);
    v.salvarVendas(pasta, [venda({ tipo: T.acess, preco: "10" }), venda({ tipo: T.acess, preco: "20" })]);
    fs.writeFileSync(path.join(pasta, "vendas.json"), "{estragado");
    const lidas = v.carregarVendas(pasta);
    assert.equal(lidas.length, 1);
    const problemas = v.tirarProblemas();
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /recuperado da versão anterior/);
    assert.ok(fs.readdirSync(pasta).some((n) => n.startsWith("vendas.json.corrompido-")));
  });
  test("sem versão anterior, começa vazio e avisa", () => {
    const pasta = pastaTemporaria();
    fs.writeFileSync(path.join(pasta, "vendas.json"), "não é json");
    assert.deepEqual(v.carregarVendas(pasta), []);
    assert.match(v.tirarProblemas()[0], /não deu pra recuperar/);
  });
  test("config com formato errado também é tratada", () => {
    const pasta = pastaTemporaria();
    fs.writeFileSync(path.join(pasta, "config.json"), "[1,2]");
    assert.deepEqual(v.carregarConfig(pasta), { metaComissao: 0 });
    v.tirarProblemas();
  });
});

describe("backup", () => {
  test("aceita backup válido e recusa produto estragado", () => {
    const b = v.montarBackup([{ id: "p1", nome: "X", preco: 100 }], [venda({ tipo: T.serv, preco: "10" })], { metaComissao: 0 });
    assert.equal(v.validarBackup(b), b);
    assert.throws(() => v.validarBackup({ ...b, produtos: [{ id: "p1" }] }), /produto estragado/);
    assert.throws(() => v.validarBackup({ app: "Outro", produtos: [], vendas: [] }), /não é um backup/);
  });
});
