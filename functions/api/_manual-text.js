// 에듀서치 매뉴얼 색인용 한국어 토큰화 — 적재 스크립트(scripts/manual-ingest.mjs)와 검색 API(search.js)가 함께 쓴다.
// FTS5 기본 토크나이저는 어절 단위라 조사가 붙은 말("예산편성은")을 놓친다. 그래서 한글 어절은 2글자씩 겹쳐 자른
// 바이그램("예산 산편 편성 성은")으로 바꿔 색인하고, 질문도 같은 방식으로 바꿔 OR 검색한다(순위는 bm25).

const TOKEN_RE = /[가-힣]+|[a-z0-9]+/g;

/** 색인·질의 공통 그램 목록(중복 포함). 한글 1글자 어절은 버린다(조사·의존명사 잡음). */
export function toGrams(text) {
  const src = String(text || '').normalize('NFKC').toLowerCase().replace(/<[^>]+>/g, ' ');
  const out = [];
  for (const tok of src.match(TOKEN_RE) || []) {
    if (/^[가-힣]/.test(tok)) {
      if (tok.length === 1) continue;
      for (let i = 0; i < tok.length - 1; i++) out.push(tok.slice(i, i + 2));
    } else if (tok.length >= 2 || /\d/.test(tok)) {
      out.push(tok);
    }
  }
  return out;
}

/** 질문 → FTS5 MATCH 식. 그램이 없으면 null. */
export function toMatchQuery(text, max = 40) {
  const uniq = [...new Set(toGrams(text))].slice(0, max);
  return uniq.length ? uniq.map(g => `"${g}"`).join(' OR ') : null;
}
