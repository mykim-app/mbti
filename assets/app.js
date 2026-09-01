import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BANK, DIMS, TYPE_INFO, TYPE_DETAIL, TYPE_MATCH, TYPE_JOB } from "./questions.js";
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
        <b>정밀 80문항</b><span>160문항 중 무작위 · 약 12분</span></button>
      <button class="mode" data-per="10" aria-pressed="${state.perDim === 10}">
        <b>간편 40문항</b><span>160문항 중 무작위 · 약 6분</span></button>
    </div>

    <button class="btn" id="start" disabled>검사 시작</button>

    <div class="note">정답이 없는 검사입니다. 오래 고민할수록 실제 성향과 멀어지니
      각 문항에서 처음 눈에 들어온 답을 고르세요. 끝까지 답하면 유형과 지표별 기울기,
      강점과 눈여겨볼 점, 다른 유형과의 궁합, 어울리는 일까지 함께 보여 드립니다.</div>

    <div class="foot">
      <span style="font-size:12.5px;color:var(--soft)">문항 풀 160개 · 무작위 출제</span>
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

/* ── PDF 저장 ──────────────────────────────────────────────
   일반 브라우저에서는 인쇄 창을 띄워 'PDF로 저장'을 고르게 한다.
   카카오톡·네이버 같은 앱 안의 화면(웹뷰)에서는 인쇄 창이 뜨지 않으므로
   화면을 직접 A4 크기 PDF로 만들어 내려받는다. */
const IN_APP = /KAKAOTALK|NAVER|Instagram|FB[AS]V|FBAN|Line\/|DaumApps|everytime|; ?wv\)/i
  .test(navigator.userAgent);

function loadScript(src) {
  return new Promise((ok, no) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = ok;
    el.onerror = () => no(new Error("스크립트를 불러오지 못했습니다"));
    document.head.appendChild(el);
  });
}

