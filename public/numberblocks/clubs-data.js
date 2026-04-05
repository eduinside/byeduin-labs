// ================================================================
// Numberblocks Club Badge — 클럽 데이터 정의
// 새 클럽을 추가하려면 CLUBS 배열에 항목을 추가하세요.
// ================================================================

/* ── 헬퍼 함수 ── */

function countDivisors(n) {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) count += (i === n / i) ? 1 : 2;
  }
  return count;
}

function isTriangular(n) {
  if (n <= 0) return false;
  for (let k = 1; k * (k + 1) / 2 <= n; k++) {
    if (k * (k + 1) / 2 === n) return true;
  }
  return false;
}

// n = a² - b² (a ≥ b + 2, b ≥ 1) 여부
// (odd)² - (odd)² 또는 (even)² - (even)² 형태만 가능
// → n은 4의 배수여야 함 (n ≥ 8)
function isSquareWithHole(n) {
  return n >= 8 && n % 4 === 0;
}

function isPerfectSquare(n) {
  if (n <= 0) return false;
  const s = Math.round(Math.sqrt(n));
  return s * s === n;
}

function isPerfectCube(n) {
  if (n <= 0) return false;
  const c = Math.round(Math.cbrt(n));
  return c * c * c === n;
}

/* ── 클럽 배열 ── */

