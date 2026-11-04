# Tour Interativo pela Escola

Plataforma gamificada para a comunidade escolar conhecer a instituição em três fases: quiz, quebra-cabeça e nuvem de palavras. O site é estático e fica no GitHub Pages. Os dados, a autenticação administrativa, as imagens, os áudios e a pontuação ficam no Supabase.

O participante abre o link, informa o nome e começa. Não há instalação, cadastro de jogador nem servidor para iniciar.

## Para a equipe do 7º ano

Abra o site e toque em **Cuidar do tour**. A senha inicial é `horizonte`. Dentro do painel dá para trocar o nome da escola, as cores, as perguntas, a foto, as palavras, o tempo e a senha. Não é preciso e-mail.

Enquanto o banco na nuvem não estiver ligado, o que a equipe salvar fica neste aparelho e neste navegador. Outro celular ainda vê o tour de exemplo.

## O que já está no código

- Jogo com as três fases, cronômetros, tentativas, pontuação e animações.
- Painel em `/admin`, com identidade visual, conteúdos, sons, regras e relatórios em CSV e Excel.
- SQL com RLS, visões públicas sem gabarito e buckets de armazenamento.
- Função `game`, que valida respostas, palavras, tentativas e pontuação. O navegador não envia a nota final.
- Fluxo de publicação pelo GitHub Actions.
- Sons originais de demonstração e uma ilustração da fachada, substituíveis pelo painel.

## O que precisa ser ativado por você

O GitHub Pages publica o jogo e o painel. Sem o projeto Supabase, a equipe entra com a senha `horizonte` e as mudanças ficam no navegador. Com o Supabase ligado, a mesma tela de senha entra com o usuário `equipe@tour.local`.

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor, execute nesta ordem:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_seed.sql`
3. Em Authentication, deixe o acesso por e-mail ativo. Crie o usuário administrador e confirme o e-mail, se a confirmação estiver ligada.
4. No SQL Editor, autorize esse usuário:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'admin@escola.exemplo';
```

5. Instale a [Supabase CLI](https://supabase.com/docs/guides/cli), entre na pasta do projeto e publique a função:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy game --no-verify-jwt
```

`--no-verify-jwt` é necessário porque o jogador não tem conta. A função confere o token da partida e usa a `service_role` apenas no servidor.

6. Em Project Settings → API, copie a Project URL e a chave `anon`. Não copie a `service_role` para o site nem para o GitHub.

## Publicar no GitHub Pages

1. Crie um repositório e envie este código para a branch `main`.
2. Em Settings → Secrets and variables → Actions, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Em Settings → Pages, escolha **GitHub Actions** como fonte.
4. O fluxo `.github/workflows/pages.yml` gera o site em `https://USUARIO.github.io/NOME-DO-REPOSITORIO/`.
5. O painel fica em `https://USUARIO.github.io/NOME-DO-REPOSITORIO/admin`.

Para testar no computador:

```bash
npm install
npm run generate:audio
copy .env.example .env.local
npm run dev
```

Preencha `.env.local` com a URL e a chave anon. Sem essas variáveis, `npm run dev` abre um modo local honesto: os dados ficam só naquele navegador e o pacote de produção não inclui esse modo.

## Segurança

- Jogadores não leem as tabelas de perguntas, alternativas, palavras, sessões ou tentativas.
- A visão pública traz identidade visual, tempos e pontuações máximas. Ela não traz gabarito, penalidade nem classificação das palavras.
- Cada partida recebe um token aleatório. Só a função `game` reconhece esse token.
- A nota do quiz sai das respostas conferidas no servidor. A da nuvem sai de cada toque conferido no servidor. A do quebra-cabeça é calculada no servidor a partir do tempo oficial e da montagem enviada, uma única vez por tentativa.
- Repetir uma resposta ou um toque não soma pontos de novo.
- Uma fase encerrada não pode ser reaberta para acumular outra pontuação. Se a política for reiniciar, a nova tentativa substitui a anterior; não soma com ela.
- O painel exige usuário do Supabase presente na tabela `admins`.

A montagem do quebra-cabeça acontece na tela. O servidor impede nota inventada e conclusão duplicada, mas não esconde a ordem das peças de quem inspeciona o próprio navegador, porque a imagem precisa ser desenhada ali.

O conteúdo fictício inicial está no SQL de demonstração. Depois que a escola substituir perguntas e palavras pelo painel, o gabarito real existe só no banco.

## Conteúdo inicial

A Escola Horizonte entra como exemplo: cinco perguntas de 10 pontos, um quebra-cabeça de demonstração, dez palavras (seis corretas e quatro incorretas) e sons originais. Tudo pode ser apagado ou substituído no painel. A pontuação sugerida é 50 + 30 + 40, com reconhecimento acima de 100 pontos.

## Conferência rápida no Supabase

Com a chave anon, estes pedidos devem falhar ou voltar vazios, sem a coluna `is_correct`:

- `GET /rest/v1/words`
- `GET /rest/v1/alternatives`
- `GET /rest/v1/sessions`

A leitura esperada do site é `GET /rest/v1/public_settings`.
