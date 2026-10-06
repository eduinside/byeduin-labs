import { generateContent } from './_ai.js';
import { guard, json, readJson, str, errorResponse } from './_guard.js';

/**
 * POST /api/timer-vision — 시정표(일과 시간표) 사진 → 시정 JSON
 *
 * 같은 출처에서만 받는다(_guard.js). 한도: LIMITS['timer-vision'] + AI 텍스트 한도.
 * 이미지는 AI에 넘기기만 하고 저장·기록하지 않는다(로그에도 남기지 않음).
 *
 * Request:  { image: 'data:image/jpeg;base64,…' }   (브라우저에서 긴 변 1280px 정도로 줄여 보냄)
 * Response: { name, periods: [{ label, start:'HH:MM', end:'HH:MM', kind }], notes, uncertain: [행 번호] }
 *           인식 실패 → 422 { error }
 */

const BODY_MAX = 900 * 1024;          // base64 이미지(약 650KB) + 여유
const IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
const ROWS_MAX = 24;
const KINDS = ['class', 'break', 'lunch', 'morning', 'after', 'etc'];
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function toHHMM(v) {
  const m = String(v || '').trim().replace(/[.：]/g, ':').match(HHMM);
  if (!m) return null;
  return m[1].padStart(2, '0') + ':' + m[2];
}
const minutes = (t) => +t.slice(0, 2) * 60 + +t.slice(3);

const SYSTEM = `당신은 한국 초·중학교의 "일과 시정표(시간표)" 이미지를 읽어 구조화하는 도우미입니다.
이미지에서 하루 일과의 각 구간(아침 활동, 1교시, 쉬는 시간, 중간 놀이, 점심시간, 방과 후 등)과 시작·끝 시각을 읽어 JSON 객체만 출력하세요.

규칙:
- 시각은 24시간제 "HH:MM". 오후 1시 10분은 "13:10". "1:10"처럼 오후가 분명한 시각(점심 뒤 교시)은 13:10으로 바꿉니다.
- 표에 "쉬는 시간"이 따로 없어도 앞 교시 끝과 다음 교시 시작 사이에 틈이 있으면 그 틈을 "쉬는 시간"(kind "break")으로 넣습니다.
- kind: 수업 교시 "class", 쉬는 시간·중간 놀이 "break", 점심 "lunch", 아침 활동·조회 "morning", 방과 후·종례 이후 "after", 그 밖 "etc".
- label은 표에 적힌 이름을 짧게(예: "1교시", "중간 놀이", "점심시간"). 20자 이내.
- 시간 순서로 정렬합니다. 학교 이름·사람 이름은 출력하지 않습니다.
- 읽기 어려웠거나 추측한 행은 uncertain 배열에 0부터 센 행 번호로 넣습니다.
- 여러 종류의 시정(예: 평일·단축)이 함께 있으면 가장 먼저 나오는 기본 시정 하나만 읽고, notes에 다른 시정이 있다고 적습니다.
- 시정표가 아니거나 읽을 수 없으면 periods를 빈 배열로 하고 notes에 이유를 적습니다.

출력 형식(이 JSON만, 코드 블록 없이):
{"name":"시정 이름(표 제목에서, 없으면 \\"우리 학교 시정\\")","periods":[{"label":"1교시","start":"09:00","end":"09:40","kind":"class"}],"uncertain":[],"notes":"짧은 한국어 메모(없으면 빈 문자열)"}`;

export async function onRequestPost({ request, env }) {
  const blocked = await guard(request, 'timer-vision');
  if (blocked) return blocked;

  const body = await readJson(request, BODY_MAX);
  if (body instanceof Response) return body;

  const image = typeof body.image === 'string' ? body.image : '';
  if (!IMAGE_RE.test(image)) return json({ error: '사진 형식을 읽지 못했어요. JPG·PNG 사진을 다시 골라 주세요.' }, 400);

  let raw;
  try {
    raw = await generateContent({
      systemPrompt: SYSTEM,
      userMessage: '이 이미지의 일과 시정표를 위 형식의 JSON으로 읽어 주세요.',
      images: [image],
      json: true,
      temperature: 0.1,
      geminiModel: 'gemini-flash-latest',   // 직접 Gemini 폴백도 이미지 인식이 되는 모델
      timeoutMs: 45000,
      env,
      request,
    });
  } catch (err) {
    console.error('[timer-vision]', err && err.message);
    return errorResponse(err, '사진을 읽지 못했어요. 잠시 후 다시 해 주세요.');
  }

  let parsed = null;
  try {
    parsed = JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
  } catch (e) { parsed = null; }
  if (!parsed || !Array.isArray(parsed.periods)) {
    return json({ error: '표를 찾지 못했어요. 시정표만 보이게, 밝은 곳에서 다시 찍어 주세요.' }, 422);
  }

  // AI 결과를 그대로 믿지 않고 다시 검사·정리
  const periods = [];
  const uncertain = new Set((Array.isArray(parsed.uncertain) ? parsed.uncertain : []).filter(Number.isInteger));
  parsed.periods.slice(0, ROWS_MAX).forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const start = toHHMM(p.start), end = toHHMM(p.end);
    if (!start || !end || minutes(end) <= minutes(start)) return;
    const label = str(p.label, 20) || '구간';
    const kind = KINDS.includes(p.kind) ? p.kind : 'etc';
    periods.push({ label, start, end, kind, uncertain: uncertain.has(i) || undefined });
  });
  periods.sort((a, b) => minutes(a.start) - minutes(b.start));

  if (!periods.length) {
    return json({ error: '시각이 적힌 표를 찾지 못했어요. 시정표만 보이게 다시 찍어 주세요.', notes: str(parsed.notes, 200) }, 422);
  }

  return json({
    name: str(parsed.name, 30) || '우리 학교 시정',
    periods,
    notes: str(parsed.notes, 200),
  });
}
