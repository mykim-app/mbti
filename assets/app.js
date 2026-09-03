import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BANK, DIMS, TYPE_INFO, TYPE_DETAIL, TYPE_MATCH, TYPE_JOB,
  BLOOD, ZODIAC, zodiacOf } from "./questions.js";
import { buildItems, score, buildScaleItems, scoreScale, matchTable,
  buildDeepItems, scoreDeep } from "./scoring.js";
import { fortune } from "./fortune.js";
import { renderComboSections } from "./combo.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const app = document.getElementById("app");
const PER_PAGE = 5;
const VERSION = "3.0";
const LIK = [
  { v: 3, size: "d1", side: "ya" }, { v: 2, size: "d2", side: "ya" },
  { v: 1, size: "d3", side: "ya" }, { v: 0, size: "d4", side: "mid" },
  { v: -1, size: "d3", side: "no" }, { v: -2, size: "d2", side: "no" },
  { v: -3, size: "d1", side: "no" }
];
const LIK_LABEL = { 3: "매우 그렇다", 2: "그렇다", 1: "조금 그렇다", 0: "잘 모르겠다",
  "-1": "조금 그렇지 않다", "-2": "그렇지 않다", "-3": "전혀 그렇지 않다" };

const configured = !SUPABASE_URL.includes("여기에") && !SUPABASE_ANON_KEY.includes("여기에");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = { name: "", blood: "", zodiac: "", birth: "", format: "choice", perDim: 20, noAuto: false, moving: false, items: [], answers: {}, page: 0, result: null, saved: null };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── 시작 화면 ─────────────────────────────────────────── */
function renderIntro() {
  app.innerHTML = `
    <h1>성격유형 검사 <span class="ver">v${VERSION}</span></h1>
    <p class="lead">${state.format === "scale"
      ? "문장을 읽고 얼마나 그런지 일곱 단계 중 하나를 고릅니다."
      : state.format === "deep"
      ? "두 가지 방식이 섞여 나옵니다. 네 개 중 고르는 문항과 일곱 단계로 표시하는 문항이 번갈아 나옵니다."
      : "각 질문마다 네 개의 답 중 자신에게 가장 가까운 하나를 고릅니다."}
      직장에서의 모습보다 <b>평소 편할 때의 나</b>를 기준으로, 오래 고민하지 말고 첫 반응대로 골라 주세요.</p>

    ${configured ? "" : `<div class="err">Supabase 접속 정보가 설정되지 않았습니다.
      <code>assets/config.js</code> 를 채운 뒤 다시 열어 주세요. 지금은 검사는 되지만 결과가 저장되지 않습니다.</div>`}

    <div class="field">
      <label class="label" for="nm">이름</label>
      <input id="nm" class="input" maxlength="20" placeholder="예: 홍길동" autocomplete="name">
    </div>

    <label class="label">검사 방식</label>
    <div class="modes modes3">
      <button class="mode" data-fmt="choice" aria-pressed="${state.format === "choice"}">
        <b>일반형 80문항</b><span>상황마다 네 답 중 하나 · 약 12분</span></button>
      <button class="mode" data-fmt="scale" aria-pressed="${state.format === "scale"}">
        <b>척도형 80문항</b><span>문장마다 그렇다 정도 표시 · 약 10분</span></button>
      <button class="mode" data-fmt="deep" aria-pressed="${state.format === "deep"}">
        <b>심화형 120문항</b><span>두 방식 절반씩 · 혈액형·별자리 함께 · 약 18분</span></button>
    </div>
    ${state.format === "deep" ? `
    <label class="label" for="bl">혈액형 <span class="opt-mark">선택</span></label>
    <div class="chipset" id="bl">
      ${["A", "B", "O", "AB"].map((b) =>
        `<button class="cbtn" data-blood="${b}" aria-pressed="${state.blood === b}">${b}형</button>`).join("")}
      <button class="cbtn" data-blood="" aria-pressed="${!state.blood}">모름</button>
    </div>

    <label class="label">별자리 <span class="opt-mark">선택</span></label>
    <div class="zrow">
      <select class="input" id="zsel">
        <option value="">고르지 않음</option>
        ${ZODIAC.map((z) =>
          `<option value="${z.key}" ${state.zodiac === z.key ? "selected" : ""}>${z.label}</option>`).join("")}
      </select>
      <span class="zor">또는 생일로</span>
      <input class="input" id="zbirth" type="text" inputmode="numeric" maxlength="5"
        placeholder="09-03" value="${esc(state.birth)}">
    </div>
    <p class="zhint" id="zhint">${state.zodiac
      ? "선택한 별자리: " + (ZODIAC.find((z) => z.key === state.zodiac) || {}).label
      : "별자리를 모르면 생일을 월-일 형식으로 넣으면 자동으로 정해집니다."}</p>
    ` : ""}


    <button class="btn" id="start" disabled>검사 시작</button>

    <div class="note">정답이 없는 검사입니다. 오래 고민할수록 실제 성향과 멀어지니
      각 문항에서 처음 눈에 들어온 답을 고르세요. 끝까지 답하면 유형과 지표별 기울기,
      강점과 눈여겨볼 점, 다른 유형과의 궁합, 어울리는 일까지 함께 보여 드립니다.</div>

    <div class="foot">
      <span style="font-size:12.5px;color:var(--soft)">문항 풀 400개 · 매번 무작위 출제</span>
      <a class="dotlink" href="./admin.html" aria-label="관리">&middot;</a>
    </div>
    <p class="todaycnt" id="todaycnt"></p>`;

  showToday();
  const nm = document.getElementById("nm");
  const startBtn = document.getElementById("start");
  nm.value = state.name;
  const sync = () => { state.name = nm.value; startBtn.disabled = !nm.value.trim(); };
  nm.addEventListener("input", sync);
  nm.addEventListener("keydown", (e) => { if (e.key === "Enter" && nm.value.trim()) start(); });
  sync();

  app.querySelectorAll(".cbtn").forEach((b) =>
    b.addEventListener("click", () => {
      state.blood = b.dataset.blood;
      app.querySelectorAll(".cbtn").forEach((o) =>
        o.setAttribute("aria-pressed", o === b));
    }));

  const zsel = document.getElementById("zsel");
  const zbirth = document.getElementById("zbirth");
  const zhint = document.getElementById("zhint");
  if (zsel && zbirth && zhint) {
  zsel.addEventListener("change", () => {
    state.zodiac = zsel.value;
    if (state.zodiac) { state.birth = ""; zbirth.value = ""; }
    zhint.textContent = state.zodiac
      ? "선택한 별자리: " + (ZODIAC.find((z) => z.key === state.zodiac) || {}).label
      : "별자리를 모르면 생일을 월-일 형식으로 넣으면 자동으로 정해집니다.";
  });
  zbirth.addEventListener("input", () => {
    state.birth = zbirth.value;
    const n = zbirth.value.replace(/\D/g, "");
    if (n.length < 3) { zhint.textContent = "월과 일을 넣으면 별자리가 정해집니다. 예: 09-03"; return; }
    const m = Number(n.slice(0, n.length - 2));
    const d = Number(n.slice(-2));
    const z = m >= 1 && m <= 12 && d >= 1 && d <= 31 ? zodiacOf(m, d) : null;
    if (z) {
      state.zodiac = z.key;
      zsel.value = z.key;
      zhint.textContent = `${m}월 ${d}일 → ${z.label}`;
    } else {
      zhint.textContent = "그런 날짜는 없습니다. 월-일 형식으로 다시 넣어 주세요.";
    }
  });
  }

  app.querySelectorAll(".mode").forEach((b) =>
    b.addEventListener("click", () => {
      state.format = b.dataset.fmt;
      renderIntro();
    }));
  startBtn.addEventListener("click", start);
}

