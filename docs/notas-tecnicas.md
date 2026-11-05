# Plano de prova · FATEC 2027

Aplicação pessoal para ADS de manhã e DSM à tarde. Treino por área, cronômetro, marcação de dúvidas, revisão de erros, redação e ensaios de estratégia de 30 minutos ou 5 horas. Acesso privado do proprietário, preservado em Sites.

## Conteúdo

400 questões de sete PDFs fornecidos pelo usuário: 2026/2 (60), 2026/1 (60), 2025/2 (64), 2024/2 (54), 2024/1 (54), 2023/2 (54) e 2023/1 (54). Enunciados e alternativas são HTML na própria tela, com figuras, gráficos, tabelas e expressões visuais locais quando necessários. Não há leitor de PDF. As coletâneas e propostas de redação dessas edições também estão incorporadas.

Gabaritos oficiais vinculados no manifesto `scripts/uploaded-exams-manifest.json`, com retificações de 2024/2 e 2023/2. Questão 44 de 2024/2: C. Questão 39 de 2023/2: anulada; preservada no ensaio completo e excluída do sorteio de treino e da correção percentual. As 400 questões importadas têm explicações de estudo específicas (incluindo a indicação de anulação), com resposta conferida no gabarito oficial. As explicações são material didático do simulador, não resoluções oficiais do CPS.

Os 180 exercícios autorais anteriores continuam disponíveis como opção, com explicações. Banco total: 580 itens; 579 válidos para sorteio. Os ensaios por edição preservam a ordem e a quantidade original (54, 60 ou 64); o ensaio misto usa 60 com a distribuição de preparação atual. O percentual mostrado é de acertos simples, sem pesos de classificação e sem previsão de aprovação. Não há correção automática da redação.

## Continuidade e seleção

Mesmo localStorage `fatec-prep-2027-v1`; migração idempotente de conteúdo para versão 4, preservando histórico, respostas, rascunhos e exposições. Os IDs das questões oficiais correspondem às mesmas questões dos cadernos; os erros antes arquivados voltam a ser treináveis. O prazo absoluto sobrevive ao fechamento da página; treinos aceitam pausa, ensaios não. Na simulação, apenas o gabarito transferido manualmente é corrigido.

Sorteio prioriza inéditas, depois menor número de exposições e exposição mais antiga. Seleção de caderno completo e revisão de erros podem repetir intencionalmente. Dados ficam na conta autenticada e em cópia local, com proteção de conflito entre dispositivos.

## Importação e verificação

`python scripts/import-uploaded-exams.py --input-dir <pasta-dos-pdfs> --cache-dir <pasta-dos-gabaritos-json>` gera `public/uploaded-exams.js` e figuras em `public/assets/exams`. O manifesto registra nome e SHA-256 dos arquivos de origem em cada edição. Arquivos enviados e caches intermediários não fazem parte da hospedagem.

`node --test tests/core.test.mjs` verifica integridade, arquivos locais, gabaritos, continuação de enunciados, compartilhamento de apoios, seleção, relógio, anulação, correção e migração. `node --check public/app.js` verifica a sintaxe. Detalhes dos testes de interface em `VALIDATION.md`.

## Estratégia com rascunho primeiro

Padrão para novos ensaios: rascunho completo e leitura da proposta (45 min), primeira passada das questões (100), revisão e transcrição da redação (30), segunda passada (95), gabarito e conferência (30). Total 300 min. O ensaio rápido escala os mesmos blocos para 30 min. Rascunho e versão definitiva usam campos separados, persistem no navegador e aparecem no histórico. Novos ensaios desse roteiro abrem na redação; o banner da etapa oferece um atalho para a tarefa atual. A mudança de preferência é idempotente e preserva os roteiros das sessões já iniciadas.


## Correções de apresentação e explicações

As sete edições foram revistas contra os PDFs. A aplicação do conjunto de correções altera 190 questões, incluindo alternativas deslocadas/vazias, contextos misturados, fórmulas, texto minúsculo e figuras cortadas. `research/*-review.json` registra as resoluções e os overrides; `research/zz-final-review.json` inclui a conferência final das capturas do usuário (2023/2 q48 e 2024/2 q23) e figuras compartilhadas. O script `scripts/apply-reviewed-content.py --pdf-dir <pasta-dos-pdfs>` reconstrói a revisão sobre a importação do commit `85c3646a227762f1707ae625c4404572ca7d2ae2`, preservando IDs e gabaritos. Relatório em `research/content-audit.json`. Ele deve ser executado após uma importação, e usa os PDFs apenas para os recortes pontuais de figuras.

No treino, “Conferir e explicar minha resposta” compara a marcação com a resposta correta e mostra o raciocínio. A consulta identifica a tentativa como estudo com ajuda; um acerto assistido não remove erros anteriores como se fosse independente. No ensaio, as explicações ficam disponíveis apenas na revisão final. Na revisão, há opções “Explicar meu acerto”, “Explicar meu erro” ou “Explicar esta questão”.

## Tempo por questão

O cronômetro individual acumula tempo ativo e soma revisitas à mesma questão. Para ao trocar de questão, abrir redação/gabarito, sair da sessão, pausar o treino ou ocultar a página. O cronômetro geral continua seguindo as regras anteriores. Checkpoints e eventos de fechamento salvam o acumulado; o período com a página fechada não é atribuído à questão. O resultado e o caderno de erros exibem o tempo individual quando registrado. Sessões anteriores à atualização mostram tempo não registrado.

Verificação atual: `npm test` executa 49 testes, incluindo regressões das capturas, conteúdo visível das alternativas, resoluções, tempos cumulativos, pausa, expiração e identificação da consulta de explicações.

## Sincronização privada entre computadores

A interface e o banco de questões ficam em `public/`; `app/route.ts` entrega o documento original, sem reescrever a experiência de estudo. O Site usa o starter Vinext e D1, mantendo o mesmo projeto e a audiência privada.

`/api/progress` guarda uma cópia por `oai-authenticated-user-id`, fornecido pelo login do ChatGPT no Site. O cliente não escolhe o usuário e chamadas sem identidade retornam 401. Escritas exigem JSON, origem igual à do Site e revisão esperada; o limite é 4 MiB. Não há chave de API de IA nessa funcionalidade.

As respostas, redações, tempos acumulados, histórico, preferências e caderno de erros sincronizam automaticamente. O relógio de foco é exclusivo do navegador e nunca continua contando tempo de questão ao importar outra cópia. O prazo absoluto dos ensaios continua igual.

A cópia local anterior é importada na primeira visita. O aplicativo consulta a conta a cada cinco segundos enquanto está visível e envia alterações após uma breve pausa. Sem conexão, preserva as alterações locais e tenta novamente ao voltar. Deve-se aguardar **Sincronizado** antes de trocar de computador.

Uma revisão divergente não é substituída automaticamente: o usuário escolhe entre o progresso local e o da conta. A escolha vale para o progresso inteiro. Antes dela, as duas versões são copiadas para recuperação no navegador; o servidor preserva os últimos 20 salvamentos anteriores, isolados por usuário. O link **Recuperar cópia** permite recuperar essas versões. Não é uma mesclagem simultânea de dois editores da mesma sessão.

A migração D1 está em `drizzle/0000_rainy_redwing.sql`, com metadados gerados pelo Drizzle. Sites aplica a migração de esquema na publicação. Para reproduzir build/migração local, siga as instruções do starter e use o binding `DB`. O gerador de conteúdo revisado grava em `public/`, mantendo a origem Git imutável das transcrições.
