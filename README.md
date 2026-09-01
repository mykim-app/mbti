# 성격유형 검사 사이트

이름을 입력하고 80문항에 답하면 성격유형을 계산해 보여 주고,
그 결과를 이름과 함께 저장합니다. 저장된 기록은 관리자 이메일로 받은
인증번호로 로그인해야 볼 수 있습니다.

- 화면: GitHub Pages (정적 파일, 빌드 도구 없음)
- 저장·인증: Supabase (무료 요금제로 충분)

## 폴더 구성

```
index.html            검사 화면
admin.html            관리자 화면
assets/
  config.js           Supabase 접속 정보 (직접 채워야 함)
  questions.js        선택형 160문항, 척도형 240문항, 유형 설명·궁합·직업
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

### 3. 메일 발송 서버(Gmail) 연결

Supabase 기본 발송 서버를 쓰는 동안에는 **메일 서식을 고칠 수 없습니다.**
서식 화면에 "Set up custom SMTP to edit templates" 라는 안내만 뜹니다.
따라서 발송 서버부터 연결해야 합니다.

**3-1. Google 계정에서 앱 비밀번호 만들기**

Gmail 은 평소 쓰는 비밀번호로는 외부 프로그램의 발송을 허용하지 않습니다.
전용 비밀번호를 따로 만들어야 합니다.

1. `myaccount.google.com/security` 에서 **2단계 인증**을 켭니다. 이게 켜져 있지 않으면
   다음 단계의 메뉴 자체가 나타나지 않습니다.
2. `myaccount.google.com/apppasswords` 로 갑니다.
3. 앱 이름에 `supabase` 처럼 알아볼 수 있는 이름을 넣고 **만들기** 를 누릅니다.
4. 화면에 나온 **16자리**를 복사해 둡니다. 창을 닫으면 다시 볼 수 없고, 다시 만들어야 합니다.
   붙여 넣을 때 사이의 공백은 지웁니다.

> 앱 비밀번호 메뉴가 보이지 않으면 세 가지 중 하나입니다. 2단계 인증이 꺼져 있거나,
> 2단계 인증을 보안 키로만 설정했거나, 회사·학교 계정이라 관리자가 막아둔 경우입니다.
> 기관 계정이 막혀 있으면 개인 Gmail 주소로 만들어도 됩니다.

**3-2. Supabase 에 입력하기**

`https://supabase.com/dashboard/project/_/auth/smtp` 로 가거나,
**Authentication** → **Emails** → **SMTP Settings** 탭을 엽니다.
**Enable Custom SMTP** 를 켜고 아래대로 채웁니다.

| 칸 | 넣을 값 |
| --- | --- |
| Sender email | 앱 비밀번호를 만든 Gmail 주소 그대로 |
| Sender name | 성격유형 검사 (받는 사람에게 보이는 이름) |
| Host | `smtp.gmail.com` |
| Port | `465` (연결이 안 되면 `587`) |
| Username | Sender email 과 **똑같은** 주소 |
| Password | 3-1 에서 만든 16자리 |

**Sender email 과 Username 이 다르면 발송이 거부됩니다.** 구글은 로그인한 계정과
발신자가 같아야 메일을 내보냅니다. 다 채웠으면 저장합니다.

> 커스텀 SMTP 를 켜면 발송 한도가 시간당 30건으로 잡힙니다. 관리자 한 명이 쓰기엔
> 넉넉하며, 값은 **Authentication > Rate Limits** 에서 볼 수 있습니다.
> 개인 Gmail 은 하루 발송량 제한이 있어 대규모 운영에는 맞지 않지만,
> 인증번호 용도로는 충분합니다.

### 4. 인증번호(숫자) 방식으로 바꾸기

Supabase 는 기본값이 '클릭하는 링크'입니다. 메일 서식을 고쳐야 숫자가 발송됩니다.
링크와 숫자는 같은 기능을 쓰며, **어느 쪽이 발송되는지는 오직 서식 내용으로 결정**됩니다.

- 서식에 `{{ .ConfirmationURL }}` 이 있으면 → 링크가 발송됩니다.
- 서식에 `{{ .Token }}` 이 있으면 → 숫자 인증번호가 발송됩니다.
  자릿수는 프로젝트마다 다를 수 있습니다. 실제로 오는 자릿수를
  `assets/config.js` 의 `OTP_LENGTH` 에 맞춰 두세요. 기본값은 8 입니다.

**4-1. 서식 화면 열기**

`https://supabase.com/dashboard/project/_/auth/templates` 로 바로 들어가거나,
왼쪽 메뉴 **Authentication** → **Emails** → **Templates** 탭을 엽니다.
3단계를 마쳤으면 잠금 안내가 사라지고 입력칸이 열립니다.
서식 목록 중 **Magic link or OTP** 를 고릅니다.
`Confirm signup`, `Invite user`, `Reset password` 는 다른 용도이므로 건드리지 않습니다.

