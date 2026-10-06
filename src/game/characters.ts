export type CharacterId = 'warrior' | 'rogue' | 'mage';

export interface CharacterDef {
  id: CharacterId;
  /** Korean display name. */
  name: string;
  /** English name shown small under the Korean one on the select card. */
  englishName: string;
  maxHp: number;
  diceCount: number;
  /** One-line introduction shown under the stats on the select card and on the help screen. */
  description: string;
  /** The complete rule list for the help screen. */
  rules: { attack: string[]; heal: string[] };
  /** The rules in a few short rows for the select card (the full list is on the help screen). */
  cardRules: CardRule[];
}

export interface CardRule {
  kind: 'attack' | 'heal';
  text: string;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  warrior: {
    id: 'warrior',
    name: '전사',
    englishName: 'Warrior',
    maxHp: 100,
    diceCount: 2,
    description: '튼튼한 갑옷과 방패의 기사. 같은 눈이 강력하다!',
    rules: {
      attack: ['같은 눈 → (합) x 4 데미지', '그 외 → 합만큼 데미지'],
      heal: ['같은 눈 → 50 회복', '그 외 → 합만큼 회복'],
    },
    cardRules: [
      { kind: 'attack', text: '같은 눈이면 두 눈의 합 x 4!' },
      { kind: 'attack', text: '그 외에는 두 눈의 합' },
      { kind: 'heal', text: '같은 눈이면 50 회복' },
      { kind: 'heal', text: '그 외에는 두 눈의 합' },
    ],
  },
  rogue: {
    id: 'rogue',
    name: '도적',
    englishName: 'Rogue',
    maxHp: 70,
    diceCount: 2,
    description: '빠른 단검술사. 홀짝이 같으면 한 번 더!',
    rules: {
      attack: [
        '둘 다 짝수/홀수 → 주사위 2개 더 굴리기',
        '두 쌍(6, 6, 3, 3) → 50 데미지',
        '트리플(6, 6, 6, 1) → 30 데미지',
        '4개 모두 같음(6, 6, 6, 6) → 75 데미지',
        '그 외 → 4개의 합만큼 데미지',
        '홀짝이 다르면 → 더 큰 눈 하나만큼',
      ],
      heal: [
        '둘 다 짝수/홀수 → 주사위 1개 더 굴리기',
        '3개 모두 짝수/홀수 → 20 회복',
        '그 외 → 3개의 합만큼 회복',
        '홀짝이 다르면 → 두 눈의 합만큼',
      ],
    },
    cardRules: [
      { kind: 'attack', text: '홀짝이 같으면 2개 더 던져 4개의 합' },
      { kind: 'attack', text: '두 쌍 50 · 트리플 30 · 넷 같으면 75' },
      { kind: 'attack', text: '홀짝이 다르면 큰 눈 하나' },
      { kind: 'heal', text: '홀짝이 같으면 1개 더! 셋 다 홀짝이면 20' },
      { kind: 'heal', text: '그 외에는 눈의 합' },
    ],
  },
  mage: {
    id: 'mage',
    name: '마법사',
    englishName: 'Mage',
    maxHp: 50,
    diceCount: 3,
    description: '주사위 3개의 도박꾼. 잭팟 아니면 자폭!',
    rules: {
      attack: [
        '6, 6, 6 → 100 데미지 (한 방!)',
        '3, 3, 3 / 5, 5, 5 → 25 데미지',
        '2, 2, 2 / 4, 4, 4 → 자신이 25 데미지',
        '1, 1, 1 → 자신의 HP가 0',
        '모두 홀수/짝수 → (합) x 2',
        '연속 3개 → 45 데미지',
        '그 외 → 가장 높은 눈',
      ],
      heal: ['모두 같은 눈 → HP 전부 회복', '모두 홀수/짝수 → 30 회복', '그 외 → 합만큼 회복'],
    },
    cardRules: [
      { kind: 'attack', text: '6, 6, 6은 100! 1, 1, 1은 즉사' },
      { kind: 'attack', text: '3, 3, 3 · 5, 5, 5는 25 데미지' },
      { kind: 'attack', text: '2, 2, 2 · 4, 4, 4는 내가 25 피해' },
      { kind: 'attack', text: '홀짝 합 x 2, 연속 45, 그 외 최고 눈' },
      { kind: 'heal', text: '같은 눈은 전부, 홀짝은 30 회복' },
    ],
  },
};

export const CHARACTER_IDS: readonly CharacterId[] = ['warrior', 'rogue', 'mage'];
