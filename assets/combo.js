/* 혈액형 · 별자리 · 성격유형을 합쳐 하나의 서술과 궁합 순위를 만든다.
   혈액형과 별자리로 성격을 나누는 것은 연구로 확인된 바 없는 통설이며,
   여기서는 재미로 견주어 보는 용도로만 쓴다. */
import { BANK, DIMS, TYPE_INFO, TYPE_MATCH, BLOOD, ZODIAC } from "./questions.js";
import { matchScores } from "./scoring.js";

const TYPES = Object.keys(TYPE_INFO);
const BLOODS = Object.keys(BLOOD);

// 지표별로 그 성향이 겉으로 드러나는 모습
const TRAIT = {
  EI: { E: "먼저 다가가 말로 푸는 면", I: "혼자 정리하고 안으로 삭이는 면" },
  SN: { S: "눈앞의 사실부터 챙기는 면", N: "뜻과 가능성을 먼저 보는 면" },
  TF: { T: "기준으로 잘라 판단하는 면", F: "사람의 사정을 살피는 면" },
  JP: { J: "미리 정해 두고 지키는 면", P: "상황을 보며 맞춰 가는 면" }
};

const BLOOD_SHORT = { A: "신중함", B: "자유로움", O: "밀고 가는 힘", AB: "거리를 두는 시선" };
const ZODIAC_SHORT = {
  aries: "앞장서는 기운", taurus: "버티는 뚝심", gemini: "넓은 호기심", cancer: "품는 마음",
  leo: "드러내는 자신감", virgo: "따지는 눈", libra: "맞추는 감각", scorpio: "파고드는 집요함",
  sagittarius: "뻗어 가는 시야", capricorn: "쌓아 가는 끈기", aquarius: "남다른 시각",
  pisces: "스며드는 감성"
};

// 혈액형끼리의 궁합 (통설 기반, 어느 쪽에서 보아도 같다)
const BLOOD_FIT = {
  "A|A": 78, "A|B": 60, "A|O": 85, "A|AB": 70,
  "B|B": 74, "B|O": 65, "B|AB": 88,
  "O|O": 80, "O|AB": 63, "AB|AB": 72
};
const bloodFit = (a, b) => BLOOD_FIT[[a, b].sort().join("|")] || 65;

// 별자리는 네 원소로 나눠 본다
const ELEM = {
  aries: "불", leo: "불", sagittarius: "불",
  taurus: "흙", virgo: "흙", capricorn: "흙",
  gemini: "공기", libra: "공기", aquarius: "공기",
  cancer: "물", scorpio: "물", pisces: "물"
};
const ELEM_FIT = { "불|불": 88, "흙|흙": 88, "공기|공기": 88, "물|물": 88,
  "공기|불": 84, "물|흙": 84, "불|흙": 62, "물|불": 58, "공기|흙": 64, "공기|물": 60 };
function zodiacFit(a, b) {
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
    ? `${TYPE_INFO[type][0]}인 ${type}에 ${parts.join("과 ")}이 겹칩니다.`
    : `${TYPE_INFO[type][0]}인 ${type}입니다.`;

  const deep = [], split = [];
  const walk = (src, key) => {
    if (!src) return;
    const name = key === "blood" ? src.label : src.label;
    for (const d of DIMS) {
      const want = (src.lean || {})[d];
      if (!want) continue;
      if (want === mine[d]) {
        deep.push(`${TRAIT[d][want]}이 한층 짙어집니다. ${name}${eun(name)} 같은 방향을 가리킵니다.`);
      } else {
        split.push(`${name}${eun(name)} ${TRAIT[d][want]}을 말하지만, 검사에서는 ` +
          `${TRAIT[d][mine[d]]}이 나왔습니다. 평소에는 뒤쪽이 앞서고 편한 자리에서 앞쪽이 비칠 수 있습니다.`);
      }
    }
  };
  walk(bl, "blood");
  walk(zo, "zodiac");

  return { head, deep, split, label: [bl && bl.label, zo && zo.label, type].filter(Boolean).join(" · ") };
}

/* ── 조합끼리의 궁합 ─────────────────────────────────── */
// 성격유형 6 : 혈액형 2 : 별자리 2 의 비중으로 합친다.
export function comboScore(a, b) {
  const m = matchScores(a.type, b.type).total;
  const bf = a.blood && b.blood ? bloodFit(a.blood, b.blood) : 65;
  const zf = a.zodiac && b.zodiac ? zodiacFit(a.zodiac, b.zodiac) : 65;
  return { total: Math.round(m * 0.6 + bf * 0.2 + zf * 0.2), mbti: m, blood: bf, zodiac: zf };
}

// 상대가 될 수 있는 모든 조합을 점수순으로 돌려준다.
export function comboRank(me, limit = 5) {
  const out = [];
  for (const t of TYPES) {
    for (const b of BLOODS) {
      for (const z of ZODIAC) {
        const other = { type: t, blood: b, zodiac: z.key };
        const s = comboScore(me, other);
        out.push({ ...other, ...s, label: `${BLOOD[b].label} · ${z.label} · ${t}` });
      }
    }
  }
  out.sort((x, y) => y.total - x.total || (x.label < y.label ? -1 : 1));
  // 같은 성격유형이 목록을 채우지 않도록 유형마다 가장 높은 조합 하나씩만 남긴다.
  const pickOnePerType = (list) => {
    const seen = new Set(), res = [];
    for (const r of list) {
      if (seen.has(r.type)) continue;
      seen.add(r.type);
      res.push(r);
    }
    return res;
  };
  return {
    top: pickOnePerType(out).slice(0, limit),
    bottom: pickOnePerType(out.slice().reverse()).slice(0, 3)
  };
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
  const row = (r, i, cls) => `<div class="crow ${cls}">
      <span class="crank">${i + 1}</span>
      <span class="clabel">${esc(r.label)}</span>
      <span class="cbar"><i style="width:${r.total}%"></i></span>
      <span class="cscore">${r.total}%</span>
    </div>`;

  return `
    <section class="blk pb">
      <h2 class="sec">${esc(p.label)}인 사람</h2>
      <p class="mixdesc">${esc(p.head)}</p>
      ${p.deep.length ? `<p class="sub">더 짙어지는 면</p>
        <ul class="rlist">${p.deep.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      ${p.split.length ? `<p class="sub">두 갈래로 보이는 면</p>
        <ul class="rlist">${p.split.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    </section>

    <section class="blk pb">
      <h2 class="sec">조합으로 본 궁합 순위</h2>
      <p class="jenv">성격유형 6, 혈액형 2, 별자리 2의 비중으로 합한 점수입니다.
        성격유형마다 가장 높은 조합 하나씩만 골라 늘어놓았습니다.</p>
      <p class="sub">잘 맞는 조합</p>
      <div class="crows">${rank.top.map((r, i) => row(r, i, "cgood")).join("")}</div>
      <p class="sub">어려울 수 있는 조합</p>
      <div class="crows">${rank.bottom.map((r, i) => row(r, i, "cbad")).join("")}</div>
    </section>

    <section class="blk pb">
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
      <p class="mixfoot">혈액형과 별자리로 성격을 나누는 것은 널리 알려진 이야기일 뿐,
        연구로 확인된 바가 없습니다. 성격유형 궁합 역시 연구로 뒷받침된 것이 아닙니다.
        낮게 나온 조합도 안 맞는 사이라는 뜻이 아니라 서로 다른 지점이 많다는 정도이니,
        재미로 봐 주세요.</p>
    </section>`;
}
