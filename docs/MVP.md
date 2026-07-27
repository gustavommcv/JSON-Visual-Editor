# Escopo do MVP — JSON Visual Editor

## Visão do produto

O JSON Visual Editor é uma aplicação web genérica para que qualquer pessoa carregue e edite dados JSON visualmente, sem precisar conhecer a sintaxe do formato. A estrutura deve ser descoberta dinamicamente em tempo de execução, sem depender de projeto, propriedade ou schema específico.

Todo o processamento deve acontecer localmente no navegador.

## Fluxo do MVP

1. Selecionar ou arrastar um arquivo JSON.
2. Analisar sua estrutura automaticamente.
3. Escolher uma visualização apropriada.
4. Editar objetos, arrays e valores simples.
5. Adicionar, duplicar, excluir e reordenar dados.
6. Pesquisar chaves e valores.
7. Pré-visualizar URLs de imagens.
8. Desfazer e refazer alterações.
9. Comparar o original com a versão atual.
10. Baixar o JSON atualizado.

## Escopo completo

- upload por clique e por arrastar e soltar;
- suporte a raiz objeto, array, string, número, booleano ou `null`;
- editor recursivo;
- formulário automático para objetos;
- tabela automática para arrays de objetos;
- editor em árvore como alternativa;
- troca manual entre visualizações compatíveis;
- página ou painel detalhado para cada item;
- pré-visualização automática de imagens;
- criação, edição e renomeação de propriedades;
- duplicação, exclusão e reordenação;
- busca por chaves e valores;
- desfazer e refazer;
- comparação das alterações;
- restauração do documento original;
- download formatado ou compactado;
- interface responsiva;
- acessibilidade por teclado e leitor de tela;
- armazenamento temporário somente no navegador.

## Fora do MVP

- backend ou banco de dados;
- login e cadastro;
- armazenamento em nuvem;
- colaboração;
- integração com GitHub;
- publicação automática;
- JSON Schema;
- perfis específicos;
- inteligência artificial;
- edição simultânea de vários arquivos;
- suporte especial a arquivos gigantes.

## Etapa 1 — implementada

- estrutura base em Vue 3, TypeScript estrito e Vite;
- layout principal responsivo;
- seleção e arrastar/soltar arquivo;
- leitura local e validação do JSON;
- reconhecimento das seis raízes JSON válidas;
- documento original e documento atual mantidos separadamente;
- nome e resumo básico do arquivo importado;
- remoção do documento e retorno à tela inicial;
- download formatado do documento sem alterações;
- aviso de privacidade local;
- tratamento de arquivo vazio, JSON inválido, inteiro inseguro e número fora da faixa;
- testes do parser e exportador.

## Etapa 2 — implementada

- editor coordenador recursivo para os seis tipos JSON;
- formulário automático para objetos;
- tabela para arrays de objetos razoavelmente uniformes;
- lista para arrays simples;
- árvore para arrays mistos, aninhados ou irregulares;
- troca manual entre visualizações compatíveis;
- edição de valores e troca de tipo em qualquer caminho;
- substituição e edição de valor simples na raiz;
- criação e exclusão de propriedades e itens;
- renomeação de propriedades com prevenção de chave duplicada;
- escolha explícita de tipo ao preencher arrays vazios ou substituir `null`;
- objetos e arrays aninhados recolhíveis;
- breadcrumb atualizado conforme o campo focado;
- área de trabalho com rolagem própria para estruturas profundas;
- operações imutáveis centralizadas e testadas.

## Etapa 3 — implementada

- tabela automática com colunas obtidas pela união estável das propriedades;
- suporte a colunas ausentes em parte dos itens;
- edição direta de strings, números, booleanos e valores nulos na tabela;
- resumo de objetos e arrays aninhados dentro das células;
- painel lateral acessível para editar o item completo;
- cards editáveis como apresentação responsiva da tabela;
- duplicação profunda de itens e propriedades;
- geração central de nomes únicos para propriedades duplicadas;
- exclusão de propriedades e itens com confirmação e caminho afetado;
- movimento exato de itens de arrays para cima e para baixo;
- reordenação previsível de propriedades textuais quando representável;
- substituição confirmada do valor raiz;
- estado de seleção mantido apenas na interface, sem metadados no documento.

## Etapa 4 — implementada

- detecção genérica de URLs HTTP/HTTPS com extensões de imagem conhecidas;
- suporte a query strings e a `data:image` raster de tamanho limitado;
- pré-visualização preguiçosa no painel detalhado, preservando proporção e limites do layout;
- fallback de carregamento e abertura segura da URL;
- `referrerpolicy="no-referrer"` para imagens remotas;
- aviso de que a prévia remota ainda consulta o servidor da imagem;
- busca recursiva por chaves, strings, números, booleanos e caminhos completos;
- comparação textual sem distinção entre maiúsculas e minúsculas;
- resultados com caminho exato, tipo de correspondência e prévia do valor;
- navegação que expande ancestrais, abre detalhes tabulares quando necessário e destaca o destino;
- atraso curto durante a digitação e limite de resultados;
- ausência de qualquer mutação ou metadado interno causada pela busca.

