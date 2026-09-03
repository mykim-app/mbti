import { BANK, DIMS, SCALE_BANK } from "./questions.js";

// 지표를 번갈아 배치한다. flip 이 참인 문항은 선택지를 뒤집어 보여 주지만
// 각 선택지가 가리키는 값은 그대로이므로 채점에는 영향이 없다.
// 뒤집기는 위쪽만 계속 고르는 습관을 상쇄하기 위한 장치다.
export function buildItems(perDim) {
  const list = [];
  DIMS.forEach((d) => {
    // 지표마다 20문항 중 perDim 개를 무작위로 고른다.
    const picked = shuffle(BANK[d].items.map((it, i) => ({ it, i }))).slice(0, perDim);
    picked.forEach(({ it, i }, k) => {
      // 고른 문항의 절반씩 선택지 순서를 뒤집어, 위쪽만 계속 고르는 습관을 상쇄한다.
      list.push({ id: d + i, dim: d, q: it.q, o: it.o, flip: k % 2 === 1 });
    });
  });
  // 문항이 나오는 순서도 매번 섞는다.
  return shuffle(list);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 선택값 0=앞 극 강함, 1=앞 극 약함, 2=뒤 극 약함, 3=뒤 극 강함
// '강함'은 2점, '약함'은 1점
export function score(items, answers) {
  const raw = {};
  for (const d of DIMS) raw[d] = { a: 0, b: 0, aStrong: 0, bStrong: 0 };

  for (const it of items) {
    const c = answers[it.id];
    if (c === undefined) continue;
    const strong = c === 0 || c === 3;
    const w = strong ? 2 : 1;
    const r = raw[it.dim];
    if (c <= 1) {
      r.a += w;
      if (strong) r.aStrong++;
    } else {
      r.b += w;
      if (strong) r.bStrong++;
    }
  }

  const dims = {};
  let type = "";
  for (const d of DIMS) {
    const { a, b, aStrong, bStrong } = raw[d];
    const total = a + b || 1;
    let idx, tie = false;
    if (a > b) idx = 0;
    else if (b > a) idx = 1;
    else { tie = true; idx = aStrong >= bStrong ? 0 : 1; }
    dims[d] = {
      a, b,
      pctA: Math.round((a / total) * 100),
      pctB: Math.round((b / total) * 100),
      letter: BANK[d].poles[idx],
      tie
    };
    type += dims[d].letter;
  }
  return { type, dims };
}

/* ── 척도형(동의 ↔ 비동의) ─────────────────────────────── */
// 지표마다 '동의=앞 극' 문항과 '동의=뒤 극' 문항을 같은 수로 뽑는다.
// 한쪽으로만 동의하는 습관이 특정 유형으로 쏠리지 않게 하려는 장치다.
export function buildScaleItems(perDim) {
  const list = [];
  DIMS.forEach((d, di) => {
    // 홀수면 한쪽이 하나 많아지므로, 그 하나를 지표마다 번갈아 준다.
    const half = perDim % 2 === 0 ? perDim / 2
      : Math.floor(perDim / 2) + (di % 2 === 0 ? 1 : 0);
    const pool = SCALE_BANK[d];
    const plus = shuffle(pool.map((it, i) => ({ it, i })).filter((x) => x.it.k === 1)).slice(0, half);
    const minus = shuffle(pool.map((it, i) => ({ it, i })).filter((x) => x.it.k === -1)).slice(0, perDim - half);
    [...plus, ...minus].forEach(({ it, i }) => {
      list.push({ id: d + "s" + i, dim: d, s: it.s, k: it.k, scale: true });
    });
  });
  return shuffle(list);
}

// 선택값 +3 매우 동의 ~ 0 중립 ~ -3 매우 비동의
// 문항의 k 를 곱해 앞 극(양수) 또는 뒤 극(음수)으로 보낸다.
export function scoreScale(items, answers) {
  const raw = {};
  for (const d of DIMS) raw[d] = { a: 0, b: 0, aStrong: 0, bStrong: 0 };

  for (const it of items) {
    const c = answers[it.id];
    if (c === undefined) continue;
    const v = c * it.k;
    if (v === 0) continue;
    const r = raw[it.dim];
    if (v > 0) { r.a += v; if (v === 3) r.aStrong++; }
    else { r.b += -v; if (v === -3) r.bStrong++; }
  }

  const dims = {};
  let type = "";
  for (const d of DIMS) {
    const { a, b, aStrong, bStrong } = raw[d];
    const total = a + b || 1;
    let idx, tie = false;
    if (a > b) idx = 0;
    else if (b > a) idx = 1;
    else { tie = true; idx = aStrong >= bStrong ? 0 : 1; }
    dims[d] = {
      a, b,
      pctA: Math.round((a / total) * 100),
      pctB: Math.round((b / total) * 100),
      letter: BANK[d].poles[idx],
      tie
    };
    type += dims[d].letter;
  }
  return { type, dims };
}

/* ── 유형 간 궁합 점수 ─────────────────────────────────────
   널리 쓰이는 이론을 따라 계산한다. 요지는 세 가지다.

   1) 보는 방식(S/N)이 같아야 말이 통한다. 여기가 어긋나면 대화가 겉돈다.
   2) 판단 기준(T/F)은 오히려 다를 때 서로를 채워 준다. 흔히 '황금 조합'이라 부른다.
      일에서는 반대로 같은 편이 손발이 맞는다.
   3) 안팎 성향(E/I)과 생활 방식(J/P)이 다른 것은 큰 흠이 아니다. 조금 더해 준다.

   같은 글자가 많다고 점수가 높아지지 않으며, 바닥은 40점이다.
   어떤 조합도 '안 맞는 사이'로 못박지 않기 위해서다.
   통계 조사값이 아니라 네 지표의 조합으로 매긴 참고 점수다. */
const W = {
  //         S/N 같음  T/F      E/I      J/P      바닥
  love:   { sn: 25, tf: 15, ei: 10, jp: 10, base: 40, tfSame: false, eiSame: false, jpSame: false },
  work:   { sn: 15, tf: 15, ei: 10, jp: 20, base: 40, tfSame: true,  eiSame: false, jpSame: true },
  friend: { sn: 25, tf: 10, ei: 10, jp: 15, base: 40, tfSame: true,  eiSame: true,  jpSame: true }
};

export function matchScores(a, b) {
  const same = [0, 1, 2, 3].map((i) => a[i] === b[i]);   // E/I, S/N, T/F, J/P
  const calc = (w) =>
    (same[1] ? w.sn : 0) +
    ((w.tfSame ? same[2] : !same[2]) ? w.tf : 0) +
    ((w.eiSame ? same[0] : !same[0]) ? w.ei : 0) +
    ((w.jpSame ? same[3] : !same[3]) ? w.jp : 0) + w.base;
  const love = calc(W.love), work = calc(W.work), friend = calc(W.friend);
  return { love, work, friend, total: Math.round((love + work + friend) / 3) };
}

// 나를 뺀 15개 유형을 종합 점수가 높은 순으로 돌려준다.
export function matchTable(type, all) {
  return all.filter((t) => t !== type)
    .map((t) => ({ type: t, ...matchScores(type, t) }))
    .sort((x, y) => y.total - x.total || (x.type < y.type ? -1 : 1));
}

/* ── 심화형 ────────────────────────────────────────────
   지표마다 일반형 15문항과 척도형 15문항을 뽑아 모두 120문항을 낸다.
   두 방식의 만점이 달라(일반형 30점, 척도형 45점) 척도형 쪽을 2/3로 맞춰
   양쪽이 같은 무게로 반영되게 한다. */
export function buildDeepItems(perDimEach = 15) {
  // 두 방식을 섞어 내면 답하는 요령이 계속 바뀌어 눈이 피로하다.
  // 그래서 척도 문항을 모두 끝낸 뒤 선택 문항으로 넘어가게 한다.
  // 어느 문항이 뽑히는지, 그 안에서의 순서는 그대로 무작위다.
  return [...buildScaleItems(perDimEach), ...buildItems(perDimEach)];
}

export function scoreDeep(items, answers) {
  const plain = items.filter((i) => !i.scale);
  const scaled = items.filter((i) => i.scale);
  const g = score(plain, answers);
  const s = scoreScale(scaled, answers);

  const dims = {};
  let type = "";
  for (const d of DIMS) {
    const a = g.dims[d].a + s.dims[d].a * (2 / 3);
    const b = g.dims[d].b + s.dims[d].b * (2 / 3);
    const total = a + b || 1;
    let idx, tie = false;
    if (a > b) idx = 0;
    else if (b > a) idx = 1;
    else { tie = true; idx = 0; }
    dims[d] = {
      a: Math.round(a), b: Math.round(b),
      pctA: Math.round((a / total) * 100),
      pctB: Math.round((b / total) * 100),
      letter: BANK[d].poles[idx],
      tie
    };
    type += dims[d].letter;
  }
  return { type, dims };
}
