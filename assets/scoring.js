import { BANK, DIMS } from "./questions.js";

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
