import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, OTP_WINDOW_SECONDS, OTP_LENGTH } from "./config.js";

const app = document.getElementById("app");
const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let email = "";      // 화면에서 직접 입력받는다. 코드에 주소를 넣어두지 않는다.
let timer = null;
let rows = [];
let query = "";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const KO_NUM = { 4: "네", 5: "다섯", 6: "여섯", 7: "일곱", 8: "여덟", 9: "아홉", 10: "열" };
const LEN_KO = (KO_NUM[OTP_LENGTH] || OTP_LENGTH) + " 자리";

/* ── 1단계: 인증번호 요청 ──────────────────────────────── */
function renderRequest(msg, isError) {
  stopTimer();
  app.innerHTML = `
    <h1>관리자 확인</h1>
    <p class="lead">등록된 관리자 주소로 ${LEN_KO} 인증번호를 보냅니다.
      번호는 발송 후 ${OTP_WINDOW_SECONDS}초 안에 입력해야 합니다.</p>
    ${configured ? "" : `<div class="err">Supabase 접속 정보가 설정되지 않았습니다.
      <code>assets/config.js</code> 를 먼저 채워 주세요.</div>`}
    <div class="field">
      <label class="label" for="em">이메일 주소</label>
      <input id="em" class="input" type="email" inputmode="email"
        autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="">
    </div>
    ${msg ? `<div class="${isError ? "err" : "ok"}">${esc(msg)}</div>` : ""}
    <div class="row">
      <button class="btn" id="send" ${configured ? "" : "disabled"}>인증번호 받기</button>
      <a class="link" href="./index.html">검사 화면으로</a>
    </div>`;

  const em = document.getElementById("em");
  em.value = "";
  em.focus();
  em.addEventListener("keydown", (e) => { if (e.key === "Enter") sendCode(); });
  document.getElementById("send").addEventListener("click", sendCode);
}

async function sendCode() {
  const em = document.getElementById("em");
  const v = (em ? em.value : "").trim();
  if (!valid(v)) return renderRequest("이메일 주소를 정확히 입력하세요.", true);
  email = v;

  const btn = document.getElementById("send");
  if (btn) { btn.disabled = true; btn.textContent = "보내는 중"; }

  // emailRedirectTo 를 넣지 않아야 링크가 아닌 숫자 인증번호가 발송된다.
  const { error } = await sb.auth.signInWithOtp({
    email, options: { shouldCreateUser: false }
  });
  if (error) return renderRequest("인증번호를 보내지 못했습니다. " + error.message, true);
  renderVerify();
}

/* ── 2단계: 인증번호 입력 (제한 시간) ──────────────────── */
function renderVerify(msg) {
  stopTimer();
  app.innerHTML = `
    <h1>인증번호 입력</h1>
    <p class="lead">메일로 보낸 ${LEN_KO} 숫자를 입력하세요.</p>
    <div class="field">
      <input id="code" class="input otp" inputmode="numeric" autocomplete="one-time-code"
        maxlength="${OTP_LENGTH}" placeholder="${"0".repeat(OTP_LENGTH)}">
    </div>
    <p class="lead" style="margin-bottom:18px">남은 시간
      <span class="count" id="cnt">${OTP_WINDOW_SECONDS}초</span></p>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ""}
    <div class="row">
      <button class="btn" id="ok">확인</button>
      <button class="btn-ghost" id="resend" disabled>다시 받기</button>
      <a class="link" href="./index.html">검사 화면으로</a>
    </div>`;

  const codeEl = document.getElementById("code");
  const okBtn = document.getElementById("ok");
  const resendBtn = document.getElementById("resend");
  const cnt = document.getElementById("cnt");
  codeEl.focus();

  let left = OTP_WINDOW_SECONDS;
  timer = setInterval(() => {
    left--;
    cnt.textContent = left > 0 ? left + "초" : "시간 초과";
    if (left <= 10) cnt.classList.add("warn");
    if (left <= 0) {
      stopTimer();
      okBtn.disabled = true;
      codeEl.disabled = true;
      resendBtn.disabled = false;
    }
  }, 1000);

  // 인증번호 재요청은 서버에서 60초에 한 번으로 제한된다.
  setTimeout(() => { resendBtn.disabled = false; }, OTP_WINDOW_SECONDS * 1000);

  const submit = async () => {
    const token = codeEl.value.replace(/\D/g, "");
    if (token.length !== OTP_LENGTH)
      return renderVerify(`${LEN_KO} 숫자를 입력하세요.`);
    okBtn.disabled = true;
    const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) return renderVerify("인증에 실패했습니다. " + error.message);
    stopTimer();
    openList();
  };
  okBtn.addEventListener("click", submit);
  codeEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  resendBtn.addEventListener("click", () => renderRequest("", false));
}

