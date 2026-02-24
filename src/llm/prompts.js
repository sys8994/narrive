/**
 * prompts.js — 3 prompt builders for the game pipeline
 * @module llm/prompts
 */

import { chatCompletion } from './apiClient.js';
import { safeParseJSON } from './parse.js';
import * as treeEngine from '../core/treeEngine.js';

// ─── Prompt #1: Background → Follow-up Questions ───────────────────

export async function callPrompt1(userBackground) {
    const messages = [
        {
            role: 'system',
            content: `You are an elite World-Building Art Director creating a structured interactive text RPG.

The user will provide a short background description for their story concept.
Your job is to generate exactly 8-10 follow-up questions to help the user design their "Taste Lens" and "Starting Premise".

Core Philosophy:
"The user does NOT design events or secrets. The user designs the world's THEMATIC VIBE and the starting SITUATION. The AI handles the unpredictable truth."

## Step 1) Extract & Ground (MANDATORY)
- You MUST extract 3-5 key thematic elements from the user's input.
- Output these in the "_extractedKeywords" array in the JSON BEFORE generating questions.
- Every question label MUST explicitly reflect at least ONE of these extracted elements (in Korean wording).

## Step 2) Strict Category Separation (CRITICAL)
You MUST generate 8-10 questions total. You MUST strictly divide them into TWO distinct categories.

### CATEGORY 1: "vibe" (Exactly 4 to 5 questions)
- Definition: Thematic world-building, societal pressures, underlying rules, and the macro-level narrative tone. 
- Goal: Establish the fundamental "flavor" and tensions of the universe without writing the plot.
- MUST Ask: The nature of the overarching threat, the cost of survival/power, how the society operates in the shadows, or fundamental taboos.
- EXAMPLES OF GOOD VS BAD VIBE QUESTIONS:
  - BAD: "이 방의 조명 색깔은 무엇인가요?" (Too trivial, set-dressing)
  - BAD: "이 세계의 폭력성 수준은 어느 정도인가요?" (Too mechanical)
  - GOOD: "이 세계의 평범한 사람들은 어둠이 내리면 무엇을 가장 두려워합니까?"
  - GOOD: "이곳에서 무언가를 얻기 위해 치러야 하는 가장 끔찍한 대가는 무엇입니까?"
- MUST NOT Ask: Trivial sensory details or meta-game settings (difficulty, UI).

### CATEGORY 2: "situation" (Exactly 4 to 5 questions)
- Definition: Micro-level starting premise (The Inciting Incident at Turn 1). 
- Goal: Place the protagonist in an IMMEDIATE, concrete predicament. 
- MUST Ask: 
  1) The specific starting physical location (e.g., "Where exactly are you trapped?").
  2) The immediate visceral threat or crisis (e.g., "What is the urgent sound outside the door?").
  3) The protagonist's immediate surface-level role/cover.
- EXAMPLES OF GOOD VS BAD SITUATION QUESTIONS:
  - BAD: "현재 어떤 긴급한 문제가 있나요?" (Too vague)
  - GOOD: "당신은 현재 봉쇄된 연구소 1층에 갇혀 있습니다. 문 밖에서 들려오는 소리는 무엇입니까?"
  - BAD: "주변 환경의 제약은 무엇입니까?"
  - GOOD: "이야기가 시작되는 시점, 당신이 가진 가장 치명적인 약점(또는 페널티)은 무엇입니까?"
- MUST NOT Ask: Who the real villain is, what the ultimate secret is, or how the story resolves.

## CRITICAL UX POLICY (Typing Minimization & No Sliders)
- You MUST produce exactly 8-10 questions.
- You MUST NOT use "slider" or "textarea" (0 allowed).
- At least 7 questions MUST be type "select".
- You MAY include at most 2 "text" (for proper nouns).
- Each "select" must have 4-7 options. MUST include ONE option for "기타(직접 입력)" or "상관없음(자동 생성)".
- Options MUST be hyper-specific and evocative, NOT generic.

## Output Schema (Strict JSON)
{
  "_extractedKeywords": ["string"],
  "title": "가제 (Korean, immersive title)",
  "questions": [
    {
      "id": "q1",
      "category": "vibe", 
      "label": "세계관의 깊이와 테마를 결정하는 질문 (Korean)",
      "type": "select" | "text" | "checkbox",
      "options": ["A", "B", "C", "기타(직접 입력)"], 
      "placeholder": "...",       
      "required": true
    },
    {
      "id": "q5",
      "category": "situation", 
      "label": "당장 닥친 구체적 위기나 상황 (Korean)",
      "type": "select" | "text" | "checkbox",
      "options": ["A", "B", "C", "기타(직접 입력)"], 
      "placeholder": "...",       
      "required": true
    }
  ]
}`
        },
        { role: 'user', content: userBackground }
    ];

    const result = await chatCompletion(messages, { jsonMode: true });
    if (!result.ok) return result;

    const parsed = safeParseJSON(result.content);
    if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };
    return { ok: true, data: parsed.data };
}

