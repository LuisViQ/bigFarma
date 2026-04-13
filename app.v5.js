let products = [];
let cart = [];
let totalDiscountPct = 0;

const EXAMS_FILE = "exames-v1.xlsx";
const STORAGE_STATE_KEY = "bigfarma:estado:v1";
const STORAGE_HISTORY_KEY = "bigfarma:historico:v1";
const HISTORY_LIMIT = 100;
const HISTORY_MAX_BYTES = 700 * 1024; // ~700 KB
const HISTORY_FALLBACK_LIMIT = 30;
const HISTORY_MAX_ITEMS_PER_ORDER = 120;

const inputName = document.getElementById("produtoNome");
const inputPrice = document.getElementById("produtoPreco");
const inputQty = document.getElementById("produtoQtd");
const btnAdd = document.getElementById("btnAdicionar");
const tbodyCart = document.getElementById("tbodyCarrinho");
const tdTotalGeneral = document.getElementById("totalGeral");
const tdTotalFinal = document.getElementById("totalFinal");
const btnExportPdf = document.getElementById("btnExportarPdf");
const btnExportNativePdf = document.getElementById("btnExportarPdfNativo");
const btnExportHistory = document.getElementById("btnExportarHistorico");
const btnClearCart = document.getElementById("btnLimpar");
const inputItemDiscountPct = document.getElementById("descontoItemPct");
const inputTotalDiscountPct = document.getElementById("descontoTotalPct");
const elExamsStatus = document.getElementById("statusExames");
const elFeedback = document.getElementById("feedbackMensagem");

const inputClientName = document.getElementById("clienteNome");
const inputClientDocument = document.getElementById("clienteDocumento");
const inputClientPhone = document.getElementById("clienteTelefone");
const inputClientBirthDate = document.getElementById("clienteDataNascimento");
const inputClientDate = document.getElementById("clienteData");
const inputClientNotes = document.getElementById("clienteObs");

let feedbackTimeoutId = null;
const debouncedSaveLocalState = debounce(saveLocalState, 250);

window.addEventListener("load", initializeApp);

function initializeApp() {
  setupEvents();
  
  // Reseta os campos e o carrinho assim que entra na página
  resetClientFields();
  resetProductFields();
  cart = [];
  
  // Caso queira voltar a restaurar o cache antigo, basta descomentar a linha abaixo
  // restoreLocalState(); 
  
  fillDefaultOrderDate();
  renderCart();
  loadFixedExams();
}

function setupEvents() {
  if (inputName) inputName.addEventListener("input", onProductChange);
  if (btnAdd) btnAdd.addEventListener("click", addToCart);
  if (btnExportPdf) btnExportPdf.addEventListener("click", exportToPrint);
  if (btnExportNativePdf) {
    btnExportNativePdf.addEventListener("click", exportNativePdf);
  }
  if (btnExportHistory) {
    btnExportHistory.addEventListener("click", exportOrderHistory);
  }
  if (btnClearCart) btnClearCart.addEventListener("click", clearCart);

  if (inputTotalDiscountPct) {
    inputTotalDiscountPct.addEventListener("input", () => {
      totalDiscountPct = readPercentage(inputTotalDiscountPct.value);
      renderCart();
      debouncedSaveLocalState();
    });
  }

  if (inputClientDocument) {
    inputClientDocument.addEventListener("input", () => {
      inputClientDocument.value = formatCpf(inputClientDocument.value);
      validateClientFields(false);
      debouncedSaveLocalState();
    });
    inputClientDocument.addEventListener("blur", () => validateClientFields(true));
  }

  if (inputClientPhone) {
    inputClientPhone.addEventListener("input", () => {
      inputClientPhone.value = formatPhone(inputClientPhone.value);
      validateClientFields(false);
      debouncedSaveLocalState();
    });
    inputClientPhone.addEventListener("blur", () => validateClientFields(true));
  }

  [
    inputClientName,
    inputClientBirthDate,
    inputClientDate,
    inputClientNotes,
    inputQty,
    inputItemDiscountPct,
  ].forEach((field) => {
    if (field) field.addEventListener("input", debouncedSaveLocalState);
  });
}

