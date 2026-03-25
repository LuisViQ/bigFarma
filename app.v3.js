let produtos = [];
let carrinho = [];
let descontoTotalPct = 0;

const EXAMES_ARQUIVO = "exames-v1.xlsx";
const STORAGE_STATE_KEY = "bigfarma:estado:v1";
const STORAGE_HISTORY_KEY = "bigfarma:historico:v1";
const HISTORY_LIMIT = 100;
const HISTORY_MAX_BYTES = 700 * 1024; // ~700 KB
const HISTORY_FALLBACK_LIMIT = 30;
const HISTORY_MAX_ITEMS_PER_ORDER = 120;

const inputNome = document.getElementById("produtoNome");
const inputPreco = document.getElementById("produtoPreco");
const inputQtd = document.getElementById("produtoQtd");
const btnAdicionar = document.getElementById("btnAdicionar");
const tbodyCarrinho = document.getElementById("tbodyCarrinho");
const totalGeralTd = document.getElementById("totalGeral");
const totalFinalTd = document.getElementById("totalFinal");
const btnExportarPdf = document.getElementById("btnExportarPdf");
const btnExportarPdfNativo = document.getElementById("btnExportarPdfNativo");
const btnExportarHistorico = document.getElementById("btnExportarHistorico");
const btnLimparCarrinho = document.getElementById("btnLimparCarrinho");
const inputDescontoItemPct = document.getElementById("descontoItemPct");
const inputDescontoTotalPct = document.getElementById("descontoTotalPct");
const statusExamesEl = document.getElementById("statusExames");
const feedbackEl = document.getElementById("feedbackMensagem");

const inputClienteNome = document.getElementById("clienteNome");
const inputClienteDocumento = document.getElementById("clienteDocumento");
const inputClienteTelefone = document.getElementById("clienteTelefone");
const inputDataNascimentoCliente = document.getElementById("clienteDataNascimento");
const inputClienteData = document.getElementById("clienteData");
const inputClienteObs = document.getElementById("clienteObs");

let feedbackTimeoutId = null;
const salvarEstadoLocalDebounced = debounce(salvarEstadoLocal, 250);

window.addEventListener("load", inicializarApp);

function inicializarApp() {
  configurarEventos();
  restaurarEstadoLocal();
  preencherDataPedidoPadrao();
  renderizarCarrinho();
  carregarExamesFixos();
}

function configurarEventos() {
  if (inputNome) inputNome.addEventListener("input", aoAlterarProduto);
  if (btnAdicionar) btnAdicionar.addEventListener("click", adicionarAoCarrinho);
  if (btnExportarPdf) btnExportarPdf.addEventListener("click", exportarParaImpressao);
  if (btnExportarPdfNativo) {
    btnExportarPdfNativo.addEventListener("click", exportarPdfNativo);
  }
  if (btnExportarHistorico) {
    btnExportarHistorico.addEventListener("click", exportarHistoricoPedidos);
  }
  if (btnLimparCarrinho) btnLimparCarrinho.addEventListener("click", limparCarrinho);

  if (inputDescontoTotalPct) {
    inputDescontoTotalPct.addEventListener("input", () => {
      descontoTotalPct = lerPercentual(inputDescontoTotalPct.value);
      renderizarCarrinho();
      salvarEstadoLocalDebounced();
    });
  }

  if (inputClienteDocumento) {
    inputClienteDocumento.addEventListener("input", () => {
      inputClienteDocumento.value = formatarCpf(inputClienteDocumento.value);
      validarCamposCliente(false);
      salvarEstadoLocalDebounced();
    });
    inputClienteDocumento.addEventListener("blur", () => validarCamposCliente(true));
  }

  if (inputClienteTelefone) {
    inputClienteTelefone.addEventListener("input", () => {
      inputClienteTelefone.value = formatarTelefone(inputClienteTelefone.value);
      validarCamposCliente(false);
      salvarEstadoLocalDebounced();
    });
    inputClienteTelefone.addEventListener("blur", () => validarCamposCliente(true));
  }

  [
    inputClienteNome,
    inputDataNascimentoCliente,
    inputClienteData,
    inputClienteObs,
    inputQtd,
    inputDescontoItemPct,
  ].forEach((campo) => {
    if (campo) campo.addEventListener("input", salvarEstadoLocalDebounced);
  });
}

