import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, OTP_WINDOW_SECONDS, OTP_LENGTH } from "./config.js";
import { TYPE_INFO, BLOOD, ZODIAC } from "./questions.js";
import { renderComboSections, bindLookup } from "./combo.js";
import { renderTypeReport } from "./report.js";

const app = document.getElementById("app");
window.__loaded = true;   // 화면 스크립트가 실행됐다는 표시
const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
// 로그인 상태를 브라우저에 남기지 않는다. 화면을 새로 열면 매번 인증번호를 받아야 한다.
const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  : null;

const IDLE_LIMIT = 20 * 60 * 1000;   // 20분 동안 아무 동작이 없으면 자동 로그아웃
let idleTimer = null;

let email = "";      // 화면에서 직접 입력받는다. 코드에 주소를 넣어두지 않는다.
let timer = null;
let rows = [];
let query = "";
let view = "list";                                   // list | combo
let pick = { type: "ISTJ", blood: "A", zodiac: "aries" };
const PAGE_SIZE = 12;              // 한 쪽에 보여 줄 기록 수
let page = 0;

const ZLABEL = { aries: "양자리", taurus: "황소자리", gemini: "쌍둥이자리", cancer: "게자리",
  leo: "사자자리", virgo: "처녀자리", libra: "천칭자리", scorpio: "전갈자리",
  sagittarius: "사수자리", capricorn: "염소자리", aquarius: "물병자리", pisces: "물고기자리" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

function watchIdle(on) {
  const reset = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      stopIdle();
      signOut("자리를 비운 사이 자동으로 로그아웃했습니다.");
    }, IDLE_LIMIT);
  };
  const stop = () => {
    clearTimeout(idleTimer);
    ["click", "keydown", "scroll"].forEach((e) => window.removeEventListener(e, reset));
  };
  window.stopIdle = stop;
  if (!on) return stop();
  ["click", "keydown", "scroll"].forEach((e) => window.addEventListener(e, reset, { passive: true }));
  reset();
}
const stopIdle = () => window.stopIdle && window.stopIdle();
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
    watchIdle(true);
    guardBack();
    openList();
  };
  okBtn.addEventListener("click", submit);
  codeEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  resendBtn.addEventListener("click", () => renderRequest("", false));
}

/* ── 3단계: 기록 조회 ──────────────────────────────────── */
async function requireSession() {
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  return Boolean(data && data.session);
}

async function openList() {
  if (!(await requireSession())) return signOut("다시 인증해 주세요.");
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
  page = 0;
  renderList();
}