async function loadFixedExams() {
  try {
    const response = await fetch(EXAMS_FILE);

    if (!response.ok) {
      throw new Error(
        `Arquivo "${EXAMS_FILE}" nao encontrado. Deixe o arquivo na mesma pasta do index.html.`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    products = parseExcelRows(rows);
    if (!products.length) {
      throw new Error(
        "Nenhum exame foi carregado. Verifique se a planilha tem dados nas colunas CODIGO / EXAME / VALOR."
      );
    }

    populateDatalist();
    if (elExamsStatus) {
      elExamsStatus.textContent = `Exames carregados com sucesso de "${EXAMS_FILE}".`;
    }
    showFeedback("success", "Tabela de exames carregada com sucesso.");
  } catch (error) {
    console.error("Erro ao carregar exames:", error);
    if (elExamsStatus) {
      elExamsStatus.textContent = "Erro ao carregar exames: " + error.message;
    }
    showFeedback("error", "Erro ao carregar o arquivo de exames: " + error.message, 7000);
  }
}

function normalizeHeader(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function extractCodeFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const separator = raw.match(/^\s*([^\-\u2013\u2014]+?)\s*[\-\u2013\u2014]\s*(.+)\s*$/);
  if (separator && separator[1]) return String(separator[1]).trim();

  return "";
}

function parseExcelRows(rows) {
  if (!rows || rows.length < 2) {
    throw new Error("A planilha esta vazia ou sem linhas de dados.");
  }

  const rawHeader = rows[0];
  const header = rawHeader.map((h) => (h ? normalizeHeader(h) : ""));

  const idxCode = header.indexOf("codigo");
  const idxName = header.indexOf("exame");
  const idxPrice = header.indexOf("valor");

  if (idxCode === -1 || idxName === -1 || idxPrice === -1) {
    throw new Error(
      "Cabecalho incorreto. Esperado: colunas CODIGO, EXAME e VALOR na primeira linha da planilha."
    );
  }

  const parsedProducts = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const cellCode = row[idxCode];
    const cellName = row[idxName];
    const cellPrice = row[idxPrice];

    if (!cellName || cellPrice === undefined || cellPrice === null) continue;

    const numPrice = parseValue(cellPrice);
    if (Number.isNaN(numPrice)) continue;

    parsedProducts.push({
      codigo: cellCode !== undefined ? String(cellCode).trim() : "",
      nome: String(cellName).trim(),
      preco: numPrice,
    });
  }

  return parsedProducts;
}

function parseValue(value) {
  if (typeof value === "number") return value;

  const priceStr = String(value)
    .trim()
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(priceStr);
}

function populateDatalist() {
  const list = document.getElementById("listaProdutos");
  if (!list) return;

  list.innerHTML = "";
  products.forEach((product) => {
    const opt = document.createElement("option");
    const code = String(product.codigo || "").trim();
    const name = String(product.nome || "").trim();
    opt.value = code ? `${code} - ${name}` : name;
    list.appendChild(opt);
  });
}

function findProductByText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const extractedCode = extractCodeFromText(raw);
  if (extractedCode) {
    const normCode = extractedCode.trim().toLowerCase();
    const foundByCode = products.find(
      (item) => String(item.codigo || "").trim().toLowerCase() === normCode
    );
    if (foundByCode) return foundByCode;
  }

  const normalizedText = normalizeText(raw);
  const rawLower = raw.toLowerCase();

  const exactMatch = products.find((item) => {
    const name = normalizeText(item.nome);
    const code = String(item.codigo || "").trim().toLowerCase();
    return name === normalizedText || code === rawLower;
  });
  if (exactMatch) return exactMatch;

  const partialMatch = products.find((item) => {
    const name = normalizeText(item.nome);
    const code = String(item.codigo || "").trim().toLowerCase();
    return name.includes(normalizedText) || code.includes(rawLower);
  });

  return partialMatch || null;
}

function readPercentage(value) {
  let n = parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(n)) n = 0;
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return n;
}

function applyDiscount(value, pct) {
  return value * (1 - pct / 100);
}

