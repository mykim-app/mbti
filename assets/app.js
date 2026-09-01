import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BANK, DIMS, TYPE_INFO } from "./questions.js";
import { buildItems, score } from "./scoring.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const app = document.getElementById("app");
const OPT_LABELS = ["가에 확실히 가깝다", "가에 조금 가깝다", "나에 조금 가깝다", "나에 확실히 가깝다"];
const PER_PAGE = 5;

const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = { name: "", perDim: 20, items: [], answers: {}, page: 0, result: null, saved: null };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── 시작 화면 ─────────────────────────────────────────── */
function renderIntro() {
  app.innerHTML = `
    <h1>성격유형 검사</h1>
    <p class="lead">두 문장 중 자신에게 가까운 쪽을 고르고, 얼마나 가까운지까지 함께 표시합니다.
      직장에서의 모습보다 <b>평소 편할 때의 나</b>를 기준으로, 오래 고민하지 말고 첫 반응대로 골라 주세요.</p>

    ${configured ? "" : `<div class="err">Supabase 접속 정보가 설정되지 않았습니다.
      <code>assets/config.js</code> 를 채운 뒤 다시 열어 주세요. 지금은 검사는 되지만 결과가 저장되지 않습니다.</div>`}

    <div class="field">
      <label class="label" for="nm">이름</label>
      <input id="nm" class="input" maxlength="20" placeholder="예: 홍길동" autocomplete="name">
    </div>

    <label class="label">문항 수</label>
    <div class="modes">
      <button class="mode" data-per="20" aria-pressed="${state.perDim === 20}">
        <b>정밀 80문항</b><span>지표당 20문항 · 약 12분</span></button>
      <button class="mode" data-per="10" aria-pressed="${state.perDim === 10}">
        <b>간편 40문항</b><span>지표당 10문항 · 약 6분</span></button>
    </div>

    <button class="btn" id="start" disabled>검사 시작</button>

    <div class="note">입력한 이름과 검사 결과가 저장되며, 관리자만 목록을 확인합니다.
      검사 결과는 자기 이해를 돕는 참고 자료이며 채용·인사·평가의 근거로 쓰지 않습니다.</div>

    <div class="foot">
      <span style="font-size:12.5px;color:var(--soft)">4지표 강도 채점</span>
      <a class="link" href="./admin.html">관리자</a>
    </div>`;

  const nm = document.getElementById("nm");
  const startBtn = document.getElementById("start");
  nm.value = state.name;
  const sync = () => { state.name = nm.value; startBtn.disabled = !nm.value.trim(); };
  nm.addEventListener("input", sync);
  nm.addEventListener("keydown", (e) => { if (e.key === "Enter" && nm.value.trim()) start(); });
  sync();

  app.querySelectorAll(".mode").forEach((b) =>
    b.addEventListener("click", () => { state.perDim = Number(b.dataset.per); renderIntro(); }));
  startBtn.addEventListener("click", start);
}

function start() {
  state.items = buildItems(state.perDim);
  state.answers = {};
  state.page = 0;
  state.result = null;
  state.saved = null;
  renderQuiz();
}

/* ── 문항 화면 ─────────────────────────────────────────── */
function renderQuiz() {
  const { items, page } = state;
  const pages = Math.ceil(items.length / PER_PAGE);
  const slice = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const done = items.filter((i) => state.answers[i.id] !== undefined).length;
  const pct = Math.round((done / items.length) * 100);

  app.innerHTML = `
    <div class="prog">
      <div class="prog-top">
        <span class="prog-num">${done} / ${items.length}</span>
        <span>${page + 1}쪽 / ${pages}쪽</span>
      </div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    </div>
    ${slice.map((it) => {
      const no = items.indexOf(it) + 1;
      const top = it.flip ? it.b : it.a;
      const bottom = it.flip ? it.a : it.b;
      return `<div class="q">
        <div class="q-no">${String(no).padStart(2, "0")}</div>
        <div class="stmt"><span class="tag">가</span><span>${esc(top)}</span></div>
        <div class="stmt"><span class="tag">나</span><span>${esc(bottom)}</span></div>
        <div class="opts">${OPT_LABELS.map((lb, ci) =>
          `<button class="opt" data-id="${it.id}" data-c="${ci}"
            aria-pressed="${state.answers[it.id] === ci}">${lb}</button>`).join("")}</div>
      </div>`;
    }).join("")}
    <div class="nav">
      <button class="btn-ghost" id="prev" ${page === 0 ? "disabled" : ""}>이전</button>
      <button class="btn" id="next">${page + 1 < pages ? "다음" : "결과 보기"}</button>
    </div>
    <p id="hint" class="lead" style="text-align:right;font-size:12.5px;margin-top:10px"></p>`;

  const nextBtn = document.getElementById("next");
  const hint = document.getElementById("hint");
  const syncNext = () => {
    const ok = slice.every((i) => state.answers[i.id] !== undefined);
    nextBtn.disabled = !ok;
    hint.textContent = ok ? "" : "이 쪽의 문항을 모두 선택하면 넘어갑니다.";
  };

  app.querySelectorAll(".opt").forEach((b) =>
    b.addEventListener("click", () => {
      state.answers[b.dataset.id] = Number(b.dataset.c);
      app.querySelectorAll(`.opt[data-id="${b.dataset.id}"]`)
        .forEach((o) => o.setAttribute("aria-pressed", o === b));
      const d = state.items.filter((i) => state.answers[i.id] !== undefined).length;
      document.querySelector(".prog-num").textContent = `${d} / ${state.items.length}`;
      document.querySelector(".fill").style.width =
        Math.round((d / state.items.length) * 100) + "%";
      syncNext();
    }));

  document.getElementById("prev").addEventListener("click", () => {
    state.page = Math.max(0, state.page - 1); renderQuiz(); window.scrollTo(0, 0);
  });
  nextBtn.addEventListener("click", () => {
    if (page + 1 < pages) { state.page++; renderQuiz(); window.scrollTo(0, 0); }
    else finish();
  });
  syncNext();
  window.scrollTo(0, 0);
}