// 오늘 몇 명이 결과를 받았는지. 기록을 열지 않고 숫자만 받아온다.
async function showToday() {
  const el = document.getElementById("todaycnt");
  if (!el || !sb) return;
  try {
    const { data, error } = await sb.rpc("today_count");
    if (error || data === null || data === undefined) return;
    el.textContent = `오늘 ${data}명이 결과를 확인했습니다`;
  } catch { /* 숫자를 못 받아도 검사에는 지장이 없다 */ }
}

function start() {
  state.items = state.format === "deep" ? buildDeepItems(15)
    : state.format === "scale" ? buildScaleItems(state.perDim)
    : buildItems(state.perDim);
  state.answers = {};
  state.page = 0;
  state.noAuto = false;
  state.moving = false;
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
    ${state.format === "scale" ? ""
      : `<p class="guide">네 개 중 자신에게 가장 가까운 하나를 고르세요. 한 쪽을 다 채우면 다음 쪽으로 넘어갑니다.</p>`}
    ${slice.map((it) => {
      const no = items.indexOf(it) + 1;
      const cur = state.answers[it.id];
      if (it.scale) {
        return `<div class="q">
          <div class="q-no">${String(no).padStart(2, "0")}</div>
          <p class="qt st">${esc(it.s)}</p>
          <div class="lik">
            <span class="lik-end">그렇다</span>
            ${LIK.map(({ v, size, side }) =>
              `<button class="dot7 ${side} ${size}" data-id="${it.id}" data-c="${v}"
                aria-pressed="${cur === v}" title="${LIK_LABEL[v]}"
                aria-label="${LIK_LABEL[v]}"></button>`).join("")}
            <span class="lik-end">그렇지<br>않다</span>
          </div>
        </div>`;
      }
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

  app.querySelectorAll(".sc, .dot7").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      state.answers[id] = Number(b.dataset.c);
      app.querySelectorAll(`[data-id="${id}"]`)
        .forEach((o) => o.setAttribute("aria-pressed", o === b));
      const d = state.items.filter((i) => state.answers[i.id] !== undefined).length;
      document.querySelector(".prog-num").textContent = `${d} / ${state.items.length}`;
      document.querySelector(".fill").style.width =
        Math.round((d / state.items.length) * 100) + "%";
      syncNext();
      const filled = slice.every((i) => state.answers[i.id] !== undefined);
      // 이 쪽을 방금 다 채웠고 되돌아온 쪽이 아니라면 다음 쪽으로 넘어간다.
      // 마지막 쪽은 넘기지 않고 '결과 보기'를 직접 누르게 한다.
      if (filled && !state.noAuto && page + 1 < pages && !state.moving) {
        state.moving = true;
        setTimeout(() => {
          state.moving = false;
          state.noAuto = false;
          state.page = page + 1;
          renderQuiz();
          window.scrollTo(0, 0);
        }, 480);
        return;
      }
      setTimeout(() => scrollToNext(b.closest(".q"), slice), 170);
    }));

  document.getElementById("prev").addEventListener("click", () => {
    state.noAuto = true;            // 되돌아온 쪽은 직접 '다음'을 눌러야 넘어간다
    state.page = Math.max(0, state.page - 1);
    renderQuiz();
    window.scrollTo(0, 0);
  });
  nextBtn.addEventListener("click", () => {
    state.noAuto = false;           // 앞으로 나아가면 자동 넘김을 다시 켠다
    if (page + 1 < pages) { state.page++; renderQuiz(); window.scrollTo(0, 0); }
    else finish();
  });
  syncNext();
  window.scrollTo(0, 0);
}

