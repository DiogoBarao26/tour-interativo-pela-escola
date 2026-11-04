-- Conteúdo fictício da Escola Horizonte. O administrador pode substituir tudo pelo painel.
-- A classificação das palavras e o gabarito ficam nestas tabelas, sem exposição ao jogador.

insert into public.puzzles (id, title, image_url, active)
values (
  '11111111-1111-4111-8111-111111111111',
  'Fachada da Escola Horizonte',
  null,
  true
)
on conflict (id) do nothing;

insert into public.settings (
  id, school_name, game_title, welcome_text, success_title, success_detail,
  encourage_title, encourage_detail, start_button_label, retry_button_label,
  puzzle_selected_id
)
values (
  1,
  'Escola Horizonte',
  'TOUR INTERATIVO PELA ESCOLA',
  'Conheça os espaços, os projetos e os valores da nossa escola em três desafios. É rápido, divertido e feito para a comunidade.',
  'PARABÉNS! VOCÊ CONHECE MUITO BEM NOSSA ESCOLA!',
  'Sua pontuação mostra que você prestou atenção no que torna esta escola especial.',
  'QUASE LÁ! QUE TAL TENTAR NOVAMENTE?',
  'Cada tentativa ajuda a descobrir um pouco mais sobre a escola. Vamos juntos?',
  'COMEÇAR TOUR',
  'TENTAR NOVAMENTE',
  '11111111-1111-4111-8111-111111111111'
)
on conflict (id) do nothing;

insert into public.audio_settings (id) values (1) on conflict (id) do nothing;

insert into public.questions (id, prompt, points, position, active) values
  ('22222222-2222-4222-8222-222222222201', 'Em que ano a Escola Horizonte foi fundada?', 10, 1, true),
  ('22222222-2222-4222-8222-222222222202', 'Qual é o lema da Escola Horizonte?', 10, 2, true),
  ('22222222-2222-4222-8222-222222222203', 'Onde acontecem os experimentos de ciências?', 10, 3, true),
  ('22222222-2222-4222-8222-222222222204', 'Quais etapas de ensino a escola oferece nesta demonstração?', 10, 4, true),
  ('22222222-2222-4222-8222-222222222205', 'Qual projeto semanal convida as famílias para a escola?', 10, 5, true)
on conflict (id) do nothing;

insert into public.alternatives (id, question_id, label, is_correct, position) values
  ('33333333-3333-4333-8333-333333333101', '22222222-2222-4222-8222-222222222201', '1982', false, 1),
  ('33333333-3333-4333-8333-333333333102', '22222222-2222-4222-8222-222222222201', '1998', true, 2),
  ('33333333-3333-4333-8333-333333333103', '22222222-2222-4222-8222-222222222201', '2005', false, 3),
  ('33333333-3333-4333-8333-333333333104', '22222222-2222-4222-8222-222222222201', '2010', false, 4),
  ('33333333-3333-4333-8333-333333333201', '22222222-2222-4222-8222-222222222202', 'Vencer a qualquer custo', false, 1),
  ('33333333-3333-4333-8333-333333333202', '22222222-2222-4222-8222-222222222202', 'Saber para transformar', true, 2),
  ('33333333-3333-4333-8333-333333333203', '22222222-2222-4222-8222-222222222202', 'Estudar só na véspera', false, 3),
  ('33333333-3333-4333-8333-333333333204', '22222222-2222-4222-8222-222222222202', 'Cada um por si', false, 4),
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222203', 'Na biblioteca', false, 1),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222203', 'Na quadra', false, 2),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222203', 'No laboratório', true, 3),
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222203', 'No refeitório', false, 4),
  ('33333333-3333-4333-8333-333333333401', '22222222-2222-4222-8222-222222222204', 'Somente o Ensino Médio', false, 1),
  ('33333333-3333-4333-8333-333333333402', '22222222-2222-4222-8222-222222222204', 'Educação Infantil, Fundamental e Médio', true, 2),
  ('33333333-3333-4333-8333-333333333403', '22222222-2222-4222-8222-222222222204', 'Apenas cursos livres', false, 3),
  ('33333333-3333-4333-8333-333333333404', '22222222-2222-4222-8222-222222222204', 'Somente a Educação Infantil', false, 4),
  ('33333333-3333-4333-8333-333333333501', '22222222-2222-4222-8222-222222222205', 'Portas Abertas', true, 1),
  ('33333333-3333-4333-8333-333333333502', '22222222-2222-4222-8222-222222222205', 'Noite silenciosa', false, 2),
  ('33333333-3333-4333-8333-333333333503', '22222222-2222-4222-8222-222222222205', 'Prova relâmpago', false, 3),
  ('33333333-3333-4333-8333-333333333504', '22222222-2222-4222-8222-222222222205', 'Recreio eterno', false, 4)
on conflict (id) do nothing;

insert into public.words (id, label, is_correct, points, active) values
  ('44444444-4444-4444-8444-444444444401', 'respeito', true, 7, true),
  ('44444444-4444-4444-8444-444444444402', 'colaboração', true, 7, true),
  ('44444444-4444-4444-8444-444444444403', 'biblioteca', true, 7, true),
  ('44444444-4444-4444-8444-444444444404', 'ciências', true, 7, true),
  ('44444444-4444-4444-8444-444444444405', 'inclusão', true, 6, true),
  ('44444444-4444-4444-8444-444444444406', 'sustentabilidade', true, 6, true),
  ('44444444-4444-4444-8444-444444444407', 'desrespeito', false, 0, true),
  ('44444444-4444-4444-8444-444444444408', 'bagunça', false, 0, true),
  ('44444444-4444-4444-8444-444444444409', 'exclusão', false, 0, true),
  ('44444444-4444-4444-8444-444444444410', 'desperdício', false, 0, true)
on conflict (id) do nothing;
