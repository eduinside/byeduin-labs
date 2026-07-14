/* ================================================================
   world-landmarks — 조사 보고서 모드 데이터 (24개국)
   대륙별 배분: 아시아 7 · 유럽 6 · 아프리카 3 · 북아메리카 3 · 남아메리카 3 · 오세아니아 2
   프레이밍 규칙: "~중 하나", 우열 비교 금지 (docs/world-landmarks-plan.md §2)
   landmarkId: 탐험 여권 모드의 LANDMARKS와 연결(기존 11개국만)
   lat/lng: 수도 좌표 — 위치 지도 점 표시용
   ================================================================ */
window.WL_COUNTRIES = [
  /* ── 아시아 (7) ── */
  {
    id: 'kr', nameKo: '대한민국', continent: 'asia', landmarkId: 'gyeongbokgung',
    lat: 37.57, lng: 126.98,
    flag: { meaning: '흰 바탕은 평화를, 가운데 태극 무늬는 조화를, 네 모서리의 괘는 하늘·땅·물·불을 뜻해요.' },
    location: { desc: '아시아 대륙의 동쪽 끝, 한반도의 남쪽에 있는 나라예요. 삼면이 바다로 둘러싸여 있어요.' },
    capital: { name: '서울', desc: '600년 넘게 이어져 온 수도로, 옛 궁궐과 높은 빌딩이 함께 어우러져 있어요.' },
    greeting: { text: '안녕하세요', korean: '안녕하세요' },
    foods: [
      { name: '비빔밥', emoji: '🍚', desc: '밥 위에 여러 가지 나물과 고추장을 넣어 비벼 먹는 음식이에요.' },
      { name: '김치', emoji: '🥬', desc: '배추 등을 양념에 절여 만든, 식탁에 자주 오르는 반찬이에요.' }
    ],
    prides: [
      { name: '경복궁', emoji: '🏯', desc: '조선 시대를 대표하는 궁궐로, 아름다운 기와지붕이 특징이에요.' },
      { name: '한글', emoji: '📝', desc: '소리 나는 원리를 본떠 과학적으로 만들어진 문자예요.' }
    ],
    cultures: [
      { name: '한복', emoji: '👘', desc: '명절이나 특별한 날 입기도 하는 전통 옷 중 하나예요.' },
      { name: '태권도', emoji: '🥋', desc: '한국에서 시작되어 전 세계 사람들이 배우는 무예예요.' }
    ]
  },
  {
    id: 'cn', nameKo: '중국', continent: 'asia', landmarkId: 'greatwall',
    lat: 39.9, lng: 116.4,
    flag: { meaning: '붉은 바탕에 큰 별 하나와 작은 별 네 개가 그려져 있어 "오성홍기"라고 불러요.' },
    location: { desc: '아시아 대륙 동쪽에 있는, 세계에서 인구가 가장 많은 나라 중 하나예요.' },
    capital: { name: '베이징', desc: '자금성 같은 옛 궁궐과 현대적인 건물이 함께 있는 큰 도시예요.' },
    greeting: { text: '니하오 (你好)', korean: '니하오' },
    foods: [
      { name: '만두', emoji: '🥟', desc: '얇은 피에 고기와 채소를 넣어 빚은 음식으로, 종류가 아주 다양해요.' },
      { name: '베이징덕', emoji: '🦆', desc: '오리를 통째로 구워 얇은 전병에 싸 먹는 베이징의 대표 요리 중 하나예요.' }
    ],
    prides: [
      { name: '만리장성', emoji: '🧱', desc: '산줄기를 따라 아주 길게 이어진 고대의 성벽이에요.' },
      { name: '판다', emoji: '🐼', desc: '중국에서만 야생으로 사는, 대나무를 먹는 동물이에요.' }
    ],
    cultures: [
      { name: '치파오', emoji: '👘', desc: '몸에 붙는 원피스 모양의 전통 옷 중 하나예요.' },
      { name: '경극', emoji: '🎭', desc: '화려한 분장과 노래로 이야기를 들려주는 전통 공연이에요.' }
    ]
  },
  {
    id: 'in', nameKo: '인도', continent: 'asia', landmarkId: 'tajmahal',
    lat: 28.6, lng: 77.2,
    flag: { meaning: '주황·하양·초록 세 가지 색과 가운데 24개의 살이 달린 바퀴(아소카 차크라)가 그려져 있어요.' },
    location: { desc: '아시아 남쪽에 있는 큰 반도 나라로, 인구가 세계에서 가장 많은 나라 중 하나예요.' },
    capital: { name: '뉴델리', desc: '오래된 유적과 새로운 건물이 함께 있는 인도의 수도예요.' },
    greeting: { text: '나마스테 (नमस्ते)', korean: '나마스테' },
    foods: [
      { name: '카레', emoji: '🍛', desc: '여러 가지 향신료를 섞어 만든, 인도를 대표하는 음식 중 하나예요.' },
      { name: '난', emoji: '🫓', desc: '화덕에 구운 납작한 빵으로, 카레와 함께 자주 먹어요.' }
    ],
    prides: [
      { name: '타지마할', emoji: '🕌', desc: '하얀 대리석으로 지은, 좌우가 똑같이 대칭인 아름다운 건축물이에요.' },
      { name: '요가', emoji: '🧘', desc: '인도에서 시작되어 전 세계 사람들이 즐기는 운동이에요.' }
    ],
    cultures: [
      { name: '사리', emoji: '👗', desc: '긴 천을 몸에 둘러 입는 전통 옷 중 하나예요.' },
      { name: '디왈리', emoji: '🪔', desc: '집집마다 등불을 밝히는 "빛의 축제"예요.' }
    ]
  },
  {
    id: 'kh', nameKo: '캄보디아', continent: 'asia', landmarkId: 'angkorwat',
    lat: 11.6, lng: 104.9,
    flag: { meaning: '국기 한가운데 앙코르와트 사원이 그려진, 세계에서 보기 드문 국기예요.' },
    location: { desc: '아시아 남동쪽, 인도차이나 반도에 있는 나라예요. 큰 호수 톤레삽이 있어요.' },
    capital: { name: '프놈펜', desc: '메콩강 근처에 자리 잡은 캄보디아의 수도예요.' },
    greeting: { text: '쑤어스데이 (សួស្តី)', korean: '쑤어스데이' },
    foods: [
      { name: '아목', emoji: '🍲', desc: '생선과 코코넛 밀크로 만든 부드러운 찜 요리예요.' },
      { name: '놈반쪽', emoji: '🍜', desc: '쌀로 만든 국수에 국물을 부어 먹는 음식이에요.' }
    ],
    prides: [
      { name: '앙코르와트', emoji: '🛕', desc: '세계에서 가장 큰 종교 건축물로 꼽히는 거대한 사원이에요.' },
      { name: '톤레삽 호수', emoji: '🛶', desc: '물 위에 집을 짓고 사는 수상 마을이 있는 큰 호수예요.' }
    ],
    cultures: [
      { name: '샘폿', emoji: '👗', desc: '허리에 두르는 긴 천 모양의 전통 옷 중 하나예요.' },
      { name: '압사라 춤', emoji: '💃', desc: '손끝 동작이 아름다운 캄보디아의 전통 춤이에요.' }
    ]
  },
  {
    id: 'jp', nameKo: '일본', continent: 'asia',
    lat: 35.7, lng: 139.7,
    flag: { meaning: '흰 바탕의 붉은 원은 떠오르는 해를 뜻해서 "일장기"라고 불러요.' },
    location: { desc: '아시아 동쪽 바다에 있는 섬나라로, 4개의 큰 섬과 많은 작은 섬으로 이루어져 있어요.' },
    capital: { name: '도쿄', desc: '세계에서 인구가 많은 도시 중 하나로, 전통과 첨단 기술이 함께 있어요.' },
    greeting: { text: '곤니치와 (こんにちは)', korean: '곤니치와' },
    foods: [
      { name: '스시', emoji: '🍣', desc: '식초로 간한 밥 위에 생선 등을 올린 음식이에요.' },
      { name: '라멘', emoji: '🍜', desc: '진한 국물에 면을 말아 먹는, 지역마다 맛이 다른 음식이에요.' }
    ],
    prides: [
      { name: '후지산', emoji: '🗻', desc: '눈 덮인 봉우리가 아름다운 일본에서 가장 높은 산이에요.' },
      { name: '신칸센', emoji: '🚄', desc: '아주 빠른 속도로 달리는 고속 열차예요.' }
    ],
    cultures: [
      { name: '기모노', emoji: '👘', desc: '허리에 넓은 띠를 두르는 전통 옷 중 하나예요.' },
      { name: '마츠리', emoji: '🏮', desc: '등불과 가마 행렬이 있는 여름 축제예요.' }
    ]
  },
  {
    id: 'vn', nameKo: '베트남', continent: 'asia',
    lat: 21.0, lng: 105.8,
    flag: { meaning: '붉은 바탕에 노란 별 하나가 그려져 있어 "금성홍기"라고 불러요.' },
    location: { desc: '아시아 남동쪽, 남북으로 길쭉하게 뻗어 있는 나라예요. 바다를 따라 해안선이 길어요.' },
    capital: { name: '하노이', desc: '천 년이 넘는 역사를 가진 베트남의 수도예요.' },
    greeting: { text: '신짜오 (Xin chào)', korean: '신짜오' },
    foods: [
      { name: '쌀국수', emoji: '🍜', desc: '맑은 국물에 쌀로 만든 면을 넣어 먹는 음식으로 "퍼"라고 불러요.' },
      { name: '반미', emoji: '🥖', desc: '바삭한 바게트 빵 사이에 채소와 고기를 넣은 샌드위치예요.' }
    ],
    prides: [
      { name: '하롱베이', emoji: '⛰️', desc: '바다 위에 수천 개의 바위섬이 솟아 있는 신비로운 곳이에요.' },
      { name: '메콩강', emoji: '🚣', desc: '여러 나라를 지나 베트남 바다로 흘러드는 큰 강이에요.' }
    ],
    cultures: [
      { name: '아오자이', emoji: '👗', desc: '긴 윗옷과 바지를 함께 입는 전통 옷 중 하나예요.' },
      { name: '수상 인형극', emoji: '🎭', desc: '물 위에서 인형을 움직여 이야기를 들려주는 전통 공연이에요.' }
    ]
  },
  {
    id: 'sa', nameKo: '사우디아라비아', continent: 'asia',
    lat: 24.7, lng: 46.7,
    flag: { meaning: '초록 바탕에 아랍어 글귀와 칼이 그려져 있어요. 초록은 이슬람교에서 소중히 여기는 색이에요.' },
    location: { desc: '아시아 서쪽 아라비아 반도의 대부분을 차지하는, 사막이 넓은 나라예요.' },
    capital: { name: '리야드', desc: '사막 한가운데 세워진 크고 현대적인 도시예요.' },
    greeting: { text: '앗살라무 알라이쿰 (السلام عليكم)', korean: '앗살라무 알라이쿰' },
    foods: [
      { name: '캅사', emoji: '🍚', desc: '향신료로 지은 쌀밥 위에 고기를 올린 대표 요리 중 하나예요.' },
      { name: '대추야자', emoji: '🌴', desc: '사막에서 자라는 달콤한 열매로, 손님에게 대접하는 귀한 간식이에요.' }
    ],
    prides: [
      { name: '룹알할리 사막', emoji: '🏜️', desc: '모래 언덕이 끝없이 펼쳐진 세계에서 손꼽히게 큰 사막이에요.' },
      { name: '석유', emoji: '🛢️', desc: '땅속에서 나오는 석유가 아주 많이 생산되는 나라예요.' }
    ],
    cultures: [
      { name: '토브와 아바야', emoji: '🥻', desc: '더운 날씨와 문화에 맞게 몸을 감싸는 전통 옷이에요.' },
      { name: '라마단과 이드', emoji: '🌙', desc: '한 달간의 금식이 끝나면 가족이 모여 축제를 열어요.' }
    ]
  },

  /* ── 유럽 (6) ── */
  {
    id: 'fr', nameKo: '프랑스', continent: 'europe', landmarkId: 'eiffel',
    lat: 48.86, lng: 2.35,
    flag: { meaning: '파랑·하양·빨강 세로 삼색기로, 자유·평등·박애의 정신을 담고 있어요.' },
    location: { desc: '유럽 서쪽에 있는 나라로, 대서양과 지중해 두 바다를 모두 만나요.' },
    capital: { name: '파리', desc: '"예술의 도시"라고 불리며, 에펠탑과 미술관이 많은 곳이에요.' },
    greeting: { text: '봉주르 (Bonjour)', korean: '봉주르' },
    foods: [
      { name: '바게트', emoji: '🥖', desc: '겉은 바삭하고 속은 부드러운 길쭉한 빵이에요.' },
      { name: '크루아상', emoji: '🥐', desc: '버터를 넣어 겹겹이 구운 초승달 모양의 빵이에요.' }
    ],
    prides: [
      { name: '에펠탑', emoji: '🗼', desc: '철골을 그물처럼 엮어 만든 파리의 상징이에요.' },
      { name: '루브르 박물관', emoji: '🖼️', desc: '모나리자 등 세계적인 예술 작품이 모여 있는 박물관이에요.' }
    ],
    cultures: [
      { name: '미술과 패션', emoji: '🎨', desc: '많은 화가와 디자이너가 활동해 온 예술의 나라예요.' },
      { name: '혁명 기념일', emoji: '🎆', desc: '7월 14일이면 온 나라가 불꽃놀이로 축제를 즐겨요.' }
    ]
  },
  {
    id: 'gb', nameKo: '영국', continent: 'europe', landmarkId: 'bigben',
    lat: 51.5, lng: -0.13,
    flag: { meaning: '잉글랜드·스코틀랜드·아일랜드의 십자가 무늬를 겹쳐 만든 "유니언 잭"이에요.' },
    location: { desc: '유럽 서쪽 바다에 있는 섬나라로, 잉글랜드·스코틀랜드·웨일스·북아일랜드로 이루어져 있어요.' },
    capital: { name: '런던', desc: '템스강이 흐르는 오래된 도시로, 빅벤과 2층 버스로 유명해요.' },
    greeting: { text: '헬로 (Hello)', korean: '헬로' },
    foods: [
      { name: '피시앤칩스', emoji: '🍟', desc: '생선 튀김과 감자튀김을 함께 먹는 대표 음식 중 하나예요.' },
      { name: '애프터눈 티', emoji: '🫖', desc: '오후에 차와 과자를 함께 즐기는 문화에서 나온 간식이에요.' }
    ],
    prides: [
      { name: '빅벤', emoji: '🏛️', desc: '국회의사당 옆에 우뚝 선 거대한 시계탑이에요.' },
      { name: '셰익스피어', emoji: '📚', desc: '전 세계에서 읽히는 이야기를 쓴 영국의 작가예요.' }
    ],
    cultures: [
      { name: '근위병 교대식', emoji: '💂', desc: '붉은 옷과 큰 털모자를 쓴 근위병이 궁전을 지켜요.' },
      { name: '축구', emoji: '⚽', desc: '현대 축구의 규칙이 만들어진 나라로, 축구를 아주 사랑해요.' }
    ]
  },
  {
    id: 'it', nameKo: '이탈리아', continent: 'europe', landmarkId: 'colosseum',
    lat: 41.9, lng: 12.5,
    flag: { meaning: '초록·하양·빨강 세로 삼색기예요. 프랑스 국기와 비슷하지만 색이 달라요.' },
    location: { desc: '유럽 남쪽, 지중해로 뻗은 장화 모양의 반도 나라예요.' },
    capital: { name: '로마', desc: '2천 년 넘은 유적이 도시 곳곳에 남아 있어 "야외 박물관"이라 불려요.' },
    greeting: { text: '차오 (Ciao)', korean: '차오' },
    foods: [
      { name: '피자', emoji: '🍕', desc: '밀가루 반죽 위에 토마토소스와 치즈를 올려 구운 음식이에요.' },
      { name: '파스타', emoji: '🍝', desc: '여러 모양의 면을 소스와 함께 먹는, 종류가 아주 많은 음식이에요.' }
    ],
    prides: [
      { name: '콜로세움', emoji: '🏛️', desc: '고대 로마 사람들이 지은 거대한 원형 경기장이에요.' },
      { name: '피사의 사탑', emoji: '🗼', desc: '한쪽으로 기울어진 채 서 있는 신기한 탑이에요.' }
    ],
    cultures: [
      { name: '베네치아 가면 축제', emoji: '🎭', desc: '화려한 가면과 옷을 입고 즐기는 물의 도시 축제예요.' },
      { name: '오페라', emoji: '🎶', desc: '노래로 이야기를 들려주는 공연 예술이 발달했어요.' }
    ]
  },
  {
    id: 'de', nameKo: '독일', continent: 'europe',
    lat: 52.5, lng: 13.4,
    flag: { meaning: '검정·빨강·노랑(금색) 가로 삼색기로, 자유를 향한 역사를 담고 있어요.' },
    location: { desc: '유럽 한가운데 있어 9개 나라와 국경을 맞대고 있는 나라예요.' },
    capital: { name: '베를린', desc: '나뉘어 있던 도시가 하나로 합쳐진 역사를 가진 수도예요.' },
    greeting: { text: '구텐 탁 (Guten Tag)', korean: '구텐 탁' },
    foods: [
      { name: '소시지', emoji: '🌭', desc: '지역마다 종류가 다른 소시지가 천 가지가 넘는다고 해요.' },
      { name: '프레첼', emoji: '🥨', desc: '매듭 모양으로 구운 짭짤한 빵이에요.' }
    ],
    prides: [
      { name: '자동차', emoji: '🚗', desc: '세계적으로 유명한 자동차를 만드는 기술의 나라예요.' },
      { name: '그림 형제 동화', emoji: '📖', desc: '백설공주, 헨젤과 그레텔 같은 동화를 모은 형제가 살았어요.' }
    ],
    cultures: [
      { name: '옥토버페스트', emoji: '🎪', desc: '가을마다 열리는 세계에서 손꼽히게 큰 축제예요.' },
      { name: '크리스마스 마켓', emoji: '🎄', desc: '겨울이면 광장마다 반짝이는 크리스마스 시장이 열려요.' }
    ]
  },
  {
    id: 'es', nameKo: '스페인', continent: 'europe',
    lat: 40.4, lng: -3.7,
    flag: { meaning: '빨강·노랑 가로줄에 나라의 문장이 그려져 있어요.' },
    location: { desc: '유럽 남서쪽 이베리아 반도에 있는 나라로, 햇살이 풍부해요.' },
    capital: { name: '마드리드', desc: '스페인 한가운데 있는 수도로, 큰 광장과 미술관이 많아요.' },
    greeting: { text: '올라 (Hola)', korean: '올라' },
    foods: [
      { name: '파에야', emoji: '🥘', desc: '큰 팬에 쌀과 해산물을 넣어 만든 노란 볶음밥 요리예요.' },
      { name: '츄러스', emoji: '🍩', desc: '길쭉하게 튀긴 빵을 초콜릿에 찍어 먹는 간식이에요.' }
    ],
    prides: [
      { name: '사그라다 파밀리아', emoji: '⛪', desc: '100년 넘게 짓고 있는 가우디의 독특한 성당이에요.' },
      { name: '알람브라 궁전', emoji: '🏰', desc: '섬세한 무늬로 꾸며진 아름다운 옛 궁전이에요.' }
    ],
    cultures: [
      { name: '플라멩코', emoji: '💃', desc: '기타 소리에 맞춰 발을 구르며 추는 정열적인 춤이에요.' },
      { name: '라 토마티나', emoji: '🍅', desc: '토마토를 던지며 즐기는 독특한 여름 축제예요.' }
    ]
  },
  {
    id: 'ru', nameKo: '러시아', continent: 'europe',
    lat: 55.8, lng: 37.6,
    flag: { meaning: '하양·파랑·빨강 가로 삼색기예요.' },
    location: { desc: '유럽과 아시아에 걸쳐 있는, 세계에서 영토가 가장 넓은 나라예요.' },
    capital: { name: '모스크바', desc: '알록달록한 양파 모양 지붕의 성당과 붉은 광장이 있는 수도예요.' },
    greeting: { text: '즈드라스트부이체 (Здравствуйте)', korean: '즈드라스트부이체' },
    foods: [
      { name: '보르시', emoji: '🍲', desc: '붉은 채소(비트)를 넣어 끓인 빨간 수프예요.' },
      { name: '블리니', emoji: '🥞', desc: '얇게 부친 팬케이크에 여러 가지를 싸 먹는 음식이에요.' }
    ],
    prides: [
      { name: '넓은 영토', emoji: '🗺️', desc: '나라가 너무 넓어서 동쪽과 서쪽의 시간이 크게 달라요.' },
      { name: '시베리아 횡단 열차', emoji: '🚂', desc: '일주일 넘게 달리는 세계에서 가장 긴 철도가 있어요.' }
    ],
    cultures: [
      { name: '마트료시카', emoji: '🪆', desc: '인형 속에 인형이 계속 나오는 전통 목각 인형이에요.' },
      { name: '발레', emoji: '🩰', desc: '백조의 호수 같은 발레 공연 예술이 발달했어요.' }
    ]
  },

  /* ── 아프리카 (3) ── */
  {
    id: 'eg', nameKo: '이집트', continent: 'africa', landmarkId: 'pyramid',
    lat: 30.0, lng: 31.2,
    flag: { meaning: '빨강·하양·검정 가로줄에 금색 독수리가 그려져 있어요.' },
    location: { desc: '아프리카 북동쪽에 있으며, 나라를 가로질러 나일강이 흘러요.' },
    capital: { name: '카이로', desc: '나일강 옆에 자리 잡은 아프리카에서 손꼽히게 큰 도시예요.' },
    greeting: { text: '마르하반 (مرحبا)', korean: '마르하반' },
    foods: [
      { name: '코샤리', emoji: '🍝', desc: '쌀·파스타·콩을 한 그릇에 담고 소스를 뿌린 음식이에요.' },
      { name: '팔라펠', emoji: '🧆', desc: '콩을 갈아 동그랗게 튀긴 고소한 음식이에요.' }
    ],
    prides: [
      { name: '피라미드와 스핑크스', emoji: '📐', desc: '수천 년 전 거대한 돌을 쌓아 만든 왕의 무덤이에요.' },
      { name: '나일강', emoji: '🏞️', desc: '세계에서 손꼽히게 긴 강으로, 사막에 생명을 불어넣어요.' }
    ],
    cultures: [
      { name: '상형문자', emoji: '📜', desc: '그림처럼 생긴 고대 이집트의 문자로, 파피루스에 기록했어요.' },
      { name: '고대 유물', emoji: '🏺', desc: '황금 가면 등 수천 년 된 보물이 박물관에 가득해요.' }
    ]
  },
  {
    id: 'ke', nameKo: '케냐', continent: 'africa',
    lat: -1.3, lng: 36.8,
    flag: { meaning: '검정·빨강·초록 줄무늬 가운데 마사이족의 방패와 창이 그려져 있어요.' },
    location: { desc: '아프리카 동쪽에 있으며, 나라 한가운데로 적도가 지나가요.' },
    capital: { name: '나이로비', desc: '도시 바로 옆에 야생동물 국립공원이 있는 특별한 수도예요.' },
    greeting: { text: '잠보 (Jambo)', korean: '잠보' },
    foods: [
      { name: '우갈리', emoji: '🌽', desc: '옥수수 가루를 반죽해 만든, 밥처럼 먹는 주식이에요.' },
      { name: '냐마 초마', emoji: '🍖', desc: '숯불에 구운 고기로, 잔칫날 함께 나눠 먹어요.' }
    ],
    prides: [
      { name: '사파리', emoji: '🦁', desc: '사자·코끼리·기린 같은 야생동물을 초원에서 볼 수 있어요.' },
      { name: '마라톤 선수들', emoji: '🏃', desc: '세계 마라톤 대회에서 뛰어난 선수들이 많이 나와요.' }
    ],
    cultures: [
      { name: '마사이족 구슬 장식', emoji: '📿', desc: '알록달록한 구슬로 목걸이와 장신구를 만드는 전통이 있어요.' },
      { name: '스와힐리어', emoji: '👋', desc: '"하쿠나 마타타(걱정 없어)"라는 말이 이 언어에서 왔어요.' }
    ]
  },
  {
    id: 'za', nameKo: '남아프리카공화국', continent: 'africa',
    lat: -25.7, lng: 28.2,
    flag: { meaning: '여섯 가지 색이 Y자로 어우러진 국기로, 다양한 사람들의 화합을 뜻해요.' },
    location: { desc: '아프리카 대륙의 가장 남쪽 끝에 있는 나라예요. 두 대양(대서양·인도양)이 만나요.' },
    capital: { name: '프리토리아', desc: '행정 수도예요. 이 나라는 도시 세 곳이 수도의 역할을 나누어 맡고 있어요.' },
    greeting: { text: '사우보나 (Sawubona)', korean: '사우보나' },
    foods: [
      { name: '브라이', emoji: '🍖', desc: '가족과 이웃이 모여 함께 즐기는 바비큐 문화예요.' },
      { name: '보보티', emoji: '🍛', desc: '향신료로 양념한 고기 위에 달걀을 부어 구운 요리예요.' }
    ],
    prides: [
      { name: '테이블마운틴', emoji: '⛰️', desc: '꼭대기가 탁자처럼 평평한 신기한 산이에요.' },
      { name: '넬슨 만델라', emoji: '✊', desc: '차별에 맞서 화해와 평화를 이끈 지도자예요.' }
    ],
    cultures: [
      { name: '무지개 나라', emoji: '🌈', desc: '다양한 민족이 함께 살아 공용어가 11개가 넘어요.' },
      { name: '줄루족 전통 춤', emoji: '💃', desc: '힘차게 발을 구르며 추는 전통 춤이 있어요.' }
    ]
  },

  /* ── 북아메리카 (3) ── */
  {
    id: 'us', nameKo: '미국', continent: 'namerica', landmarkId: 'liberty',
    lat: 38.9, lng: -77.0,
    flag: { meaning: '50개의 별은 지금의 주(州)를, 13개의 줄은 처음 세워진 13개 주를 뜻해요.' },
    location: { desc: '북아메리카 대륙 가운데에 있는 넓은 나라로, 대서양과 태평양을 모두 만나요.' },
    capital: { name: '워싱턴 D.C.', desc: '뉴욕이 아니라 워싱턴 D.C.가 수도예요. 백악관이 있는 도시예요.' },
    greeting: { text: '헬로 (Hello)', korean: '헬로' },
    foods: [
      { name: '햄버거', emoji: '🍔', desc: '빵 사이에 고기와 채소를 끼운, 전 세계로 퍼진 음식이에요.' },
      { name: '핫도그', emoji: '🌭', desc: '길쭉한 빵에 소시지를 끼워 간편하게 먹는 음식이에요.' }
    ],
    prides: [
      { name: '자유의 여신상', emoji: '🗽', desc: '뉴욕 앞바다 섬에서 횃불을 들고 서 있는 거대한 동상이에요.' },
      { name: '그랜드캐니언', emoji: '🏜️', desc: '강물이 오랜 세월 깎아 만든 거대한 협곡이에요.' }
    ],
    cultures: [
      { name: '할로윈', emoji: '🎃', desc: '10월이면 분장을 하고 "트릭 오어 트릿!"을 외치는 축제예요.' },
      { name: '스포츠', emoji: '⚾', desc: '야구·농구·미식축구 등 다양한 스포츠를 즐겨요.' }
    ]
  },
  {
    id: 'ca', nameKo: '캐나다', continent: 'namerica',
    lat: 45.4, lng: -75.7,
    flag: { meaning: '빨강-하양-빨강 바탕 가운데 붉은 단풍잎 하나가 그려져 있어요.' },
    location: { desc: '북아메리카 북쪽에 있는, 세계에서 두 번째로 넓은 나라예요.' },
    capital: { name: '오타와', desc: '겨울이면 강이 얼어 스케이트장이 되는 수도예요.' },
    greeting: { text: '헬로 / 봉주르', korean: '헬로, 봉주르' },
    foods: [
      { name: '메이플 시럽 팬케이크', emoji: '🥞', desc: '단풍나무 수액으로 만든 달콤한 시럽을 듬뿍 뿌려 먹어요.' },
      { name: '푸틴', emoji: '🍟', desc: '감자튀김에 치즈와 그레이비 소스를 얹은 음식이에요.' }
    ],
    prides: [
      { name: '나이아가라 폭포', emoji: '💧', desc: '엄청난 물이 쏟아지는 세계적으로 유명한 폭포예요.' },
      { name: '오로라', emoji: '🌌', desc: '북쪽 하늘에서 초록빛 커튼처럼 빛나는 자연 현상을 볼 수 있어요.' }
    ],
    cultures: [
      { name: '아이스하키', emoji: '🏒', desc: '얼음 위에서 펼쳐지는, 캐나다 사람들이 사랑하는 스포츠예요.' },
      { name: '두 가지 공용어', emoji: '🗣️', desc: '영어와 프랑스어를 모두 공용어로 사용해요.' }
    ]
  },
  {
    id: 'mx', nameKo: '멕시코', continent: 'namerica',
    lat: 19.4, lng: -99.1,
    flag: { meaning: '초록·하양·빨강 바탕 가운데, 선인장 위에서 뱀을 문 독수리가 그려져 있어요.' },
    location: { desc: '북아메리카 남쪽에 있는 나라로, 미국과 국경을 맞대고 있어요.' },
    capital: { name: '멕시코시티', desc: '옛 아즈텍의 도시 위에 세워진, 높은 곳에 있는 큰 수도예요.' },
    greeting: { text: '올라 (Hola)', korean: '올라' },
    foods: [
      { name: '타코', emoji: '🌮', desc: '옥수수 전병에 고기와 채소를 싸 먹는 대표 음식 중 하나예요.' },
      { name: '토르티야', emoji: '🫓', desc: '옥수수 가루로 만든 얇고 납작한 빵이에요.' }
    ],
    prides: [
      { name: '마야·아즈텍 피라미드', emoji: '🛕', desc: '옛 문명이 세운 계단 모양의 거대한 피라미드가 남아 있어요.' },
      { name: '선인장', emoji: '🌵', desc: '사막에서 자라는 다양한 선인장이 국기에도 그려질 만큼 특별해요.' }
    ],
    cultures: [
      { name: '죽은 자들의 날', emoji: '🌼', desc: '노란 꽃과 해골 분장으로 조상을 기억하는 축제예요.' },
      { name: '마리아치', emoji: '🎺', desc: '전통 옷을 입고 기타와 트럼펫을 연주하는 악단 음악이에요.' }
    ]
  },

  /* ── 남아메리카 (3) ── */
  {
    id: 'br', nameKo: '브라질', continent: 'samerica', landmarkId: 'amazon',
    lat: -15.8, lng: -47.9,
    flag: { meaning: '초록 바탕에 노란 마름모, 그 안에 별이 그려진 파란 지구가 있어요.' },
    location: { desc: '남아메리카에서 가장 넓은 나라로, 대륙의 절반 가까이를 차지해요.' },
    capital: { name: '브라질리아', desc: '비행기 모양으로 계획해서 새로 만든 수도예요.' },
    greeting: { text: '올라 (Olá)', korean: '올라' },
    foods: [
      { name: '슈하스코', emoji: '🥩', desc: '큰 꼬치에 고기를 꽂아 구운 브라질식 바비큐예요.' },
      { name: '아사이볼', emoji: '🫐', desc: '아마존 열매 아사이를 갈아 과일과 함께 먹는 간식이에요.' }
    ],
    prides: [
      { name: '아마존 열대우림', emoji: '🌿', desc: '"지구의 허파"라고 불리는 세계에서 가장 큰 열대우림이에요.' },
      { name: '리우 예수상', emoji: '⛰️', desc: '산꼭대기에서 두 팔을 벌리고 도시를 내려다보는 큰 조각상이에요.' }
    ],
    cultures: [
      { name: '리우 카니발', emoji: '🎉', desc: '화려한 옷을 입고 거리에서 춤추는 세계적인 축제예요.' },
      { name: '삼바', emoji: '💃', desc: '빠른 북소리에 맞춰 추는 브라질의 전통 춤이에요.' }
    ]
  },
  {
    id: 'ar', nameKo: '아르헨티나', continent: 'samerica',
    lat: -34.6, lng: -58.4,
    flag: { meaning: '하늘색·하양 줄무늬 가운데 사람 얼굴이 있는 "5월의 태양"이 그려져 있어요.' },
    location: { desc: '남아메리카 남쪽에 길게 뻗어 있는 나라로, 남쪽 끝은 남극과 가까워요.' },
    capital: { name: '부에노스아이레스', desc: '"남미의 파리"라고 불리는 유럽풍의 아름다운 수도예요.' },
    greeting: { text: '올라 (Hola)', korean: '올라' },
    foods: [
      { name: '아사도', emoji: '🥩', desc: '숯불에 천천히 구운 고기로, 주말에 가족이 모여 먹어요.' },
      { name: '엠파나다', emoji: '🥟', desc: '고기나 치즈를 넣고 반달 모양으로 구운 만두 같은 빵이에요.' }
    ],
    prides: [
      { name: '이구아수 폭포', emoji: '💦', desc: '수백 개의 물줄기가 쏟아지는 거대한 폭포예요.' },
      { name: '축구 영웅들', emoji: '⚽', desc: '메시 등 세계적인 축구 선수들이 태어난 나라예요.' }
    ],
    cultures: [
      { name: '탱고', emoji: '💃', desc: '두 사람이 호흡을 맞춰 추는 정열적인 춤이에요.' },
      { name: '가우초', emoji: '🐎', desc: '넓은 초원에서 말을 타고 소를 돌보는 목동 문화가 있어요.' }
    ]
  },
  {
    id: 'pe', nameKo: '페루', continent: 'samerica',
    lat: -12.0, lng: -77.0,
    flag: { meaning: '빨강-하양-빨강 세로줄로 이루어져 있고, 가운데에 나라 문장을 넣기도 해요.' },
    location: { desc: '남아메리카 서쪽, 안데스산맥이 지나가는 나라예요.' },
    capital: { name: '리마', desc: '태평양 바닷가에 자리 잡은 페루의 수도예요.' },
    greeting: { text: '올라 (Hola)', korean: '올라' },
    foods: [
      { name: '세비체', emoji: '🐟', desc: '신선한 생선을 라임즙에 재워 만든 새콤한 요리예요.' },
      { name: '감자 요리', emoji: '🥔', desc: '감자의 고향이라 불릴 만큼 감자 종류가 수천 가지예요.' }
    ],
    prides: [
      { name: '마추픽추', emoji: '⛰️', desc: '높은 산꼭대기에 숨어 있던 잉카 문명의 공중 도시예요.' },
      { name: '나스카 지상화', emoji: '🛩️', desc: '하늘에서만 보이는 거대한 그림이 사막에 그려져 있어요.' }
    ],
    cultures: [
      { name: '잉카 문명', emoji: '🏺', desc: '돌을 정교하게 쌓아 도시를 만든 옛 문명의 문화가 이어져요.' },
      { name: '알파카 털옷', emoji: '🦙', desc: '알파카의 털로 따뜻하고 알록달록한 옷을 만들어요.' }
    ]
  },

  /* ── 오세아니아 (2) ── */
  {
    id: 'au', nameKo: '호주', continent: 'oceania', landmarkId: 'opera',
    lat: -35.3, lng: 149.1,
    flag: { meaning: '파란 바탕에 유니언 잭과 남반구 하늘의 별자리(남십자성)가 그려져 있어요.' },
    location: { desc: '오세아니아에 있는, 대륙 하나가 통째로 한 나라인 곳이에요.' },
    capital: { name: '캔버라', desc: '시드니가 아니라 캔버라가 수도예요. 계획해서 만든 도시랍니다.' },
    greeting: { text: '지데이 (G\'day)', korean: '지데이' },
    foods: [
      { name: '미트 파이', emoji: '🥧', desc: '고기를 넣어 구운 작은 파이로, 간식처럼 즐겨 먹어요.' },
      { name: '바비큐', emoji: '🍖', desc: '공원 곳곳에 바비큐 시설이 있을 만큼 야외 요리를 즐겨요.' }
    ],
    prides: [
      { name: '오페라하우스', emoji: '⛵', desc: '조개껍질 모양 지붕이 아름다운 시드니의 공연장이에요.' },
      { name: '캥거루와 코알라', emoji: '🦘', desc: '호주에서만 사는 특별한 동물들이에요.' }
    ],
    cultures: [
      { name: '서핑', emoji: '🏄', desc: '아름다운 해변이 많아 서핑 문화가 발달했어요.' },
      { name: '원주민 예술', emoji: '🎨', desc: '점을 찍어 그리는 애버리진(원주민)의 전통 그림이 유명해요.' }
    ]
  },
  {
    id: 'nz', nameKo: '뉴질랜드', continent: 'oceania',
    lat: -41.3, lng: 174.8,
    flag: { meaning: '파란 바탕에 유니언 잭과 붉은 별 네 개(남십자성)가 그려져 있어요.' },
    location: { desc: '오세아니아의 남동쪽 바다에 있는 두 개의 큰 섬으로 이루어진 나라예요.' },
    capital: { name: '웰링턴', desc: '바람이 많이 불기로 유명한, 바닷가의 아담한 수도예요.' },
    greeting: { text: '키아 오라 (Kia ora)', korean: '키아 오라' },
    foods: [
      { name: '항이', emoji: '🍠', desc: '땅속에 뜨거운 돌을 묻어 음식을 익히는 마오리 전통 요리예요.' },
      { name: '파블로바', emoji: '🍰', desc: '머랭 위에 과일을 얹은 폭신한 디저트 케이크예요.' }
    ],
    prides: [
      { name: '아름다운 자연', emoji: '🏞️', desc: '영화 "반지의 제왕"을 찍을 만큼 자연 풍경이 멋져요.' },
      { name: '키위 새', emoji: '🥝', desc: '날지 못하는 뉴질랜드에만 사는 새로, 나라의 상징이에요.' }
    ],
    cultures: [
      { name: '하카', emoji: '💪', desc: '눈을 크게 뜨고 가슴을 치며 추는 마오리족의 전통 춤이에요.' },
      { name: '럭비', emoji: '🏉', desc: '국가대표팀 "올블랙스"가 경기 전 하카를 추는 것으로 유명해요.' }
    ]
  }
];
