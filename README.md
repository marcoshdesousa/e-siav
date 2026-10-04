# App do DBV

Plataforma para clubes de Desbravadores: gestão do clube (membros e unidades), requisitos com pontuação e ranking, perfis públicos com medalhas e eventos, especialidades/classes/cursos e chat interno em tempo real.

Aplicação web responsiva, pensada primeiro para celular e instalável como app (PWA). Toda a organização é por distrito (a primeira versão vem com o **Distrito Palmares**).

![Logo](client/public/logo-horizontal.svg)

## Como rodar

Requer **Node.js 22.13 ou mais novo** (usa o SQLite nativo do Node — nenhum banco externo).

```bash
npm install
npm run build      # gera o frontend em dist/
npm start          # http://localhost:3000
```

Na primeira execução o banco é criado em `data/` e preenchido com os dados de exemplo. Para recriar do zero: `npm run seed`.

Desenvolvimento com recarga automática: `npm run dev` (API na porta 3000 e Vite na 5173).

Testes da API (permissões, privacidade, pontuação, ranking e chat): `npm test`.

### Contas de demonstração

| Tela de entrada | Conta | Usuário / senha |
|---|---|---|
| Login Membros | Administrador Geral | `admin` / `admin123` |
| Login Clube | Clube Águias do Vale | `aguias` / `aguias123` |
| Login Clube | Clube Leões de Judá | `leoes` / `leoes123` |
| Login Clube | Unidades | `falcoes`, `gavioes`, `panteras`, `tigres` / nome + `123` (ex.: `falcoes123`) |
| Login Membros | Desbravadores | `pedro`, `ana`, `lucas`, `beatriz`, `gabriel`, `davi`, `sofia`, `rafael`, `isabela` / `dbv123` |
| Login Membros | Liderança | `marcos`, `juliana`, `carlos`, `fernanda` / `dbv123` |

## O que tem

- **Cinco tipos de conta**, ninguém se cadastra sozinho: Administrador Geral → Clube → Unidade, Desbravador e Liderança. Sem CPF.
- **Login Clube** (clube e unidades) e **Login Membros** (desbravadores, liderança e Administrador Geral).
- **Painel do Administrador Geral**: distritos, clubes e seus logins, outros administradores, requisitos gerais (clubes, unidades, desbravadores; alcance geral ou por distrito), avaliação de envios, especialidades/classes/cursos grátis ou pagos, compras e liberação manual de acesso, medalhas e troféus (entrega manual), eventos e participantes, rankings e denúncias.
- **Sistema do Clube**: foto e logo, membros (a idade define Desbravador 10–15 ou Liderança 16+), cargos, unidades com login, classes/especialidades concluídas e Insígnia de Excelência, requisitos para as próprias unidades, avaliação, ranking interno, mensagens da diretoria e denúncias.
- **Portal da Unidade**: requisitos do clube e gerais de unidade, ranking e perfil.
- **Portal do Membro**: Perfil, Requisitos (só desbravadores), Especialidades, Classes, Cursos, Ranking, Clubes e Chat.
- **Requisitos**: modelos Texto, Foto, Quiz, Relatório + foto, Quiz + foto; pontos no prazo e fora do prazo; quiz com nota proporcional calculada na hora; demais modelos avaliados por quem criou; estados pendente, enviado, aprovado, recusado e fora do prazo.
- **Quatro rankings** atualizados a cada envio pontuado (membros, unidades do clube, geral de unidades, clubes), com pódio, filtro por distrito e desempate por quem enviou primeiro. Não há ranking de liderança.
- **Perfis públicos** com link para compartilhar: `/p/clube/:id`, `/p/unidade/:id`, `/p/membro/:código`. Clubes e unidades mostram só a quantidade de membros.
- **Chat estilo WhatsApp**: Unidade (grupo), Diretoria (membro ↔ clube) e Direta (por código ou nome). Texto, áudio gravado na hora e fotos; tempo real via WebSocket; horário, ✓✓ de lida, aviso de nova mensagem; Denunciar e Bloquear em toda conversa (denúncias vão para a diretoria e para o Administrador Geral).

## Regras de permissão e privacidade

As regras são garantidas no servidor (cada rota filtra pelo dono da conta logada) e, onde possível, no próprio banco (`server/db.js`): `CHECK`s e *triggers* impedem, por exemplo, mover um membro para outro clube, colocar um membro numa unidade de outro clube, enviar requisito de clube a partir de unidade de outro clube, enviar para um requisito de outro público ou registrar entrega de medalha sem um administrador.

- O Administrador Geral não tem nenhuma rota que altere nome ou dados de membros.
- O membro só altera a própria foto (`PUT /api/me/photo`).
- A unidade só envia requisitos.
- A busca por nome no chat só encontra membros do próprio clube; de outros clubes, só pelo código.
- O perfil público do membro mostra a idade, nunca a data de nascimento.
- Fotos e áudios do chat e fotos de comprovação dos requisitos ficam fora da pasta pública e só abrem com login, para quem participa da conversa ou para quem enviou/avalia o requisito. Diretoria e Administrador Geral só veem a mídia de uma conversa privada quando ela foi denunciada a eles.
- O login bloqueia por 15 minutos depois de 8 senhas erradas para o mesmo usuário (ou 30 no mesmo IP).

## Estrutura

```
server/            API Express + SQLite + WebSocket
  config.js        cargos (lista fácil de editar), modelos de envio, faixas de idade
  db.js            esquema do banco e regras de integridade
  payments.js      ponto de integração do meio de pagamento (a definir)
  seed.js          dados de exemplo do Distrito Palmares
  routes/          auth, public, admin, club, requirements, content, rankings, chat, me
client/            frontend React (Vite)
  public/          logo, ícones do PWA, manifest e service worker
  src/pages/       telas de cada tipo de conta e telas compartilhadas
test/              testes da API
```

## Pagamentos

Itens pagos já têm preço, botão **Comprar**, pedido de compra e liberação de acesso. Enquanto o meio de pagamento não é definido, o pedido fica *pendente* e o Administrador Geral confirma o pagamento ou libera o acesso manualmente (aba Conteúdo → Compras). Para plugar um provedor, implemente `startCheckout()` e chame `confirmPurchase()` no webhook em `server/payments.js`.

## Publicação

- Use HTTPS (necessário para gravar áudio e instalar o app no celular).
- Defina `JWT_SECRET` e mantenha a pasta `data/` (banco e uploads) em disco persistente; `DATA_DIR` muda o local.
- `PORT` define a porta (padrão 3000).
- Atrás de proxy reverso (Nginx, Render etc.), defina `TRUST_PROXY=1` para o limite de tentativas de login usar o IP real.

## Logo

Logo original (não usa o emblema oficial dos Desbravadores): bússola com agulha vermelha e chama de fogueira no centro, montanhas e faixas amarela e vermelha lembrando o lenço. Arquivos em `client/public/`: `logo.svg` (ícone quadrado), `logo-horizontal.svg` e `logo-horizontal-branco.svg` (com o nome), `logo-maskable.svg` e os PNGs em `icons/` (gerados com `npm run icons`).