function renderList() {
  const list = rows.filter((r) => !query.trim() || r.name.includes(query.trim()));
  const dist = {};
  for (const r of list) dist[r.mbti_type] = (dist[r.mbti_type] || 0) + 1;
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (page >= pages) page = pages - 1;
  const slice = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  app.innerHTML = `
    <h1>검사 기록</h1>
    ${tabs()}
    <div class="row" style="margin-bottom:16px">
      <input id="q" class="input" style="flex:1 1 180px" placeholder="이름 검색" value="${esc(query)}">
      <button class="btn-ghost" id="reload">새로고침</button>
      <button class="btn-ghost" id="csv" ${list.length ? "" : "disabled"}>CSV 내려받기</button>
    </div>
    ${top.length ? `<div class="row" style="margin-bottom:18px">${top.map(([t, n]) =>
      `<span class="chip">${t} ${n}</span>`).join("")}</div>` : ""}
    ${list.length === 0 ? `<p class="lead">표시할 기록이 없습니다.</p>` : `
    <div class="cards">${slice.map((r) => `
      <div class="rcard clickrow" data-row="${r.id}" title="눌러서 조합 결과 보기">
        <div class="rc-head">
          <span class="rc-name">${esc(r.name)}</span>
          <span class="rc-type">${esc(r.mbti_type)}</span>
          <button class="link rc-del" data-del="${r.id}">삭제</button>
        </div>
        <div class="rc-body">
          <span><i>혈액형</i>${r.blood_type ? esc(r.blood_type) + "형" : "—"}</span>
          <span><i>별자리</i>${r.zodiac ? esc(ZLABEL[r.zodiac] || r.zodiac) : "—"}</span>
          <span><i>문항</i>${r.question_count}</span>
          <span><i>E·I</i>${r.ei_e}:${r.ei_i}</span>
          <span><i>S·N</i>${r.sn_s}:${r.sn_n}</span>
          <span><i>T·F</i>${r.tf_t}:${r.tf_f}</span>
          <span><i>J·P</i>${r.jp_j}:${r.jp_p}</span>
          <span class="rc-date">${(() => {
            const d = new Date(r.created_at);
            const p2 = (n) => String(n).padStart(2, "0");
            return `${String(d.getFullYear()).slice(2)}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ` +
                   `${p2(d.getHours())}:${p2(d.getMinutes())}`;
          })()}</span>
        </div>
      </div>`).join("")}</div>

    ${pages > 1 ? `<div class="pager">
      <button class="btn-ghost" id="prevp" ${page === 0 ? "disabled" : ""}>이전</button>
      <span class="pnum">${page + 1} / ${pages}쪽</span>
      <button class="btn-ghost" id="nextp" ${page + 1 >= pages ? "disabled" : ""}>다음</button>
    </div>` : ""}`}
    <div class="foot">
      <span style="font-size:12.5px;color:var(--soft)">총 ${list.length}건</span>
      <button class="btn-ghost" id="out">로그아웃</button>
    </div>
    <div class="backnote" id="backnote">화면을 벗어나려면 아래 <b>로그아웃</b>을 눌러 주세요.</div>`;

  const q = document.getElementById("q");
  const pv = document.getElementById("prevp");
  const nx = document.getElementById("nextp");
  if (pv) pv.addEventListener("click", () => { page--; renderList(); window.scrollTo(0, 0); });
  if (nx) nx.addEventListener("click", () => { page++; renderList(); window.scrollTo(0, 0); });

  q.addEventListener("input", () => {
    query = q.value;
    page = 0;
    const pos = q.selectionStart;
    renderList();
    const nq = document.getElementById("q");
    nq.focus(); nq.setSelectionRange(pos, pos);
  });
  bindTabs();
  app.querySelectorAll("[data-row]").forEach((tr) =>
    tr.addEventListener("click", (e) => {
      if (e.target.closest("[data-del]")) return;
      const r = rows.find((x) => x.id === tr.dataset.row);
      if (!r) return;
      pick = { type: r.mbti_type, blood: r.blood_type || "", zodiac: r.zodiac || "" };
      view = "combo";
      renderCombo();
      window.scrollTo(0, 0);
    }));
  document.getElementById("reload").addEventListener("click", openList);
  document.getElementById("out").addEventListener("click", signOut);
  const csv = document.getElementById("csv");
  if (csv) csv.addEventListener("click", () => exportCsv(list));
  app.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => remove(b.dataset.del)));
}

/* 뒤로 가기를 눌러도 인증 화면으로 튕기지 않게 막는다.
   기록을 보다가 실수로 눌러 다시 인증하는 일을 줄이기 위해서다.
   화면 안에서 오갈 곳이 있으면 그쪽으로 보내고, 없으면 그 자리에 머문다. */
function guardBack() {
  if (window.__backGuard) return;
  window.__backGuard = true;
  history.pushState({ adm: 1 }, "");
  window.addEventListener("popstate", () => {
    history.pushState({ adm: 1 }, "");        // 다시 한 칸 쌓아 밖으로 못 나가게 한다
    if (view === "combo") { view = "list"; renderList(); return; }
    const box = document.getElementById("app");
    if (box) {
      const note = document.getElementById("backnote");
      if (note) { note.classList.add("show"); setTimeout(() => note.classList.remove("show"), 2600); }
    }
  });
}

function tabs() {
  return `<div class="modes" style="margin-bottom:18px">
    <button class="mode" data-view="list" aria-pressed="${view === "list"}">
      <b>검사 기록</b><span>저장된 결과 목록</span></button>
    <button class="mode" data-view="combo" aria-pressed="${view === "combo"}">
      <b>조합 미리보기</b><span>혈액형·별자리·유형을 골라 결과 보기</span></button>
  </div>`;
}

