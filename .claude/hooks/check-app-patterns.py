#!/usr/bin/env python3
"""
PostToolUse 훅: public/ 앱 HTML 파일에 공통 패턴 누락 여부 검사
- /common/hero-theme.css 링크
- /common/theme.js 스크립트
- .top-overlay-left (홈 버튼)
- .top-overlay (테마/공유 버튼)
"""
import sys
import json
import os
import re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

file_path = (data.get("tool_input") or {}).get("file_path", "")
if not file_path:
    sys.exit(0)

# 정규화 (백슬래시 → 슬래시)
file_path = file_path.replace("\\", "/")

# public/ 하위 .html 파일만 검사
if not re.search(r"public/.+\.html$", file_path):
    sys.exit(0)

# public/index.html (포털 메인)은 오버레이 불필요
if file_path.endswith("public/index.html"):
    sys.exit(0)

try:
    with open(file_path, encoding="utf-8") as f:
        content = f.read()
except Exception:
    sys.exit(0)

checks = [
    ("/common/hero-theme.css", "hero-theme.css 링크"),
    ("/common/theme.js",       "theme.js 스크립트"),
    ("top-overlay-left",       "top-overlay-left (홈 버튼)"),
    ('"top-overlay"',          "top-overlay (테마/공유)"),
]

missing = [label for pattern, label in checks if pattern not in content]

if not missing:
    sys.exit(0)

basename = os.path.basename(file_path)
dirname = os.path.basename(os.path.dirname(file_path))
msg = f"⚠️ [공통 패턴 누락] {dirname}/{basename}: {', '.join(missing)}"

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": msg
    }
}))
