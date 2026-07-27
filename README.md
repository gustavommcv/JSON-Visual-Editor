# JSON Visual Editor

Aplicação web genérica para importar, compreender, editar, comparar e exportar documentos JSON sem trabalhar diretamente com a sintaxe. O documento é processado localmente e permanece na memória da aba.

O estado final e as decisões do produto estão detalhados em [`docs/MVP.md`](docs/MVP.md).

## Recursos

- importação de um arquivo `.json` por clique ou arrastar e soltar;
- suporte a objetos, arrays, strings, números, booleanos e `null`, inclusive na raiz;
- editor recursivo com breadcrumb, recolhimento de estruturas e área própria de rolagem;
- formulário para objetos, lista para arrays simples, tabela para arrays de objetos semelhantes e árvore para estruturas irregulares;
- troca manual entre todas as visualizações compatíveis;
- criação, edição, alteração de tipo, renomeação, duplicação profunda, exclusão e reordenação;
- tabela com união estável de colunas, células ausentes, resumos aninhados e painel de detalhes;
- cards responsivos para tabelas em telas estreitas;
- busca global por chave, valor e caminho, com navegação e destaque sem mutar os dados;
- pré-visualização heurística e contida de imagens, com fallback de carregamento;
- histórico com desfazer, refazer e restauração reversível do original;
- comparação estrutural com adições, remoções, alterações e reordenações de arrays;
- exportação formatada com dois espaços ou compacta;
- indicação de alterações ainda não exportadas;
- mensagens acessíveis, foco visível, controles rotulados e diálogos com foco contido e restaurado.

## Privacidade

O arquivo não é enviado para um servidor, banco de dados ou serviço de análise. Importação, edição, histórico, busca, comparação e exportação acontecem no navegador. Ao fechar ou recarregar a aba, o estado não salvo em arquivo é perdido.

A única exceção possível de tráfego externo é a pré-visualização de uma URL remota que já exista no JSON. Nesse caso, o navegador solicita diretamente a imagem ao host indicado; o documento JSON não é enviado. O aplicativo não faz proxy, upload nem download automático dessas imagens.

## Requisitos

- Node.js 20.19+ ou 22.12+;
- npm, incluído nas distribuições usuais do Node.js;
- navegador moderno com suporte a `File`, `Blob`, `URL.createObjectURL` e módulos JavaScript.

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

O Vite informa o endereço local. O aplicativo não depende de backend nem de variáveis de ambiente.

## Testes e verificações

```bash
npm test
npm run typecheck
npm run lint
```

- `npm test` executa a suíte Vitest;
- `npm run typecheck` valida Vue e TypeScript em modo estrito;
- `npm run lint` executa ESLint sem permitir avisos.

## Build

```bash
npm run build
```

O comando executa o typecheck e gera os arquivos estáticos em `dist/`. Para conferir esse resultado localmente:

```bash
npm run preview
```

## Dependências

- `vue`: única dependência de execução, usada para componentes, reatividade e estado da interface;
- `vite` e `@vitejs/plugin-vue`: servidor de desenvolvimento e empacotamento;
- `typescript` e `vue-tsc`: tipagem estrita do domínio e dos componentes;
- `vitest`: testes unitários das regras JSON;
- `eslint`, `typescript-eslint`, `eslint-plugin-vue` e `vue-eslint-parser`: análise estática.

Não há biblioteca de estado global, tabela, upload, manipulação de JSON ou CSS. As capacidades necessárias ao MVP são implementadas com Vue e APIs nativas do navegador.

## Formatos suportados

- entrada: um arquivo com extensão `.json` por vez;
- raízes: objeto, array, string, número, booleano ou `null`;
- saída: JSON formatado com dois espaços ou JSON compacto;
- imagens possíveis: URLs HTTP/HTTPS cujo caminho termine em extensão conhecida, inclusive com query string, e `data:image` raster dentro do limite documentado.

SVG incorporado em `data:image` não é carregado. Uma URL válida sem extensão de imagem conhecida não é pré-visualizada automaticamente.

## Inferência automática da interface

A escolha depende somente do tipo e da estrutura real dos dados:

| Estrutura | Visualização inicial |
|---|---|
| Objeto | Formulário |
| Array de valores simples | Lista editável |
| Array somente de objetos, com até 16 colunas e ao menos 50% delas em cada linha | Tabela |
| Array misto, aninhado ou muito irregular | Árvore |
| Valor simples na raiz | Editor do próprio tipo |
| `null` | Seletor explícito do tipo substituto |

As colunas da tabela seguem a primeira aparição de cada chave. Nenhum nome como `title`, `image`, `category` ou `id` influencia a inferência.

## Decisões de segurança e integridade

- caminhos JSON são arrays de segmentos `string | number`; pontos, espaços, barras, acentos e símbolos permanecem literais;
- toda alteração passa por `src/core/json/operations.ts` e produz uma nova raiz;
- renomeações e adições recusam chaves duplicadas;
- duplicações usam cópia profunda;
- arrays preservam ordem exata; a ordem de objetos é apenas uma apresentação previsível, sem significado semântico;
- inteiros fora da faixa segura e números não finitos são rejeitados;
- troca de tipo, substituição da raiz, exclusões relevantes e restauração exigem confirmação;
- não há renderização de HTML fornecido pelo documento;
- imagens remotas usam `referrerpolicy="no-referrer"`, link com `noopener noreferrer`, carregamento preguiçoso e limites de layout;
- a exportação valida novamente o estado e serializa exclusivamente o valor JSON atual;
- URLs, valores e tipos nunca são transformados por busca ou heurísticas de imagem;
- URLs de objetos usadas no download são revogadas após o acionamento.

## Histórico e comparação

O histórico usa snapshots imutáveis, com até 50 estados anteriores e 50 estados para refazer. Digitação consecutiva no mesmo campo dentro de 750 ms forma uma única etapa. `Ctrl+Z`/`Cmd+Z`, `Ctrl+Y` e `Cmd+Shift+Z` atuam fora dos campos; dentro deles, o navegador mantém seu desfazer nativo.

A comparação percorre o documento estruturalmente. A ordem das propriedades de objetos é ignorada; a ordem dos arrays é significativa. Uma troca de ordem que mantém exatamente os mesmos elementos é apresentada como reordenação.

## Arquitetura resumida

- o domínio JSON é independente do Vue;
- componentes emitem operações tipadas e não modificam o documento diretamente;
- o composable do documento coordena importação, histórico, diff, estado exportado e download;
- estado de busca, seleção, foco e painéis permanece somente na interface;
- CSS comum controla layout, contenção de tabelas, cards responsivos, contraste e movimento reduzido.

## Estrutura das pastas

```text
src/
├── composables/          # estado do documento e gerenciamento reutilizável de foco
├── core/json/            # parser, análise, operações, histórico, diff, busca e exportação
├── features/
│   ├── comparison/       # painel de diferenças estruturais
│   ├── editor/           # editor recursivo, tabela, tipos, imagens e diálogos
│   ├── export/           # configuração e acionamento do download
│   ├── import/           # dropzone e resumo do arquivo
│   └── search/           # busca global e resultados
├── styles/               # design responsivo e acessível
├── App.vue
└── main.ts
docs/
└── MVP.md                # escopo, decisões e estado final dos requisitos
```

## Limitações conhecidas

- apenas um documento pode ser aberto por vez;
- o estado existe somente durante a vida da aba;
- documentos gigantes não têm virtualização ou processamento em worker;
- snapshots de documentos grandes ainda podem consumir memória relevante, embora o histórico seja limitado;
- decimais seguem a precisão IEEE 754 do JavaScript;
- a heurística de imagem pode produzir falso positivo ou falha de carregamento;
- a comparação identifica reordenação apenas quando o array mantém o mesmo multiconjunto de valores;
- não existe persistência, sincronização ou colaboração.

## Próximos passos fora do MVP

Possíveis evoluções, conscientemente excluídas desta versão:

- suporte opcional a JSON Schema;
- virtualização e workers para arquivos muito grandes;
- política explícita para números de precisão arbitrária;
- persistência local opcional;
- edição simultânea de vários arquivos;
- backend, contas, nuvem e colaboração;
- integrações externas e publicação automática.
