/**
 * seedManager.js — Manages the pool of story seeds
 * @module core/seedManager
 */

import { generateId } from './id.js';

// Hardcoded seed pool (expandable later up to ~1000)
const HARDCODED_SEEDS = [
    {
        id: "modern_detective",
        title: "빗속의 단서",
        hook: "현대 도시 배경의 미스터리 추리물",
        tags: ["현대", "추리", "도시"],
        tone: "긴장감"
    },
    {
        id: "fantasy_politics",
        title: "왕좌의 뒷모습",
        hook: "판타지 배경의 치열한 궁중 정치 스릴러",
        tags: ["판타지", "정치", "스릴러"],
        tone: "숨막히는"
    },
    {
        id: "haunted_escape",
        title: "닫힌 문명",
        hook: "공포 분위기의 귀신의 집 무한 방탈출",
        tags: ["호러", "방탈출", "심리"],
        tone: "음산함"
    },
    {
        id: "cyberpunk_heist",
        title: "네온 밑의 그림자",
        hook: "사이버펑크 배경의 대기업 서버 해킹 침투극",
        tags: ["사이버펑크", "해킹", "잠입"],
        tone: "스피디함"
    },
    {
        id: "post_apocalypse",
        title: "재의 시대",
        hook: "자원이 고갈된 포스트 아포칼립스 세계의 생존기",
        tags: ["아포칼립스", "생존", "황무지"],
        tone: "처절함"
    },
    {
        id: "space_drifter",
        title: "침묵의 궤도",
        hook: "동면에서 깬 승무원의 고립된 우주선 탈출기",
        tags: ["SF", "우주", "미스터리"],
        tone: "고립감"
    },
    {
        id: "modern_fantasy",
        title: "도시 속의 이면",
        hook: "평범한 현대 일상 속에 숨겨진 마법사들의 암투극",
        tags: ["현대판타지", "액션", "숨겨진세계"],
        tone: "흥미진진"
    },
    {
        id: "zombie_defense",
        title: "마지막 방어선",
        hook: "좀비 사태 발발 직후 대형 마트에서의 농성전",
        tags: ["좀비", "방어", "생존"],
        tone: "절박함"
    }
];

/**
 * Get N random seeds from the hardcoded pool.
 * @param {number} count 
 * @returns {Promise<Array<Object>>} (Returning Promise to match existing UI async pattern)
 */
export async function getRandomSeeds(count = 3) {
    // Shuffle the hardcoded list
    const shuffled = [...HARDCODED_SEEDS].sort(() => 0.5 - Math.random());

    // Assign unique IDs for UI rendering just in case
    return shuffled.slice(0, count).map(seed => ({
        ...seed,
        id: seed.id + '_' + generateId()
    }));
}
