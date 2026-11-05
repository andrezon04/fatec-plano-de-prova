# Validação da versão inicial

- 13 testes de unidade aprovados: banco/distribuição, seleção, roteiro, relógio, pausa, correção, transcrição e revisão.
- Navegador: configuração de área e tempo, seleção de alternativa, marcação, navegação e pausa.
- Recarregamento preservou a pausa, a resposta e a dúvida marcada.
- Resultado de 1/2 com erro proposital; a explicação correspondeu ao gabarito. Acerto na nova tentativa retirou a questão do caderno.
- Ensaio de 30 min: 12 questões, anotação separada do gabarito, divergência de transferência registrada no resultado, texto e checklist preservados após recarregar.
- Sessão de 1 minuto encerrou automaticamente e contou a questão em branco.
- Ensaio de 5 horas: 60 botões de questões, cronômetro de 5 horas e nenhum botão de pausa.
- Interface móvel em iframe de 390 px: largura útil de 375 px, conteúdo de 375 px; sem transbordamento horizontal. Navegação, questão, redação e gabarito adaptados por CSS.
- Erros de extensão do navegador foram observados; nenhum erro da aplicação foi identificado.

O teste de navegador ocorreu na prévia interna. A disponibilização deve usar a operação de hospedagem privada, mantendo a configuração de acesso do proprietário.

# Ampliação e redução de repetição

- 20 testes automatizados aprovados. Banco com 244 IDs únicos: 60 autorais e 184 oficiais (2026/1, 2026/2, 2025/2).
- Gabaritos dos três PDFs extraídos por número, alternativa e disciplina; páginas identificadas no caderno correspondente. As edições de 2026 mantêm 60 itens e distribuição atual; 2025/2 tem 64 itens.
- Testes de seleção confirmam prioridade para inéditas entre sessões, seguida de menor número de exposições e exposição mais antiga. Migração preserva histórico e erros anteriores.
- Navegador: filtro oficial/2026-2/Biologia apresentou 5 disponíveis e, após a primeira sessão, 4 ainda não vistas. A rodada seguinte selecionou questão diferente.
- Questão 1 de 2026/2: PDF original carregou visualmente na página 2; resposta D recebeu 1/1; revisão mostrou gabarito correto e links oficiais.
- Recarregar preservou a questão 4 da segunda rodada e o relógio.
- Ensaio completo 2026/1: 60 botões de questões, numeração original, 5 horas, PDF da edição correta e proposta de redação da página 22.
- O PDF não é recriado nem hospedado: carregamento e consulta externa usam o endereço oficial, com botão de abertura em outra aba. Conexão necessária; funcionamento do leitor depende do navegador.
- Selecionar uma alternativa ou marcar dúvida atualiza os controles sem reconstruir o iframe, preservando o leitor aberto.

# Questões completas na interface · versão 3

- 120 novos exercícios autorais independentes e 60 iniciais: 180 itens selecionáveis. Cada novo treino A/B contém 60 na distribuição por área da preparação.
- Todas as questões selecionáveis têm texto completo, cinco alternativas não vazias e distintas, e explicação. Os dados de três problemas foram inseridos em tabelas HTML, com cabeçalhos e legendas.
- As novas alternativas corretas têm distribuição equilibrada: 24 de cada letra no conjunto de 120.
- 26 testes passaram. Incluem conferência independente dos 16 cálculos novos de matemática e de 14 problemas de física/química; filtros de sorteio; migração idempotente; preservação de notas, erros e textos; bloqueio dos índices históricos no novo sorteio.
- Navegador: ensaio Treino B abriu com 60 itens e 5 horas. Questão 52 mostrou enunciado, tabela de espera e cinco alternativas. Resposta E foi marcada, transferida manualmente e corrigida como correta, com explicação e tabela também presentes na revisão. Redação digitada permaneceu no resultado.
- Nenhum iframe/object/embed encontrado no conteúdo do simulador.
- Em iframe de QA com 390 px, a questão 60 exibiu a tabela de três embalagens e alternativas completas, com largura útil e de conteúdo de 375 px, sem transbordamento horizontal da página. A sessão foi retomada no mesmo item após abrir a prévia móvel.
- Os metadados oficiais continuam acessíveis somente para histórico anterior. Nenhuma questão respondida foi sobrescrita; novas perguntas têm IDs novos.

# Provas enviadas · versão 4

