# BigFarma

<p align="center">
  <img src="./logo_big_farma.jpg" alt="BigFarma logo" width="120" />
</p>

<p align="center">
  Sistema web para montar pedidos de exames com base em Excel.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-v1%20funcional-2ea44f" alt="status" />
  <img src="https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JavaScript-1f6feb" alt="stack" />
  <img src="https://img.shields.io/badge/dados-Excel%20(XLSX)-217346" alt="excel" />
  <img src="https://img.shields.io/badge/deploy-local%20server-orange" alt="deploy" />
</p>

## Indice

- [Visao geral](#visao-geral)
- [Demo local](#demo-local)
- [Funcionalidades](#funcionalidades)
- [Arquitetura rapida](#arquitetura-rapida)
- [Formato da planilha](#formato-da-planilha)
- [Fluxo da tela](#fluxo-da-tela)
- [Regras de calculo](#regras-de-calculo)
- [Limites e desempenho](#limites-e-desempenho)
- [Roadmap](#roadmap)
- [Solucao de problemas](#solucao-de-problemas)
- [Autor](#autor)

## Visao geral

O BigFarma e uma aplicacao web estatica para atendimento de pacientes em pedidos de exames.

- Carrega os exames do arquivo `exames-v1.xlsx`.
- Busca exame por nome, codigo ou formato `CODIGO - NOME`.
- Controla carrinho com quantidade e desconto por item.
- Aplica desconto geral no total.
- Preenche automaticamente a data do pedido (quando vazia).
- Persiste dados no navegador com `localStorage`.
- Exporta por impressao, PDF nativo e historico em JSON.
- Todas as exportacoes de documento sao em preto e branco (P&B).

## Demo local

1. Abra um terminal na pasta do projeto.
2. Suba um servidor HTTP local.
3. Acesse no navegador.

```powershell
cd C:\Users\Admin\Desktop\bigFarma
python -m http.server 8000
```

```text
http://localhost:8000
```

Opcao alternativa: Live Server (VS Code).

## Funcionalidades

| Area | O que faz |
|------|-----------|
| Carga de dados | Le `exames-v1.xlsx` automaticamente ao iniciar |
| Busca | Normaliza texto e ignora acentos |
| Paciente | Coleta nome, CPF, nascimento, telefone, data e observacoes |
| Validacao | Aplica mascara/validacao de CPF e telefone |
| Carrinho | Adiciona, remove, limpa e recalcula itens em tempo real |
| Descontos | Item (%) e total (%) com limite entre 0 e 100 |
| Persistencia | Salva cliente, carrinho e desconto total no `localStorage` |
| Feedback | Exibe avisos de erro/sucesso em popup abaixo dos botoes de exportacao |
| Exportacao | Imprime pedido, gera PDF nativo (`jsPDF`) com layout equivalente e exporta historico em JSON (P&B) |

## Arquitetura rapida

```text
bigFarma/
|- index.html           # Estrutura da interface
|- styles.css           # Tema visual + responsividade
|- app.v2.js            # Regras de negocio e interacoes
|- exames-v1.xlsx       # Base de exames
|- logo_big_farma.jpg   # Identidade visual principal
|- logo_crd.jpg         # Logo secundaria
|- favicon.ico          # Icone do navegador
`- README.md
```

## Formato da planilha

A primeira aba deve ter cabecalho na primeira linha com:

- `CODIGO`
- `EXAME`
- `VALOR`

Exemplo:

| CODIGO | EXAME              | VALOR |
|--------|--------------------|-------|
| 1001   | Hemograma Completo | 35,00 |
| 2030   | Glicose            | 12,50 |

Regras:

- `EXAME` e `VALOR` sao obrigatorios.
- `VALOR` aceita numero ou texto (`35,00`, `R$ 35,00`).
- Linhas invalidas sao ignoradas.
- Cabecalho invalido gera erro de carregamento.

## Fluxo da tela

1. Preencha os dados do paciente.
2. Digite/seleciona exame.
3. Informe quantidade e desconto do item.
4. Clique em `Adicionar exame`.
5. (Opcional) ajuste desconto no total.
6. Escolha uma acao:
   - `Imprimir` para abrir a tela de impressao
   - `Baixar PDF` para gerar PDF nativo
   - `Exportar historico` para baixar historico em JSON
7. Use `Limpar carrinho` quando quiser reiniciar o pedido.

## Regras de calculo

- `subtotalBruto = preco * quantidade`
- `subtotalComDescontoItem = subtotalBruto * (1 - descontoItem/100)`
- `totalGeral = soma(subtotalComDescontoItem)`
- `totalFinal = totalGeral * (1 - descontoTotal/100)`

## Limites e desempenho

Para evitar travamento por crescimento de dados no navegador:

- Historico limitado a `100` pedidos.
- Tamanho maximo do historico em `~700 KB` no `localStorage`.
- Limite de `120` itens por pedido salvo no historico.
- Fallback automatico para `30` pedidos quando houver erro de cota.

## Roadmap

### Fase 1 - Base do produto (Concluida)

- [x] Leitura de exames por Excel
- [x] Busca por codigo/nome com normalizacao
- [x] Carrinho com desconto por item
- [x] Desconto geral no pedido
- [x] Exportacao por impressao

### Fase 2 - Fechamento da V1 para GitHub Pages (Concluida)

- [x] Persistencia em `localStorage`
- [x] Mascara e validacao de CPF/telefone
- [x] Botao de limpar carrinho
- [x] Confirmacao visual para erros e sucesso nas acoes principais

### Fase 3 - Evolucao de documentos no front-end (Concluida)

- [x] PDF nativo em codigo (`jsPDF`)
- [x] Layout de impressao com cabecalho/rodape institucional
- [x] Opcao de exportar historico de pedidos

### Fora do escopo de runtime GitHub Pages puro

- Testes automatizados e lint ficam como tarefa de pipeline/CI (opcional).

## Solucao de problemas

- Erro ao carregar exames:
  - Confirme `exames-v1.xlsx` na mesma pasta de `index.html`.
  - Execute por `http://localhost` (nao usar `file://`).
- Exame nao encontrado:
  - Revise codigo/nome na planilha.
  - Tente busca parcial.
- Historico muito grande:
  - O sistema reduz automaticamente a quantidade de registros para manter estabilidade.
  - Exporte o historico em JSON periodicamente para arquivamento externo.
- Texto com acentuacao quebrada:
  - Garanta arquivos em UTF-8.

## Autor

- Luis Queiroz
