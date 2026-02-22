/**
 * seedManager.js — Manages the pool of story seeds
 * @module core/seedManager
 */

import { generateId } from './id.js';

// --- Internal State for Seed Rotation ---
let shuffledPool = [];
let currentIndex = 0;


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
    },
    {
        id: "oriental_wuxia",
        title: "무영검의 자취",
        hook: "문파의 멸문 이후 이름을 숨기고 살아가는 고수의 복수극",
        tags: ["무협", "복수", "정통"],
        tone: "비장함"
    },
    {
        id: "slice_of_life_cafe",
        title: "기억을 파는 카페",
        hook: "손님의 소중한 기억을 음료로 바꿔주는 신비한 카페 이야기",
        tags: ["일상", "힐링", "판타지"],
        tone: "따뜻함"
    },
    {
        id: "noir_underworld",
        title: "잿빛 항구",
        hook: "배신이 난무하는 범죄 조직 속에서 생존을 위한 마지막 거래",
        tags: ["느와르", "범죄", "하드보일드"],
        tone: "냉소적"
    },
    {
        id: "time_travel_fixer",
        title: "역사의 매듭",
        hook: "사소한 역사적 오류를 수정하기 위해 파견된 시간 관리국 요원",
        tags: ["SF", "시간여행", "임무"],
        tone: "긴박함"
    },
    {
        id: "mystery_island",
        title: "안개의 섬",
        hook: "외딴 섬에 초대받은 8인의 외지인과 의문의 실종 사건",
        tags: ["미스터리", "고립", "심리"],
        tone: "불안감"
    },
    {
        id: "sports_underdog",
        title: "9회말 2아웃",
        hook: "해체 직전의 야구팀이 기적의 연승을 노리는 뜨거운 승부",
        tags: ["스포츠", "열정", "성장"],
        tone: "벅참"
    },
    {
        id: "mythological_adventure",
        title: "신들의 황혼",
        hook: "잊혀진 고대 신의 유물을 찾아 떠나는 고고학자의 모험",
        tags: ["모험", "신화", "고고학"],
        tone: "장대함"
    },
    {
        id: "lovecraftian_horror",
        title: "심연의 부름",
        hook: "해안가 마을에서 발견된 기괴한 표식과 외계의 공포",
        tags: ["코즈믹호러", "공포", "심연"],
        tone: "광기"
    },
    {
        id: "political_thriller",
        title: "여론의 전장",
        hook: "선거 직전 터진 스캔들을 덮으려는 권력층의 추악한 암투",
        tags: ["정치", "스릴러", "현대"],
        tone: "냉철함"
    },
    {
        id: "gourmet_mystery",
        title: "최후의 만찬",
        hook: "독살 사건이 벌어진 연회장에서 범인을 찾는 요리사",
        tags: ["요리", "추리", "연회"],
        tone: "품격있는"
    },
    {
        id: "mecha_war",
        title: "강철의 심장",
        hook: "거대 로봇 부대의 신참 조종사가 마주하는 전쟁의 참혹함",
        tags: ["메카닉", "전쟁", "SF"],
        tone: "묵직함"
    },
    {
        id: "steampunk_airship",
        title: "증기 아래의 보물",
        hook: "공중 정원 전설을 쫓는 비행선 해적단의 하늘 항해기",
        tags: ["스팀펑크", "판타지", "모험"],
        tone: "호쾌함"
    },
    {
        id: "school_supernatural",
        title: "방과 후의 괴담",
        hook: "학교에 떠도는 7대 괴담의 실체를 파헤치는 방송부원들",
        tags: ["학교", "괴담", "공포"],
        tone: "오싹함"
    },
    {
        id: "western_outlaw",
        title: "무법지대의 태양",
        hook: "현상금이 걸린 무법자가 고립된 마을을 구하기 위해 싸우는 서부극",
        tags: ["서부", "액션", "총잡이"],
        tone: "강렬함"
    },
    {
        id: "corporate_espionage",
        title: "침묵의 연봉",
        hook: "신기술 설계도를 훔치기 위해 경쟁사에 위장 취업한 스파이",
        tags: ["기업", "첩보", "현대"],
        tone: "짜릿함"
    },
    {
        id: "fairy_tale_twist",
        title: "늑대의 진실",
        hook: "우리가 알던 동화 뒤에 숨겨진 잔혹하고 슬픈 진실",
        tags: ["동화", "잔혹동화", "반전"],
        tone: "쓸쓸함"
    },
    {
        id: "legal_drama",
        title: "침묵하는 법정",
        hook: "모두가 유죄라고 말하는 피고인의 무죄를 증명하려는 변호사",
        tags: ["법정", "드라마", "추리"],
        tone: "지적인"
    },
    {
        id: "superhero_origin",
        title: "각성의 밤",
        hook: "초능력을 가졌다는 사실을 깨달은 고등학생과 그를 쫓는 비밀 조직",
        tags: ["히어로", "성장", "현대"],
        tone: "긴장감"
    },
    {
        id: "cyber_noir_romance",
        title: "비 비린내 나는 네온",
        hook: "인간과 안드로이드의 금지된 사랑을 쫓는 사이버 펑크 형사",
        tags: ["사이버펑크", "느와르", "로맨스"],
        tone: "애틋함"
    },
    {
        id: "historical_naval_war",
        title: "거센 파도의 끝",
        hook: "대항해시대, 거대 문명을 정복하려는 제국 함대속의 말단 항해사",
        tags: ["역사", "해전", "모험"],
        tone: "장대함"
    },
    {
        id: "magic_school_mystery",
        title: "지하실의 마도서",
        hook: "마법 학교의 금지된 구역에서 발견된 의문의 마도서와 저주",
        tags: ["마법학교", "미스터리", "학년물"],
        tone: "신비로움"
    },
    {
        id: "post_apoc_library",
        title: "마지막 도서관",
        hook: "모든 지식이 사라진 세상에서 고대 서적을 지키는 외로운 사서",
        tags: ["아포칼립스", "지식", "감성"],
        tone: "정적인"
    },
    {
        id: "dark_fantasy_necromancer",
        title: "죽은 자의 노래",
        hook: "시체를 되살려 왕국의 음모를 밝혀내려는 어린 강령술사",
        tags: ["다크판타지", "강령술", "복수"],
        tone: "어두움"
    },
    {
        id: "spy_thriller_coldwar",
        title: "베를린의 유령",
        hook: "냉전 시대 베를린, 첩보원들 사이에서 이중 스파이를 찾아내는 임무",
        tags: ["첩보", "냉전", "스릴러"],
        tone: "숨막히는"
    },
    {
        id: "space_opera_rebel",
        title: "별들의 반역",
        hook: "우주 제국에 저항하는 해적 연합의 일원이 되어 행성을 탈환하는 여정",
        tags: ["스페이스오페라", "전쟁", "SF"],
        tone: "웅장함"
    },
    {
        id: "survival_game_island",
        title: "지옥의 서바이벌",
        hook: "무인도에 갇혀 살아남아야 하는 100인의 서바이벌 게임",
        tags: ["서바이벌", "데스게임", "심리"],
        tone: "잔혹함"
    },
    {
        id: "urban_legend_ghost",
        title: "빨간 마스크의 진실",
        hook: "도시 괴담 속 유령과 실제로 마주치게 된 오컬트 유튜버",
        tags: ["공포", "오컬트", "도시괴담"],
        tone: "기괴함"
    },
    {
        id: "heist_museum",
        title: "세기의 한탕",
        hook: "세계 최고의 박물관 지하에 잠든 전설의 다이아몬드 탈취 작전",
        tags: ["도둑", "잠입", "케이퍼무비"],
        tone: "유쾌함"
    },
    {
        id: "cooking_fantasy_dungeon",
        title: "던전의 미식가",
        hook: "던전 몬스터를 재료로 최고의 요리를 만드는 방랑 요리사",
        tags: ["판타지", "요리", "이색"],
        tone: "흥미로운"
    },
    {
        id: "samurai_western",
        title: "외팔이 검객",
        hook: "황야의 무법지대에서 검 한 자루로 평화를 찾는 떠돌이 무사",
        tags: ["찬바라", "서부", "액션"],
        tone: "정갈함"
    },
    {
        id: "vampire_politics",
        title: "밤의 의회",
        hook: "현대 서울의 어둠 속에서 인간의 피를 두고 벌이는 뱀파이어 세력 다툼",
        tags: ["뱀파이어", "도시", "정치"],
        tone: "매혹적"
    },
    {
        id: "island_governor",
        title: "열대 섬의 제왕",
        hook: "버려진 열대 섬에 정착하여 자신만의 왕국을 건설하는 개척기",
        tags: ["건설", "생존", "개척"],
        tone: "활기찬"
    },
    {
        id: "dream_thief_inception",
        title: "꿈의 도둑들",
        hook: "타인의 꿈으로 들어가 비밀 정보를 추출하거나 심는 특수 요원",
        tags: ["SF", "심리", "잠입"],
        tone: "몽환적"
    },
    {
        id: "medical_drama_outbreak",
        title: "검역 구역",
        hook: "알 수 없는 전염병이 창궐한 병원에서 환자들을 살리려는 의사",
        tags: ["의학", "재난", "휴먼"],
        tone: "긴급함"
    },
    {
        id: "detective_noir_animal",
        title: "동물 마을의 의뢰인",
        hook: "인간이 사라진 세상, 동물들이 사는 도시에서 벌어진 살인 사건",
        tags: ["우화", "추리", "색다른"],
        tone: "냉소적"
    },
    {
        id: "underwater_city",
        title: "심해의 정거장",
        hook: "해수면 상승으로 물에 잠긴 지구, 심해 기지에서 살아가는 인류",
        tags: ["SF", "해저", "생존"],
        tone: "신비함"
    },
    {
        id: "dragon_slayer_last",
        title: "용의 마지막 불꽃",
        hook: "세상의 마지막 용을 사냥해야만 저주를 풀 수 있는 어느 기사",
        tags: ["하이판타지", "사냥", "모험"],
        tone: "숙명적"
    }
];

/**
 * Initialize the seed pool by shuffling it once.
 * This should be called once when the app starts.
 */
export function initSeedPool() {
    shuffledPool = [...HARDCODED_SEEDS].sort(() => 0.5 - Math.random());
    currentIndex = 0;
}

/**
 * Get the next N seeds from the shuffled pool.
 * If the pool is exhausted, it resets the index (wraps around).
 * @param {number} count 
 * @returns {Promise<Array<Object>>}
 */
export async function getRandomSeeds(count = 3) {
    if (shuffledPool.length === 0) {
        initSeedPool();
    }

    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(shuffledPool[currentIndex]);
        currentIndex = (currentIndex + 1) % shuffledPool.length;
    }

    // Assign temporary unique IDs for UI keys if needed (optional but good for consistency)
    return results.map(seed => ({
        ...seed,
        id: seed.id + '_' + generateId()
    }));
}