async function savePdf(direct) {
  const sheet = document.querySelector(".sheet");
  if (!sheet) return;
  const hint = document.getElementById("pdfhint");

  if (!direct) {
    sheet.classList.add("compact");
    window.print();
    setTimeout(() => sheet.classList.remove("compact"), 800);
    return;
  }

  if (hint) hint.textContent = "PDF를 만드는 중입니다. 잠시 기다려 주세요.";
  sheet.classList.add("compact");
  try {
    if (!window.html2pdf) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
    }
    await window.html2pdf().set({
      margin: [13, 14, 13, 14],
      filename: `성격유형결과_${state.name.trim() || "결과"}_${state.result.type}.pdf`,
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(sheet).save();
    if (hint) hint.textContent = "PDF를 내려받았습니다. 파일 앱이나 다운로드 폴더에서 확인하세요.";
  } catch (e) {
    if (hint) {
      hint.innerHTML = "이 화면에서는 파일 저장이 막혀 있습니다. " +
        "오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 고른 뒤 다시 시도해 주세요.";
    }
  } finally {
    sheet.classList.remove("compact");
  }
}

function renderResult() {
  const { type, dims } = state.result;
  const info = TYPE_INFO[type] || ["", ""];
  const detail = TYPE_DETAIL[type] || {};
  const job = TYPE_JOB[type] || { jobs: [] };
  const match = TYPE_MATCH[type] || { fit: [], hard: [] };
  const close = DIMS.filter((d) => dims[d].pctA >= 42 && dims[d].pctA <= 58);
  const today = new Date().toLocaleDateString("ko-KR");

  const axes = DIMS.map((d) => {
    const x = dims[d];
    const leftWins = x.letter === BANK[d].poles[0];
    const half = Math.abs(x.pctA - 50);
    return `<div class="axis">
      <div class="axis-top">
        <span style="font-weight:${leftWins ? 700 : 400};color:${leftWins ? "var(--teal)" : "var(--soft)"}">
          ${BANK[d].poles[0]} ${BANK[d].name[0]} ${x.pctA}%</span>
        <span style="font-weight:${leftWins ? 400 : 700};color:${leftWins ? "var(--soft)" : "var(--plum)"}">
          ${x.pctB}% ${BANK[d].name[1]} ${BANK[d].poles[1]}</span>
      </div>
      <div class="bar">
        <div class="bar-fill" style="background:${leftWins ? "var(--teal)" : "var(--plum)"};
          left:${leftWins ? 50 - half : 50}%;width:${half}%"></div>
        <div class="bar-mid"></div>
      </div>
    </div>`;
  }).join("");

  const pair = (arr, cls) => (arr || []).map(([t, why, kind]) =>
    `<div class="pair ${cls}"><b>${t}</b><span>${esc(why)}</span>
      <em>${esc(kind)} · ${(TYPE_INFO[t] || [""])[0]}</em></div>`).join("");

  app.innerHTML = `
  <div class="sheet">
    <header class="rhead">
      <div>
        <p class="rname">${esc(state.name)} 님의 성격유형 결과</p>
        <div class="type">${type}</div>
        <div class="type-sub">${info[0]}</div>
      </div>
      <div class="rmeta">${today}<br>${state.items.length}문항</div>
    </header>
    <p class="rdesc">${info[1]}</p>

    <section class="blk">
      <h2 class="sec">지표별 기울기</h2>
      ${axes}
      <p class="ranal">${analysisLine(dims)}</p>
    </section>

    <div class="cols blk">
      <section>
        <h2 class="sec">강점</h2>
        <ul class="rlist">${(detail.strong || []).map((t) => `<li>${t}</li>`).join("")}</ul>
      </section>
      <section>
        <h2 class="sec">눈여겨볼 점</h2>
        <ul class="rlist">${(detail.care || []).map((t) => `<li>${t}</li>`).join("")}</ul>
      </section>
    </div>

    <section class="blk">
      <h2 class="sec">다른 유형과의 궁합</h2>
      <div class="cols">
        <div><p class="sub">결이 잘 맞는 유형</p><div class="pairs">${pair(match.fit, "fitp")}</div></div>
        <div><p class="sub">부딪히기 쉬운 유형</p><div class="pairs">${pair(match.hard, "hardp")}</div></div>
      </div>
    </section>

    <section class="blk">
      <h2 class="sec">어울리는 일</h2>
      <p class="jenv">${esc(job.env || "")}</p>
      <div class="chips">${(job.jobs || []).map((j) => `<span class="jchip">${esc(j)}</span>`).join("")}</div>
    </section>

    <p class="rfoot">${state.items.length}문항 기준의 참고 결과입니다.
      같은 사람이 몇 주 뒤 다시 하면 한 지표가 바뀌기도 합니다.
      궁합과 어울리는 일은 통계로 검증된 것이 아니므로 관계나 진로를 정하는 근거로 쓰지 않습니다.</p>
  </div>

  ${close.length ? `<div class="note noprint">${close.map((d) =>
    `${BANK[d].poles[0]}/${BANK[d].poles[1]}`).join(", ")} 지표가 팽팽합니다.
    다시 검사하면 이 글자는 바뀔 수 있습니다.</div>` : ""}

  ${state.saved && !state.saved.ok ? `<div class="err noprint">결과를 저장하지 못했습니다. 관리자에게 알려 주세요.
    <br><span style="color:var(--soft)">${esc(state.saved.msg)}</span></div>` : ""}

  <div class="row noprint" style="margin-top:26px">
    <button class="btn" id="pdf">PDF로 저장</button>
    <button class="btn-ghost" id="again">처음으로</button>
  </div>
  <p class="lead noprint" id="pdfhint" style="font-size:12.5px;margin-top:10px">
    ${IN_APP
      ? "PDF 파일이 바로 내려받아집니다. 저장이 되지 않으면 이 화면을 기본 브라우저에서 열어 주세요."
      : "인쇄 창이 열리면 대상(프린터)을 'PDF로 저장'으로 고르세요. A4 한 장으로 나옵니다."}</p>
  <p class="lead noprint" style="font-size:12.5px;margin-top:4px">
    <button class="link" id="pdfalt">저장이 안 되면 여기를 눌러 파일로 내려받기</button></p>`;

  document.getElementById("pdf").addEventListener("click", () => savePdf(IN_APP));
  document.getElementById("pdfalt").addEventListener("click", () => savePdf(true));
  document.getElementById("again").addEventListener("click", () => { state.name = ""; renderIntro(); });
}

renderIntro();
