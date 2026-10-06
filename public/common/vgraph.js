/* =====================================================
   VGraph — eduin VIVES 공용 막대·꺾은선 그래프 (SVG)
   교과서 표기를 맞추려고 라이브러리 없이 직접 그린다:
   눈금 한 칸 크기, 물결선(세로축 아래 생략), 평균선, 값 표시.
   - 출력은 SVG 요소만(이벤트 없음). 글자는 textContent로만 넣는다.
   - 색은 옵션 colors로 받는다(앱이 CSS 변수에서 읽어 넘김) → PNG로 내보내도 색이 유지됨.
   사용: graph-maker(그래프 그리기), sun-shadow(측정 기록)
   ===================================================== */
(function (root) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  var DEFAULT_COLORS = {
    bg: "#ffffff", text: "#1e293b", muted: "#64748b", grid: "#e2e8f0", axis: "#475569",
    bar: "#3b82f6", line: "#ef4444", point: "#ef4444", avg: "#f59e0b", wave: "#475569"
  };

  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = String(text);
    if (parent) parent.appendChild(e);
    return e;
  }

  // 1·2·5 × 10ⁿ 중에서 최댓값이 maxTicks칸 안에 들어가는 가장 작은 눈금(minStep 이상).
  // 예) 최댓값 7 → 1, 23 → 5, 180 → 20. 개수 자료는 minStep 1로 0.5 같은 눈금을 막는다.
  function niceStep(max, maxTicks, minStep) {
    maxTicks = maxTicks || 10; minStep = minStep || 0;
    if (!(max > 0)) return Math.max(1, minStep);
    var bases = [1, 2, 5];
    for (var p = -3; p <= 7; p++) {
      for (var i = 0; i < 3; i++) {
        var s = round(bases[i] * Math.pow(10, p));
        if (s < minStep - 1e-9) continue;
        if (Math.ceil(max / s - 1e-9) <= maxTicks) return s;
      }
    }
    return Math.max(1, minStep);
  }
  function round(v) { return Math.round(v * 1e6) / 1e6; }
  function fmtNum(v) { var r = Math.round(v * 100) / 100; return String(r); }

  function textWidth(s, size) {
    var w = 0, str = String(s);
    for (var i = 0; i < str.length; i++) w += /[ㄱ-힝]/.test(str[i]) ? 1 : 0.6;
    return w * size;
  }

  /* 공통 축 계산 */
  function frame(o) {
    var W = o.width || 640, H = o.height || 400;
    var items = o.items || [];
    var vals = items.map(function (it) { return Number(it.value) || 0; });
    var maxData = Math.max.apply(null, vals.concat([0]));
    if (o.avg != null && isFinite(o.avg)) maxData = Math.max(maxData, o.avg);
    var from = o.wave && o.wave.from > 0 ? o.wave.from : 0;
    var span = Math.max(1e-9, maxData - from);
    var allInt = vals.every(function (v) { return Math.round(v) === v; });
    var step = o.step && o.step > 0 ? o.step : niceStep(span, 10, allInt ? 1 : 0);
    var top = Math.ceil(maxData / step - 1e-9) * step;
    if (top <= from) top = from + step;
    if (top - maxData < step * 0.25) top += step; // 맨 위 칸에 여유
    var ticks = Math.round((top - from) / step);
    if (ticks > 40) { step = niceStep(span, 12, allInt ? 1 : 0); top = Math.ceil(maxData / step) * step + step; ticks = Math.round((top - from) / step); }
    var fs = o.fontSize || Math.max(12, Math.min(18, Math.round(Math.min(W, H) / 30)));
    var labelEvery = ticks > 12 ? Math.ceil(ticks / 12) : 1;
    var maxTickLabel = 0;
    for (var t = 0; t <= ticks; t++) maxTickLabel = Math.max(maxTickLabel, textWidth(fmtNum(from + t * step), fs));
    var horizontal = !!o.horizontal;
    var catLabelW = 0;
    items.forEach(function (it) { catLabelW = Math.max(catLabelW, textWidth(it.label, fs)); });
    var pad = { t: (o.title ? fs * 2.4 : fs) + fs * 1.4, r: 18, b: 0, l: 0 };
    if (horizontal) {
      pad.l = Math.min(W * 0.35, catLabelW + 18);
      pad.b = fs * 2.6;
    } else {
      pad.l = maxTickLabel + 22 + (from ? 10 : 0);
      var slot = (W - pad.l - pad.r) / Math.max(1, items.length);
      var rotate = catLabelW > slot - 6;
      pad.b = rotate ? Math.min(H * 0.32, catLabelW * 0.75 + fs + 10) : fs * 2.4;
      pad.rotate = rotate;
    }
    var plot = { l: pad.l, t: pad.t, r: W - pad.r, b: H - pad.b };
    return { W: W, H: H, items: items, vals: vals, from: from, step: step, top: top, ticks: ticks, fs: fs, labelEvery: labelEvery, plot: plot, horizontal: horizontal, rotate: !!pad.rotate };
  }

  function axes(svg, f, o, C) {
    var p = f.plot, g = el("g", { "aria-hidden": "true" }, svg);
    if (o.title) el("text", { x: f.W / 2, y: f.fs * 1.5, "text-anchor": "middle", "font-size": f.fs * 1.15, "font-weight": 800, fill: C.text }, g, o.title);
    // 눈금선·눈금 글자
    for (var t = 0; t <= f.ticks; t++) {
      var v = f.from + t * f.step;
      if (f.horizontal) {
        var x = p.l + (t / f.ticks) * (p.r - p.l);
        el("line", { x1: x, y1: p.t, x2: x, y2: p.b, stroke: t === 0 ? C.axis : C.grid, "stroke-width": t === 0 ? 2 : 1 }, g);
        if (t % f.labelEvery === 0) el("text", { x: x, y: p.b + f.fs * 1.3, "text-anchor": "middle", "font-size": f.fs * 0.9, fill: C.muted }, g, fmtNum(v));
      } else {
        var y = p.b - (t / f.ticks) * (p.b - p.t);
        el("line", { x1: p.l, y1: y, x2: p.r, y2: y, stroke: t === 0 && !f.from ? C.axis : C.grid, "stroke-width": t === 0 && !f.from ? 2 : 1 }, g);
        if (t % f.labelEvery === 0) el("text", { x: p.l - 8 - (f.from ? 10 : 0), y: y, "text-anchor": "end", "dominant-baseline": "central", "font-size": f.fs * 0.9, fill: C.muted }, g, fmtNum(v));
      }
    }
    // 세로축
    if (f.horizontal) el("line", { x1: p.l, y1: p.t, x2: p.l, y2: p.b, stroke: C.axis, "stroke-width": 2 }, g);
    else el("line", { x1: p.l, y1: p.t, x2: p.l, y2: p.b + (f.from ? 0 : 0), stroke: C.axis, "stroke-width": 2 }, g);
    // 단위
    if (o.unit) {
      if (f.horizontal) el("text", { x: p.r, y: p.b + f.fs * 2.4, "text-anchor": "end", "font-size": f.fs * 0.85, fill: C.muted }, g, "(" + o.unit + ")");
      else el("text", { x: p.l - 6, y: p.t - f.fs * 0.9, "text-anchor": "end", "font-size": f.fs * 0.85, fill: C.muted }, g, "(" + o.unit + ")");
    }
    // 물결선: 세로축 0과 시작값 사이를 생략했다는 표시
    if (f.from && !f.horizontal) {
      var wy = p.b + 4, wx = p.l;
      el("rect", { x: wx - 9, y: p.b - 2, width: 18, height: 12, fill: C.bg }, g);
      el("path", { d: "M" + (wx - 9) + " " + (wy + 2) + " q4.5 -6 9 0 t9 0 M" + (wx - 9) + " " + (wy + 7) + " q4.5 -6 9 0 t9 0", fill: "none", stroke: C.wave, "stroke-width": 1.8 }, g);
      el("text", { x: p.l - 8 - 10, y: p.b + 14, "text-anchor": "end", "dominant-baseline": "central", "font-size": f.fs * 0.9, fill: C.muted }, g, "0");
      el("line", { x1: p.l, y1: p.b, x2: p.r, y2: p.b, stroke: C.axis, "stroke-width": 2 }, g);
    }
    return g;
  }

  function catLabels(svg, f, C, xs) {
    var g = el("g", { "aria-hidden": "true" }, svg), p = f.plot;
    f.items.forEach(function (it, i) {
      if (f.horizontal) {
        el("text", { x: p.l - 8, y: xs[i], "text-anchor": "end", "dominant-baseline": "central", "font-size": f.fs, fill: C.text, "font-weight": 700 }, g, it.label);
      } else if (f.rotate) {
        var t = el("text", { x: xs[i], y: p.b + 10, "text-anchor": "end", "font-size": f.fs * 0.95, fill: C.text, "font-weight": 700, transform: "rotate(-40 " + xs[i] + " " + (p.b + 10) + ")" }, g, it.label);
        void t;
      } else {
        el("text", { x: xs[i], y: p.b + f.fs * 1.4, "text-anchor": "middle", "font-size": f.fs, fill: C.text, "font-weight": 700 }, g, it.label);
      }
    });
  }

  function a11y(svg, o, kind) {
    var items = o.items || [];
    el("title", null, svg, (o.title || kind) + " " + kind);
    el("desc", null, svg, items.map(function (it) { return it.label + " " + fmtNum(Number(it.value) || 0) + (o.unit || ""); }).join(", "));
    svg.setAttribute("role", "img");
  }

  function prep(svg, o) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var C = {}; var k; for (k in DEFAULT_COLORS) C[k] = DEFAULT_COLORS[k];
    if (o.colors) for (k in o.colors) if (o.colors[k]) C[k] = o.colors[k];
    var f = frame(o);
    svg.setAttribute("viewBox", "0 0 " + f.W + " " + f.H);
    svg.setAttribute("width", f.W); svg.setAttribute("height", f.H);
    svg.setAttribute("font-family", o.fontFamily || "-apple-system, 'Pretendard', 'Malgun Gothic', sans-serif");
    if (o.background !== false) el("rect", { x: 0, y: 0, width: f.W, height: f.H, fill: C.bg }, svg);
    return { C: C, f: f };
  }

  function scaleFns(f) {
    var p = f.plot;
    var n = Math.max(1, f.items.length);
    if (f.horizontal) {
      var slotH = (p.b - p.t) / n;
      return {
        slot: slotH,
        cat: function (i) { return p.t + slotH * (i + 0.5); },
        val: function (v) { return p.l + ((v - f.from) / (f.top - f.from)) * (p.r - p.l); },
        inv: function (px) { return f.from + ((px - p.l) / (p.r - p.l)) * (f.top - f.from); }
      };
    }
    var slot = (p.r - p.l) / n;
    return {
      slot: slot,
      cat: function (i) { return p.l + slot * (i + 0.5); },
      val: function (v) { return p.b - ((v - f.from) / (f.top - f.from)) * (p.b - p.t); },
      inv: function (py) { return f.from + ((p.b - py) / (p.b - p.t)) * (f.top - f.from); }
    };
  }

  function avgLine(svg, f, S, C, avg) {
    if (avg == null || !isFinite(avg)) return;
    var p = f.plot, g = el("g", {}, svg);
    if (f.horizontal) {
      var x = S.val(avg);
      el("line", { x1: x, y1: p.t, x2: x, y2: p.b, stroke: C.avg, "stroke-width": 3, "stroke-dasharray": "8 6" }, g);
      el("text", { x: x + 4, y: p.t - 4, "font-size": f.fs * 0.9, "font-weight": 800, fill: C.avg }, g, "평균 " + fmtNum(avg));
    } else {
      var y = S.val(avg);
      el("line", { x1: p.l, y1: y, x2: p.r, y2: y, stroke: C.avg, "stroke-width": 3, "stroke-dasharray": "8 6" }, g);
      el("text", { x: p.r, y: y - 6, "text-anchor": "end", "font-size": f.fs * 0.9, "font-weight": 800, fill: C.avg }, g, "평균 " + fmtNum(avg));
    }
  }

  /* 막대그래프 */
  function bar(svg, o) {
    var r = prep(svg, o), C = r.C, f = r.f, S = scaleFns(f), p = f.plot;
    axes(svg, f, o, C);
    var xs = f.items.map(function (_, i) { return S.cat(i); });
    var bw = Math.max(6, Math.min(S.slot * 0.62, 120));
    var bars = el("g", {}, svg);
    var rects = [];
    f.items.forEach(function (it, i) {
      var v = o.drawValues ? o.drawValues[i] : Number(it.value) || 0;
      var color = (o.barColors && o.barColors[i]) || C.bar;
      var rect;
      if (f.horizontal) {
        var x0 = S.val(f.from), x1 = S.val(Math.max(f.from, v));
        rect = el("rect", { x: x0, y: xs[i] - bw / 2, width: Math.max(0, x1 - x0), height: bw, fill: color, rx: 3 }, bars);
        if (o.showValues && v != null && !o.hideValueOf) el("text", { x: x1 + 6, y: xs[i], "dominant-baseline": "central", "font-size": f.fs * 0.9, "font-weight": 800, fill: C.text }, bars, fmtNum(v));
      } else {
        var y0 = S.val(f.from), y1 = S.val(Math.max(f.from, v));
        rect = el("rect", { x: xs[i] - bw / 2, y: y1, width: bw, height: Math.max(0, y0 - y1), fill: color, rx: 3 }, bars);
        if (o.showValues && v != null) el("text", { x: xs[i], y: y1 - 6, "text-anchor": "middle", "font-size": f.fs * 0.9, "font-weight": 800, fill: C.text }, bars, fmtNum(v));
      }
      rect.setAttribute("data-i", i);
      rects.push(rect);
    });
    avgLine(svg, f, S, C, o.avg);
    catLabels(svg, f, C, xs);
    a11y(svg, o, "막대그래프");
    return { frame: f, scale: S, rects: rects, barWidth: bw, colors: C };
  }

  /* 꺾은선그래프 */
  function line(svg, o) {
    var r = prep(svg, o), C = r.C, f = r.f, S = scaleFns(f);
    f.horizontal = false;
    axes(svg, f, o, C);
    var xs = f.items.map(function (_, i) { return S.cat(i); });
    // 세로 보조선(가로 항목마다)
    var gv = el("g", { "aria-hidden": "true" }, svg);
    xs.forEach(function (x) { el("line", { x1: x, y1: f.plot.t, x2: x, y2: f.plot.b, stroke: C.grid, "stroke-width": 1 }, gv); });
    var pts = [];
    f.items.forEach(function (it, i) {
      var v = o.drawValues ? o.drawValues[i] : Number(it.value);
      if (v == null || !isFinite(v)) { pts.push(null); return; }
      pts.push([xs[i], S.val(v), v]);
    });
    var gl = el("g", {}, svg);
    var d = "", started = false;
    pts.forEach(function (pt) { if (!pt) { started = false; return; } d += (started ? "L" : "M") + pt[0].toFixed(1) + " " + pt[1].toFixed(1); started = true; });
    if (d) el("path", { d: d, fill: "none", stroke: C.line, "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" }, gl);
    var dots = [];
    pts.forEach(function (pt, i) {
      if (!pt) { dots.push(null); return; }
      var c = el("circle", { cx: pt[0], cy: pt[1], r: 6, fill: C.point, stroke: C.bg, "stroke-width": 2, "data-i": i }, gl);
      dots.push(c);
      if (o.showValues) el("text", { x: pt[0], y: pt[1] - 12, "text-anchor": "middle", "font-size": f.fs * 0.9, "font-weight": 800, fill: C.text }, gl, fmtNum(pt[2]));
    });
    avgLine(svg, f, S, C, o.avg);
    catLabels(svg, f, C, xs);
    a11y(svg, o, "꺾은선그래프");
    return { frame: f, scale: S, dots: dots, colors: C };
  }

  root.VGraph = { niceStep: niceStep, bar: bar, line: line, colors: DEFAULT_COLORS, fmtNum: fmtNum, el: el, version: "1.0.0" };
})(window);
