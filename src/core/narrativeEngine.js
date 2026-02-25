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
export const HARD_ENDING_THRESHOLD = 4;

/**
 * Returns a machine-readable key for the current narrative phase.
 */
export function getNarrativePhaseKey(turnCount, clocks = {}) {
    const maxClock = Math.max(clocks.win || 0, clocks.lose || 0);
    if (maxClock >= HARD_ENDING_THRESHOLD || turnCount >= 10) return "ENDING";
    if (maxClock >= 3 || turnCount >= 7) return "ACT3";
    if (maxClock >= 1 || turnCount >= 3) return "ACT2";
    return "ACT1";
}

export function getNarrativePhaseLabel(turnCount, clocks = {}) {
    const key = getNarrativePhaseKey(turnCount, clocks);
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
 * @returns {string} directive string
 */
export function getNarrativePhaseDirective(turnCount, clocks = {}) {
    const label = getNarrativePhaseLabel(turnCount, clocks);

    if (label.startsWith("ACT 4")) {
        return `[PHASE: ${label}]
- 디렉팅: 이야기를 마무리 지어야 할 때입니다. 더 이상의 새로운 단서나 조력자를 등장시키지 마십시오.
- 선택지 방향: 유저가 승리 조건을 달성하기 위한 최종 결단을 내리게 하거나, 이미 한계에 달했다면 패배 조건을 발동시켜 게임을 즉시 종료("isEnding": true) 시키십시오.`;
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
