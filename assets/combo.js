/* 혈액형 · 별자리 · 성격유형을 합쳐 하나의 서술과 궁합 순위를 만든다.
   혈액형과 별자리로 성격을 나누는 것은 연구로 확인된 바 없는 통설이며,
   여기서는 재미로 견주어 보는 용도로만 쓴다. */
import { BANK, DIMS, TYPE_INFO, TYPE_MATCH, BLOOD, ZODIAC } from "./questions.js";
import { matchScores } from "./scoring.js";

const TYPES = Object.keys(TYPE_INFO);
const BLOODS = Object.keys(BLOOD);

// 지표별로 그 성향이 겉으로 드러나는 모습
const TRAIT = {
  EI: { E: "먼저 말을 거는 성격", I: "혼자 생각을 정리하는 성격" },
  SN: { S: "눈에 보이는 것부터 챙기는 성격", N: "앞일을 먼저 그려 보는 성격" },
  TF: { T: "따질 것은 따지는 성격", F: "상대 마음을 먼저 살피는 성격" },
  JP: { J: "미리 정해 두는 성격", P: "그때그때 맞춰 가는 성격" }
};

const BLOOD_SHORT = { A: "신중함", B: "자유로움", O: "밀고 가는 힘", AB: "거리를 두는 시선" };
const ZODIAC_SHORT = {
  aries: "앞장서는 기운", taurus: "버티는 뚝심", gemini: "넓은 호기심", cancer: "품는 마음",
  leo: "드러내는 자신감", virgo: "따지는 눈", libra: "맞추는 감각", scorpio: "파고드는 집요함",
  sagittarius: "뻗어 가는 시야", capricorn: "쌓아 가는 끈기", aquarius: "남다른 시각",
  pisces: "스며드는 감성"
};

/* 혈액형끼리의 궁합. 여러 곳에서 되풀이되는 통설을 모아 맞췄다.
   A-O 를 가장 높게, B-AB 를 그다음으로 보는 설명이 가장 흔하다.
   같은 혈액형끼리는 편하지만 부딪히기도 한다고 보아 중간에 둔다.
   어느 쪽에서 보아도 값이 같으며, 가장 낮은 조합도 60 에서 멈춘다. */
// 키는 두 글자를 정렬해 만든다. AB 는 B·O 보다 앞서므로 "AB|B", "AB|O" 가 된다.
const BLOOD_FIT = {
  "A|O": 92,    // 서로 부족한 곳을 채운다는 설명이 가장 널리 퍼져 있다
  "AB|B": 88,   // 다름이 오히려 끌린다고 본다
  "B|O": 80,    // 활기가 잘 맞는 조합으로 꼽힌다
  "A|A": 75, "B|B": 75, "A|AB": 74, "AB|AB": 72,
  "O|O": 70,    // 둘 다 앞에 서려 해 부딪힌다고 본다
  "AB|O": 62, "A|B": 60
};
function bloodFit(a, b) {
  const v = BLOOD_FIT[[a, b].sort().join("|")];
  if (v === undefined) console.warn("혈액형 궁합 값이 없습니다:", a, b);
  return v === undefined ? 70 : v;
}

// 별자리는 네 원소로 나눠 본다
const ELEM = {
  aries: "불", leo: "불", sagittarius: "불",
  taurus: "흙", virgo: "흙", capricorn: "흙",
  gemini: "공기", libra: "공기", aquarius: "공기",
  cancer: "물", scorpio: "물", pisces: "물"
};
/* 점성술에서 쓰는 각도 개념을 원소로 옮긴 값이다.
   같은 원소(120도)는 자연스러운 조화, 불-공기와 흙-물(180도를 포함)은 서로를 부추기는
   관계로 본다. 마주 보는 별자리는 늘 이 두 묶음에 들어가므로 낮게 잡지 않는다.
   나머지(90도)는 노력이 필요한 조합이지만 '최악'은 없다고 보아 60대에서 멈춘다. */
const ELEM_FIT = { "불|불": 88, "흙|흙": 88, "공기|공기": 88, "물|물": 88,
  "공기|불": 85, "물|흙": 85, "불|흙": 64, "물|불": 62, "공기|흙": 64, "공기|물": 62 };