// 방금 답한 문항 다음에 있는, 아직 답하지 않은 문항으로 부드럽게 내려간다.
// 남은 문항이 없으면 다음 쪽으로 넘어가는 단추까지 내려간다.
function scrollToNext(fromEl, slice) {
  if (!fromEl) return;
  const soft = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const opt = { behavior: soft ? "smooth" : "auto", block: "center" };
  const boxes = Array.from(app.querySelectorAll(".q"));
  const rest = boxes.slice(boxes.indexOf(fromEl) + 1);
  const next = rest.find((el) => {
    const btn = el.querySelector("[data-id]");
    return btn && state.answers[btn.dataset.id] === undefined;
  });
  if (next) return next.scrollIntoView(opt);
  const done = slice.every((i) => state.answers[i.id] !== undefined);
  const nav = document.querySelector(".nav");
  if (done && nav) nav.scrollIntoView({ behavior: opt.behavior, block: "end" });
}

/* ── 결과 ──────────────────────────────────────────────── */
async function finish() {
  state.result = state.format === "deep" ? scoreDeep(state.items, state.answers)
    : state.format === "scale" ? scoreScale(state.items, state.answers)
    : score(state.items, state.answers);
  renderResult();
  window.scrollTo(0, 0);
  if (!sb) { state.saved = { ok: false, msg: "접속 정보 미설정" }; return renderResult(); }
  const d = state.result.dims;
  const { error } = await sb.from("mbti_results").insert({
    name: state.name.trim(),
    blood_type: state.format === "deep" ? (state.blood || null) : null,
    zodiac: state.format === "deep" ? (state.zodiac || null) : null,
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
function loadScript(src) {
  return new Promise((ok, no) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = ok;
    el.onerror = () => no(new Error("스크립트를 불러오지 못했습니다"));
    document.head.appendChild(el);
  });
}

async function savePdf() {
  const sheet = document.querySelector(".sheet");
  if (!sheet) return;
  const hint = document.getElementById("pdfhint");
  const btn = document.getElementById("pdf");
  if (btn) { btn.disabled = true; btn.textContent = "만드는 중"; }
  if (hint) hint.textContent = "PDF를 만들고 있습니다. 10초쯤 걸립니다.";

  // 찍는 동안에는 폭과 배치를 고정한다.
  const prev = { width: sheet.style.width, maxWidth: sheet.style.maxWidth,
                 padding: sheet.style.padding, background: sheet.style.background };
  sheet.classList.add("compact");
  sheet.style.width = "720px";
  sheet.style.maxWidth = "720px";
  sheet.style.padding = "0";
  sheet.style.background = "#ffffff";
  window.scrollTo(0, 0);

  try {
    if (!window.html2canvas) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    }
    if (!window.jspdf) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
    await new Promise((r) => setTimeout(r, 120));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 13;
    const contentW = pageW - margin * 2;
    const bottom = pageH - margin;
    const gap = 3;

    // 덩어리 하나가 쪽 경계에 걸치면 통째로 다음 쪽으로 넘긴다. 그래서 잘리지 않는다.
    // pb 표시가 붙은 덩어리 단위로 쪽을 채운다. 작은 덩어리라 앞쪽이 촘촘히 찬다.
    const marked = sheet.querySelectorAll(".pb");
    const blocks = Array.from(marked.length ? marked : sheet.children)
      .filter((el) => el.offsetHeight > 0);
    let y = margin;
    let first = true;

    for (const el of blocks) {
      const canvas = await window.html2canvas(el, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true,
        scrollX: 0, scrollY: 0, windowWidth: 900,
        width: el.scrollWidth, height: el.scrollHeight
      });
      let w = contentW;
      let h = (canvas.height / canvas.width) * w;
      // 한 덩어리가 한 쪽보다 크면 그 덩어리만 줄여서 한 쪽에 담는다.
      if (h > bottom - margin) {
        const k = (bottom - margin) / h;
        h *= k; w *= k;
      }
      if (!first && y + h > bottom) { pdf.addPage(); y = margin; }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, y, w, h);
      y += h + gap;
      first = false;
    }

    pdf.save(`성격유형결과_${state.name.trim() || "결과"}_${state.result.type}.pdf`);
    if (hint) hint.textContent = "PDF를 내려받았습니다. 파일 앱이나 다운로드 폴더에서 확인하세요.";
  } catch (e) {
    if (hint) {
      hint.textContent = "이 화면에서는 파일 저장이 막혀 있습니다. " +
        "오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 고른 뒤 다시 시도해 주세요.";
    }
  } finally {
    sheet.classList.remove("compact");
    sheet.style.width = prev.width;
    sheet.style.maxWidth = prev.maxWidth;
    sheet.style.padding = prev.padding;
    sheet.style.background = prev.background;
    if (btn) { btn.disabled = false; btn.textContent = "PDF로 저장"; }
  }
}

