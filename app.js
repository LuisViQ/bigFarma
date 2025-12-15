let produtos = [];
let carrinho = [];

const EXAMES_ARQUIVO = 'exames.xlsx';

// ===============================
//   Carregar exames ao iniciar
// ===============================
window.addEventListener('load', () => {
  carregarExamesFixos();
});

async function carregarExamesFixos() {
  const statusExamesEl = document.getElementById('statusExames');

  try {
    const resposta = await fetch(EXAMES_ARQUIVO);

    if (!resposta.ok) {
      throw new Error(
        `Arquivo "${EXAMES_ARQUIVO}" não encontrado. Deixe o arquivo na mesma pasta do index.html.`
      );
    }

    const arrayBuffer = await resposta.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Linhas brutas do Excel:', rows);

    produtos = parseExcelRows(rows);
    console.log('Exames carregados (Excel):', produtos);

    if (!produtos.length) {
      throw new Error(
        'Nenhum exame foi carregado. Verifique se a planilha tem dados nas colunas CODIGO / EXAME / VALOR.'
      );
    }

    popularDatalist();
    if (statusExamesEl) {
      statusExamesEl.textContent = `Exames carregados com sucesso de "${EXAMES_ARQUIVO}".`;
    }
  } catch (erro) {
    console.error('Erro ao carregar exames:', erro);
    if (statusExamesEl) {
      statusExamesEl.textContent = 'Erro ao carregar exames: ' + erro.message;
    }
    alert('Erro ao carregar o arquivo de exames:\n' + erro.message);
  }
}

// ===============================
//   Normalização de cabeçalho
// ===============================
function normalizaCabecalho(s) {
  return s
    .trim()
    .toLowerCase()
    .replace('á', 'a')
    .replace('â', 'a')
    .replace('ã', 'a')
    .replace('é', 'e')
    .replace('ê', 'e')
    .replace('í', 'i')
    .replace('ó', 'o')
    .replace('ô', 'o')
    .replace('õ', 'o')
    .replace('ú', 'u')
    .replace('ç', 'c');
}

// ===============================
//   Parse Excel (linhas já em array) - CODIGO / EXAME / VALOR
// ===============================
function parseExcelRows(rows) {
  if (!rows || rows.length < 2) {
    throw new Error('A planilha está vazia ou sem linhas de dados.');
  }

  const cabecalhoRaw = rows[0];
  const cabecalho = cabecalhoRaw.map((h) =>
    h ? normalizaCabecalho(String(h)) : ''
  );

  const idxCodigo = cabecalho.indexOf('codigo');
  const idxNome = cabecalho.indexOf('exame');
  const idxValor = cabecalho.indexOf('valor');

  if (idxCodigo === -1 || idxNome === -1 || idxValor === -1) {
    throw new Error(
      'Cabeçalho incorreto. Esperado: colunas CODIGO, EXAME e VALOR na primeira linha da planilha.'
    );
  }

  const produtosParseados = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const codigoCel = row[idxCodigo];
    const nomeCel = row[idxNome];
    let valorCel = row[idxValor];

    if (!nomeCel || valorCel === undefined || valorCel === null) {
      console.warn('Linha ignorada (nome ou valor vazio):', row);
      continue;
    }

    let precoNum;

    if (typeof valorCel === 'number') {
      precoNum = valorCel;
    } else {
      let precoStr = String(valorCel)
        .trim()
        .replace('R$', '')
        .replace(/\./g, '')
        .replace(',', '.');
      precoNum = parseFloat(precoStr);
    }

    if (isNaN(precoNum)) {
      console.warn('Linha ignorada (valor inválido):', row);
      continue;
    }

    produtosParseados.push({
      codigo: codigoCel !== undefined ? String(codigoCel).trim() : '',
      nome: String(nomeCel).trim(),
      preco: precoNum,
    });
  }

  return produtosParseados;
}

// ===============================
//   Datalist de exames
// ===============================
function popularDatalist() {
  const lista = document.getElementById('listaProdutos');
  lista.innerHTML = '';
  produtos.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.nome; // só o nome do exame
    lista.appendChild(opt);
  });
}