function onProductChange() {
  if (!inputName || !inputPrice) return;

  const text = inputName.value;
  if (!text || !text.trim()) {
    inputPrice.value = "";
    return;
  }

  const product = findProductByText(text);
  if (!product) {
    inputPrice.value = "";
    return;
  }

  inputPrice.value = product.preco.toFixed(2);
}

function addToCart() {
  if (!inputName || !inputQty || !inputPrice) return;

  const typedText = inputName.value;
  const qty = parseInt(inputQty.value, 10);

  if (!products.length) {
    showFeedback("error", "Nenhum exame carregado. Verifique o arquivo de exames.");
    return;
  }

  if (!typedText || !typedText.trim()) {
    showFeedback("error", "Digite ou selecione um exame (nome ou codigo).");
    return;
  }

  const product = findProductByText(typedText);
  if (!product) {
    showFeedback("error", "Exame nao encontrado. Confira nome/codigo ou o arquivo.");
    return;
  }

  if (!qty || qty <= 0) {
    showFeedback("error", "Quantidade invalida.");
    return;
  }

  const itemDiscountPct = inputItemDiscountPct
    ? readPercentage(inputItemDiscountPct.value)
    : 0;

  const productKey = getProductKey(product.codigo, product.nome);
  const existingItem = cart.find(
    (item) => getProductKey(item.codigo, item.nome) === productKey
  );

  if (existingItem) {
    existingItem.qtd += qty;
    existingItem.descontoPct = itemDiscountPct;
  } else {
    cart.push({
      codigo: product.codigo,
      nome: product.nome,
      preco: product.preco,
      qtd: qty,
      descontoPct: itemDiscountPct,
    });
  }

  resetProductFields();
  renderCart();
  saveLocalState();
  showFeedback("success", `Exame "${product.nome}" adicionado ao carrinho.`);
}

function removeItem(code, name) {
  const key = getProductKey(code, name);
  cart = cart.filter(
    (item) => getProductKey(item.codigo, item.nome) !== key
  );
  renderCart();
  saveLocalState();
  showFeedback("success", "Item removido do carrinho.");
}

// Funções novas para esvaziar os inputs
function resetProductFields() {
  if (inputName) inputName.value = "";
  if (inputPrice) inputPrice.value = "";
  if (inputQty) inputQty.value = 1;
  if (inputItemDiscountPct) inputItemDiscountPct.value = 0;
}

function resetClientFields() {
  if (inputClientName) inputClientName.value = "";
  if (inputClientDocument) {
    inputClientDocument.value = "";
    inputClientDocument.classList.remove("input-invalid");
  }
  if (inputClientPhone) {
    inputClientPhone.value = "";
    inputClientPhone.classList.remove("input-invalid");
  }
  if (inputClientBirthDate) inputClientBirthDate.value = "";
  if (inputClientNotes) inputClientNotes.value = "";
  if (inputTotalDiscountPct) inputTotalDiscountPct.value = "0";
  totalDiscountPct = 0;
  fillDefaultOrderDate();
}

function clearCart() {
  const isCartEmpty = !cart.length;
  const isClientInfoEmpty = !(inputClientName && inputClientName.value);
  
  if (isCartEmpty && isClientInfoEmpty) {
    showFeedback("info", "O carrinho e os dados ja estao vazios.");
    return;
  }

  const confirmed = window.confirm("Deseja limpar todos os exames do carrinho e os dados do cliente?");
  if (!confirmed) return;

  cart = [];
  resetProductFields();
  resetClientFields();
  
  renderCart();
  saveLocalState();
  showFeedback("success", "Carrinho e campos limpos com sucesso.");
}

function calculateItemSubtotal(item) {
  const grossSubtotal = Number(item.preco) * Number(item.qtd);
  const discountPct = readPercentage(item.descontoPct);
  return applyDiscount(grossSubtotal, discountPct);
}

function getCartTotals() {
  let totalWithItem = 0;
  cart.forEach((item) => {
    totalWithItem += calculateItemSubtotal(item);
  });

  const finalTotal = applyDiscount(totalWithItem, totalDiscountPct);
  return { totalWithItem, finalTotal };
}