/* ── 결과 ──────────────────────────────────────────────── */
async function finish() {
  state.result = score(state.items, state.answers);
  renderResult();
  window.scrollTo(0, 0);
  if (!sb) { state.saved = { ok: false, msg: "접속 정보 미설정" }; return renderResult(); }
  const d = state.result.dims;
  const { error } = await sb.from("mbti_results").insert({
    name: state.name.trim(),
    mbti_type: state.result.type,
    question_count: state.items.length,
    ei_e: d.EI.a, ei_i: d.EI.b,
    sn_s: d.SN.a, sn_n: d.SN.b,
    tf_t: d.TF.a, tf_f: d.TF.b,
    jp_j: d.JP.a, jp_p: d.JP.b
  });
  state.saved = error ? { ok: false, msg: error.message } : { ok: true };
  renderResult();
}

function renderResult() {
  const { type, dims } = state.result;
  const info = TYPE_INFO[type] || ["", ""];
  const close = DIMS.filter((d) => dims[d].pctA >= 42 && dims[d].pctA <= 58);

  app.innerHTML = `
    <p style="font-size:13.5px;color:var(--soft);margin:0">${esc(state.name)} 님의 결과</p>
    <div class="type">${type}</div>
    <div class="type-sub">${info[0]}</div>
    <p class="lead">${info[1]}</p>

    ${DIMS.map((d) => {
      const x = dims[d];
      const leftWins = x.letter === BANK[d].poles[0];
      const half = Math.abs(x.pctA - 50);
      return `<div class="axis">
        <div class="axis-top">
          <span style="font-weight:${leftWins ? 700 : 400};color:${leftWins ? "var(--teal)" : "var(--soft)"}">
            ${BANK[d].poles[0]} ${BANK[d].name[0]}</span>
          <span style="font-weight:${leftWins ? 400 : 700};color:${leftWins ? "var(--soft)" : "var(--plum)"}">
            ${BANK[d].name[1]} ${BANK[d].poles[1]}</span>
        </div>
        <div class="bar">
          <div class="bar-fill" style="background:${leftWins ? "var(--teal)" : "var(--plum)"};
            left:${leftWins ? 50 - half : 50}%;width:${half}%"></div>
          <div class="bar-mid"></div>
        </div>
        <div class="axis-pct"><span>${x.pctA}%</span>
          <span>${x.tie ? "동률 — 재검사 시 바뀔 수 있음" : ""}</span>
          <span>${x.pctB}%</span></div>
      </div>`;
    }).join("")}

    ${close.length ? `<div class="note">${close.map((d) =>
      `${BANK[d].poles[0]}/${BANK[d].poles[1]}`).join(", ")} 지표가 팽팽합니다.
      다시 검사하면 이 글자는 바뀔 수 있습니다.</div>` : ""}

    ${state.saved === null ? `<div class="ok">결과를 저장하는 중입니다.</div>` : ""}
    ${state.saved && state.saved.ok ? `<div class="ok">결과를 저장했습니다. (${state.items.length}문항)</div>` : ""}
    ${state.saved && !state.saved.ok ? `<div class="err">결과를 저장하지 못했습니다. 관리자에게 알려 주세요.
      <br><span style="color:var(--soft)">${esc(state.saved.msg)}</span></div>` : ""}

    <div class="note">이 검사는 ${state.items.length}문항 기반의 참고 지표입니다.
      같은 사람이 몇 주 뒤 다시 하면 한 지표가 바뀌는 경우가 흔하므로,
      확정된 성격이 아니라 자기 이해를 돕는 틀로 보시기 바랍니다.</div>

    <button class="btn-ghost" id="again">처음으로</button>`;

  document.getElementById("again").addEventListener("click", () => { state.name = ""; renderIntro(); });
}

renderIntro();