// ===============================
//   Helpers desconto (%)
// ===============================
function lerPercentual(valor) {
  let n = parseFloat(String(valor).replace(',', '.'));
  if (isNaN(n)) n = 0;
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return n;
}

function aplicarDesconto(valor, pct) {
  return valor * (1 - pct / 100);
}

// ===============================
//   Interação do carrinho
// ===============================
const inputNome = document.getElementById('produtoNome');
const inputPreco = document.getElementById('produtoPreco');
const inputQtd = document.getElementById('produtoQtd');
const btnAdicionar = document.getElementById('btnAdicionar');
const tbodyCarrinho = document.getElementById('tbodyCarrinho');
const totalGeralTd = document.getElementById('totalGeral');
const btnExportarPdf = document.getElementById('btnExportarPdf');

// NOVO: desconto por item e desconto geral
const inputDescontoItemPct = document.getElementById('descontoItemPct');   // <input id="descontoItemPct">
const inputDescontoTotalPct = document.getElementById('descontoTotalPct'); // <input id="descontoTotalPct">
const totalFinalTd = document.getElementById('totalFinal');               // <td id="totalFinal"> (opcional)

let descontoTotalPct = 0;

// NOVO: campos do cliente
const inputClienteNome = document.getElementById('clienteNome');
const inputClienteDocumento = document.getElementById('clienteDocumento');
const inputClienteTelefone = document.getElementById('clienteTelefone');
const inputClienteData = document.getElementById('clienteData');
const inputClienteObs = document.getElementById('clienteObs');

inputNome.addEventListener('input', aoAlterarProduto);
btnAdicionar.addEventListener('click', adicionarAoCarrinho);
btnExportarPdf.addEventListener('click', exportarSomenteTabela);

// Atualiza desconto geral ao digitar
if (inputDescontoTotalPct) {
  inputDescontoTotalPct.addEventListener('input', () => {
    descontoTotalPct = lerPercentual(inputDescontoTotalPct.value);
    renderizarCarrinho();
  });
}

// ===============================
//   Exportar só a tabela para PDF + dados do cliente
// ===============================
function exportarSomenteTabela() {
  if (!carrinho.length) {
    alert('Nenhum exame no carrinho para exportar.');
    return;
  }

  const tabela = document.querySelector('.cart-table').outerHTML;

  // Pega dados do cliente
  const nomeCliente =
    (inputClienteNome && inputClienteNome.value.trim()) || 'Não informado';
  const docCliente =
    (inputClienteDocumento && inputClienteDocumento.value.trim()) ||
    'Não informado';
  const telCliente =
    (inputClienteTelefone && inputClienteTelefone.value.trim()) ||
    'Não informado';

  let dataPedido;
  if (inputClienteData && inputClienteData.value) {
    dataPedido = new Date(
      inputClienteData.value + 'T00:00:00'
    ).toLocaleDateString('pt-BR');
  } else {
    dataPedido = new Date().toLocaleDateString('pt-BR');
  }

  let obs = (inputClienteObs && inputClienteObs.value.trim()) || '';
  obs = obs.replace(/\n/g, '<br>');

  const estilo = `
    <style>
      body { font-family: Arial, sans-serif; font-size: 14px; }
      h1, h2 { margin: 4px 0; }
      .cliente-bloco { margin-bottom: 16px; }
      .cliente-bloco p { margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th, td { border: 1px solid #555; padding: 6px; text-align: left; }
      th { background: #eee; }
    </style>
  `;

  const novaJanela = window.open('', '_blank');

  novaJanela.document.write(`
    <html>
      <head>
        <title>Exames selecionados</title>
        ${estilo}
      </head>
      <body>
        <h1>BigFarma</h1>
        <h2>Pedido de Exames</h2>
        <div class="cliente-bloco">
          <p><strong>Paciente:</strong> ${nomeCliente}</p>
          <p><strong>Documento:</strong> ${docCliente}</p>
          <p><strong>Telefone:</strong> ${telCliente}</p>
          <p><strong>Data do pedido:</strong> ${dataPedido}</p>
          ${
            obs
              ? `<p><strong>Observações:</strong><br>${obs}</p>`
              : `<p><strong>Observações:</strong> - </p>`
          }
        </div>
        ${tabela}
      </body>
    </html>
  `);

  novaJanela.document.close();

  novaJanela.onload = () => {
    novaJanela.print();
    novaJanela.close();
  };
}