function renderResult() {
  const { type, dims } = state.result;
  const info = TYPE_INFO[type] || ["", ""];
  const detail = TYPE_DETAIL[type] || {};
  const job = TYPE_JOB[type] || { jobs: [] };
  const match = TYPE_MATCH[type] || { fit: [], hard: [] };
  const table = matchTable(type, Object.keys(TYPE_INFO));
  const bl = state.format === "deep" ? (BLOOD[state.blood] || null) : null;
  const zo = state.format === "deep"
    ? (ZODIAC.find((z) => z.key === state.zodiac) || null) : null;
  const fo = fortune(type + (state.blood || "") + (state.zodiac || ""), detail);
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

  const mtable = (rows) => `<table class="tbl mt">
    <thead><tr><th>유형</th><th>연애</th><th>일</th><th>친구</th><th>종합</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td class="mtype">${r.type}<span class="mlab">${(TYPE_INFO[r.type] || [""])[0]}</span></td>
      <td class="num">${r.love}</td><td class="num">${r.work}</td>
      <td class="num">${r.friend}</td><td class="num mtot">${r.total}</td>
    </tr>`).join("")}</tbody></table>`;

  const pair = (arr, cls) => (arr || []).map(([t, why, kind, pct], i) =>
    `<div class="pair ${cls}">
      <b><span class="rank">${i + 1}순위</span> ${t}</b>
      <span class="pct">${pct}%</span>
      <span class="pwhy">${esc(why)}</span>
      <em>${esc(kind)} · ${(TYPE_INFO[t] || [""])[0]}</em>
    </div>`).join("");

  app.innerHTML = `
  <div class="sheet">
    <div class="pb">
    <header class="rhead">
      <div>
        <p class="rname">${esc(state.name)} 님의 성격유형 결과</p>
        <div class="type">${type}</div>
        <div class="type-sub">${info[0]}</div>
      </div>
      <div class="rmeta">${today}<br>${state.items.length}문항${
        (bl || zo) ? "<br>" + [bl && bl.label, zo && zo.label].filter(Boolean).join(" · ") : ""}</div>
    </header>
    <p class="rdesc">${info[1]}</p>
    </div>

    <section class="blk pb">
      <h2 class="sec">지표별 기울기</h2>
      ${axes}
      <p class="ranal">${analysisLine(dims)}</p>
    </section>

    <div class="cols blk pb">
      <section>
        <h2 class="sec">강점</h2>
        <ul class="rlist">${(detail.strong || []).map((t) => `<li>${t}</li>`).join("")}</ul>
      </section>
      <section>
        <h2 class="sec">눈여겨볼 점</h2>
        <ul class="rlist">${(detail.care || []).map((t) => `<li>${t}</li>`).join("")}</ul>
      </section>
    </div>

    <section class="blk pb">
      <h2 class="sec">다른 유형과의 궁합</h2>
      <div class="cols">
        <div><p class="sub">결이 잘 맞는 유형</p><div class="pairs">${pair(match.fit, "fitp")}</div></div>
        <div><p class="sub">부딪히기 쉬운 유형</p><div class="pairs">${pair(match.hard, "hardp")}</div></div>
      </div>
    </section>

    <section class="blk pb">
      <h2 class="sec">연애 · 일 · 친구로 나눠 본 궁합</h2>
      <p class="jenv">위의 두 유형은 성향의 결을 본 것이고, 아래 표는 상황별로 따로 계산한 것이라
        순위가 다를 수 있습니다.</p>
      ${mtable(table.slice(0, 8))}
    </section>
    <div class="pb mtail">${mtable(table.slice(8))}</div>

    ${(bl || zo) ? renderComboSections({ type, blood: state.blood, zodiac: state.zodiac }) : ""}

    <section class="blk pb">
      <h2 class="sec">어울리는 일</h2>
      <p class="jenv">${esc(job.env || "")}</p>
      <ol class="jrank">${(job.jobs || []).slice(0, 3).map((j) =>
        `<li><span class="jno"></span>${esc(j)}</li>`).join("")}</ol>
      ${(job.jobs || []).length > 3 ? `<p class="sub">그 밖에 살펴볼 만한 일</p>
      <div class="chips">${job.jobs.slice(3).map((j) =>
        `<span class="jchip">${esc(j)}</span>`).join("")}</div>` : ""}

    <p class="rfoot">v${VERSION} · ${state.items.length}문항 기준의 참고 결과입니다.
      같은 사람이 몇 주 뒤 다시 하면 한 지표가 바뀌기도 합니다.
      궁합의 백분율은 통계 조사값이 아니라 네 지표의 조합으로 매긴 참고 점수이며, 연애·일·친구 점수도 같은 방식으로 계산했습니다. 관계나 진로를 정하는 근거로 쓰지 않습니다.</p>
    </section>
  </div>

  <section class="fort noprint">
    <div class="fort-h">
      <h2 class="fort-t">오늘의 운세</h2>
      <span class="fort-d">${fo.day} · ${type}</span>
    </div>
    <p class="fort-line">${esc(fo.line)}</p>
    <div class="fort-tags">
      <span class="ftag"><b>키워드</b>${esc(fo.keyword)}</span>
      <span class="ftag"><b>좋은 때</b>${esc(fo.time)}</span>
      <span class="ftag"><b>색</b>${esc(fo.color)}</span>
      <span class="ftag"><b>잘 풀리는 일</b>${esc(fo.focus)}</span>
    </div>
    <ul class="fort-list">
      ${fo.lean ? `<li><b>오늘 기대 볼 것</b> ${esc(fo.lean)}</li>` : ""}
      ${fo.watch ? `<li><b>오늘 조심할 것</b> ${esc(fo.watch)}</li>` : ""}
    </ul>
    <p class="fort-foot">재미로 보는 것입니다. 날짜와 유형으로 문구를 고른 것일 뿐,
      어떤 예측도 아닙니다.</p>
  </section>

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
    A4 파일로 내려받습니다. 내용이 길면 두 쪽으로 나뉘며, 항목이 쪽 경계에서 잘리지 않습니다.</p>`;

  document.getElementById("pdf").addEventListener("click", () => savePdf());
  document.getElementById("again").addEventListener("click", () => { state.name = ""; renderIntro(); });
}

renderIntro();
