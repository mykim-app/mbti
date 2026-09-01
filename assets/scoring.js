import { BANK, DIMS } from "./questions.js";

// 지표를 번갈아 배치한다. flip 이 참인 문항은 선택지를 뒤집어 보여 주지만
// 각 선택지가 가리키는 값은 그대로이므로 채점에는 영향이 없다.
// 뒤집기는 위쪽만 계속 고르는 습관을 상쇄하기 위한 장치다.
export function buildItems(perDim) {
  const list = [];
  for (let i = 0; i < perDim; i++) {
    DIMS.forEach((d, di) => {
      const it = BANK[d].items[i];
      list.push({ id: d + i, dim: d, q: it.q, o: it.o, flip: (i + di) % 2 === 1 });
    });
  }
  return list;
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
