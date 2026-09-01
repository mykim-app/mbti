-- Supabase 대시보드 > SQL Editor 에 그대로 붙여 넣고 실행합니다.
-- 관리자 주소를 바꿀 때는 아래 두 정책의 이메일을 함께 고쳐야 합니다.

create table if not exists public.mbti_results (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 1 and 20),
  mbti_type      text not null check (mbti_type ~ '^[EI][SN][TF][JP]$'),
  question_count int  not null check (question_count between 1 and 200),
  ei_e int not null, ei_i int not null,
  sn_s int not null, sn_n int not null,
  tf_t int not null, tf_f int not null,
  jp_j int not null, jp_p int not null
);

create index if not exists mbti_results_created_at_idx
  on public.mbti_results (created_at desc);

alter table public.mbti_results enable row level security;

-- 누구나 결과를 넣을 수는 있지만, 읽을 수는 없다.
drop policy if exists "결과 제출 허용" on public.mbti_results;
create policy "결과 제출 허용"
  on public.mbti_results for insert
  to anon, authenticated
  with check (true);

-- 읽기는 로그인한 관리자 주소만 가능하다.
drop policy if exists "관리자 조회" on public.mbti_results;
create policy "관리자 조회"
  on public.mbti_results for select
  to authenticated
  using (auth.jwt() ->> 'email' = 'mykim@igc.or.kr');

-- 삭제도 관리자만 가능하다.
drop policy if exists "관리자 삭제" on public.mbti_results;
create policy "관리자 삭제"
  on public.mbti_results for delete
  to authenticated
  using (auth.jwt() ->> 'email' = 'mykim@igc.or.kr');