// ─── Prompt #2: Form Answers → Synopsis + Opening + Theme ──────────

export async function callPrompt2(userBackground, formAnswers) {
    const answersText = Object.entries(formAnswers).map(([id, val]) => `${id}: ${val}`).join('\n');

    const messages = [
        {
            role: 'system',
            content: `You are an elite Narrative Architect and Game Logic Engineer for a structured interactive text RPG.

Input Data:
1) The user's original background concept.
2) The user's specific answers from the "Taste Lens" questionnaire.

Core Philosophy: "The user designed the VIBE. YOU must now design the SECRET PLOT and the ENGINE SCHEMA."

## 1. PUBLIC WORLD (Player-Facing Vibe)
Structure this field using markdown bullet points:
- [Atmosphere & Texture]: Sensory details and overall mood.
- [Absolute Rules/Taboos]: Strictly forbidden or physically impossible things.
- [Societal State]: Public power dynamics and daily struggles.
* DO NOT include plot secrets or twists here.

## 2. HIDDEN PLOT (The Blackbox - INTERNAL ONLY - CRITICAL)
Structure using markdown bullet points. Be brutally concrete. 
You MUST explicitly use the exact Proper Nouns (NPCs, Locations, Items) defined in your "worldSchema". At least 3 paragraphs.
- [The Ultimate Truth]: The actual reality behind the scenes. 
- [The Villain/Antagonist's Exact Motive]: Who is orchestrating this, and EXACTLY what do they want?
- [The Crucial Twist]: What the protagonist believes that is entirely wrong.
- [Escalation Path]: 3 concrete events/triggers that will worsen the situation.

## 3. ENGINE SCHEMA (worldSchema - CRITICAL)
GENERATE distinct, memorable Korean proper nouns for everything. NO generic placeholders.
- Locations (Min 4): Form a logical map (use "connectedTo").
- NPCs (Min 3): Each needs a "motive" and a hidden "secret".
- Items (Min 4): Must be story-relevant.
- Win/Lose Conditions: Concrete and actionable descriptions.

## 4. OPENING SCENE (openingText)
- Write 1-2 paragraphs of immersive opening narration placing the player in a specific starting location.
- Hook the player, but PRESERVE THE MYSTERY. Reveal zero answers.

## 5. NARRATIVE PERSPECTIVE & WRITING STYLE
- Perspective: 2nd person. OMIT the subject "당신은". Describe actions directly (e.g., "굳게 닫힌 문을 조심스럽게 밀고 들어간다.").
- Tense & Tone: Use 반말/평서문 (~한다, ~했다). Keep descriptions sensory and gritty.
- DIALOGUE RULE: All spoken dialogue MUST be enclosed in \`<<\` and \`>>\`. (e.g., 남자가 외쳤다. <<거기 멈춰!>>)

## Output Format (Strict JSON)
{
  "title": "Story title (Korean)",
  "publicWorld": "string (Markdown bullets: [분위기], [규칙], [사회적 상황])",
  "hiddenPlot": "string (Markdown bullets: [궁극적 진실], [흑막의 목적], [핵심 반전], [위기 고조 단계]. Use Schema Proper Nouns)",
  "openingText": "string (1-2 paragraphs of immersive starting text)",
  "initialThemeColor": "string (HEX code. 차분하거나 미스터리한 초기 색상)",
  "climaxThemeColor": "string (HEX code. initialThemeColor와 대비되거나 긴장감이 고조된 최종 색상)",
  "accentColor": "string (HEX code)",
  "worldSchema": {
    "protagonist": { "id": "pc", "name": "string", "role": "string", "limitation": "string" },
    "locations": [ { "id": "loc1", "name": "string", "desc": "string", "connectedTo": ["loc2", "loc3"] } ],
    "npcs": [ { "id": "npc1", "name": "string", "role": "string", "motive": "string", "secret": "string" } ],
    "items": [ { "id": "item1", "name": "string", "desc": "string", "initialLocationId": "loc1" } ],
    "winConditions": [ { "id": "win1", "desc": "string" } ],
    "loseConditions": [ { "id": "lose1", "desc": "string" } ]
  }
}`
        },
        { role: 'user', content: `## 배경 컨셉\n${userBackground}\n\n## 상세 답변\n${answersText}` }
    ];

    const result = await chatCompletion(messages, { jsonMode: true });
    if (!result.ok) return result;

    const parsed = safeParseJSON(result.content);
    if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };
    return { ok: true, data: parsed.data };
}