**4-2. 제목과 본문 바꾸기**

Subject heading(제목):

```
[성격유형 검사] 관리자 인증번호 {{ .Token }}
```

Message body(본문) 안의 내용을 모두 지우고 아래를 붙여 넣습니다.
기존 `<a href="{{ .ConfirmationURL }}">...</a>` 줄이 **한 글자도 남지 않아야** 합니다.

```html
<h2>관리자 인증번호</h2>
<p>아래 여덟 자리 번호를 1분 안에 입력하세요.</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
```

**Save changes** 를 누릅니다.

**4-3. 유효 시간 줄이기**

`https://supabase.com/dashboard/project/_/auth/providers` 에서 **Email** 을 펼치고
**Email OTP Expiration** 값을 `60` 으로 바꾼 뒤 저장합니다. 기본값은 3600(1시간)입니다.
화면이 60을 받지 않으면 허용되는 가장 작은 값으로 두세요. 이 값이 실제 유효 시간이고,
사이트에 보이는 1분 카운트다운은 안내용입니다.

### 5. 접속 정보 넣기

**Project Settings > API** 에서 Project URL 과 anon public key 를 복사해
`assets/config.js` 에 넣습니다.

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
export const OTP_LENGTH = 8;   // 메일로 오는 인증번호 자릿수
```

관리자 주소는 코드에 두지 않습니다. 관리자 화면에서 직접 입력하며,
누가 기록을 볼 수 있는지는 `schema.sql` 의 권한 정책이 정합니다.

anon key 는 공개되어도 되는 값입니다. 실제 차단은 `schema.sql` 의 권한 설정이
담당합니다. **service_role key 는 절대 넣지 마세요.**

### 6. GitHub 에 올리고 공개하기

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

검사 방식은 두 가지이고, 시작 화면에서 하나를 고릅니다. 둘 다 80문항입니다.

**일반형 80문항** — 상황을 묻고 네 개의 답 중 하나를 고릅니다.
- 문항 풀은 지표당 40문항, 모두 160문항입니다.
- 검사할 때마다 지표마다 20개씩 무작위로 뽑아 80문항을 냅니다.
  어느 지표도 더 많거나 적게 나오지 않습니다.
- 출제 순서도 매번 섞이므로, 같은 사람이 다시 해도 문항 구성과 순서가 달라집니다.
- 문항마다 질문 하나와 선택지 네 개가 있습니다. 선택지는 한쪽 극에서 반대쪽 극으로
  기울기가 옮겨가며, 각각 그 자체로 완결된 문장이라 다른 선택지와 견줘 볼 필요가 없습니다.
- 방향이 뚜렷한 선택지는 2점, 약한 선택지는 1점입니다.
- 지표당 최대 40점이며, 결과의 백분율은 두 극이 나눠 가진 점수 비율입니다.
- 중립 선택지는 두지 않았습니다. 방향이 흐려지는 것을 막기 위해서입니다.
- 뽑힌 문항의 절반은 선택지 순서를 뒤집어 보여 줍니다. 맨 위 선택지만 계속 고르는 습관이
  특정 유형으로 쏠리지 않게 하려는 장치이며, 채점 값은 순서와 무관하게 유지됩니다.

**척도형 80문항** — 문장 하나를 읽고 얼마나 그런지 일곱 단계로 표시합니다.
- 문항 풀은 지표당 60문항, 모두 240문항입니다. 여기서 지표당 20개씩 뽑습니다.
- 매우 그렇다 3점, 그렇다 2점, 조금 그렇다 1점, 가운데 0점이며 그렇지 않다 쪽도 같습니다.
- 지표마다 '그렇다가 앞 극'인 문장과 '그렇다가 뒤 극'인 문장을 절반씩 뽑습니다.
  계속 그렇다만 누르거나 그렇지 않다만 눌러도 특정 유형으로 쏠리지 않습니다.
- 두 방식의 문항 풀을 합치면 400문항입니다.
- 두 극이 같은 점수면 방향이 뚜렷한 응답이 많은 쪽으로 정하고, 화면에 동률임을 표시합니다.

## 막힐 때

**서식 화면에 "Set up custom SMTP to edit templates" 만 보이고 편집이 안 된다**
발송 서버를 아직 연결하지 않았습니다. 3단계를 먼저 끝내야 4단계가 열립니다.

**`535 5.7.8 Username and Password not accepted`**
평소 쓰는 Gmail 비밀번호를 넣었거나, 앱 비밀번호 사이의 공백을 함께 붙여 넣었습니다.
16자리를 공백 없이 다시 넣으세요.

**`534` 또는 로그인 거부**
해당 Google 계정에 2단계 인증이 꺼져 있습니다.

**발신자가 내가 넣은 주소가 아니다 / 발송이 거부된다**
Sender email 과 Username 이 서로 다릅니다. 둘을 같은 주소로 맞추세요.

**메일에 숫자 대신 링크가 왔다**
서식에 `{{ .ConfirmationURL }}` 이 남아 있습니다. 또는 `Magic link or OTP` 가 아닌
다른 서식을 고쳤습니다. 3-2 를 다시 확인하세요.

**`Signups not allowed for otp` 오류**
해당 주소가 Authentication > Users 에 없습니다. 이 사이트는 새 계정을 만들지 않도록
막아 두었기 때문에(`shouldCreateUser: false`), 관리자 주소를 먼저 등록해야 합니다. (2단계)

**인증번호 자릿수가 화면과 다르다**
`assets/config.js` 의 `OTP_LENGTH` 를 실제로 오는 자릿수로 바꾸세요. 이 한 곳만 고치면
안내 문구와 입력칸이 함께 맞춰집니다.

**`Token has expired or is invalid` 오류**
유효 시간이 지났거나, 이미 한 번 쓴 번호이거나, 최근에 새 번호를 받아 이전 번호가
무효가 된 경우입니다. 가장 마지막에 온 메일의 번호를 쓰세요.

**`Email rate limit exceeded` 또는 429 오류**
같은 주소로는 60초에 한 번만 요청됩니다. 1분 기다렸다가 다시 누르세요.

**`Error sending magic link email`**
Supabase 가 메일 발송에 실패했습니다. 3단계 SMTP 설정을 확인하세요. 흔한 원인은
Sender email 과 Username 이 서로 다른 경우, 일반 비밀번호를 넣은 경우,
그리고 SMTP 를 아직 연결하지 않은 경우입니다. 기본 발송 서버는 Supabase 계정에
등록된 팀 구성원 주소로만 보낼 수 있어, 외부 주소로는 이 오류가 납니다.
자세한 실패 사유는 Authentication > Logs 에서 확인합니다.

**메일이 아예 안 온다**
스팸함을 먼저 보시고, 그래도 없으면 기관 메일 서버가 막은 것입니다. 3-4 의 SMTP 연결이
필요합니다. 확인은 Authentication > Logs 에서 발송 기록을 보면 됩니다.

**결과 저장에서 `new row violates row-level security policy` 오류**
`schema.sql` 의 '결과 제출 허용' 정책이 적용되지 않았습니다. SQL 을 다시 실행하세요.

**관리자 화면에 기록이 하나도 안 보인다**
로그인한 주소와 `schema.sql` 에 적힌 주소가 다르면 읽기가 막힙니다. 두 곳의 철자를
맞추고 SQL 을 다시 실행하세요.

**PDF 내용이 잘려서 나온다**
파일로 내려받는 방식은 화면을 그대로 찍어 A4 안에 맞춰 줄입니다. 잘림 없이 한 장에
들어가도록 계산하므로, 잘린 파일이 나오면 예전 `assets/app.js` 가 남아 있는 것입니다.
브라우저 캐시를 지우거나 시크릿 창에서 다시 시도하세요.

**PDF 저장이 안 된다**
카카오톡·네이버 앱 안에서 열면 인쇄 창이 뜨지 않습니다. 이 경우 버튼을 누르면 화면을
직접 A4 PDF로 만들어 내려받습니다. 그것마저 막히는 웹뷰라면 오른쪽 위 메뉴에서
'다른 브라우저로 열기'를 고른 뒤 다시 시도하세요. 일반 브라우저에서는 인쇄 창이 열리므로
대상을 'PDF로 저장'으로 고르면 됩니다.

**내 컴퓨터에서 파일을 열었더니 아무것도 안 뜬다**
`index.html` 을 더블클릭해 여는 방식은 브라우저 보안 때문에 동작하지 않습니다.
폴더에서 `python -m http.server 8000` 을 실행하고 `http://localhost:8000` 으로 접속하거나,
GitHub Pages 에 올린 주소로 확인하세요.

## 알아두실 점

- 결과는 참고 자료입니다. 같은 사람이 몇 주 뒤 다시 하면 한 지표가 바뀌는 일이
  흔합니다. 채용·인사·평가의 근거로 쓰지 않는 것이 좋습니다.
- 이름을 받는 순간 개인정보 수집에 해당합니다. 시작 화면의 안내 문구를 기관
  기준에 맞게 고치고, 보관 기간과 파기 시점을 정해 두시기 바랍니다.
- 저장된 기록은 관리자만 읽을 수 있지만, 결과를 넣는 것은 누구나 할 수 있습니다.
  주소가 알려지면 장난 기록이 쌓일 수 있으므로, 관리자 화면에서 지울 수 있게 해 두었습니다.