function zodiacFit(a, b) {
  // 같은 별자리끼리는 깊이 이해하지만 같은 약점을 공유한다고 본다.
  if (a === b) return 75;
  return ELEM_FIT[[ELEM[a], ELEM[b]].sort().join("|")] || 65;
}

const zLabel = (k) => (ZODIAC.find((z) => z.key === k) || {}).label || "";
export const eun = (w) => {
  const c = String(w).trim().slice(-1).charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return "은";
  return (c - 0xac00) % 28 === 0 ? "는" : "은";
};

/* ── 세 가지를 합친 서술 ─────────────────────────────── */
export function comboProfile(type, bloodKey, zodiacKey) {
  const bl = BLOOD[bloodKey] || null;
  const zo = ZODIAC.find((z) => z.key === zodiacKey) || null;
  const mine = { EI: type[0], SN: type[1], TF: type[2], JP: type[3] };

  const parts = [];
  if (bl) parts.push(`${bl.label}의 ${BLOOD_SHORT[bloodKey]}`);
  if (zo) parts.push(`${zo.label}의 ${ZODIAC_SHORT[zodiacKey]}`);
  const head = parts.length
    ? `${TYPE_INFO[type][0]}인 ${type}에 ${parts.join("과 ")}이 더해진 조합입니다.`
    : `${TYPE_INFO[type][0]}인 ${type}입니다.`;

  // 같은 성향을 여럿이 함께 가리키면 한 줄로 묶어, 같은 말이 되풀이되지 않게 한다.
  const agree = new Map();   // 지표 → 함께 가리킨 것들의 이름
  const clash = [];
  const walk = (src) => {
    if (!src) return;
    for (const d of DIMS) {
      const want = (src.lean || {})[d];
      if (!want) continue;
      if (want === mine[d]) {
        if (!agree.has(d)) agree.set(d, []);
        agree.get(d).push(src.label);
      } else {
        clash.push({ name: src.label, theirs: TRAIT[d][want], mine: TRAIT[d][mine[d]] });
      }
    }
  };
  walk(bl);
  walk(zo);

  const deep = [...agree.entries()].map(([d, names]) => {
    const who = names.join("과 ");
    return `${TRAIT[d][mine[d]]}입니다. ${who}도 같은 쪽을 말하니, 이 면이 더 두드러질 수 있습니다.`;
  });

  const split = clash.map(({ name, theirs, mine: m }) =>
    `${name}${eun(name)} ${theirs}이라고 하지만, 검사 결과는 ${m}으로 나왔습니다. ` +
    `둘 중에서는 검사 쪽이 더 가깝다고 보시면 됩니다.`);

  return { head, deep, split, label: [bl && bl.label, zo && zo.label, type].filter(Boolean).join(" · ") };
}

/* ── 조합끼리의 궁합 ─────────────────────────────────── */
// 성격유형 6 : 혈액형 2 : 별자리 2 의 비중으로 합친다.
export function comboScore(a, b) {
  const s = matchScores(a.type, b.type);
  // 조합 궁합은 가까운 사이를 전제로 하므로 연애 점수를 쓴다.
  // 일·친구까지 섞으면 판단 기준이 같은 쪽이 유리해져, 앞의 궁합 카드와 순위가 어긋난다.
  const m = s.love;
  const bf = a.blood && b.blood ? bloodFit(a.blood, b.blood) : 65;
  const zf = a.zodiac && b.zodiac ? zodiacFit(a.zodiac, b.zodiac) : 65;
  return { total: Math.round(m * 0.6 + bf * 0.2 + zf * 0.2), mbti: m, blood: bf, zodiac: zf };
}