async function carregarExamesFixos() {
  try {
    const resposta = await fetch(EXAMES_ARQUIVO);

    if (!resposta.ok) {
      throw new Error(
        `Arquivo "${EXAMES_ARQUIVO}" nao encontrado. Deixe o arquivo na mesma pasta do index.html.`
      );
    }

    const arrayBuffer = await resposta.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    produtos = parseExcelRows(rows);
    if (!produtos.length) {
      throw new Error(
        "Nenhum exame foi carregado. Verifique se a planilha tem dados nas colunas CODIGO / EXAME / VALOR."
      );
    }

    popularDatalist();
    if (statusExamesEl) {
      statusExamesEl.textContent = `Exames carregados com sucesso de "${EXAMES_ARQUIVO}".`;
    }
    mostrarFeedback("success", "Tabela de exames carregada com sucesso.");
  } catch (erro) {
    console.error("Erro ao carregar exames:", erro);
    if (statusExamesEl) {
      statusExamesEl.textContent = "Erro ao carregar exames: " + erro.message;
    }
    mostrarFeedback("error", "Erro ao carregar o arquivo de exames: " + erro.message, 7000);
  }
}

function normalizaCabecalho(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizaTexto(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function extrairCodigoDoTexto(texto) {
  const raw = String(texto || "").trim();
  if (!raw) return "";

  const separador = raw.match(/^\s*([^\-\u2013\u2014]+?)\s*[\-\u2013\u2014]\s*(.+)\s*$/);
  if (separador && separador[1]) return String(separador[1]).trim();

  return "";
}

function parseExcelRows(rows) {
  if (!rows || rows.length < 2) {
    throw new Error("A planilha esta vazia ou sem linhas de dados.");
  }

  const cabecalhoRaw = rows[0];
  const cabecalho = cabecalhoRaw.map((h) => (h ? normalizaCabecalho(h) : ""));

  const idxCodigo = cabecalho.indexOf("codigo");
  const idxNome = cabecalho.indexOf("exame");
  const idxValor = cabecalho.indexOf("valor");

  if (idxCodigo === -1 || idxNome === -1 || idxValor === -1) {
    throw new Error(
      "Cabecalho incorreto. Esperado: colunas CODIGO, EXAME e VALOR na primeira linha da planilha."
    );
  }

  const produtosParseados = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const codigoCel = row[idxCodigo];
    const nomeCel = row[idxNome];
    const valorCel = row[idxValor];

    if (!nomeCel || valorCel === undefined || valorCel === null) continue;

    const precoNum = parseValor(valorCel);
    if (Number.isNaN(precoNum)) continue;

    produtosParseados.push({
      codigo: codigoCel !== undefined ? String(codigoCel).trim() : "",
      nome: String(nomeCel).trim(),
      preco: precoNum,
    });
  }

  return produtosParseados;
}

function parseValor(valor) {
  if (typeof valor === "number") return valor;

  const precoStr = String(valor)
    .trim()
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(precoStr);
}

function popularDatalist() {
  const lista = document.getElementById("listaProdutos");
  if (!lista) return;

  lista.innerHTML = "";
  produtos.forEach((produto) => {
    const opt = document.createElement("option");
    const cod = String(produto.codigo || "").trim();
    const nome = String(produto.nome || "").trim();
    opt.value = cod ? `${cod} - ${nome}` : nome;
    lista.appendChild(opt);
  });
}

function encontrarProdutoPorTexto(texto) {
  const raw = String(texto || "").trim();
  if (!raw) return null;

  const codigoExtraido = extrairCodigoDoTexto(raw);
  if (codigoExtraido) {
    const codNorm = codigoExtraido.trim().toLowerCase();
    const achouPorCodigo = produtos.find(
      (item) => String(item.codigo || "").trim().toLowerCase() === codNorm
    );
    if (achouPorCodigo) return achouPorCodigo;
  }

  const textoNormalizado = normalizaTexto(raw);
  const rawLower = raw.toLowerCase();

  const exato = produtos.find((item) => {
    const nome = normalizaTexto(item.nome);
    const codigo = String(item.codigo || "").trim().toLowerCase();
    return nome === textoNormalizado || codigo === rawLower;
  });
  if (exato) return exato;

  const parcial = produtos.find((item) => {
    const nome = normalizaTexto(item.nome);
    const codigo = String(item.codigo || "").trim().toLowerCase();
    return nome.includes(textoNormalizado) || codigo.includes(rawLower);
  });

  return parcial || null;
}

function lerPercentual(valor) {
  let n = parseFloat(String(valor).replace(",", "."));
  if (Number.isNaN(n)) n = 0;
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return n;
}

function aplicarDesconto(valor, pct) {
  return valor * (1 - pct / 100);
}

function aoAlterarProduto() {
  if (!inputNome || !inputPreco) return;

  const texto = inputNome.value;
  if (!texto || !texto.trim()) {
    inputPreco.value = "";
    return;
  }

  const produto = encontrarProdutoPorTexto(texto);
  if (!produto) {
    inputPreco.value = "";
    return;
  }

  inputPreco.value = produto.preco.toFixed(2);
}

function adicionarAoCarrinho() {
  if (!inputNome || !inputQtd || !inputPreco) return;

  const textoDigitado = inputNome.value;
  const qtd = parseInt(inputQtd.value, 10);

  if (!produtos.length) {
    mostrarFeedback("error", "Nenhum exame carregado. Verifique o arquivo de exames.");
    return;
  }

  if (!textoDigitado || !textoDigitado.trim()) {
    mostrarFeedback("error", "Digite ou selecione um exame (nome ou codigo).");
    return;
  }

  const produto = encontrarProdutoPorTexto(textoDigitado);
  if (!produto) {
    mostrarFeedback("error", "Exame nao encontrado. Confira nome/codigo ou o arquivo.");
    return;
  }

  if (!qtd || qtd <= 0) {
    mostrarFeedback("error", "Quantidade invalida.");
    return;
  }

  const descontoItemPct = inputDescontoItemPct
    ? lerPercentual(inputDescontoItemPct.value)
    : 0;

  const chaveProduto = obterChaveProduto(produto.codigo, produto.nome);
  const existente = carrinho.find(
    (item) => obterChaveProduto(item.codigo, item.nome) === chaveProduto
  );

  if (existente) {
    existente.qtd += qtd;
    existente.descontoPct = descontoItemPct;
  } else {
    carrinho.push({
      codigo: produto.codigo,
      nome: produto.nome,
      preco: produto.preco,
      qtd,
      descontoPct: descontoItemPct,
    });
  }

  inputNome.value = "";
  inputPreco.value = "";
  inputQtd.value = 1;
  if (inputDescontoItemPct) inputDescontoItemPct.value = 0;

  renderizarCarrinho();
  salvarEstadoLocal();
  mostrarFeedback("success", `Exame "${produto.nome}" adicionado ao carrinho.`);
}

function removerItem(codigo, nome) {
  const chave = obterChaveProduto(codigo, nome);
  carrinho = carrinho.filter(
    (item) => obterChaveProduto(item.codigo, item.nome) !== chave
  );
  renderizarCarrinho();
  salvarEstadoLocal();
  mostrarFeedback("success", "Item removido do carrinho.");
}

function limparCarrinho() {
  if (!carrinho.length) {
    mostrarFeedback("info", "Carrinho ja esta vazio.");
    return;
  }

  const confirmou = window.confirm("Deseja limpar todos os exames do carrinho?");
  if (!confirmou) return;

  carrinho = [];
  renderizarCarrinho();
  salvarEstadoLocal();
  mostrarFeedback("success", "Carrinho limpo com sucesso.");
}

function calcularSubtotalItem(item) {
  const subtotalBruto = Number(item.preco) * Number(item.qtd);
  const descPct = lerPercentual(item.descontoPct);
  return aplicarDesconto(subtotalBruto, descPct);
}

function obterTotaisCarrinho() {
  let totalComItem = 0;
  carrinho.forEach((item) => {
    totalComItem += calcularSubtotalItem(item);
  });

  const totalFinal = aplicarDesconto(totalComItem, descontoTotalPct);
  return { totalComItem, totalFinal };
}

function renderizarCarrinho() {
  if (!tbodyCarrinho || !totalGeralTd || !totalFinalTd) return;

  tbodyCarrinho.innerHTML = "";

  if (!carrinho.length) {
    const trVazio = document.createElement("tr");
    trVazio.innerHTML = '<td colspan="7">Nenhum exame selecionado.</td>';
    tbodyCarrinho.appendChild(trVazio);
  } else {
    carrinho.forEach((item) => {
      const tr = document.createElement("tr");
      const descPct = lerPercentual(item.descontoPct);
      const subtotalComDescontoItem = calcularSubtotalItem(item);

      tr.innerHTML = `
        <td>${escaparHtml(item.codigo || "-")}</td>
        <td>${escaparHtml(item.nome || "-")}</td>
        <td>${Number(item.preco).toFixed(2)}</td>
        <td>${Number(item.qtd)}</td>
        <td>${descPct.toFixed(2)}%</td>
        <td>${subtotalComDescontoItem.toFixed(2)}</td>
        <td>
          <button
            class="btn-remover"
            data-codigo="${escaparHtml(item.codigo || "")}"
            data-nome="${escaparHtml(item.nome || "")}"
          >
            Remover
          </button>
        </td>
      `;

      tbodyCarrinho.appendChild(tr);
    });
  }

  const { totalComItem, totalFinal } = obterTotaisCarrinho();
  totalGeralTd.textContent = totalComItem.toFixed(2);
  totalFinalTd.textContent = totalFinal.toFixed(2);

  const botoesRemover = tbodyCarrinho.querySelectorAll(".btn-remover");
  botoesRemover.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cod = btn.getAttribute("data-codigo") || "";
      const nome = btn.getAttribute("data-nome") || "";
      removerItem(cod, nome);
    });
  });
}

