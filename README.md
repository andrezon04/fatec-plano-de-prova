<div align="center">

# Plano de prova · FATEC 2027

Simulador de estudos para o vestibular da FATEC com treinos cronometrados, revisão de erros e prática de redação.

<img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-1a1b27?style=flat-square" />
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-1a1b27?style=flat-square" />
<img alt="Vinext" src="https://img.shields.io/badge/Vinext-1a1b27?style=flat-square" />
<img alt="Cloudflare D1" src="https://img.shields.io/badge/Cloudflare%20D1-1a1b27?style=flat-square" />

**Projeto de estudo**

</div>

---

## Funcionalidades

- Treino por área e simulados por edição, com cronômetro geral e tempo por questão.
- Caderno de erros, explicações e rascunho de redação.
- Progresso no navegador e sincronização por conta no ambiente do ChatGPT Sites.

## Como executar

Com Node.js 22.13 ou superior, rode `npm ci` e `npm run dev`. Para executar os testes, use `npm test`. A sincronização depende da identidade fornecida pelo Sites e do binding D1 `DB`.

## Organização

- `app/` entrega a interface e a API de progresso.
- `public/` reúne a interface, o banco de questões e as imagens.
- `drizzle/` contém a migração do banco.
- [Notas técnicas](docs/notas-tecnicas.md) documentam a importação das provas e as regras de estudo.
