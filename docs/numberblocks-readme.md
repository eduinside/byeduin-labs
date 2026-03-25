# 🔢 Numberblocks Finder (넘버블럭스 파인더)

넘버블럭스 학습 자료를 다양한 기준(단계, 학년, 영역)으로 쉽게 탐색하고 검색할 수 있는 반응형 웹 애플리케이션입니다.

## 🚀 주요 특징 (Key Features)

### 1. 지능형 필터 시스템 (Advanced Filtering)
- **3단계 분류**: '단계별', '학년별', '영역별'의 세 가지 모드를 제공합니다.
- **동적 하위 필터**: 선택한 모드에 따라 관련 옵션(예: 1단계~5단계, 유아~초등 등)이 실시간으로 업데이트됩니다.
- **데스크톱/모바일 UI 최적화**: 
  - **Desktop**: 가로 스크롤 가능한 버튼 인터페이스.
  - **Mobile**: 공간 효율을 극대화한 드롭다운(30%:70% 비율) 인터페이스.

### 2. 고도화된 검색 기능 (Smart Search)
- **데스크톱 인터랙션**: 돋보기 아이콘 클릭 시 왼쪽으로 부드럽게 펼쳐지는 확장형 검색바.
- **모바일 인터랙션**: 작은 화면에서도 입력이 편리한 전체 화면 검색 오버레이 및 전용 닫기(✕) 버튼.
- **실시간 필터링**: 입력과 동시에 결과를 보여주는 반응형 검색.

### 3. 반응형 디자인 (Responsive UI/UX)
- **그리드 레이아웃**: 데스크톱의 다단 그리드에서 모바일의 1열 레이아웃으로 유연하게 전환.
- **플로팅 네비게이션**: 모바일에서 상단에 고정된 플로팅 헤더를 통해 언제든 필터를 변경 가능.
- **카드 UI**: 공식 이미지, 제목, 주제, 관련 학년 및 학습 아이디어를 담은 미려한 카드 디자인.

### 4. 성능 및 편의성 (Performance & Ease of Use)
- **무한 로드 (Load More)**: Intersection Observer를 활용하여 스크롤 시 데이터를 효율적으로 추가 로드.
- **공식 링크 연결**: 국내외 공식 유튜브 채널 및 학습 사이트로 즉시 연결되는 바로가기 버튼 제공.

## 🛠 기술 스택 (Tech Stack)

- **Frontend**: Vanilla JS (ES6+), HTML5, CSS3
- **Design**: Flexbox/Grid Layout, Custom CSS Keyframes for Animations
- **Typography**: Google Fonts (Noto Sans KR, Outfit)
- **Data**: JSON 기반 동적 데이터 관리

## 📂 파일 구조

- `index.html`: 메인 구조 및 초기 데이터 포함
- `style.css`: 데스크톱 및 모바일(Media Query) 레이아웃 정의
- `app.js`: 필터링, 검색, 렌더링, 무한 스크롤 등 핵심 비즈니스 로직
- `data-content.json`: 외부 리소스 데이터베이스

---
*Developed for Numberblocks Fans and Educators.*