// 상대가 될 수 있는 조합을 점수순으로 돌려준다.
// 내가 넣지 않은 항목(혈액형·별자리)은 상대 쪽에서도 따지지 않는다.
export function comboRank(me, limit = 5) {
  const bloods = me.blood ? BLOODS : [""];
  const zodiacs = me.zodiac ? ZODIAC.map((z) => z.key) : [""];
  const out = [];

  for (const type of TYPES) {
    for (const blood of bloods) {
      for (const zodiac of zodiacs) {
        const s = comboScore(me, { type, blood, zodiac });
        const label = [
          blood ? BLOOD[blood].label : "",
          zodiac ? zLabel(zodiac) : "",
          blood || zodiac ? type : `${type} · ${TYPE_INFO[type][0]}`
        ].filter(Boolean).join(" · ");
        out.push({
          type, blood, zodiac, label,
          total: s.total, mbtiScore: s.mbti, bloodScore: s.blood, zodiacScore: s.zodiac
        });
      }
    }
  }

  out.sort((x, y) => y.total - x.total || (x.label < y.label ? -1 : 1));

  // 같은 성격유형이 목록을 채우지 않도록 유형마다 가장 높은 조합 하나씩만 남긴다.
  // 다만 같은 점수인 조합이 여럿이면 이름을 함께 적어, 가려지는 조합이 없게 한다.
  const onePerType = (list) => {
    const seen = new Set(), res = [];
    for (const r of list) {
      if (seen.has(r.type)) continue;
      seen.add(r.type);
      const tied = out.filter((x) => x.type === r.type && x.total === r.total);
      const zs = [...new Set(tied.map((x) => x.zodiac).filter(Boolean))].map(zLabel);
      const bs = [...new Set(tied.map((x) => x.blood).filter(Boolean))].map((b) => BLOOD[b].label);
      const label = [
        bs.length ? bs.join("·") : "",
        zs.length ? zs.join("·") : "",
        bs.length || zs.length ? r.type : `${r.type} · ${TYPE_INFO[r.type][0]}`
      ].filter(Boolean).join(" · ");
      res.push({ ...r, label, tiedCount: tied.length });
    }
    return res;
  };
  return { top: onePerType(out).slice(0, limit), bottom: onePerType(out.slice().reverse()).slice(0, 3) };
}

// 혈액형만 볼 때, 별자리만 볼 때의 순위
export function axisRank(me) {
  const blood = me.blood
    ? BLOODS.map((b) => ({ key: b, label: BLOOD[b].label, score: bloodFit(me.blood, b) }))
        .sort((a, b) => b.score - a.score)
    : [];
  const zodiac = me.zodiac
    ? ZODIAC.map((z) => ({ key: z.key, label: z.label, score: zodiacFit(me.zodiac, z.key) }))
        .sort((a, b) => b.score - a.score)
    : [];
  const mbti = TYPE_MATCH[me.type]
    ? TYPE_MATCH[me.type].fit.map((f) => ({ label: f[0], score: f[3] }))
    : [];
  return { blood, zodiac, mbti };
}

export { zLabel, TYPES, BLOODS };