// ===============================
//   Lógica dos inputs
// ===============================
function aoAlterarProduto() {
  const nomeDigitado = inputNome.value.trim().toLowerCase();

  if (!nomeDigitado) {
    inputPreco.value = '';
    return;
  }

  const produto = produtos.find(
    (p) => p && p.nome && p.nome.toLowerCase() === nomeDigitado
  );

  if (!produto) {
    inputPreco.value = '';
    return;
  }

  inputPreco.value = produto.preco.toFixed(2);
}

function adicionarAoCarrinho() {
  const nomeDigitado = inputNome.value.trim().toLowerCase();
  const qtd = parseInt(inputQtd.value, 10);

  if (!produtos.length) {
    alert('Nenhum exame carregado. Verifique o arquivo "exames.xlsx".');
    return;
  }

  if (!nomeDigitado) {
    alert('Digite ou selecione um exame.');
    return;
  }

  const produto = produtos.find(
    (p) => p && p.nome && p.nome.toLowerCase() === nomeDigitado
  );

  if (!produto) {
    alert('Exame não encontrado. Confira o nome ou o arquivo de exames.');
    return;
  }

  if (!qtd || qtd <= 0) {
    alert('Quantidade inválida.');
    return;
  }

  const descontoItemPct = inputDescontoItemPct
    ? lerPercentual(inputDescontoItemPct.value)
    : 0;

  const existente = carrinho.find((item) => item.codigo === produto.codigo);
  if (existente) {
    existente.qtd += qtd;
    // se você quiser atualizar o desconto ao adicionar de novo:
    existente.descontoPct = descontoItemPct;
  } else {
    carrinho.push({
      codigo: produto.codigo,
      nome: produto.nome,
      preco: produto.preco,
      qtd: qtd,
      descontoPct: descontoItemPct,
    });
  }

  inputNome.value = '';
  inputPreco.value = '';
  inputQtd.value = 1;
  if (inputDescontoItemPct) inputDescontoItemPct.value = 0;

  renderizarCarrinho();
}

function removerItem(codigo) {
  carrinho = carrinho.filter((item) => item.codigo !== codigo);
  renderizarCarrinho();
}

function renderizarCarrinho() {
  tbodyCarrinho.innerHTML = '';

  let totalBruto = 0;        // sem descontos
  let totalComItem = 0;      // com desconto por item (sem o desconto geral)

  carrinho.forEach((item) => {
    const tr = document.createElement('tr');

    const subtotalBruto = item.preco * item.qtd;
    totalBruto += subtotalBruto;

    const descPct = lerPercentual(item.descontoPct);
    const subtotalComDescontoItem = aplicarDesconto(subtotalBruto, descPct);
    totalComItem += subtotalComDescontoItem;

    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.nome}</td>
      <td>${item.preco.toFixed(2)}</td>
      <td>${item.qtd}</td>
      <td>${descPct.toFixed(2)}%</td>
      <td>${subtotalComDescontoItem.toFixed(2)}</td>
      <td><button class="btn-remover" data-codigo="${item.codigo}">Remover</button></td>
    `;

    tbodyCarrinho.appendChild(tr);
  });

  // Total "geral" aqui vira o total após desconto por item
  totalGeralTd.textContent = totalComItem.toFixed(2);

  // Total final aplica desconto geral em cima do total já com desconto por item
  const totalFinal = aplicarDesconto(totalComItem, descontoTotalPct);
  if (totalFinalTd) totalFinalTd.textContent = totalFinal.toFixed(2);

  const botoesRemover = tbodyCarrinho.querySelectorAll('.btn-remover');
  botoesRemover.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cod = btn.getAttribute('data-codigo');
      removerItem(cod);
    });
  });
}