- 400 questões extraídas dos sete PDFs enviados: 2026/2, 2026/1, 2025/2, 2024/2, 2024/1, 2023/2 e 2023/1. Enunciados e alternativas aparecem na página, com figuras locais; nenhum PDF hospedado e nenhum leitor incorporado. 180 autorais anteriores permanecem como opção.
- 33 testes automatizados passaram, incluindo quantidade e ordem de todas as edições, cinco alternativas e conteúdo local, textos que continuam em outra coluna/página, apoios compartilhados à esquerda, frações compactas, seleção, cronômetro, transcrição, migração e anulação.
- Gabaritos oficiais associados ao número e à disciplina. Conferência das retificações: 2024/2, questão 44 = C; 2023/2, questão 39 anulada. Anulada excluída do treino aleatório, dos erros e do denominador de acertos, mas mantida no caderno completo.
- Navegador desktop: ensaio 2026/2 abriu com 60 itens e cinco horas. Questão 7 apresentou texto de apoio, gráfico carregado e cinco alternativas completas. Edição de D para E e marcação de dúvida preservadas. Questão 8 foi conferida contra o PDF e suas cinco frações foram convertidas para MathML para evitar sobreposição entre linhas. Redação original e rascunho digitado disponíveis.
- Simulação com resposta D na questão 1 e transferência manual D resultou em 1/60; a resposta anotada na questão 7 sem transferência contou como divergência. Revisão mostrou texto original, alternativas e conferência D no gabarito oficial.
- Ensaio 2023/2 abriu com 54 itens e aviso de anulação na questão 39; encerrado em branco mostrou 0/53 e uma anulada sem pontuação.
- Navegador em iframe de QA de 390 px: treino de Matemática 2026/2 abriu questão 11 com texto completo, figura e cinco alternativas. Pausa, resposta A e dúvida marcada sobreviveram ao recarregamento e à retomada. Largura útil = 375 px; scrollWidth = 375 px, sem transbordamento horizontal. Encerramento mostrou 0/2, conforme a marcação de teste.
- Nenhum dado de QA faz parte do artefato: a página de iframe foi removida. Dados de navegador são exclusivos da prévia interna e não alteram o histórico do proprietário no endereço hospedado.
- Acesso lido antes da disponibilização: proprietário, modo custom, somente o proprietário na lista, zero grupos e zero visitantes. Usar exclusivamente a operação de hospedagem privada.

# Estratégia com rascunho antes das questões

- 37 testes passaram. Novas verificações cobrem ordem e total de 300 minutos, escala de 30 minutos, limites exatos do relógio entre rascunho/questões/transcrição/gabarito, preservação de sessões antigas e armazenamento independente dos dois textos.
- Prévia no navegador: roteiro exibiu 45/100/30/95/30 minutos; ensaio rápido abriu na redação com etapa Rascunho e 4min30 restantes no bloco.
- Digitação de textos diferentes nos campos Rascunho e Versão definitiva; troca para questões e atalho Ir ao rascunho recuperaram ambos e focaram o campo correto. Recarregamento e retomada preservaram os dois textos.
- Encerramento exibiu os textos separados e o roteiro proporcional no histórico.

# Correções de conteúdo, tempo individual e explicações

- Auditoria das sete edições, 400 itens importados. 190 questões receberam correções específicas ou substituição de alternativas textuais antes rasterizadas; 400 explicações de estudo (399 resoluções e a indicação da anulada), separadas do gabarito oficial.
- Regressores das capturas: 2023/2 q48 agora tem apoio único em HTML, quadro em lista e cinco alternativas textuais; sem alternativas/rodapés repetidos dentro do enunciado. 2024/2 q23 tem gráfico completo com eixos e extremos e C nativa 193/500, sem a frase da alternativa B.
- 49 testes aprovados. Incluem integridade de conteúdo visível e figuras locais, fórmulas, alternativas antes vazias, gabaritos/retificação/anulação, cronometragem por foco, soma nas revisitas, pausa, período offline, expiração e consultas de explicação marcadas como ajuda.
- Navegador desktop: treino 2024/1 q2 abriu explicação de erro ao marcar A e explicação de acerto ao mudar para C. Resultado mostrou 1/2, tentativa assistida e tempo individual na revisão. Voltar à questão somou o tempo anterior; pausa e recarga preservaram resposta e acumulado.
- Navegador móvel em iframe de 390 px: q48 de 2023/2 conferida integralmente contra a captura, sem duplicações. Durante o ensaio não havia botão para revelar resposta; depois de encerrar, “Explicar meu erro” mostrou E escolhida, B correta e a distinção kWh/energia e carga elétrica. A anulação continuou fora do denominador (53 itens válidos).
- No mesmo viewport móvel, q23 de 2024/2 exibiu cinco alternativas nativas, C sem contaminação por B e gráfico carregado. Largura de conteúdo = 375 px, igual à largura útil, sem transbordamento. Navegação entre redação e questões manteve o tempo individual acumulado.
- A página de QA é temporária e foi removida antes do pacote. A prévia usa armazenamento independente do site hospedado; os testes não alteram o histórico do usuário em produção.

## Sincronização na conta — novembro de 2026

- 56 testes automatizados: os 49 de conteúdo, estratégia e tempo existentes, mais sete testes de sincronização com duas instâncias de armazenamento local independentes e banco D1 real em Miniflare.
- Cobertura nova: importação do progresso anterior; respostas, gabarito, marcações, redações e tempos; ida e volta entre dispositivos; operação offline e retorno; escrita durante requisição; comparação atômica de revisão e conflito simultâneo; recuperação de cópia; isolamento de usuários; rejeição de anônimos, origem externa e corpo inválido/grande.
- Browser QA com a prévia gerenciada: duas páginas com armazenamento local separado, identidade sintética apenas no teste e a API D1 local real. Sessão iniciada em A foi retomada em B com alternativa E selecionada, dúvida marcada, tempo acumulado, título, rascunho e texto definitivo idênticos.
- Browser QA móvel: largura de conteúdo e rolagem de 375 px, sem overflow; indicador Sincronizado visível.
- As páginas temporárias de teste e sua identidade sintética são removidas antes do build final. Nenhuma identidade de teste ou dado de teste é enviada ao banco de produção.
- Acesso segue somente do proprietário. A confirmação de publicação privada é obtida do retorno nativo de Sites. A autenticação real e a sincronização entre os computadores físicos do usuário precisam ocorrer quando ele abrir o aplicativo com a mesma conta.