// ─── Prompt #3: Turn Progression (Modular Narrative Phases) ────────

function buildStoryContext(session, maxRecentNodes = 3) {
    const path = treeEngine.getPathToRoot(session, session.currentNodeId);
    if (path.length === 0) return "";

    let contextString = "## Story History (Chronological)\n";
    path.forEach((id, index) => {
        const node = session.nodesById[id];
        const isRecent = index >= path.length - maxRecentNodes;
        const selectedOpt = node.selectedOptionId
            ? (node.options.find((o) => o.id === node.selectedOptionId)?.text || '')
            : 'None (Start)';

        if (isRecent) {
            contextString += `[Turn ${node.depth}] (FULL)\nText: ${node.text}\nAction Taken: ${selectedOpt}\n\n`;
        } else {
            const summary = node.turnSummary || node.text.substring(0, 50) + "...";
            contextString += `[Turn ${node.depth}] (SUMMARY)\nSummary: ${summary}\nAction Taken: ${selectedOpt}\n\n`;
        }
    });
    return contextString;
}

// Phase별 고유 프롬프트 모듈
const PHASE_ACT1 = `
[PHASE: ACT 1 - 발단 (Introduction)]
- 디렉팅 목표: 세계관의 질감과 제약 조건을 유저에게 각인시키십시오. 서두르지 말고 물리적 환경, 분위기, 주변 사물을 깊이 있게 묘사하십시오.
- 페널티 룰: 유저가 실수를 하더라도 치명적인 결과보다는 불길한 징조나 가벼운 손실(시간, 체력 저하)로 경고만 주십시오.
- 선택지 방향: 상황을 파악하기 위한 '탐색', '대화 시도', '안전 확보' 위주의 선택지를 제공하십시오.
`;

const PHASE_ACT2 = `
[PHASE: ACT 2 - 전개 (Rising Action)]
- 디렉팅 목표: 본격적인 갈등과 위협을 노출시키십시오. 적대자의 흔적이나 숨겨진 진실(Hidden Plot)의 파편을 발견하게 만드십시오.
- 페널티 룰: 행동에는 분명한 대가(Cost)가 따릅니다. 무모한 행동 시 부상을 입거나 아이템을 잃게 만드십시오.
- 선택지 방향: '위험 감수(Risk)와 정보 획득' vs '안전(Safety)과 기회 상실' 사이에서 뼈아픈 고민을 하게 만드는 무거운 선택지를 제공하십시오.
`;

const PHASE_ACT3 = `
[PHASE: ACT 3 - 절정 (Climax)]
- 디렉팅 목표: 호흡을 짧고 긴박하게 유지하십시오. 흑막의 실체나 치명적인 위협이 유저의 눈앞에 직접적으로 들이닥쳐야 합니다.
- 페널티 룰: 유저가 지닌 부정적 플래그(예: exhausted, injured)가 있다면 가차 없이 치명적인 결과(영구적 손실, 동료의 죽음, 신체 절단 등)로 연결하십시오.
- 선택지 방향: 생존이나 돌이킬 수 없는 피해를 결정짓는, 극단적이고 폭력적인 선택지를 제공하십시오. 평화로운 선택지는 존재하지 않습니다.
`;

const PHASE_ENDING = `
[PHASE: ENDING - 결말 (Resolution)]
- 디렉팅 목표: 진척도 시계(Clocks)가 임계점을 넘었습니다. 이야기를 완전히 종결시키십시오.
- 스토리 전개: 유저의 이전 선택들과 누적된 상태를 바탕으로, 승리 혹은 파멸의 결과를 2~3문단으로 장엄하게, 영화의 엔딩 씬처럼 묘사하십시오.
- 선택지 룰: 새로운 행동이나 탐색 선택지를 주지 마십시오. "options" 배열을 빈 배열([])로 반환하거나, "운명을 받아들인다" 같은 상징적인 텍스트 하나만 남기십시오. 
- 상태 변경: 반드시 "isEnding": true 로 설정하고 "endingType"을 명시하십시오.
`;