## Etapa 5 — implementada

- histórico central com snapshots imutáveis para todas as operações;
- limite de 50 estados anteriores e 50 estados para refazer;
- agrupamento de digitação no mesmo campo dentro de uma janela de 750 ms;
- desfazer e refazer por botões e atalhos compatíveis com Windows, Linux e macOS;
- preservação do desfazer nativo enquanto o foco está em campos de texto;
- descarte da pilha de refazer após uma nova edição;
- restauração completa do original como operação reversível;
- indicação visual da existência de alterações não exportadas;
- comparação estrutural recursiva entre original e atual;
- adição, remoção, alteração e reordenação pura de arrays identificadas por caminho;
- ordem das propriedades de objetos ignorada semanticamente na comparação;
- navegação de cada diferença até o editor;
- escolha entre JSON formatado com dois espaços e JSON compacto;
- nome de download sugerido com o sufixo `-editado.json`;
- validação do estado interno antes da criação do download;
- ausência de metadados de interface, histórico ou busca no conteúdo exportado;
- preservação do documento e do histórico depois do download.

## Estado final dos requisitos

| Requisito | Estado final | Evidência principal |
|---|---|---|
| Importar por clique e arrastar | Concluído | `JsonDropzone.vue` encaminha seleção e `drop` para o mesmo fluxo de `FileList` |
| Seis tipos JSON na raiz | Concluído | `JsonValueEditor.vue`, `JsonPrimitiveEditor.vue` e testes de operações/parser |
| Editor recursivo | Concluído | `JsonValueEditor.vue` chama a si próprio com caminhos segmentados |
| Formulário para objetos | Concluído | propriedades editáveis, renomeáveis, recolhíveis e com CRUD |
| Tabela automática | Concluído | `analyzer.ts` e tabela semântica com união de colunas |
| Lista e árvore alternativas | Concluído | seleção manual entre visualizações compatíveis |
| Painel detalhado por item | Concluído | `JsonItemDetailsPanel.vue`, com foco contido e restaurado |
| Imagens | Concluído | `image.ts` e `ImagePreview.vue`, sem alterar o valor original |
| CRUD e reordenação | Concluído | operações imutáveis centralizadas em `operations.ts` |
| Busca global | Concluído | `search.ts` e `JsonSearchPanel.vue`, sem metadados no documento |
| Desfazer, refazer e restauração | Concluído | snapshots limitados em `history.ts` |
| Comparação estrutural | Concluído | `diff.ts` e painel navegável de comparação |
| Exportação formatada e compacta | Concluído | validação em `exporter.ts` e download por `Blob` |
| Responsividade | Concluído | cards abaixo de 760 px, tabela contida e ausência de rolagem horizontal na página |
| Acessibilidade | Concluído | semântica nativa, labels, alertas, foco visível, contraste, foco de diálogos e movimento reduzido |
| Processamento local | Concluído | nenhuma chamada de backend; somente prévias remotas opcionais fazem requisição ao host da imagem |

## Fluxos finais auditados

| Fluxo | Estado | Evidência |
|---|---|---|
| 1. Importar por clique | Validado | seletor nativo abriu e carregou arquivos objeto e array |
| 2. Importar por arrastar | Validado por implementação | eventos `dragenter`, `dragover`, `dragleave` e `drop` usam o mesmo `FileList` e o mesmo pipeline validado no fluxo por clique; o gesto com arquivo real do sistema operacional não pôde ser sintetizado pela automação do navegador |
| 3. Editar objeto na raiz | Validado | string, número e booleano alterados em propriedades do objeto raiz |
| 4. Editar array na raiz | Validado | células e itens alterados diretamente no array raiz |
| 5. Editar valores simples e `null` na raiz | Validado | substituição e edição dos quatro valores simples e escolha explícita após `null` |
| 6. Navegar por estruturas aninhadas | Validado | breadcrumb e expansão chegaram a seis segmentos de profundidade |
| 7. Usar tabela automática | Validado | arrays uniformes abriram em tabela com cabeçalhos e células tipadas |
| 8. Trocar para árvore | Validado | seletor de visualização substituiu a tabela por árvore |
| 9–13. Adicionar, editar, duplicar, excluir e reordenar | Validado | operações executadas na interface e cobertas unitariamente |
| 14. Pesquisar | Validado | busca aninhada retornou caminho completo e navegou ao resultado |
| 15. Visualizar imagens | Validado | imagens horizontal e vertical permaneceram contidas e carregaram de forma preguiçosa |
| 16. Desfazer e refazer | Validado | interface e testes confirmaram as duas pilhas e o descarte de redo |
| 17. Comparar alterações | Validado | painel exibiu caminho, valor anterior e valor atual e navegou ao editor |
| 18. Restaurar | Validado | documento voltou ao original e a restauração permaneceu reversível |
| 19–20. Baixar formatado e compacto | Validado | os dois arquivos foram gerados, reanalisados como JSON válido e comparados |
| 21. Abrir novamente o exportado | Validado | o JSON compacto exportado foi reimportado com tipos e tabela preservados |