function renderCart() {
  if (!tbodyCart || !tdTotalGeneral || !tdTotalFinal) return;

  tbodyCart.innerHTML = "";

  if (!cart.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = '<td colspan="7">Nenhum exame selecionado.</td>';
    tbodyCart.appendChild(emptyRow);
  } else {
    cart.forEach((item) => {
      const tr = document.createElement("tr");
      const discountPct = readPercentage(item.descontoPct);
      const subtotalWithDiscount = calculateItemSubtotal(item);

      tr.innerHTML = `
        <td>${escapeHtml(item.codigo || "-")}</td>
        <td>${escapeHtml(item.nome || "-")}</td>
        <td>${Number(item.preco).toFixed(2)}</td>
        <td>${Number(item.qtd)}</td>
        <td>${discountPct.toFixed(2)}%</td>
        <td>${subtotalWithDiscount.toFixed(2)}</td>
        <td>
          <button
            class="btn-remover"
            data-codigo="${escapeHtml(item.codigo || "")}"
            data-nome="${escapeHtml(item.nome || "")}"
          >
            Remover
          </button>
        </td>
      `;

      tbodyCart.appendChild(tr);
    });
  }

  const { totalWithItem, finalTotal } = getCartTotals();
  tdTotalGeneral.textContent = totalWithItem.toFixed(2);
  tdTotalFinal.textContent = finalTotal.toFixed(2);

  const removeButtons = tbodyCart.querySelectorAll(".btn-remover");
  removeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-codigo") || "";
      const name = btn.getAttribute("data-nome") || "";
      removeItem(code, name);
    });
  });
}

function getClientData() {
  return {
    nome: (inputClientName && inputClientName.value.trim()) || "Nao informado",
    cpf: (inputClientDocument && inputClientDocument.value.trim()) || "Nao informado",
    telefone: (inputClientPhone && inputClientPhone.value.trim()) || "Nao informado",
    dataNascimento:
      (inputClientBirthDate && formatIsoDateToBr(inputClientBirthDate.value)) ||
      "Nao informado",
    dataPedido:
      (inputClientDate && formatIsoDateToBr(inputClientDate.value)) ||
      formatIsoDateToBr(new Date().toISOString().slice(0, 10)),
    observacoes: (inputClientNotes && inputClientNotes.value.trim()) || "-",
  };
}