function bindTabs() {
  app.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.view;
      view === "combo" ? renderCombo() : renderList();
    }));
}

// 성격유형만 있으면 유형 결과만, 셋 다 있으면 조합까지 보여 준다.
// 혈액형과 별자리는 둘 다 있어야 조합을 계산하므로 하나만 있으면 알려 준다.
function comboBody(pick) {
  const base = renderTypeReport(pick.type);
  if (pick.blood && pick.zodiac) return base + renderComboSections(pick);
  if (pick.blood || pick.zodiac) {
    return `<div class="err" style="margin-top:0">${pick.blood
      ? "별자리를 골라 주세요. 혈액형만으로는 조합 결과를 만들지 않습니다."
      : "혈액형을 골라 주세요. 별자리만으로는 조합 결과를 만들지 않습니다."}</div>` + base;
  }
  return base;
}

async function renderCombo() {
  if (!(await requireSession())) return signOut("다시 인증해 주세요.");
  app.innerHTML = `
    <h1>조합 미리보기</h1>
    ${tabs()}
    <div class="picker">
      <div>
        <label class="label" for="pt">성격유형</label>
        <select class="input" id="pt">${Object.keys(TYPE_INFO).map((t) =>
          `<option value="${t}" ${pick.type === t ? "selected" : ""}>${t} · ${TYPE_INFO[t][0]}</option>`).join("")}</select>
      </div>
      <div>
        <label class="label" for="pb">혈액형</label>
        <select class="input" id="pb">
          <option value="">고르지 않음</option>
          ${Object.keys(BLOOD).map((b) =>
            `<option value="${b}" ${pick.blood === b ? "selected" : ""}>${BLOOD[b].label}</option>`).join("")}
        </select>
      </div>
      <div>
        <label class="label" for="pz">별자리</label>
        <select class="input" id="pz">
          <option value="">고르지 않음</option>
          ${ZODIAC.map((z) =>
            `<option value="${z.key}" ${pick.zodiac === z.key ? "selected" : ""}>${z.label}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="sheet" id="cbox">${comboBody(pick)}</div>
    <div class="foot">
      <span style="font-size:12.5px;color:var(--soft)">기록에 저장되지 않는 미리보기입니다</span>
      <button class="btn-ghost" id="out">로그아웃</button>
    </div>
    <div class="backnote" id="backnote">화면을 벗어나려면 아래 <b>로그아웃</b>을 눌러 주세요.</div>`;

  bindTabs();
  const redraw = () => {
    pick = {
      type: document.getElementById("pt").value,
      blood: document.getElementById("pb").value,
      zodiac: document.getElementById("pz").value
    };
    document.getElementById("cbox").innerHTML = comboBody(pick);
    bindLookup(app);
  };
  ["pt", "pb", "pz"].forEach((id) =>
    document.getElementById(id).addEventListener("change", redraw));
  bindLookup(app);
  document.getElementById("out").addEventListener("click", signOut);
}

async function remove(id) {
  if (!confirm("이 기록을 지웁니다. 되돌릴 수 없습니다.")) return;
  const { error } = await sb.from("mbti_results").delete().eq("id", id);
  if (error) return alert("삭제하지 못했습니다. " + error.message);
  rows = rows.filter((r) => r.id !== id);
  renderList();
}

function exportCsv(list) {
  const head = ["검사일시", "이름", "유형", "혈액형", "별자리", "문항수",
    "E", "I", "S", "N", "T", "F", "J", "P"];
  const lines = [head.join(",")];
  for (const r of list) {
    lines.push([
      new Date(r.created_at).toLocaleString("ko-KR"),
      r.name, r.mbti_type, r.blood_type || "", ZLABEL[r.zodiac] || "", r.question_count,
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

async function signOut(msg) {
  window.__backGuard = false;
  stopIdle();
  rows = [];
  view = "list";
  try { await sb.auth.signOut(); } catch { /* 이미 끊긴 경우 */ }
  email = "";
  renderRequest(msg || "로그아웃했습니다.", false);
}

/* ── 진입 ──────────────────────────────────────────────── */
(async () => {
  // 로그인 상태를 저장하지 않으므로 화면을 열 때마다 인증부터 시작한다.
  renderRequest("", false);
})();
