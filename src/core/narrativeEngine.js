/**
 * narrativeEngine.js — Logic for controlling the story's pace and phases.
 * @module core/narrativeEngine
 */

/**
 * Returns the narrative directive based on current session progress.
 * @param {number} turnCount 
 * @param {Object} clocks — { win, lose }
 * @returns {string} directive string
 */
/**
 * Returns a short label for the current phase (e.g. "ACT 1").
 * @param {number} turnCount 
 * @param {Object} clocks 
 * @returns {string}
 */
/**
 * Returns the hard ending threshold for Clocks.
 */
export function getHardEndingThreshold(storyLength = '중편') {
    const thresholds = {
        '단편': 6,
        '중편': 10,
        '장편': 15
    };
    return thresholds[storyLength] || thresholds['중편'];
}

/**
 * Returns a machine-readable key for the current narrative phase.
 */
export function getNarrativePhaseKey(turnCount, clocks = {}, storyLength = '중편') {
    const tension = clocks.tension || 0;
    const insight = clocks.insight || 0;

    // Thresholds based on storyLength
    // tension: ACT 전환 기준 / insight: ENDING 전환 기준
    const thresholds = {
        '단편': { resolution: { insight: 6, turn: 10 }, act3: { tension: 5, turn: 7 }, act2: { tension: 2, turn: 3 } },
        '중편': { resolution: { insight: 10, turn: 20 }, act3: { tension: 7, turn: 14 }, act2: { tension: 3, turn: 5 } },
        '장편': { resolution: { insight: 15, turn: 35 }, act3: { tension: 10, turn: 22 }, act2: { tension: 4, turn: 7 } }
    };

    const t = thresholds[storyLength] || thresholds['중편'];

    if (insight >= t.resolution.insight || turnCount >= t.resolution.turn) return "ENDING";
    if (tension >= t.act3.tension || turnCount >= t.act3.turn) return "ACT3";
    if (tension >= t.act2.tension || turnCount >= t.act2.turn) return "ACT2";
    return "ACT1";
}

export function getNarrativePhaseLabel(turnCount, clocks = {}, storyLength = '중편') {
    const key = getNarrativePhaseKey(turnCount, clocks, storyLength);
    const labels = {
        ACT1: "ACT 1 (발단)",
        ACT2: "ACT 2 (전개)",
        ACT3: "ACT 3 (절정)",
        ENDING: "ACT 4 (결말)"
    };
    return labels[key];
}

/**
 * Returns the narrative directive based on current session progress.
 * @param {number} turnCount 
 * @param {Object} clocks — { win, lose }
 * @param {string} storyLength
 * @returns {string} directive string
 */
export function getNarrativePhaseDirective(turnCount, clocks = {}, storyLength = '중편') {
    const label = getNarrativePhaseLabel(turnCount, clocks, storyLength);

    if (label.startsWith("ACT 4")) {
        return `[PHASE: ${label}]
- 디렉팅: 이야기의 최종 결말부입니다. 단순한 승리나 패배를 넘어, 유저가 쌓아온 통찰(insight)과 긴박함(tension)의 균형에 따른 다채로운 결말을 서술하십시오.
- 서술 목표: 높은 tension은 희생적이거나 극적인 결말을, 높은 insight는 모든 진실을 밝히는 완전한 결말을 암시할 수 있습니다. 그 여정에 걸맞은 입체적인 엔딩을 도출하십시오.
- 선택지 방향: 결말의 최종적인 톤을 결정하는 유저의 최후 선택을 받거나, 이미 이야기가 완성되었다면 "isEnding": true로 게임을 즉시 종결하십시오.`;
    } else if (label.startsWith("ACT 3")) {
        return `[PHASE: ${label}]
- 디렉팅: 텐션을 최고조로 끌어올리십시오. 흑막의 실체나 치명적인 위협이 유저의 눈앞에 직접적으로 드러나야 합니다. 부정적인 상태(flag)가 있다면 가차 없이 치명적인 결과(부상, 동료 상실 등)로 연결하십시오.
- 선택지 방향: 유저의 선택이 생존이나 돌이킬 수 없는 피해를 결정짓는, 극단적인 리스크를 동반한 선택지를 제공하십시오.`;
    } else if (label.startsWith("ACT 2")) {
        return `[PHASE: ${label}]
- 디렉팅: 본격적으로 갈등을 전개하십시오. [Hidden Plot]에 대한 단서를 흘리고, 앞길을 막는 물리적/심리적 장애물을 등장시키십시오. 행동에는 대가(Cost)가 따릅니다.
- 선택지 방향: '위험 감수(Risk)'와 '안전(Safety)' 사이에서 고민하게 만드는 갈등형 선택지를 제공하십시오.`;
    } else {
        return `[PHASE: ${label}]
- 디렉팅: 서두르지 마십시오. 유저가 처한 물리적 환경과 분위기, 핵심 사물이나 NPC를 깊이 있게 묘사하여 적응하게 하십시오. 페널티는 경고 수준에 머무릅니다.
- 선택지 방향: 상황을 파악하기 위한 '탐색 및 정보 수집' 위주의 선택지를 제공하십시오.`;
    }
}