function obterDadosCliente() {
  return {
    nome: (inputClienteNome && inputClienteNome.value.trim()) || "Nao informado",
    cpf: (inputClienteDocumento && inputClienteDocumento.value.trim()) || "Nao informado",
    telefone: (inputClienteTelefone && inputClienteTelefone.value.trim()) || "Nao informado",
    dataNascimento:
      (inputDataNascimentoCliente && formatarDataIsoParaBr(inputDataNascimentoCliente.value)) ||
      "Nao informado",
    dataPedido:
      (inputClienteData && formatarDataIsoParaBr(inputClienteData.value)) ||
      formatarDataIsoParaBr(new Date().toISOString().slice(0, 10)),
    observacoes: (inputClienteObs && inputClienteObs.value.trim()) || "-",
  };
}

function exportarParaImpressao() {
  if (!carrinho.length) {
    mostrarFeedback("error", "Nenhum exame no carrinho para exportar.");
    return;
  }
  if (!validarCamposCliente(true)) return;

  const dadosCliente = obterDadosCliente();
  const tabela = document.querySelector(".cart-table");
  if (!tabela) return;

  const tabelaHtml = tabela.outerHTML;
  const obsHtml = escaparHtml(dadosCliente.observacoes).replace(/\n/g, "<br>");

  const novaJanela = window.open("", "_blank");
  if (!novaJanela) {
    mostrarFeedback("error", "Popup bloqueado. Permita popups para imprimir o pedido.");
    return;
  }

  const estilo = `
    <style>
      @page { margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; color: #000; background: #fff; }
      * { color: #000 !important; }
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; }
      .logo { width: 58px; height: 58px; object-fit: contain; filter: grayscale(100%) contrast(120%); }
      .title h1 { margin: 0; font-size: 20px; }
      .title p { margin: 2px 0 0; font-size: 12px; color: #000; }
      .cliente-bloco { margin-bottom: 14px; border: 1px solid #000; border-radius: 8px; padding: 10px 12px; }
      .cliente-bloco p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #000; padding: 6px; text-align: left; background: #fff !important; }
      th { background: #fff !important; }
      td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(6) { text-align: right; }
      .footer { margin-top: 14px; font-size: 11px; color: #000; border-top: 1px solid #000; padding-top: 8px; display: flex; justify-content: space-between; }
    </style>
  `;

  novaJanela.document.write(`
    <html>
      <head>
        <title>Pedido de exames - BigFarma</title>
        ${estilo}
      </head>
      <body>
        <div class="header">
          <img class="logo" src="logo_big_farma.jpg" alt="Logo BigFarma" />
          <div class="title">
            <h1>BigFarma - Pedido de exames</h1>
            <p>Documento gerado em ${new Date().toLocaleString("pt-BR")}</p>
          </div>
          <img class="logo" src="logo_crd.jpg" alt="Logo CRD" />
        </div>
        <div class="cliente-bloco">
          <p><strong>Paciente:</strong> ${escaparHtml(dadosCliente.nome)}</p>
          <p><strong>CPF:</strong> ${escaparHtml(dadosCliente.cpf)}</p>
          <p><strong>Data de nascimento:</strong> ${escaparHtml(dadosCliente.dataNascimento)}</p>
          <p><strong>Telefone:</strong> ${escaparHtml(dadosCliente.telefone)}</p>
          <p><strong>Data do pedido:</strong> ${escaparHtml(dadosCliente.dataPedido)}</p>
          <p><strong>Observacoes:</strong><br>${obsHtml}</p>
        </div>
        ${tabelaHtml}
        <div class="footer">
          <span>BigFarma</span>
          <span>Responsavel: _____________________</span>
        </div>
      </body>
    </html>
  `);

  novaJanela.document.close();
  novaJanela.onload = () => {
    novaJanela.focus();
    novaJanela.print();
    novaJanela.close();
  };

  registrarHistoricoPedido("impressao");
  mostrarFeedback("success", "Pedido enviado para impressao.");
}

