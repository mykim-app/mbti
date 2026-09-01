import { BANK, DIMS } from "./questions.js";

// 지표를 번갈아 배치하고, 홀수 번째 문항은 두 문장의 위아래를 뒤집어
// 한쪽 위치만 계속 고르는 편향을 줄인다.
export function buildItems(perDim) {
  const list = [];
  for (let i = 0; i < perDim; i++) {
    DIMS.forEach((d, di) => {
      list.push({
        id: d + i,
        dim: d,
        a: BANK[d].items[i][0],
        b: BANK[d].items[i][1],
        // 지표 안에서 절반씩 뒤집히도록 문항 번호와 지표 순서를 함께 쓴다.
        flip: (i + di) % 2 === 1
      });
    });
  }
  return list;
}

// 선택값 0=가에 확실히, 1=가에 조금, 2=나에 조금, 3=나에 확실히
// '확실히'는 2점, '조금'은 1점
export function score(items, answers) {
  const raw = {};
  for (const d of DIMS) raw[d] = { a: 0, b: 0, aStrong: 0, bStrong: 0 };

  for (const it of items) {
    const c = answers[it.id];
    if (c === undefined) continue;
    const towardA = it.flip ? c >= 2 : c <= 1;
    const strong = c === 0 || c === 3;
    const w = strong ? 2 : 1;
    const r = raw[it.dim];
    if (towardA) {
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
