# BigFarma

<p align="center">
  <img src="./logo_big_farma.jpg" alt="BigFarma logo" width="120" />
</p>

<p align="center">
  Sistema web para montar pedidos de exames com base em Excel.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-2ea44f" alt="status" />
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
- [Roadmap](#roadmap)
- [Solucao de problemas](#solucao-de-problemas)
- [Autor](#autor)

## Visao geral

O BigFarma e uma aplicacao web estatica para atendimento de pacientes em pedidos de exames.

- Carrega os exames do arquivo `exames-v1.xlsx`.
- Busca exame por nome, codigo ou formato `CODIGO - NOME`.
- Controla carrinho com quantidade e desconto por item.
- Aplica desconto geral no total.
- Exporta para impressao/PDF via `window.print()`.

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
| Paciente | Coleta nome, documento, nascimento, telefone, data e observacoes |
| Carrinho | Adiciona, remove e recalcula itens em tempo real |
| Descontos | Item (%) e total (%) com limite entre 0 e 100 |
| Exportacao | Gera layout de impressao com dados do paciente e tabela |

## Arquitetura rapida

```text
bigFarma/
|- index.html           # Estrutura da interface
|- styles.css           # Tema visual + responsividade
|- app.v1.js            # Regras de negocio e interacoes
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
6. Clique em `Exportar para PDF`.
7. Na janela de impressao, escolha `Salvar como PDF` ou impressora.

## Regras de calculo

- `subtotalBruto = preco * quantidade`
- `subtotalComDescontoItem = subtotalBruto * (1 - descontoItem/100)`
- `totalGeral = soma(subtotalComDescontoItem)`
- `totalFinal = totalGeral * (1 - descontoTotal/100)`

## Roadmap

- [x] Leitura de exames por Excel
- [x] Busca por codigo/nome com normalizacao
- [x] Carrinho com desconto por item
- [x] Desconto geral no pedido
- [x] Exportacao por impressao/PDF
- [ ] Persistencia em `localStorage`
- [ ] Mascara e validacao de CPF/telefone
- [ ] Botao de limpar carrinho
- [ ] PDF nativo em codigo (ex.: `jsPDF`)
- [ ] Suite de testes para parser/calculos

## Solucao de problemas

- Erro ao carregar exames:
  - Confirme `exames-v1.xlsx` na mesma pasta de `index.html`.
  - Execute por `http://localhost` (nao usar `file://`).
- Exame nao encontrado:
  - Revise codigo/nome na planilha.
  - Tente busca parcial.
- Texto com acentuacao quebrada:
  - Garanta arquivos em UTF-8.

## Autor

- Luis Queiroz
