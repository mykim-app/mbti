# 성격유형 검사 사이트

이름을 입력하고 80문항(또는 40문항)에 답하면 성격유형을 계산해 보여 주고,
그 결과를 이름과 함께 저장합니다. 저장된 기록은 관리자 이메일로 받은
여섯 자리 인증번호로 로그인해야 볼 수 있습니다.

- 화면: GitHub Pages (정적 파일, 빌드 도구 없음)
- 저장·인증: Supabase (무료 요금제로 충분)

## 폴더 구성

```
index.html            검사 화면
admin.html            관리자 화면
assets/
  config.js           Supabase 접속 정보 (직접 채워야 함)
  questions.js        문항 80개와 유형 설명
  scoring.js          문항 배치와 채점
  app.js              검사 진행
  admin.js            인증번호 로그인, 기록 조회
  styles.css
supabase/schema.sql   테이블과 접근 권한 설정
```

## 설치 순서

### 1. Supabase 프로젝트 만들기

1. supabase.com 에 가입하고 새 프로젝트를 만듭니다. 지역은 Northeast Asia (Seoul)를 고릅니다.
2. 왼쪽 메뉴 **SQL Editor** 에서 `supabase/schema.sql` 내용을 붙여 넣고 실행합니다.
   - 관리자 주소를 `mykim@igc.or.kr` 이 아닌 것으로 바꾸려면 SQL 안의 이메일 두 곳을 먼저 고칩니다.

### 2. 관리자 계정 등록

**Authentication > Users > Add user** 에서 `mykim@igc.or.kr` 을 등록합니다.
비밀번호는 아무 값이나 넣어도 됩니다. 이 사이트는 비밀번호를 쓰지 않고
인증번호로만 로그인합니다. 미리 등록된 주소가 아니면 인증번호 발송 자체가
거부되므로, 다른 사람이 관리자 화면에 접근할 수 없습니다.

### 3. 인증번호(숫자) 방식으로 바꾸기

Supabase 는 기본값이 '클릭하는 링크'입니다. 숫자 인증번호로 바꿔야 합니다.

1. **Authentication > Emails > Templates > Magic Link** 를 엽니다.
2. 본문의 `{{ .ConfirmationURL }}` 을 지우고 `{{ .Token }}` 을 넣습니다. 예:

   ```html
   <h2>관리자 인증번호</h2>
   <p>아래 여섯 자리 번호를 1분 안에 입력하세요.</p>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   ```

3. **Authentication > Sign In / Providers > Email > Email OTP Expiration** 을
   `60` 으로 낮춥니다. 화면이 60을 받지 않으면 허용되는 가장 작은 값으로 두세요.
   이 값이 실제 유효 시간이고, 사이트에 표시되는 1분 카운트다운은 안내용입니다.

> 참고: 인증번호 재요청은 60초에 한 번만 됩니다. 기본 메일 발송량에는 하루 한도가
> 있으므로, 자주 쓰실 거라면 **Project Settings > Authentication > SMTP** 에
> 재단 메일 서버나 외부 발송 서비스를 연결하시는 편이 안정적입니다.

### 4. 접속 정보 넣기

**Project Settings > API** 에서 Project URL 과 anon public key 를 복사해
`assets/config.js` 에 넣습니다.

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
export const ADMIN_EMAIL = "mykim@igc.or.kr";
```

anon key 는 공개되어도 되는 값입니다. 실제 차단은 `schema.sql` 의 권한 설정이
담당합니다. **service_role key 는 절대 넣지 마세요.**

### 5. GitHub 에 올리고 공개하기

```bash
git init
git add .
git commit -m "성격유형 검사 사이트"
git branch -M main
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

저장소 **Settings > Pages** 에서 Source 를 `Deploy from a branch`,
Branch 를 `main` / `/ (root)` 로 두고 저장하면 몇 분 뒤 주소가 나옵니다.

마지막으로 Supabase **Authentication > URL Configuration > Site URL** 에
그 주소를 넣어 둡니다.

## 채점 방식

- 지표당 20문항, 총 80문항. 간편형은 지표당 10문항.
- 두 문장 중 가까운 쪽을 고르고 강도까지 표시합니다. '확실히'는 2점, '조금'은 1점.
- 지표당 최대 40점이며, 결과의 백분율은 두 극이 나눠 가진 점수 비율입니다.
- 중립 선택지는 두지 않았습니다. 방향이 흐려지는 것을 막기 위해서입니다.
- 홀수 번째 문항은 두 문장의 위아래를 뒤집어, 한쪽 위치만 계속 고르는 습관을 줄입니다.
- 두 극이 같은 점수면 '확실히' 응답이 많은 쪽으로 정하고, 화면에 동률임을 표시합니다.

## 알아두실 점

- 결과는 참고 자료입니다. 같은 사람이 몇 주 뒤 다시 하면 한 지표가 바뀌는 일이
  흔합니다. 채용·인사·평가의 근거로 쓰지 않는 것이 좋습니다.
- 이름을 받는 순간 개인정보 수집에 해당합니다. 시작 화면의 안내 문구를 기관
  기준에 맞게 고치고, 보관 기간과 파기 시점을 정해 두시기 바랍니다.
- 저장된 기록은 관리자만 읽을 수 있지만, 결과를 넣는 것은 누구나 할 수 있습니다.
  주소가 알려지면 장난 기록이 쌓일 수 있으므로, 관리자 화면에서 지울 수 있게 해 두었습니다.
