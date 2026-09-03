-- Supabase 대시보드 > SQL Editor 에 그대로 붙여 넣고 실행합니다.
-- 관리자 주소는 이 파일에 적지 않습니다. 아래를 실행한 뒤 마지막 안내대로
-- 데이터베이스에 직접 넣으세요. 저장소에는 주소가 남지 않습니다.

-- 1) 검사 결과 테이블
create table if not exists public.mbti_results (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 1 and 20),
  mbti_type      text not null check (mbti_type ~ '^[EI][SN][TF][JP]$'),
  question_count int  not null check (question_count between 1 and 200),
  ei_e int not null, ei_i int not null,
  sn_s int not null, sn_n int not null,
  tf_t int not null, tf_f int not null,
  jp_j int not null, jp_p int not null,
  blood_type text check (blood_type in ('A','B','O','AB')),
  zodiac     text check (char_length(zodiac) between 2 and 20)
);

-- 이미 표를 만들어 두었다면 아래 두 줄이 열을 더해 준다.
alter table public.mbti_results add column if not exists blood_type text;
alter table public.mbti_results add column if not exists zodiac text;

create index if not exists mbti_results_created_at_idx
  on public.mbti_results (created_at desc);

-- 2) 관리자 명단 테이블
--    누구에게도 읽기 권한을 주지 않는다. 아래 함수만 안을 들여다볼 수 있다.
create table if not exists public.admins (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 3) 로그인한 사람이 관리자 명단에 있는지 확인하는 함수
--    security definer 라서 명단 테이블을 대신 확인해 주고, 결과는 참/거짓만 돌려준다.
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.email = (auth.jwt() ->> 'email')
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 4) 접근 권한
alter table public.mbti_results enable row level security;

-- 누구나 결과를 넣을 수는 있지만, 읽을 수는 없다.
drop policy if exists "결과 제출 허용" on public.mbti_results;
create policy "결과 제출 허용"
  on public.mbti_results for insert
  to anon, authenticated
  with check (true);

-- 읽기는 관리자 명단에 있는 사람만 가능하다.
drop policy if exists "관리자 조회" on public.mbti_results;
create policy "관리자 조회"
  on public.mbti_results for select
  to authenticated
  using (public.is_admin());

-- 삭제도 관리자만 가능하다.
drop policy if exists "관리자 삭제" on public.mbti_results;
create policy "관리자 삭제"
  on public.mbti_results for delete
  to authenticated
  using (public.is_admin());


-- 5) 오늘 몇 건이 저장됐는지 세어 주는 함수
--    기록은 보여 주지 않고 숫자만 돌려준다. 시작 화면에 쓴다.
create or replace function public.today_count()
  returns integer
  language sql
  security definer
  stable
  set search_path = public
as $$
  select count(*)::int
  from public.mbti_results
  where created_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
                        at time zone 'Asia/Seoul';
$$;
revoke all on function public.today_count() from public;
grant execute on function public.today_count() to anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 마지막 단계: 관리자 주소 등록
--
-- 아래 한 줄을 SQL Editor 에 따로 붙여 넣고, 주소를 자기 것으로 바꿔 실행하세요.
-- 이 줄은 저장소에 올리지 마세요.
--
--   insert into public.admins (email) values ('여기에-관리자-주소')
--     on conflict (email) do nothing;
--
-- 등록된 주소인지 확인:   select email from public.admins;
-- 관리자 교체:            delete from public.admins where email = '옛 주소';
-- ─────────────────────────────────────────────────────────────
