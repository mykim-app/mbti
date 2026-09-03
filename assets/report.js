/* 성격유형만으로 만들 수 있는 결과 조각들.
   검사 결과 화면과 관리자 조합 미리보기가 함께 쓴다. */
import { TYPE_INFO, TYPE_DETAIL, TYPE_MATCH, TYPE_JOB } from "./questions.js";
import { matchTable } from "./scoring.js";

const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const mtable = (rows) => `<table class="tbl mt">
  <thead><tr><th>유형</th><th>연애</th><th>일</th><th>친구</th><th>종합</th></tr></thead>
  <tbody>${rows.map((r) => `<tr>
    <td class="mtype">${r.type}<span class="mlab">${(TYPE_INFO[r.type] || [""])[0]}</span></td>
    <td class="num">${r.love}</td><td class="num">${r.work}</td>
    <td class="num">${r.friend}</td><td class="num mtot">${r.total}</td>
  </tr>`).join("")}</tbody></table>`;

const pairRows = (arr, cls) => (arr || []).map(([t, why, kind, pct], i) =>
  `<div class="pair ${cls}">
    <b><span class="rank">${i + 1}순위</span> ${t}</b>
    <span class="pct">${pct}%</span>
    <span class="pwhy">${esc(why)}</span>
    <em>${esc(kind)} · ${(TYPE_INFO[t] || [""])[0]}</em>
  </div>`).join("");

// 유형 이름과 한 줄 설명 (관리자 미리보기에서 머리말로 쓴다)
export function renderTypeHead(type) {
  const info = TYPE_INFO[type] || ["", ""];
  return `<div class="pb">
    <header class="rhead"><div>
      <p class="rname">성격유형 결과</p>
      <div class="type">${type}</div>
      <div class="type-sub">${info[0]}</div>
    </div></header>
    <p class="rdesc">${info[1]}</p>
  </div>`;
}

export function renderStrengths(type) {
  const d = TYPE_DETAIL[type] || {};
  return `<div class="cols blk pb">
    <section>
      <h2 class="sec">강점</h2>
      <ul class="rlist">${(d.strong || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2 class="sec">눈여겨볼 점</h2>
      <ul class="rlist">${(d.care || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    </section>
  </div>`;
}

export function renderMatch(type) {
  const m = TYPE_MATCH[type] || { fit: [], hard: [] };
  const table = matchTable(type, Object.keys(TYPE_INFO));
  return `<section class="blk pb">
      <h2 class="sec">다른 유형과의 궁합</h2>
      <div class="cols">
        <div><p class="sub">결이 잘 맞는 유형</p><div class="pairs">${pairRows(m.fit, "fitp")}</div></div>
        <div><p class="sub">부딪히기 쉬운 유형</p><div class="pairs">${pairRows(m.hard, "hardp")}</div></div>
      </div>
    </section>

    <section class="blk pb">
      <h2 class="sec">연애 · 일 · 친구로 나눠 본 궁합</h2>
      <p class="jenv">위의 두 유형은 성향의 결을, 아래 표는 상황별 맞물림을 봅니다.
        연애는 보는 방식이 같고 판단 기준이 다를 때, 일은 판단 기준과 일하는 방식이
        같을 때 높게 잡히므로 두 순위가 다를 수 있습니다.</p>
      ${mtable(table.slice(0, 8))}
    </section>
    <div class="pb mtail">${mtable(table.slice(8))}</div>`;
}

export function renderJobs(type) {
  const job = TYPE_JOB[type] || { jobs: [] };
  return `<section class="blk pb">
    <h2 class="sec">어울리는 일</h2>
    <p class="jenv">${esc(job.env || "")}</p>
    <ol class="jrank">${(job.jobs || []).slice(0, 3).map((j) =>
      `<li><span class="jno"></span>${esc(j)}</li>`).join("")}</ol>
    ${(job.jobs || []).length > 3 ? `<p class="sub">그 밖에 살펴볼 만한 일</p>
    <div class="chips">${job.jobs.slice(3).map((j) =>
      `<span class="jchip">${esc(j)}</span>`).join("")}</div>` : ""}
  </section>`;
}

// 관리자 미리보기용 — 머리말부터 어울리는 일까지 한 번에
export function renderTypeReport(type) {
  return renderTypeHead(type) + renderStrengths(type) + renderMatch(type) + renderJobs(type);
}