function exportToPrint() {
  if (!cart.length) {
    showFeedback("error", "Nenhum exame no carrinho para exportar.");
    return;
  }
  if (!validateClientFields(true)) return;

  const clientData = getClientData();
  const table = document.querySelector(".cart-table");
  if (!table) return;

  const tableHtml = table.outerHTML;
  const notesHtml = escapeHtml(clientData.observacoes).replace(/\n/g, "<br>");

  const newWindow = window.open("", "_blank");
  if (!newWindow) {
    showFeedback("error", "Popup bloqueado. Permita popups para imprimir o pedido.");
    return;
  }

  const style = `
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

  newWindow.document.write(`
    <html>
      <head>
        <title>Pedido de exames - BigFarma</title>
        ${style}
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
          <p><strong>Paciente:</strong> ${escapeHtml(clientData.nome)}</p>
          <p><strong>CPF:</strong> ${escapeHtml(clientData.cpf)}</p>
          <p><strong>Data de nascimento:</strong> ${escapeHtml(clientData.dataNascimento)}</p>
          <p><strong>Telefone:</strong> ${escapeHtml(clientData.telefone)}</p>
          <p><strong>Data do pedido:</strong> ${escapeHtml(clientData.dataPedido)}</p>
          <p><strong>Observacoes:</strong><br>${notesHtml}</p>
        </div>
        ${tableHtml}
        <div class="footer">
          <span>BigFarma</span>
          <span>Responsavel: _____________________</span>
        </div>
      </body>
    </html>
  `);

  newWindow.document.close();
  newWindow.onload = () => {
    newWindow.focus();
    newWindow.print();
    newWindow.close();
  };

  registerOrderHistory("impressao");
  showFeedback("success", "Pedido enviado para impressao.");
}

async function exportNativePdf() {
  if (!cart.length) {
    showFeedback("error", "Nenhum exame no carrinho para gerar PDF.");
    return;
  }
  if (!validateClientFields(true)) return;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showFeedback("error", "Biblioteca de PDF indisponivel.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  const clientData = getClientData();
  const { totalWithItem, finalTotal } = getCartTotals();

  const [leftLogoBw, rightLogoBw] = await Promise.all([
    loadLogoForPdfBw("logo_big_farma.jpg"),
    loadLogoForPdfBw("logo_crd.jpg"),
  ]);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const logoSize = 52;
  const headerTop = 34;

  if (leftLogoBw) {
    doc.addImage(leftLogoBw, "JPEG", marginX, headerTop, logoSize, logoSize);
  }
  if (rightLogoBw) {
    doc.addImage(
      rightLogoBw,
      "JPEG",
      pageWidth - marginX - logoSize,
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

  const headerLineY = headerTop + logoSize + 10;
  doc.setLineWidth(1.1);
  doc.line(marginX, headerLineY, pageWidth - marginX, headerLineY);
  doc.setLineWidth(0.4);

  let y = headerLineY + 16;

  const baseClientLines = [
    `Paciente: ${clientData.nome}`,
    `CPF: ${clientData.cpf}`,
    `Data de nascimento: ${clientData.dataNascimento}`,
    `Telefone: ${clientData.telefone}`,
    `Data do pedido: ${clientData.dataPedido}`,
  ];
  const notesLines = doc.splitTextToSize(
    `Observacoes: ${clientData.observacoes}`,
    contentWidth - 20
  );
  const clientBlockLines = [...baseClientLines, ...notesLines];
  const lineHeight = 13;
  const blockHeight = clientBlockLines.length * lineHeight + 14;

  if (typeof doc.roundedRect === "function") {
    doc.roundedRect(marginX, y, contentWidth, blockHeight, 6, 6);
  } else {
    doc.rect(marginX, y, contentWidth, blockHeight);
  }

  let textBlockY = y + 16;
  doc.setFontSize(10);
  clientBlockLines.forEach((line) => {
    doc.text(line, marginX + 10, textBlockY);
    textBlockY += lineHeight;
  });
  y += blockHeight + 12;

  const tableRows = cart.map((item) => {
    const discountPct = readPercentage(item.descontoPct);
    const subtotal = calculateItemSubtotal(item);
    return [
      String(item.codigo || "-"),
      String(item.nome || "-"),
      formatNumberPtBr(item.preco),
      String(item.qtd),
      `${discountPct.toFixed(2)}%`,
      formatNumberPtBr(subtotal),
    ];
  });

  if (typeof doc.autoTable === "function") {
    doc.autoTable({
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 70 },
      head: [["Codigo", "Exame", "Valor", "Qtd", "Desc.%", "Subtotal"]],
      body: tableRows,
      foot: [
        ["", "", "", "", "Total (c/ desconto por item)", formatNumberPtBr(totalWithItem)],
        ["", "", "", "", "Total final (c/ desconto geral)", formatNumberPtBr(finalTotal)],
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
    tableRows.forEach((row) => {
      doc.text(row.join(" | "), marginX, y);
      y += 12;
    });
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Total (c/ desconto por item): ${formatNumberPtBr(totalWithItem)}`, marginX, y);
    y += 16;
    doc.text(`Total final (c/ desconto geral): ${formatNumberPtBr(finalTotal)}`, marginX, y);
  }

  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);

  const footerY = pageHeight - 24;
  doc.setLineWidth(0.8);
  doc.line(marginX, footerY - 11, pageWidth - marginX, footerY - 11);
  doc.setLineWidth(0.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("BigFarma", marginX, footerY);
  doc.text("Responsavel: _____________________", pageWidth - marginX, footerY, {
    align: "right",
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  doc.save(`pedido-exames-${stamp}.pdf`);

  registerOrderHistory("pdf_nativo");
  showFeedback("success", "PDF gerado com sucesso.");
}

function loadLogoForPdfBw(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const maxSide = 180;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (error) {
        console.warn("Falha ao converter logo para P&B:", error);
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function registerOrderHistory(channel) {
  try {
    const history = loadOrderHistory();
    const clientData = getClientData();
    const { totalWithItem, finalTotal } = getCartTotals();

    history.unshift({
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      geradoEm: new Date().toISOString(),
      canal: channel,
      paciente: {
        nome: clientData.nome,
        cpf: clientData.cpf,
        telefone: clientData.telefone,
      },
      totais: {
        totalComDescontoItem: Number(totalWithItem.toFixed(2)),
        totalFinal: Number(finalTotal.toFixed(2)),
      },
      itens: cart.slice(0, HISTORY_MAX_ITEMS_PER_ORDER).map((item) => ({
        codigo: item.codigo || "",
        exame: item.nome || "",
        quantidade: Number(item.qtd),
        valorUnitario: Number(item.preco),
        descontoPct: readPercentage(item.descontoPct),
      })),
    });

    const safeHistory = limitHistorySafely(history);
    persistHistorySafely(safeHistory);
  } catch (error) {
    console.error("Falha ao salvar historico:", error);
  }
}

function loadOrderHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return limitHistorySafely(parsed);
  } catch (error) {
    console.error("Falha ao carregar historico:", error);
    return [];
  }
}

function exportOrderHistory() {
  const history = loadOrderHistory();
  if (!history.length) {
    showFeedback("info", "Nenhum historico de pedido para exportar.");
    return;
  }

  const json = JSON.stringify(history, null, 2);
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

  showFeedback("success", "Historico exportado em JSON.");
}

function measureTextInBytes(text) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(String(text)).length;
  }
  return String(text).length * 2;
}