/* ── 화면에 넣을 조각 만들기 (검사 결과와 관리자 미리보기가 함께 쓴다) ── */
const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderComboSections(me) {
  const p = comboProfile(me.type, me.blood, me.zodiac);
  const rank = comboRank(me, 5);
  const ax = axisRank(me);
  const full = Boolean(me.blood && me.zodiac);
  const hasAxis = ax.blood.length > 0 || ax.zodiac.length > 0;
  const row = (r, i, cls) => `<div class="crow ${cls}">
      <span class="crank">${i + 1}</span>
      <span class="clabel">${esc(r.label)}</span>
      <span class="cbar"><i style="width:${r.total}%"></i></span>
      <span class="cscore">${r.total}%</span>
    </div>`;

  return `
    ${(p.deep.length || p.split.length) ? `<section class="blk pb">
      <h2 class="sec">${esc(p.label)}인 사람</h2>
      <p class="mixdesc">${esc(p.head)}</p>
      ${p.deep.length ? `<p class="sub">더 뚜렷하게 나타날 수 있는 성격</p>
        <ul class="rlist">${p.deep.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      ${p.split.length ? `<p class="sub">서로 다르게 말하는 부분</p>
        <ul class="rlist">${p.split.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    </section>` : ""}

    <section class="blk pb">
      <h2 class="sec">조합으로 본 궁합 순위</h2>
      <p class="jenv">${full
        ? "연인이나 친한 사이를 놓고 본 순위입니다. 성격유형을 6, 혈액형을 2, 별자리를 2만큼 반영했고, 성격유형마다 점수가 가장 높은 조합 하나씩만 골랐습니다. 같은 점수인 조합은 한 줄에 함께 적었습니다."
        : (me.blood || me.zodiac)
        ? `연인이나 친한 사이를 놓고 본 순위입니다. 넣지 않은 항목은 빼고 ${me.blood ? "성격유형과 혈액형" : "성격유형과 별자리"}만으로 비교했습니다.`
        : "혈액형과 별자리를 넣지 않아 성격유형만으로 비교한 순위입니다."}</p>
      <p class="sub">잘 맞는 조합</p>
      <div class="crows">${rank.top.map((r, i) => row(r, i, "cgood")).join("")}</div>
      <p class="sub">어려울 수 있는 조합</p>
      <div class="crows">${rank.bottom.map((r, i) => row(r, i, "cbad")).join("")}</div>
    </section>

    ${hasAxis ? `<section class="blk pb">
      <h2 class="sec">항목별로 따로 보면</h2>
      <div class="cols">
        ${ax.blood.length ? `<div><p class="sub">혈액형끼리</p>
          <div class="crows">${ax.blood.map((b, i) =>
            `<div class="crow"><span class="crank">${i + 1}</span>
              <span class="clabel">${esc(b.label)}</span>
              <span class="cbar"><i style="width:${b.score}%"></i></span>
              <span class="cscore">${b.score}</span></div>`).join("")}</div></div>` : ""}
        ${ax.zodiac.length ? `<div><p class="sub">별자리끼리 (상위 4)</p>
          <div class="crows">${ax.zodiac.slice(0, 4).map((z, i) =>
            `<div class="crow"><span class="crank">${i + 1}</span>
              <span class="clabel">${esc(z.label)}</span>
              <span class="cbar"><i style="width:${z.score}%"></i></span>
              <span class="cscore">${z.score}</span></div>`).join("")}</div></div>` : ""}
      </div>
      <div class="lookup noprint" data-me="${esc(me.type)}|${esc(me.blood || "")}|${esc(me.zodiac || "")}">
        <p class="sub">궁금한 조합 찾아보기</p>
        <div class="lookrow">
          <select class="input" data-lk="blood">${Object.keys(BLOOD).map((b) =>
            `<option value="${b}">${BLOOD[b].label}</option>`).join("")}</select>
          <select class="input" data-lk="zodiac">${ZODIAC.map((z) =>
            `<option value="${z.key}">${z.label}</option>`).join("")}</select>
          <select class="input" data-lk="type">${TYPES.map((t) =>
            `<option value="${t}">${t}</option>`).join("")}</select>
        </div>
        <p class="lookout" data-lk="out"></p>
      </div>

      <p class="mixfoot">혈액형이나 별자리로 성격을 나누는 이야기는 널리 퍼져 있지만
        연구로 밝혀진 것은 아닙니다. 성격유형 궁합도 마찬가지입니다.
        점수가 낮게 나왔다고 안 맞는 사이라는 뜻이 아니라, 서로 다른 점이 많다는 정도입니다.
        재미로만 봐 주세요.</p>
    </section>` : ""}`;
}

/* 화면에 그려진 뒤 '상대 조합 찾아보기'를 움직이게 한다. */
export function bindLookup(root = document) {
  root.querySelectorAll(".lookup").forEach((box) => {
    const [type, blood, zodiac] = box.dataset.me.split("|");
    const me = { type, blood, zodiac };
    const out = box.querySelector('[data-lk="out"]');
    const pickers = ["blood", "zodiac", "type"].map((k) => box.querySelector(`[data-lk="${k}"]`));

    const show = () => {
      const other = { blood: pickers[0].value, zodiac: pickers[1].value, type: pickers[2].value };
      const s = comboScore(me, other);
      // 전체 조합에서 몇 번째인지 센다. 같은 점수는 공동 순위로 본다.
      let higher = 0, same = 0;
      for (const t of TYPES) for (const b of BLOODS) for (const z of ZODIAC) {
        const v = comboScore(me, { type: t, blood: b, zodiac: z.key }).total;
        if (v > s.total) higher++;
        else if (v === s.total) same++;
      }
      out.innerHTML = `<b>${s.total}%</b> · 전체 ${TYPES.length * BLOODS.length * ZODIAC.length}개 조합 중 ` +
        `<b>${higher + 1}위</b>${same > 1 ? ` (같은 점수 ${same}개 공동)` : ""}` +
        `<span class="lookdetail">유형 ${s.mbti} · 혈액형 ${s.blood ?? "-"} · 별자리 ${s.zodiac ?? "-"}</span>`;
    };
    pickers.forEach((p) => p.addEventListener("change", show));
    show();
  });
}
