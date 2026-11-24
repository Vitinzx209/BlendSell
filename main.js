// =====================================================================
// BLENDSELL: o lado "main" do Electron (acessa os arquivos do computador)
// A tela (renderer/) pede tudo por aqui, pela ponte (preload.js).
// =====================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const v = require("./src/vendas");

let pasta;
let produtos;
let vendas;
let config;
let janela;
const ICONE = path.join(__dirname, "build", "icone.png");

// Os dados ficam em C:\Users\<você>\AppData\Roaming\BlendSell
function prepararPasta() {
  pasta = process.env.BLENDSELL_PASTA || app.getPath("userData");
  fs.mkdirSync(pasta, { recursive: true });
}

function recarregar() {
  produtos = v.carregarProdutos(pasta);
  vendas = v.carregarVendas(pasta);
  config = v.carregarConfig(pasta);
}

// Embrulha um pedido: se der erro, devolve { ok: false, mensagem } em vez de quebrar
function seguro(funcao) {
  return async (evento, ...args) => {
    try {
      return { ok: true, ...(await funcao(...args)) };
    } catch (erro) {
      return { ok: false, mensagem: erro.message };
    }
  };
}

// Janela "Salvar como" (nos testes, BLENDSELL_SALVAR_EM pula a janela)
async function perguntarOndeSalvar(titulo, nome, tipo, extensao) {
  if (process.env.BLENDSELL_SALVAR_EM) return path.join(process.env.BLENDSELL_SALVAR_EM, nome);
  const r = await dialog.showSaveDialog(janela, {
    title: titulo, defaultPath: path.join(app.getPath("documents"), nome), filters: [{ name: tipo, extensions: [extensao] }],
  });
  return r.canceled || !r.filePath ? null : r.filePath;
}

function registrarPedidos() {
  ipcMain.handle("obter-tudo", seguro(() => {
    recarregar();
    return { produtos: produtos, vendas: v.ordenarPorData(vendas), config: config, tipos: v.tiposDe(config) };
  }));

  ipcMain.handle("relatorio", seguro((mes, ano) => {
    recarregar();
    const doMes = vendasDoMesOrdenadas(mes, ano);
    const resumo = v.resumo(doMes);
    const ant = mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano: ano };
    const doAnterior = v.vendasDoMes(vendas, ant.mes, ant.ano);
    return {
      resumo: resumo,
      anterior: { ...v.resumo(doAnterior), temDados: doAnterior.length > 0 },
      vendas: doMes,
      ranking: v.rankingProdutos(doMes),
      porTipo: v.comissaoPorTipo(doMes, v.tiposDe(config)),
      serie: v.serieMensal(vendas, mes, ano, 6),
      meta: v.progressoMeta(resumo.comissao, config.metaComissao || 0, mes, ano, v.hojeComoData()),
    };
  }));

  // ===== Produtos =====
  ipcMain.handle("salvar-produto", seguro((form) => {
    recarregar();
    const produto = v.salvarProduto(produtos, form, v.tiposDe(config));
    v.salvarProdutos(pasta, produtos);
    return { produto: produto };
  }));

  ipcMain.handle("remover-produto", seguro((id) => {
    recarregar();
    const r = v.removerProduto(produtos, vendas, id);
    v.salvarProdutos(pasta, produtos);
    return r;
  }));

  // ===== Vendas =====
  ipcMain.handle("adicionar-venda", seguro((form) => {
    recarregar();
    const venda = v.criarVenda(form, produtos, v.tiposDe(config));
    vendas.push(venda);
    v.salvarVendas(pasta, vendas);
    return { venda: venda };
  }));

  ipcMain.handle("excluir-venda", seguro((id) => {
    recarregar();
    if (!vendas.some((x) => x.id === id)) throw new Error("Venda não encontrada.");
    vendas = vendas.filter((x) => x.id !== id);
    v.salvarVendas(pasta, vendas);
    return {};
  }));

  // ===== Tipos de comissão =====
  ipcMain.handle("salvar-tipo", seguro((form) => {
    recarregar();
    const tipo = v.salvarTipo(config, form);
    v.salvarConfig(pasta, config);
    return { tipo: tipo };
  }));

  ipcMain.handle("remover-tipo", seguro((id) => {
    recarregar();
    v.removerTipo(config, produtos, id);
    v.salvarConfig(pasta, config);
    return {};
  }));

  // ===== Meta =====
  ipcMain.handle("salvar-meta", seguro((texto) => {
    recarregar();
    config.metaComissao = String(texto || "").trim() === "" ? 0 : v.converterValor(texto);
    v.salvarConfig(pasta, config);
    return {};
  }));

  // ===== Exportar e backup =====
  ipcMain.handle("exportar-csv", seguro(async (ids, nome) => {
    recarregar();
    const escolhidas = new Set(ids);
    const lista = v.ordenarPorData(vendas.filter((x) => escolhidas.has(x.id))).reverse();
    const caminho = await perguntarOndeSalvar("Exportar vendas (CSV)", nome + ".csv", "Planilha CSV", "csv");
    if (!caminho) return { cancelado: true };
    fs.writeFileSync(caminho, v.gerarCSV(lista, v.tiposDe(config)), "utf-8");
    return { quantidade: lista.length };
  }));

  ipcMain.handle("exportar-backup", seguro(async () => {
    recarregar();
    const caminho = await perguntarOndeSalvar("Salvar backup do BlendSell",
      "blendsell-backup-" + new Date().toISOString().slice(0, 10) + ".json", "Backup do BlendSell", "json");
    if (!caminho) return { cancelado: true };
    fs.writeFileSync(caminho, JSON.stringify(v.montarBackup(produtos, vendas, config), null, 2), "utf-8");
    return { quantidade: vendas.length };
  }));

  ipcMain.handle("escolher-backup", seguro(async () => {
    const r = await dialog.showOpenDialog(janela, {
      title: "Escolha o backup do BlendSell", filters: [{ name: "Backup do BlendSell", extensions: ["json"] }], properties: ["openFile"],
    });
    if (r.canceled || r.filePaths.length === 0) return { cancelado: true };
    const b = v.validarBackup(v.lerJSON(r.filePaths[0]));
    return { caminho: r.filePaths[0], quantidade: b.vendas.length };
  }));

  ipcMain.handle("restaurar-backup", seguro((caminho) => {
    const b = v.validarBackup(v.lerJSON(caminho));
    recarregar();
    const agora = new Date().toISOString().replace(/[:.]/g, "-");
    v.salvarJSON(path.join(pasta, "antes-de-restaurar-" + agora + ".json"), v.montarBackup(produtos, vendas, config));
    v.salvarProdutos(pasta, b.produtos);
    v.salvarVendas(pasta, b.vendas);
    v.salvarConfig(pasta, b.config || { metaComissao: 0 });
    return { quantidade: b.vendas.length };
  }));

  ipcMain.handle("abrir-pasta", () => shell.openPath(pasta));
}