## Arquitetura

As regras JSON vivem em `src/core/json`, independentes do Vue. Funcionalidades com interação de navegador são organizadas em `src/features`, enquanto estado de tela reutilizável fica em `src/composables`. Os caminhos JSON são representados por segmentos, nunca por strings concatenadas com pontos.

Todas as edições passam por `src/core/json/operations.ts`. Cada operação valida o caminho e o contêiner, copia apenas os ancestrais necessários e devolve uma nova raiz. Os componentes emitem intenções tipadas e nunca modificam o documento diretamente.

A visualização padrão é inferida apenas do tipo real e da uniformidade estrutural. Para ser considerada tabular, uma coleção deve conter somente objetos, ter no máximo 16 colunas combinadas e cada linha deve preencher pelo menos 50% delas. Nenhum nome de propriedade participa da decisão.

As colunas tabulares seguem a primeira aparição de cada chave na coleção. Propriedades ausentes são representadas explicitamente e podem ser criadas escolhendo seu tipo. Valores aninhados são resumidos na célula e editados no painel do item para evitar tabelas excessivamente altas.

Arrays possuem ordem semântica e sua reordenação é exata. Objetos JSON não possuem ordem semântica, embora a implementação preserve uma apresentação previsível para chaves textuais. Objetos com chaves que se comportam como índices numéricos do JavaScript não oferecem reordenação visual, pois o runtime controla a ordem de enumeração nesses casos.

Identificadores e seleções necessários à interface permanecem somente no estado Vue. As operações de domínio trabalham exclusivamente com os valores fornecidos pelo usuário; nenhum campo interno é adicionado ao JSON exportado.

O histórico vive em `src/core/json/history.ts`. Cada edição válida cria um snapshot, exceto eventos consecutivos de digitação no mesmo caminho dentro de 750 ms, que compartilham uma etapa. As pilhas anterior e futura são limitadas a 50 entradas, evitando crescimento ilimitado. Restaurar o original é um novo snapshot, portanto também pode ser desfeito.

A comparação vive em `src/core/json/diff.ts` e percorre valores recursivamente. Chaves de objetos são comparadas como conjuntos, pois sua ordem não é semântica; índices de arrays são comparados em ordem. Quando dois arrays possuem exatamente o mesmo multiconjunto de elementos e apenas a sequência muda, a alteração é classificada como reordenação.

A exportação valida novamente o valor em `src/core/json/exporter.ts`, serializa somente o documento atual e cria o arquivo no navegador. Nenhum estado do composable ou dos componentes participa dessa serialização.

Tabelas largas permanecem dentro de `.table-scroll`, com contenção de layout e pintura; o documento não herda a largura das colunas. Abaixo de 760 px a apresentação visual muda para cards, mantendo os mesmos editores tipados. Estruturas profundas usam a área de trabalho com rolagem própria.

Diálogos e painéis guardam o controle que os abriu, mantêm `Tab` e `Shift+Tab` dentro da interface modal e restauram o foco ao fechar. Quando uma exclusão remove o controle original, o foco recua para o ancestral JSON ainda existente.

A busca vive em `src/core/json/search.ts`, percorre somente o valor JSON atual e devolve resultados com caminhos segmentados. A navegação usa esses caminhos para expandir componentes e aplicar classes visuais; o documento não recebe marcações. Consultas são adiadas em 180 ms e limitadas a 250 resultados.

A heurística de imagem vive em `src/core/json/image.ts`. URLs remotas só são consideradas quando usam HTTP/HTTPS e terminam em extensão conhecida no `pathname`; query strings não interferem. `data:image` é limitado a formatos raster conhecidos e a 1.000.000 de caracteres. SVG incorporado é excluído por segurança. A prévia é feita diretamente pelo navegador, sem proxy, e por isso uma imagem remota ainda gera uma requisição ao host informado pelo usuário.

## Política numérica

A importação rejeita inteiros fora da faixa segura do JavaScript e valores que seriam convertidos em infinito. Isso evita que abrir e baixar um arquivo altere números silenciosamente. A precisão arbitrária para decimais não faz parte desta etapa e deverá ser tratada por uma decisão explícita de representação antes de ser implementada.
