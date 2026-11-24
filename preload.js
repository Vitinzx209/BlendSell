// A PONTE entre a tela e o computador: a tela só pode fazer estes pedidos
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("blendsell", {
  obterTudo: () => ipcRenderer.invoke("obter-tudo"),
  relatorio: (mes, ano) => ipcRenderer.invoke("relatorio", mes, ano),
  salvarProduto: (form) => ipcRenderer.invoke("salvar-produto", form),
  removerProduto: (id) => ipcRenderer.invoke("remover-produto", id),
  adicionarVenda: (form) => ipcRenderer.invoke("adicionar-venda", form),
  excluirVenda: (id) => ipcRenderer.invoke("excluir-venda", id),
  salvarTipo: (form) => ipcRenderer.invoke("salvar-tipo", form),
  removerTipo: (id) => ipcRenderer.invoke("remover-tipo", id),
  salvarMeta: (valor) => ipcRenderer.invoke("salvar-meta", valor),
  exportarCSV: (ids, nome) => ipcRenderer.invoke("exportar-csv", ids, nome),
  exportarBackup: () => ipcRenderer.invoke("exportar-backup"),
  escolherBackup: () => ipcRenderer.invoke("escolher-backup"),
  restaurarBackup: (caminho) => ipcRenderer.invoke("restaurar-backup", caminho),
  abrirPasta: () => ipcRenderer.invoke("abrir-pasta"),
});