function vendasDoMesOrdenadas(mes, ano) {
  return v.ordenarPorData(v.vendasDoMes(vendas, mes, ano));
}

// Se algum arquivo de dados estava estragado, conta pro usuário o que foi feito
function avisarProblemas() {
  const lista = v.tirarProblemas();
  if (lista.length === 0) return;
  if (process.env.BLENDSELL_FOTO) { console.log("[problemas]", JSON.stringify(lista)); return; }
  dialog.showMessageBox(janela, {
    type: "warning", title: "BlendSell", message: "Encontrei um problema nos seus dados",
    detail: lista.join("\n\n"), buttons: ["Entendi", "Abrir a pasta dos dados"],
  }).then((r) => { if (r.response === 1) shell.openPath(pasta); });
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1360, height: 880, minWidth: 900, minHeight: 640,
    title: "BlendSell", icon: ICONE, backgroundColor: "#0b0c10", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  const carregando = janela.loadFile(path.join(__dirname, "renderer", "index.html"));
  carregando.then(avisarProblemas);

  // "Modo foto" (só pra testes): roda um roteiro, tira um print e fecha
  if (process.env.BLENDSELL_FOTO) {
    janela.webContents.on("console-message", (e) => console.log("[tela]", e.message));
    setTimeout(() => app.exit(1), 25000);
    carregando.then(async () => {
      await new Promise((r) => setTimeout(r, 1500));
      if (process.env.BLENDSELL_ROTEIRO) {
        const resultado = await janela.webContents.executeJavaScript(fs.readFileSync(process.env.BLENDSELL_ROTEIRO, "utf-8"));
        console.log("[roteiro]", JSON.stringify(resultado));
        await new Promise((r) => setTimeout(r, 900));
      }
      fs.writeFileSync(process.env.BLENDSELL_FOTO, (await janela.webContents.capturePage()).toPNG());
      console.log("foto salva");
      app.exit(0);
    });
  }
}

app.setAppUserModelId("com.vitor.blendsell");
app.whenReady().then(() => {
  prepararPasta();
  recarregar();
  registrarPedidos();
  criarJanela();
});
app.on("window-all-closed", () => app.quit());
