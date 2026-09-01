import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BANK, DIMS, TYPE_INFO, TYPE_DETAIL } from "./questions.js";
import { buildItems, score } from "./scoring.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const app = document.getElementById("app");
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
    <p class="lead">각 질문마다 네 개의 답 중 자신에게 가장 가까운 하나를 고릅니다.
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
      <a class="dotlink" href="./admin.html" aria-label="관리">&middot;</a>
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
    <p class="guide">네 개 중 자신에게 가장 가까운 하나를 고르세요.</p>
    ${slice.map((it) => {
      const no = items.indexOf(it) + 1;
      const cur = state.answers[it.id];
      const order = it.flip ? [3, 2, 1, 0] : [0, 1, 2, 3];
      return `<div class="q">
        <div class="q-no">${String(no).padStart(2, "0")}</div>
        <p class="qt">${esc(it.q)}</p>
        <div class="scale">${order.map((c) =>
          `<button class="sc" data-id="${it.id}" data-c="${c}"
            aria-pressed="${cur === c}">${esc(it.o[c])}</button>`).join("")}</div>
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

  app.querySelectorAll(".sc").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      state.answers[id] = Number(b.dataset.c);
      app.querySelectorAll(`.sc[data-id="${id}"]`)
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

function analysisLine(dims) {
  const sorted = DIMS.slice().sort((x, y) =>
    Math.max(dims[y].pctA, dims[y].pctB) - Math.max(dims[x].pctA, dims[x].pctB));
  const top = sorted[0], low = sorted[sorted.length - 1];
  const nm = (d) => dims[d].letter === BANK[d].poles[0] ? BANK[d].name[0] : BANK[d].name[1];
  const lowWin = Math.max(dims[low].pctA, dims[low].pctB);
  const tail = lowWin < 62
    ? `반대로 ${BANK[low].poles[0]}/${BANK[low].poles[1]}는 ${lowWin}%로 팽팽해, 상황에 따라 양쪽을 오갈 수 있습니다.`
    : `네 지표 모두 방향이 비교적 분명한 편입니다.`;
  return `가장 뚜렷한 지표는 ${dims[top].letter}(${nm(top)})로, 이 성향이 평소 판단과 행동에 가장 크게 드러납니다. ${tail}`;
}

function renderResult() {
  const { type, dims } = state.result;
  const info = TYPE_INFO[type] || ["", ""];
  const detail = TYPE_DETAIL[type] || {};
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

    <h2 class="sec">지표 해석</h2>
    <ul class="rlist">${DIMS.map((d) => {
      const x = dims[d];
      const win = Math.max(x.pctA, x.pctB);
      const lv = win >= 75 ? "뚜렷합니다" : win >= 62 ? "비교적 분명합니다" : "근소합니다";
      const nm = x.letter === BANK[d].poles[0] ? BANK[d].name[0] : BANK[d].name[1];
      return `<li><b>${x.letter} ${nm} ${win}%</b> — 이 지표의 기울기는 ${lv}.</li>`;
    }).join("")}</ul>
    <p class="lead">${analysisLine(dims)}</p>

    <h2 class="sec">강점</h2>
    <ul class="rlist">${(detail.strong || []).map((t) => `<li>${t}</li>`).join("")}</ul>

    <h2 class="sec">눈여겨볼 점</h2>
    <ul class="rlist">${(detail.care || []).map((t) => `<li>${t}</li>`).join("")}</ul>

    <h2 class="sec">다른 유형과의 궁합</h2>
    <p class="sub">결이 잘 맞는 유형</p>
    <div class="pairs">${(detail.fit || []).map(([t, why]) =>
      `<div class="pair fitp"><b>${t}</b><span>${why}</span>
        <em>${(TYPE_INFO[t] || [""])[0]}</em></div>`).join("")}</div>
    <p class="sub">부딪히기 쉬운 유형</p>
    <div class="pairs">${(detail.hard || []).map(([t, why]) =>
      `<div class="pair hardp"><b>${t}</b><span>${why}</span>
        <em>${(TYPE_INFO[t] || [""])[0]}</em></div>`).join("")}</div>
    <div class="note">궁합은 통계로 검증된 것이 아니라 지표 조합에서 나오는 경향을 정리한
      참고 자료입니다. 잘 맞는다고 해서 편한 사이가 되는 것도, 부딪히기 쉽다고 해서
      맞지 않는 사이가 되는 것도 아닙니다.</div>

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