function limitHistorySafely(history) {
  const baseList = Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [];
  if (!baseList.length) return [];

  let list = baseList;
  let json = JSON.stringify(list);

  while (list.length > 1 && measureTextInBytes(json) > HISTORY_MAX_BYTES) {
    list = list.slice(0, -1);
    json = JSON.stringify(list);
  }

  if (list.length === 1 && measureTextInBytes(json) > HISTORY_MAX_BYTES) {
    const reduced = reduceHistoryRecord(list[0]);
    list = [reduced];
  }

  return list;
}

function reduceHistoryRecord(record) {
  const base = {
    ...record,
    itens: Array.isArray(record.itens)
      ? record.itens.slice(0, Math.min(20, HISTORY_MAX_ITEMS_PER_ORDER))
      : [],
  };

  let list = [base];
  let json = JSON.stringify(list);

  while (base.itens.length > 1 && measureTextInBytes(json) > HISTORY_MAX_BYTES) {
    base.itens.pop();
    json = JSON.stringify(list);
  }

  if (measureTextInBytes(json) > HISTORY_MAX_BYTES) {
    base.itens = [];
  }

  return base;
}

function persistHistorySafely(history) {
  const normalized = limitHistorySafely(history);

  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(normalized));
    return;
  } catch (error) {
    console.warn("Historico cheio, aplicando fallback:", error);
  }

  try {
    const fallback = normalized.slice(0, HISTORY_FALLBACK_LIMIT);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(fallback));
  } catch (finalError) {
    console.error("Falha ao salvar historico mesmo com fallback:", finalError);
  }
}

function saveLocalState() {
  try {
    const state = {
      cliente: {
        nome: inputClientName ? inputClientName.value : "",
        documento: inputClientDocument ? inputClientDocument.value : "",
        telefone: inputClientPhone ? inputClientPhone.value : "",
        dataNascimento: inputClientBirthDate ? inputClientBirthDate.value : "",
        dataPedido: inputClientDate ? inputClientDate.value : "",
        observacoes: inputClientNotes ? inputClientNotes.value : "",
      },
      carrinho: cart,
      descontoTotalPct: totalDiscountPct,
    };
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Falha ao salvar estado local:", error);
  }
}

function restoreLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    if (!raw) return;

    const state = JSON.parse(raw);
    if (!state || typeof state !== "object") return;

    const client = state.cliente || {};

    if (inputClientName) inputClientName.value = client.nome || "";
    if (inputClientDocument) {
      inputClientDocument.value = formatCpf(client.documento || "");
    }
    if (inputClientPhone) {
      inputClientPhone.value = formatPhone(client.telefone || "");
    }
    if (inputClientBirthDate) {
      inputClientBirthDate.value = client.dataNascimento || "";
    }
    if (inputClientDate) inputClientDate.value = client.dataPedido || "";
    if (inputClientNotes) inputClientNotes.value = client.observacoes || "";

    cart = Array.isArray(state.carrinho)
      ? state.carrinho.map(normalizeCartItem).filter(Boolean)
      : [];

    totalDiscountPct = readPercentage(state.descontoTotalPct);
    if (inputTotalDiscountPct) inputTotalDiscountPct.value = String(totalDiscountPct);

    validateClientFields(false);
    showFeedback("info", "Dados anteriores restaurados do navegador.");
  } catch (error) {
    console.error("Falha ao restaurar estado local:", error);
  }
}

function normalizeCartItem(item) {
  if (!item || typeof item !== "object") return null;

  const price = Number(item.preco);
  const qty = parseInt(item.qtd, 10);
  if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) return null;

  return {
    codigo: item.codigo !== undefined ? String(item.codigo) : "",
    nome: item.nome !== undefined ? String(item.nome) : "",
    preco: price,
    qtd: qty,
    descontoPct: readPercentage(item.descontoPct),
  };
}

function showFeedback(type, message, durationMs = 4500) {
  if (!elFeedback) return;

  elFeedback.textContent = message;
  elFeedback.className = `feedback-message is-visible feedback-${type}`;

  if (feedbackTimeoutId) clearTimeout(feedbackTimeoutId);
  if (durationMs > 0) {
    feedbackTimeoutId = setTimeout(() => {
      elFeedback.className = "feedback-message";
      elFeedback.textContent = "";
    }, durationMs);
  }
}

function onlyDigits(text) {
  return String(text || "").replace(/\D/g, "");
}

function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9)}`;
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";

  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validateCpf(cpfDigits) {
  if (!/^\d{11}$/.test(cpfDigits)) return false;
  if (/^(\d)\1+$/.test(cpfDigits)) return false;

  const calcDigit = (base, initialFactor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (initialFactor - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const digit1 = calcDigit(cpfDigits.slice(0, 9), 10);
  const digit2 = calcDigit(cpfDigits.slice(0, 10), 11);
  return digit1 === Number(cpfDigits[9]) && digit2 === Number(cpfDigits[10]);
}

function validateClientFields(showMessage) {
  let isValid = true;

  if (inputClientDocument) {
    const cpfDigits = onlyDigits(inputClientDocument.value);
    const cpfValid =
      cpfDigits.length === 0 || (cpfDigits.length === 11 && validateCpf(cpfDigits));
    inputClientDocument.classList.toggle("input-invalid", !cpfValid);
    if (!cpfValid) isValid = false;
  }

  if (inputClientPhone) {
    const phoneDigits = onlyDigits(inputClientPhone.value);
    const phoneValid =
      phoneDigits.length === 0 || phoneDigits.length === 10 || phoneDigits.length === 11;
    inputClientPhone.classList.toggle("input-invalid", !phoneValid);
    if (!phoneValid) isValid = false;
  }

  if (!isValid && showMessage) {
    showFeedback("error", "Revise CPF e telefone antes de continuar.");
  }

  return isValid;
}

function formatIsoDateToBr(isoDate) {
  const raw = String(isoDate || "").trim();
  if (!raw) return "Nao informado";
  const parts = raw.split("-");
  if (parts.length !== 3) return raw;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatNumberPtBr(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getTodayIsoLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function fillDefaultOrderDate() {
  if (!inputClientDate) return;
  inputClientDate.value = getTodayIsoLocal();
  debouncedSaveLocalState();
}

function getProductKey(code, name) {
  const rawCode = String(code || "").trim();
  if (rawCode) return rawCode.toLowerCase();
  return `nome:${String(name || "").trim().toLowerCase()}`;
}

function escapeHtml(text) {
  return String(text)
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