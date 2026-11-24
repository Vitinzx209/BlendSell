// Regras e contas de comissão, num lugar só.
// Usado pelo main (via require) e pela tela (via <script>), pra prévia e venda salva nunca divergirem.
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === "object" && module.exports) module.exports = modulo;
  else raiz.Comissao = modulo;
})(typeof self !== "undefined" ? self : this, function () {
  // Os tipos de comissão são cadastrados pelo usuário (config.tipos).
  // "Outro" sempre existe: é a saída pra digitar a % na hora.
  const TIPO_OUTRO = { id: "outro", nome: "Outro (% na mão)", manual: true };

  // Texto → centavos, sem passar por número quebrado.
  // Aceita "1.234,56", "1,234.56", "10,50", "10.50", "15.000", "R$ 99".
  // Com um único ponto seguido de 3 dígitos ("15.000"), o ponto é de milhar (jeito brasileiro).
  function converterValor(texto) {
    const limpo = String(texto ?? "").toUpperCase().replace("R$", "").replace(/\s/g, "");
    if (limpo === "") throw new Error("Digite um valor.");
    if (limpo.startsWith("-")) throw new Error("O valor não pode ser negativo.");
    if (!/^[\d.,]+$/.test(limpo) || !/\d/.test(limpo)) throw new Error("Valor inválido: " + texto);

    const ultimoPonto = limpo.lastIndexOf(".");
    const ultimaVirgula = limpo.lastIndexOf(",");
    let decimal = null;
    if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
      decimal = ultimoPonto > ultimaVirgula ? "." : ",";
    } else if (ultimaVirgula >= 0) {
      decimal = limpo.split(",").length === 2 ? "," : null;
    } else if (ultimoPonto >= 0) {
      decimal = limpo.split(".").length === 2 && limpo.length - ultimoPonto - 1 !== 3 ? "." : null;
    }

    let inteiro = limpo;
    let centavos = "";
    if (decimal) {
      const pos = limpo.lastIndexOf(decimal);
      inteiro = limpo.slice(0, pos);
      centavos = limpo.slice(pos + 1);
      if (centavos.length > 2) throw new Error("Use no máximo 2 casas depois da vírgula: " + texto);
      if (/[.,]/.test(centavos)) throw new Error("Valor inválido: " + texto);
    }
    const milhar = decimal === "." ? "," : decimal === "," ? "." : ultimoPonto >= 0 ? "." : ",";
    if (/[.,]/.test(inteiro)) {
      const grupos = inteiro.split(milhar);
      const gruposOk = grupos.every((g, i) => /^\d+$/.test(g) && (i === 0 ? g.length <= 3 : g.length === 3));
      if (!gruposOk) throw new Error("Valor inválido: " + texto);
    }
    inteiro = inteiro.replace(/[.,]/g, "");
    if (!/^\d*$/.test(inteiro)) throw new Error("Valor inválido: " + texto);
    return Number(inteiro || "0") * 100 + Number((centavos + "00").slice(0, 2));
  }

  // "12,5" / "12.5%" / "8" → pontos-base (1250 / 1250 / 800)
  function converterPercentual(texto) {
    const limpo = String(texto ?? "").replace("%", "").replace(/\s/g, "").replace(",", ".");
    if (limpo === "") throw new Error("Digite a porcentagem de comissão.");
    if (!/^\d+(\.\d{1,2})?$/.test(limpo)) throw new Error("Porcentagem inválida: " + texto);
    const pontos = Math.round(Number(limpo) * 100);
    if (pontos > 10000) throw new Error("A porcentagem tem que ser entre 0 e 100.");
    return pontos;
  }

  function listaDeTipos(tiposDoUsuario) {
    return [...(tiposDoUsuario || []), TIPO_OUTRO];
  }

  function acharTipo(tipos, id) {
    const tipo = listaDeTipos(tipos).find((t) => t.id === id);
    if (!tipo) throw new Error("Escolha o tipo da venda.");
    return tipo;
  }

  // form = { nome, modo: "fixa" | "faixa", pct, limite, pctAcima, pctAbaixo }
  // "faixa": a % muda conforme o preço de UMA unidade (ex.: 2% de R$ 20 mil pra cima, 2,5% abaixo)
  function montarTipo(form, existentes, id) {
    const nome = String(form.nome || "").trim();
    if (nome === "") throw new Error("Escreva o nome do tipo.");
    if (nome.length > 60) throw new Error("Nome muito comprido (máximo 60 letras).");
    const repetido = listaDeTipos(existentes).find((t) => t.id !== id && t.nome.toUpperCase() === nome.toUpperCase());
    if (repetido) throw new Error("Já existe um tipo chamado “" + nome + "”.");
    const tipo = { id: id || "tipo|" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome: nome };
    if (form.modo === "faixa") {
      tipo.limite = converterValor(form.limite);
      if (tipo.limite === 0) throw new Error("O preço que separa as faixas não pode ser zero.");
      tipo.pctAcima = converterPercentual(form.pctAcima);
      tipo.pctAbaixo = converterPercentual(form.pctAbaixo);
    } else {
      tipo.pct = converterPercentual(form.pct);
    }
    return tipo;
  }

  // Preço de UMA unidade já com o desconto (é ele que decide em qual faixa de preço a venda cai)
  function valorDeUma(precoUnitario, quantidade, desconto) {
    return Math.round(Math.max(0, precoUnitario * quantidade - (desconto || 0)) / quantidade);
  }

  function percentualDoTipo(tipos, tipoId, valorUnitario, pctManual) {
    const tipo = acharTipo(tipos, tipoId);
    if (tipo.manual) return pctManual;
    if (tipo.limite) return valorUnitario >= tipo.limite ? tipo.pctAcima : tipo.pctAbaixo;
    return tipo.pct;
  }

  function calcular(precoUnitario, quantidade, comissaoPct, desconto) {
    const bruto = precoUnitario * quantidade;
    const total = Math.max(0, bruto - (desconto || 0));
    const comissao = Math.round((total * comissaoPct) / 10000);
    return { bruto: bruto, total: total, comissao: comissao };
  }

  return { TIPO_OUTRO, listaDeTipos, montarTipo, converterValor, converterPercentual, acharTipo, valorDeUma, percentualDoTipo, calcular };
});