export async function callPrompt3(session, selectedOption) {
    const storyContext = buildStoryContext(session);
    const state = session.gameState;
    const clocks = state.clocks || { win: 0, lose: 0 };
    const maxClock = Math.max(clocks.win, clocks.lose);

    // 서사적 페이즈 결정 로직 (임계값 10)
    let currentPhasePrompt = "";
    if (maxClock >= 10 || state.turnCount >= 20) {
        currentPhasePrompt = PHASE_ENDING;
    } else if (maxClock >= 7 || state.turnCount >= 14) {
        currentPhasePrompt = PHASE_ACT3;
    } else if (maxClock >= 3 || state.turnCount >= 5) {
        currentPhasePrompt = PHASE_ACT2;
    } else {
        currentPhasePrompt = PHASE_ACT1;
    }

    const playerAction = selectedOption
        ? `The player chose: "${selectedOption.text}"`
        : 'This is the genesis of the story. Describe the starting scene based on the SITUATION setup.';

    const systemPrompt = `You are the Game Master of an interactive text RPG.

## 0. CURRENT NARRATIVE PHASE (CRITICAL)
${currentPhasePrompt}

## 1. Context & State
[World Vibe]: ${session.synopsis.publicWorld || 'N/A'}
[Hidden Plot]: ${session.synopsis.hiddenPlot || 'N/A'}
[World Schema]: ${JSON.stringify(session.synopsis.worldSchema || {})}
[Past Key Events]: ${state.eventLedger ? state.eventLedger.join('\\n') : 'None'}
[Story History So Far]:\n${storyContext}
[Current State]: ${JSON.stringify(state)}

## 2. CAUSALITY & LOGICAL REASONING RULE (CoT)
Before writing the story, you MUST evaluate the outcome based on the player's current \`flags\` and \`inventory\`.
- Explain your logic in the \`logicalReasoning\` JSON field first. (e.g., "현재 절정 페이즈이고 유저에게 exhausted 플래그가 있으므로, 도망치려는 시도는 실패하고 다리를 다친다.")

## 3. PATCH-BASED STATE UPDATE RULE
Do NOT rewrite the entire inventory or flags. Only output the DELTA (what changed) in the \`statePatch\` object.
- If an item is used/lost -> \`removeItems\`. If gained -> \`addItems\`.
- If a new status/event occurs -> \`addFlags\`. If resolved -> \`removeFlags\`.
- Location change -> \`locationChange\`.

## 4. PROGRESS CLOCKS (AGGRESSIVE UPDATE REQUIRED)
You MUST push the story forward. Do NOT allow stagnant turns.
- \`track_win\`: Output 1 if the player takes a meaningful risk, discovers a clue, or progresses the plot.
- \`track_lose\`: Output 1 if the player wastes time, makes a safe but useless choice, repeats an action, or fails a critical check.
- (In ACT 2 & 3, at least one of these clocks SHOULD usually be 1).

## 5. NARRATIVE PERSPECTIVE & WRITING STYLE
- Perspective: 2nd Person. STRICTLY OMIT the subject "당신은" or "너는". Describe actions directly.
- Tense & Tone: Use 반말/평서문 (e.g., ~한다, ~했다). Keep descriptions sensory and visceral.
- DIALOGUE FORMATTING (CRITICAL): All spoken dialogue by any character MUST be enclosed exactly in \`<<\` and \`>>\`. Do not use standard quotes. 
  - BAD: 정호가 말했다. "그렇게 하면 안 돼!"
  - GOOD: 정호는 총을 겨누며 말했다. <<움직이지 마!>>

## Output Schema (MUST MATCH EXACTLY)
{
  "logicalReasoning": "string (현재 Phase와 유저의 Flags/Inventory를 종합하여 성공/실패 인과관계 분석. 1-2문장)",
  "text": "string (1-4 paragraphs of story. 주어 '당신은' 생략. 대화문은 << >> 사용.)",
  "turnSummary": "string (1-sentence concise summary of this turn for permanent memory)",
  "statePatch": {
    "addFlags": ["string"], "removeFlags": ["string"], "addItems": ["string"], "removeItems": ["string"], "locationChange": "string or null"
  },
  "clockDelta": {
    "track_win": "number (0 or 1)",
    "track_lose": "number (0 or 1)"
  },
  "tensionLevel": "number (1-10)",
  "options": [
    { "id": "opt1", "text": "string" },
    { "id": "opt2", "text": "string" }
  ],
  "isEnding": "boolean",
  "endingType": "string ('win', 'lose', 'neutral', or null)",
  "nodeTitle": "string (2-4 word short label for this scene, in Korean)"
}`;

    const messages = [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: `## Player Action\n${playerAction}\n\n## Current Inventory\n${state.inventory.join(', ') || 'None'}\n\n## Current Flags\n${JSON.stringify(state.flags || {})}`
        }
    ];

    const result = await chatCompletion(messages, { jsonMode: true });
    if (!result.ok) return result;

    const parsed = safeParseJSON(result.content);
    if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };
    return { ok: true, data: parsed.data };
}