async function exportarPdfNativo() {
  if (!carrinho.length) {
    mostrarFeedback("error", "Nenhum exame no carrinho para gerar PDF.");
    return;
  }
  if (!validarCamposCliente(true)) return;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarFeedback("error", "Biblioteca de PDF indisponivel.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  const dadosCliente = obterDadosCliente();
  const { totalComItem, totalFinal } = obterTotaisCarrinho();

  const [logoEsquerdaPb, logoDireitaPb] = await Promise.all([
    carregarLogoParaPdfPb("logo_big_farma.jpg"),
    carregarLogoParaPdfPb("logo_crd.jpg"),
  ]);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margemX = 40;
  const larguraConteudo = pageWidth - margemX * 2;
  const logoSize = 52;
  const headerTop = 34;

  if (logoEsquerdaPb) {
    doc.addImage(logoEsquerdaPb, "JPEG", margemX, headerTop, logoSize, logoSize);
  }
  if (logoDireitaPb) {
    doc.addImage(
      logoDireitaPb,
      "JPEG",
      pageWidth - margemX - logoSize,
      headerTop,
      logoSize,
      logoSize
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("BigFarma - Pedido de exames", pageWidth / 2, headerTop + 18, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString("pt-BR")}`,
    pageWidth / 2,
    headerTop + 34,
    { align: "center" }
  );

  const linhaCabecalhoY = headerTop + logoSize + 10;
  doc.setLineWidth(1.1);
  doc.line(margemX, linhaCabecalhoY, pageWidth - margemX, linhaCabecalhoY);
  doc.setLineWidth(0.4);

  let y = linhaCabecalhoY + 16;

  const linhasBaseCliente = [
    `Paciente: ${dadosCliente.nome}`,
    `CPF: ${dadosCliente.cpf}`,
    `Data de nascimento: ${dadosCliente.dataNascimento}`,
    `Telefone: ${dadosCliente.telefone}`,
    `Data do pedido: ${dadosCliente.dataPedido}`,
  ];
  const linhasObservacao = doc.splitTextToSize(
    `Observacoes: ${dadosCliente.observacoes}`,
    larguraConteudo - 20
  );
  const linhasBlocoCliente = [...linhasBaseCliente, ...linhasObservacao];
  const lineHeight = 13;
  const alturaBloco = linhasBlocoCliente.length * lineHeight + 14;

  if (typeof doc.roundedRect === "function") {
    doc.roundedRect(margemX, y, larguraConteudo, alturaBloco, 6, 6);
  } else {
    doc.rect(margemX, y, larguraConteudo, alturaBloco);
  }

  let textoBlocoY = y + 16;
  doc.setFontSize(10);
  linhasBlocoCliente.forEach((linha) => {
    doc.text(linha, margemX + 10, textoBlocoY);
    textoBlocoY += lineHeight;
  });
  y += alturaBloco + 12;

  const tableRows = carrinho.map((item) => {
    const descPct = lerPercentual(item.descontoPct);
    const subtotal = calcularSubtotalItem(item);
    return [
      String(item.codigo || "-"),
      String(item.nome || "-"),
      formatarNumeroPtBr(item.preco),
      String(item.qtd),
      `${descPct.toFixed(2)}%`,
      formatarNumeroPtBr(subtotal),
    ];
  });

  if (typeof doc.autoTable === "function") {
    doc.autoTable({
      startY: y,
      margin: { left: margemX, right: margemX, bottom: 70 },
      head: [["Codigo", "Exame", "Valor", "Qtd", "Desc.%", "Subtotal"]],
      body: tableRows,
      foot: [
        ["", "", "", "", "Total (c/ desconto por item)", formatarNumeroPtBr(totalComItem)],
        ["", "", "", "", "Total final (c/ desconto geral)", formatarNumeroPtBr(totalFinal)],
      ],
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.4,
        fillColor: [255, 255, 255],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.4,
      },
      footStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.4,
        fontStyle: "bold",
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  } else {
    y += 10;
    doc.setFontSize(9);
    tableRows.forEach((linha) => {
      doc.text(linha.join(" | "), margemX, y);
      y += 12;
    });
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Total (c/ desconto por item): ${formatarNumeroPtBr(totalComItem)}`, margemX, y);
    y += 16;
    doc.text(`Total final (c/ desconto geral): ${formatarNumeroPtBr(totalFinal)}`, margemX, y);
  }

  const ultimaPagina = doc.getNumberOfPages();
  doc.setPage(ultimaPagina);

  const footerY = pageHeight - 24;
  doc.setLineWidth(0.8);
  doc.line(margemX, footerY - 11, pageWidth - margemX, footerY - 11);
  doc.setLineWidth(0.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("BigFarma", margemX, footerY);
  doc.text("Responsavel: _____________________", pageWidth - margemX, footerY, {
    align: "right",
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  doc.save(`pedido-exames-${stamp}.pdf`);

  registrarHistoricoPedido("pdf_nativo");
  mostrarFeedback("success", "PDF gerado com sucesso.");
}

function carregarLogoParaPdfPb(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const maxLado = 180;
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const largura = Math.max(1, Math.round(img.width * escala));
        const altura = Math.max(1, Math.round(img.height * escala));

        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, largura, altura);

        const imageData = ctx.getImageData(0, 0, largura, altura);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const cinza = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          data[i] = cinza;
          data[i + 1] = cinza;
          data[i + 2] = cinza;
        }
        ctx.putImageData(imageData, 0, 0);

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (erro) {
        console.warn("Falha ao converter logo para P&B:", erro);
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function registrarHistoricoPedido(canal) {
  try {
    const historico = carregarHistoricoPedidos();
    const dadosCliente = obterDadosCliente();
    const { totalComItem, totalFinal } = obterTotaisCarrinho();

    historico.unshift({
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      geradoEm: new Date().toISOString(),
      canal,
      paciente: {
        nome: dadosCliente.nome,
        cpf: dadosCliente.cpf,
        telefone: dadosCliente.telefone,
      },
      totais: {
        totalComDescontoItem: Number(totalComItem.toFixed(2)),
        totalFinal: Number(totalFinal.toFixed(2)),
      },
      itens: carrinho.slice(0, HISTORY_MAX_ITEMS_PER_ORDER).map((item) => ({
        codigo: item.codigo || "",
        exame: item.nome || "",
        quantidade: Number(item.qtd),
        valorUnitario: Number(item.preco),
        descontoPct: lerPercentual(item.descontoPct),
      })),
    });

    const historicoSeguro = limitarHistoricoSeguro(historico);
    persistirHistoricoSeguro(historicoSeguro);
  } catch (erro) {
    console.error("Falha ao salvar historico:", erro);
  }
}

function carregarHistoricoPedidos() {
  try {
    const cru = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!cru) return [];
    const parsed = JSON.parse(cru);
    if (!Array.isArray(parsed)) return [];
    return limitarHistoricoSeguro(parsed);
  } catch (erro) {
    console.error("Falha ao carregar historico:", erro);
    return [];
  }
}

function exportarHistoricoPedidos() {
  const historico = carregarHistoricoPedidos();
  if (!historico.length) {
    mostrarFeedback("info", "Nenhum historico de pedido para exportar.");
    return;
  }

  const json = JSON.stringify(historico, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `historico-pedidos-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  mostrarFeedback("success", "Historico exportado em JSON.");
}

function medirTextoEmBytes(texto) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(String(texto)).length;
  }
  return String(texto).length * 2;
}

function limitarHistoricoSeguro(historico) {
  const listaBase = Array.isArray(historico) ? historico.slice(0, HISTORY_LIMIT) : [];
  if (!listaBase.length) return [];

  let lista = listaBase;
  let json = JSON.stringify(lista);

  while (lista.length > 1 && medirTextoEmBytes(json) > HISTORY_MAX_BYTES) {
    lista = lista.slice(0, -1);
    json = JSON.stringify(lista);
  }

  if (lista.length === 1 && medirTextoEmBytes(json) > HISTORY_MAX_BYTES) {
    const reduzido = reduzirRegistroHistorico(lista[0]);
    lista = [reduzido];
  }

  return lista;
}

function reduzirRegistroHistorico(registro) {
  const base = {
    ...registro,
    itens: Array.isArray(registro.itens)
      ? registro.itens.slice(0, Math.min(20, HISTORY_MAX_ITEMS_PER_ORDER))
      : [],
  };

  let lista = [base];
  let json = JSON.stringify(lista);

  while (base.itens.length > 1 && medirTextoEmBytes(json) > HISTORY_MAX_BYTES) {
    base.itens.pop();
    json = JSON.stringify(lista);
  }

  if (medirTextoEmBytes(json) > HISTORY_MAX_BYTES) {
    base.itens = [];
  }

  return base;
}

function persistirHistoricoSeguro(historico) {
  const normalizado = limitarHistoricoSeguro(historico);

  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(normalizado));
    return;
  } catch (erro) {
    console.warn("Historico cheio, aplicando fallback:", erro);
  }

  try {
    const fallback = normalizado.slice(0, HISTORY_FALLBACK_LIMIT);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(fallback));
  } catch (erroFinal) {
    console.error("Falha ao salvar historico mesmo com fallback:", erroFinal);
  }
}

function salvarEstadoLocal() {
  try {
    const estado = {
      cliente: {
        nome: inputClienteNome ? inputClienteNome.value : "",
        documento: inputClienteDocumento ? inputClienteDocumento.value : "",
        telefone: inputClienteTelefone ? inputClienteTelefone.value : "",
        dataNascimento: inputDataNascimentoCliente ? inputDataNascimentoCliente.value : "",
        dataPedido: inputClienteData ? inputClienteData.value : "",
        observacoes: inputClienteObs ? inputClienteObs.value : "",
      },
      carrinho,
      descontoTotalPct,
    };
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(estado));
  } catch (erro) {
    console.error("Falha ao salvar estado local:", erro);
  }
}

function restaurarEstadoLocal() {
  try {
    const cru = localStorage.getItem(STORAGE_STATE_KEY);
    if (!cru) return;

    const estado = JSON.parse(cru);
    if (!estado || typeof estado !== "object") return;

    const cliente = estado.cliente || {};

    if (inputClienteNome) inputClienteNome.value = cliente.nome || "";
    if (inputClienteDocumento) {
      inputClienteDocumento.value = formatarCpf(cliente.documento || "");
    }
    if (inputClienteTelefone) {
      inputClienteTelefone.value = formatarTelefone(cliente.telefone || "");
    }
    if (inputDataNascimentoCliente) {
      inputDataNascimentoCliente.value = cliente.dataNascimento || "";
    }
    if (inputClienteData) inputClienteData.value = cliente.dataPedido || "";
    if (inputClienteObs) inputClienteObs.value = cliente.observacoes || "";

    carrinho = Array.isArray(estado.carrinho)
      ? estado.carrinho.map(normalizarItemCarrinho).filter(Boolean)
      : [];

    descontoTotalPct = lerPercentual(estado.descontoTotalPct);
    if (inputDescontoTotalPct) inputDescontoTotalPct.value = String(descontoTotalPct);

    validarCamposCliente(false);
    mostrarFeedback("info", "Dados anteriores restaurados do navegador.");
  } catch (erro) {
    console.error("Falha ao restaurar estado local:", erro);
  }
}

function normalizarItemCarrinho(item) {
  if (!item || typeof item !== "object") return null;

  const preco = Number(item.preco);
  const qtd = parseInt(item.qtd, 10);
  if (!Number.isFinite(preco) || !Number.isFinite(qtd) || qtd <= 0) return null;

  return {
    codigo: item.codigo !== undefined ? String(item.codigo) : "",
    nome: item.nome !== undefined ? String(item.nome) : "",
    preco,
    qtd,
    descontoPct: lerPercentual(item.descontoPct),
  };
}

function mostrarFeedback(tipo, mensagem, duracaoMs = 4500) {
  if (!feedbackEl) return;

  feedbackEl.textContent = mensagem;
  feedbackEl.className = `feedback-message is-visible feedback-${tipo}`;

  if (feedbackTimeoutId) clearTimeout(feedbackTimeoutId);
  if (duracaoMs > 0) {
    feedbackTimeoutId = setTimeout(() => {
      feedbackEl.className = "feedback-message";
      feedbackEl.textContent = "";
    }, duracaoMs);
  }
}

function somenteDigitos(texto) {
  return String(texto || "").replace(/\D/g, "");
}

function formatarCpf(valor) {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (!digitos) return "";

  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  }
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(
    6,
    9
  )}-${digitos.slice(9)}`;
}

function formatarTelefone(valor) {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (!digitos) return "";

  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;

  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }

  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function validarCpf(cpfDigitos) {
  if (!/^\d{11}$/.test(cpfDigitos)) return false;
  if (/^(\d)\1+$/.test(cpfDigitos)) return false;

  const calcDigito = (base, fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (fatorInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calcDigito(cpfDigitos.slice(0, 9), 10);
  const digito2 = calcDigito(cpfDigitos.slice(0, 10), 11);
  return digito1 === Number(cpfDigitos[9]) && digito2 === Number(cpfDigitos[10]);
}

function validarCamposCliente(exibirMensagem) {
  let valido = true;

  if (inputClienteDocumento) {
    const cpfDigitos = somenteDigitos(inputClienteDocumento.value);
    const cpfValido =
      cpfDigitos.length === 0 || (cpfDigitos.length === 11 && validarCpf(cpfDigitos));
    inputClienteDocumento.classList.toggle("input-invalid", !cpfValido);
    if (!cpfValido) valido = false;
  }

  if (inputClienteTelefone) {
    const telDigitos = somenteDigitos(inputClienteTelefone.value);
    const telValido =
      telDigitos.length === 0 || telDigitos.length === 10 || telDigitos.length === 11;
    inputClienteTelefone.classList.toggle("input-invalid", !telValido);
    if (!telValido) valido = false;
  }

  if (!valido && exibirMensagem) {
    mostrarFeedback("error", "Revise CPF e telefone antes de continuar.");
  }

  return valido;
}

function formatarDataIsoParaBr(dataIso) {
  const raw = String(dataIso || "").trim();
  if (!raw) return "Nao informado";
  const partes = raw.split("-");
  if (partes.length !== 3) return raw;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarNumeroPtBr(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function obterHojeIsoLocal() {
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  return agora.toISOString().slice(0, 10);
}

function preencherDataPedidoPadrao() {
  if (!inputClienteData) return;
  if (inputClienteData.value) return;

  inputClienteData.value = obterHojeIsoLocal();
  salvarEstadoLocalDebounced();
}

function obterChaveProduto(codigo, nome) {
  const cod = String(codigo || "").trim();
  if (cod) return cod.toLowerCase();
  return `nome:${String(nome || "").trim().toLowerCase()}`;
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function debounce(fn, waitMs) {
  let timeoutId = null;
  return function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, waitMs);
  };
}
