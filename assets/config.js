// Supabase 접속 정보를 여기에 채워 넣으세요.
// Supabase 대시보드 > Project Settings > API 에서 확인합니다.
//
// anon key 는 공개되어도 되는 값입니다. 실제 접근 통제는 데이터베이스의
// RLS 정책(supabase/schema.sql)이 담당합니다. service_role key 는
// 절대로 이 파일에 넣지 마세요.

export const SUPABASE_URL = "https://vewmmndhipvazzmttzzr.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_BSnYjtOMPv6gdf7k0vnb_A_f5_Si7EP";

// 관리자 이메일. schema.sql 의 RLS 정책에 적은 주소와 반드시 같아야 합니다.
export const ADMIN_EMAIL = "mykim@igc.or.kr";

// 인증번호 입력 제한 시간(초)
export const OTP_WINDOW_SECONDS = 60;