/* ── 3단계: 기록 조회 ──────────────────────────────────── */
async function openList() {
  app.innerHTML = `<h1>검사 기록</h1><p class="lead">불러오는 중입니다.</p>`;
  const { data, error } = await sb
    .from("mbti_results").select("*").order("created_at", { ascending: false });
  if (error) {
    app.innerHTML = `<h1>검사 기록</h1>
      <div class="err">기록을 불러오지 못했습니다. ${esc(error.message)}</div>
      <button class="btn-ghost" id="out">로그아웃</button>`;
    document.getElementById("out").addEventListener("click", signOut);
    return;
  }
  rows = data || [];
  renderList();
}

function renderList() {
  const list = rows.filter((r) => !query.trim() || r.name.includes(query.trim()));
  const dist = {};
  for (const r of list) dist[r.mbti_type] = (dist[r.mbti_type] || 0) + 1;
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 6);

  app.innerHTML = `
    <h1>검사 기록</h1>
    <div class="row" style="margin-bottom:16px">
      <input id="q" class="input" style="flex:1 1 180px" placeholder="이름 검색" value="${esc(query)}">
      <button class="btn-ghost" id="reload">새로고침</button>
      <button class="btn-ghost" id="csv" ${list.length ? "" : "disabled"}>CSV 내려받기</button>
    </div>
    ${top.length ? `<div class="row" style="margin-bottom:18px">${top.map(([t, n]) =>
      `<span class="chip">${t} ${n}</span>`).join("")}</div>` : ""}
    ${list.length === 0 ? `<p class="lead">표시할 기록이 없습니다.</p>` : `
    <div class="scroll"><table class="tbl">
      <thead><tr><th>이름</th><th>유형</th><th>E·I</th><th>S·N</th><th>T·F</th><th>J·P</th>
        <th>문항</th><th>검사일시</th><th></th></tr></thead>
      <tbody>${list.map((r) => `<tr>
        <td>${esc(r.name)}</td>
        <td style="font-weight:700;letter-spacing:.04em">${esc(r.mbti_type)}</td>
        <td class="num">${r.ei_e}:${r.ei_i}</td>
        <td class="num">${r.sn_s}:${r.sn_n}</td>
        <td class="num">${r.tf_t}:${r.tf_f}</td>
        <td class="num">${r.jp_j}:${r.jp_p}</td>
        <td class="num">${r.question_count}</td>
        <td class="num">${new Date(r.created_at).toLocaleString("ko-KR",
          { dateStyle: "short", timeStyle: "short" })}</td>
        <td><button class="link" data-del="${r.id}">삭제</button></td>
      </tr>`).join("")}</tbody>
    </table></div>`}
    <div class="foot">
      <span style="font-size:12.5px;color:var(--soft)">총 ${list.length}건</span>
      <button class="btn-ghost" id="out">로그아웃</button>
    </div>`;

  const q = document.getElementById("q");
  q.addEventListener("input", () => {
    query = q.value;
    const pos = q.selectionStart;
    renderList();
    const nq = document.getElementById("q");
    nq.focus(); nq.setSelectionRange(pos, pos);
  });
  document.getElementById("reload").addEventListener("click", openList);
  document.getElementById("out").addEventListener("click", signOut);
  const csv = document.getElementById("csv");
  if (csv) csv.addEventListener("click", () => exportCsv(list));
  app.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => remove(b.dataset.del)));
}

async function remove(id) {
  if (!confirm("이 기록을 지웁니다. 되돌릴 수 없습니다.")) return;
  const { error } = await sb.from("mbti_results").delete().eq("id", id);
  if (error) return alert("삭제하지 못했습니다. " + error.message);
  rows = rows.filter((r) => r.id !== id);
  renderList();
}

function exportCsv(list) {
  const head = ["검사일시", "이름", "유형", "문항수", "E", "I", "S", "N", "T", "F", "J", "P"];
  const lines = [head.join(",")];
  for (const r of list) {
    lines.push([
      new Date(r.created_at).toLocaleString("ko-KR"),
      r.name, r.mbti_type, r.question_count,
      r.ei_e, r.ei_i, r.sn_s, r.sn_n, r.tf_t, r.tf_f, r.jp_j, r.jp_p
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mbti_기록_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function signOut() {
  await sb.auth.signOut();
  email = "";
  renderRequest("로그아웃했습니다.", false);
}

/* ── 진입 ──────────────────────────────────────────────── */
(async () => {
  if (!sb) return renderRequest("", false);
  const { data } = await sb.auth.getSession();
  if (data.session) openList();
  else renderRequest("", false);
})();
