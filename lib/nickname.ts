const COLORS = ["빨강이", "초록이", "노랑이"];
const FRUITS = [
  "딸기", "바나나", "포도", "수박", "참외", "망고", "복숭아", "자두", "귤", "멜론",
  "체리", "키위", "레몬", "사과", "배", "오렌지", "블루베리", "라임", "무화과", "살구",
];

// 신호등 색 + 과일 랜덤 닉네임. suffix=true면 뒤에 두 자리 숫자.
export function randomNickname(suffix = false): string {
  const c = COLORS[Math.floor(Math.random() * COLORS.length)];
  const f = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  const n = suffix ? ` ${Math.floor(Math.random() * 90) + 10}` : "";
  return `${c} ${f}${n}`;
}