const CLUBS = [
  {
    id: 'made-of-ones',
    color: '#E74C3C',
    textColor: '#fff',
    emoji: '1️⃣',
    nameKo: '1로 이루어진 클럽',
    nameEn: 'Made of Ones Club',
    shortKo: '1로 이루어진 클럽',
    descKo: '이 클럽은 매우 큽니다! 모든 수는 1들로 이루어져 있어요. 0만 구성원이 아니에요.',
    descEn: 'This is a very big club — Zero is the only nonmember.',
    check: (n) => n >= 1,
    examples: (max) => {
      const r = [];
      for (let i = 1; i <= max; i++) r.push(i);
      return r;
    },
  },
  {
    id: 'even-tops',
    color: '#3498DB',
    textColor: '#fff',
    emoji: '⬛',
    nameKo: '짝수 탑 클럽',
    nameEn: 'Even Tops Club',
    shortKo: '짝수 탑 클럽',
    descKo: '이 넘버블록스는 너비가 2이며 맨 위에 평평한 꼭대기가 있어요. 이걸 짝수라고 불러요!',
    descEn: 'When Numberblocks stand 2 blocks wide, they have a flat, even top. They are what we call even numbers.',
    check: (n) => n % 2 === 0,
    examples: (max) => {
      const r = [];
      for (let i = 0; i <= max; i += 2) r.push(i);
      return r;
    },
  },
  {
    id: 'odd-tops',
    color: '#E67E22',
    textColor: '#fff',
    emoji: '🟧',
    nameKo: '홀수 탑 클럽',
    nameEn: 'Odd Tops Club',
    shortKo: '홀수 탑 클럽',
    descKo: '이 넘버블록스는 너비가 2이며 맨 위에 블록 하나만 있어요. 이걸 홀수라고 불러요!',
    descEn: 'When Numberblocks stand 2 blocks wide, they have an odd block on top. They are what we call odd numbers.',
    check: (n) => n % 2 !== 0,
    examples: (max) => {
      const r = [];
      for (let i = 1; i <= max; i += 2) r.push(i);
      return r;
    },
  },
  {
    id: 'three-club',
    color: '#27AE60',
    textColor: '#fff',
    emoji: '3️⃣',
    nameKo: '3 클럽',
    nameEn: 'Three Club',
    shortKo: '3 클럽',
    descKo: '구성원은 3으로 이루어지거나 3으로 나눌 수 있어요. 3은 클럽을 처음 만든 구성원이에요!',
    descEn: 'Members are made of 3s or can split into 3s. Three is the founding member!',
    check: (n) => n > 0 && n % 3 === 0,
    examples: (max) => {
      const r = [];
      for (let i = 3; i <= max; i += 3) r.push(i);
      return r;
    },
  },
  {
    id: 'rainbow-sevens',
    color: '#9B59B6',
    textColor: '#fff',
    emoji: '🌈',
    nameKo: '무지개 7 클럽',
    nameEn: 'Rainbow Sevens Club',
    shortKo: '무지개 7 클럽',
    descKo: '7로 균등하게 나눌 수 있는 넘버블록스를 위한 클럽이에요. 모든 회원은 창단 멤버 넘버블록 7에서 영감을 받아 무지개 색깔의 블록을 가지고 있어요!',
    descEn: 'This is a club for Numberblocks that can split evenly into 7s. They all have a rainbow aspect to their blocks, inspired by their founding member, Numberblock Seven!',
    check: (n) => n > 0 && n % 7 === 0,
    examples: (max) => {
      const r = [];
      for (let i = 7; i <= max; i += 7) r.push(i);
      return r;
    },
  },
  {
    id: 'football-club',
    color: '#1ABC9C',
    textColor: '#fff',
    emoji: '⚽',
    nameKo: '축구 클럽',
    nameEn: 'Football Club',
    shortKo: '축구 클럽',
    descKo: '클럽의 주장은 넘버블록 11이에요. 모든 구성원은 11의 배수이며, 축구팀의 선수 수와 같은 수예요!',
    descEn: 'The Football Club: the club captain is Numberblock Eleven. All team members are multiples of 11, the same number of players on a football team!',
    check: (n) => n > 0 && n % 11 === 0,
    examples: (max) => {
      const r = [];
      for (let i = 11; i <= max; i += 11) r.push(i);
      return r;
    },
  },
  {
    id: 'falling-apart',
    color: '#E91E63',
    textColor: '#fff',
    emoji: '🔓',
    nameKo: '분리되는 클럽',
    nameEn: 'Falling Apart Club',
    shortKo: '분리되는 클럽',
    descKo: '클럽의 주장은 비운의 넘버블록 13이에요. 모든 구성원은 13의 배수예요. 만약 누군가 "13"이라고 말하면, 팀원들은 10과 3으로 나뉘게 돼요.',
    descEn: 'Unlucky Thirteen is the captain of this club. All members are multiples of 13. If anyone says "Thirteen," team members fall apart into Thirteens, who further break into Tens and Threes.',
    check: (n) => n > 0 && n % 13 === 0,
    examples: (max) => {
      const r = [];
      for (let i = 13; i <= max; i += 13) r.push(i);
      return r;
    },
  },
  {
    id: 'square-club',
    color: '#F1C40F',
    textColor: '#2D2D2D',
    emoji: '🟩',
    nameKo: '정사각형 클럽',
    nameEn: 'Square Club',
    shortKo: '정사각형 클럽',
    descKo: '구성원들은 스스로를 멋지고 강한 정사각형이라 생각하며 자랑스러워해요. 너비와 높이가 같으며 모두 4개의 모서리를 가지고 있어요.',
    descEn: 'Members are very proud to be super strong squares! They are the same number of blocks wide as they are tall, and they all have 4 corners.',
    check: isPerfectSquare,
    examples: (max) => {
      const r = [];
      for (let i = 1; i * i <= max; i++) r.push(i * i);
      return r;
    },
  },
  {
    id: 'step-squad',
    color: '#FF8C00',
    textColor: '#2D2D2D',
    emoji: '🪜',
    nameKo: '계단 분대 클럽',
    nameEn: 'Step Squad Club',
    shortKo: '계단 분대 클럽',
    descKo: '1씩 커지는 숫자들로 이루어진 넘버블록스로 구성돼요. 계단 모양의 가면을 착용하고 클럽을 처음 만든 15는 1+2+3+4+5로 구성되어 있어요.',
    descEn: 'Members contain a set of numbers that are each 1 bigger than the other, starting at One. Founding member Fifteen is made of 1+2+3+4+5 and wears a step-shaped mask.',
    check: isTriangular,
    examples: (max) => {
      const r = [];
      for (let k = 1; k * (k + 1) / 2 <= max; k++) r.push(k * (k + 1) / 2);
      return r;
    },
  },
  {
    id: 'cube-club',
    color: '#34495E',
    textColor: '#fff',
    emoji: '🎲',
    nameKo: '큐브 클럽',
    nameEn: 'Cube Club',
    shortKo: '큐브 클럽',
    descKo: '구성원으로는 1과 8이 있어요. 큐브는 6개의 정사각형 면을 가진 3D 도형이에요!',
    descEn: 'Members include One and Eight. Cubes are 3D shapes with 6 square faces.',
    check: isPerfectCube,
    examples: (max) => {
      const r = [];
      for (let i = 1; i * i * i <= max; i++) r.push(i * i * i);
      return r;
    },
  },
  {
    id: 'squares-holes',
    color: '#FF6B9D',
    textColor: '#fff',
    emoji: '🔲',
    nameKo: '구멍있는 정사각형 클럽',
    nameEn: 'Squares-with-holes-in Club',
    shortKo: '구멍있는 정사각형 클럽',
    descKo: '실제 정사각형 구멍을 만들 수 있는 수예요. a²-b² (a≥b+2, b≥1) 예: 8=3²-1², 12=4²-2², 16=5²-3², 24=5²-1²',
    descEn: 'Members can form actual square holes: a²-b² where a ≥ b+2, b ≥ 1. Examples: 8=3²-1², 12=4²-2², 16=5²-3², 24=5²-1²',
    check: isSquareWithHole,
    examples: (max) => {
      const r = [];
      for (let i = 1; i <= max; i++) { if (isSquareWithHole(i)) r.push(i); }
      return r;
    },
  },
  {
    id: 'super-rect',
    color: '#00B894',
    textColor: '#fff',
    emoji: '🔷',
    nameKo: '슈퍼 직사각형 클럽',
    nameEn: 'Super-rectangle Club',
    shortKo: '슈퍼 직사각형 클럽',
    descKo: '이 클럽에 들어가려면 넘버블록스는 6개 이상의 다른 직사각형 모양을 만들 수 있어야 해요. 12가 이 클럽을 처음 만들었어요.',
    descEn: 'To get into this Club, a Numberblock must be able to make 6 or more different rectangle shapes! Twelve is the founding member of the club.',
    check: (n) => n > 0 && countDivisors(n) >= 6,
    examples: (max) => {
      const r = [];
      for (let i = 1; i <= max; i++) { if (i > 0 && countDivisors(i) >= 6) r.push(i); }
      return r;
    },
  },
  {
    id: 'super-duper',
    color: '#6C5CE7',
    textColor: '#fff',
    emoji: '💎',
    nameKo: '슈퍼 초특급 직사각형 클럽',
    nameEn: 'Super-duper Rectangle Club',
    shortKo: '슈퍼 초특급 직사각형 클럽',
    descKo: '이 사각형들은 8개 이상 또는 더 많은 직사각형을 만들 수 있어요. 심지어 슈퍼 직사각형 클럽보다도 더 많죠. 정말 네모네모해요!',
    descEn: 'These rectangles can make 8 or more rectangles, even more than Super-rectangles — so rectantly!',
    check: (n) => n > 0 && countDivisors(n) >= 8,
    examples: (max) => {
      const r = [];
      for (let i = 1; i <= max; i++) { if (i > 0 && countDivisors(i) >= 8) r.push(i); }
      return r;
    },
  },
  {
    id: 'prime-club',
    color: '#D63031',
    textColor: '#fff',
    emoji: '🔑',
    nameKo: '프라임 클럽',
    nameEn: 'Prime Club',
    shortKo: '프라임 클럽',
    descKo: '구성원들은 자신이 할 수 있는 가장 크고 세로 또는 가로의 직사각형만 만들 수 있어요. 이 직사각형은 다른 수로 나눌 수 없어야 해요.',
    descEn: 'Members can only make rectangles in two shapes: standing as tall or as wide as they can. They cannot be divided by any other number into equal parts.',
    check: (n) => countDivisors(n) === 2,
    examples: (max) => {
      const r = [];
      for (let i = 2; i <= max; i++) { if (countDivisors(i) === 2) r.push(i); }
      return r;
    },
  },
  {
    id: 'roaring-twenties',
    color: '#FDCB6E',
    textColor: '#2D2D2D',
    emoji: '2️⃣0️⃣',
    nameKo: '2로 시작하는 두 자릿수 클럽',
    nameEn: 'Roaring Twenties Club',
    shortKo: '20대 클럽',
    descKo: '20부터 29까지의 블록이 클럽의 구성원이에요. 모두 20 이상이지만 30이 안 돼요!',
    descEn: 'Every block from Twenty to Twenty-nine is part of this club. They are all 20 or more, but less than 30.',
    check: (n) => n >= 20 && n <= 29,
    examples: (max) => {
      const r = [];
      for (let i = 20; i <= Math.min(29, max); i++) r.push(i);
      return r;
    },
  },
  {
    id: 'nine-enders',
    color: '#A29BFE',
    textColor: '#fff',
    emoji: '9️⃣',
    nameKo: '9로 끝나는 클럽',
    nameEn: 'Nine Enders Club',
    shortKo: '9로 끝나는 클럽',
    descKo: '이 클럽은 일의 자릿수가 9로 끝나는 모든 넘버블록스를 위한 클럽이에요! 넘버블록 29가 이 클럽을 처음 만들었어요.',
    descEn: 'This is the club for all the Numberblocks whose numbers end in 9. Numberblock Twenty-nine was the inventor of the club!',
    check: (n) => n > 0 && n % 10 === 9,
    examples: (max) => {
      const r = [];
      for (let i = 9; i <= max; i += 10) r.push(i);
      return r;
    },
  },
];
