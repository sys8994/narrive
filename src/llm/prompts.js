/**
 * prompts.js — 3 prompt builders for the game pipeline
 * @module llm/prompts
 */

import { chatCompletion } from './apiClient.js';
import { safeParseJSON } from './parse.js';
import * as treeEngine from '../core/treeEngine.js';
import { getNarrativePhaseKey } from '../core/narrativeEngine.js';

// ─── Prompt #1: Background → Follow-up Questions ───────────────────

export async function callPrompt1(userBackground) {
    const messages = [
        {
            role: 'system',
            content: `You are an elite World-Building Art Director designing a high-immersion structured interactive text RPG.

The user will provide a short background description for their story concept.

Your task is to generate exactly 8–10 follow-up questions that define:
1) The "Taste Lens" (THEMATIC GRAVITY and MOOD of the world)
2) The "Starting Premise" (IMMEDIATE INCITING INCIDENT at Turn 1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PHILOSOPHY (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"The user does NOT design secrets, twists, or hidden truths.
The user defines the VIBE and the STARTING SITUATION.
The AI owns the unpredictable hidden reality."

The mystery must remain strictly blackboxed.
NEVER force the user to:
- reveal the villain’s identity
- define the ultimate twist
- determine how the story resolves
- explain how the crime happened

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1) EXTRACT & GROUND (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Extract 3–5 key thematic elements from the user's input.
   - These may be emotional (e.g., isolation, decay), structural (e.g., collapsing empire), aesthetic (e.g., neon-lit city), or ideological.
2. Output them FIRST in "_extractedKeywords".
3. EVERY question label MUST explicitly reflect at least ONE extracted keyword (in Korean wording) to feel highly personalized. No generic phrasing allowed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2) STRICT CATEGORY SEPARATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST generate exactly 8–10 questions total.
You MUST divide them strictly into TWO categories:
- Exactly 4–5 "vibe"
- Exactly 4–5 "situation"
If the distribution is wrong, the output is invalid.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY 1: "vibe" (Exactly 4–5 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Definition: Abstract aesthetics, emotional undertones, narrative grittiness, and the psychological weight of the universe.
Goal: Establish the literary "flavor" and tensions without writing the plot.

YOU MUST DRAW INSPIRATION FROM THESE HIGH-QUALITY EXAMPLES (Adapt to user's theme):
[Sensory Temperature & Mood]
- "이 세계의 공기에 짙게 깔려 있는, 사람들을 지배하는 가장 주된 정서는 무엇입니까?"
- "이야기의 전반적인 분위기를 한 폭의 추상화로 표현한다면, 어떤 색채와 온도에 가깝습니까?"
- "이 세계의 밑바닥에 조용히 흐르고 있는 가장 서늘하거나 쓸쓸한 감각은 어떤 형태입니까?"
[Tension & Fear]
- "이 이야기에서 주인공의 숨통을 서서히 조여오는 위협은 주로 어떤 형태를 띠고 있습니까?"
- "등장인물들이 죽음보다 더 끔찍하게 여기는 '최악의 절망'은 어떤 모습입니까?"
- "진실에 다가갈수록 주인공이 느끼게 될 주된 심리적 감각은 무엇입니까?"
[Weight of the Narrative]
- "이 세계에서 피를 흘리거나 위기에 처했을 때, 이야기는 이를 얼마나 무겁고 현실적으로 묘사합니까?"
- "폭력이나 물리적인 충돌이 발생할 때, 이야기는 그 순간을 어떤 템포와 시선으로 그려냅니까?"
- "누군가를 맹목적으로 믿고 등을 맡기는 행위는 이 이야기에서 주로 어떤 결과를 초래합니까?"
[Treatment of the Unknown & Desire]
- "인간의 상식을 벗어난 기이한 현상이나 미지의 힘은 이 세계에서 어떤 필터로 다루어집니까?"
- "이 세계에서 가장 가치 있게 여겨지며, 사람들을 움직이게 만드는 '보이지 않는 욕망'은 무엇입니까?"

MUST NOT Ask: Trivial visual details (e.g., "벽지 색깔은 무엇인가요?"), socio-economic mechanics, or meta-game settings (difficulty level, UI).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY 2: "situation" (Exactly 4–5 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Definition: Micro-level Turn 1 Inciting Incident.
The player must be placed in a concrete present-tense dilemma.

You MUST include questions covering:
1) Exact starting physical location (e.g., "Where exactly are you trapped?")
2) Immediate visceral danger (e.g., "What is the urgent sound outside the door?")
3) Protagonist’s surface role or cover identity.
4) One personal limitation / weakness / penalty.

GOOD EXAMPLES:
- "당신은 현재 봉쇄된 연구소 1층에 갇혀 있습니다. 문 밖에서 들려오는 위협적인 소리는 무엇입니까?"
- "이야기가 시작되는 시점, 당신이 가진 가장 치명적인 약점(또는 페널티)은 무엇입니까?"

BAD EXAMPLES:
- "현재 어떤 문제가 있습니까?" (Too vague)
- "주변 환경의 제약은 무엇입니까?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL UX POLICY (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Typing must be minimized.
1) EXACTLY 8–10 questions.
2) ZERO sliders. ZERO textarea.
3) At least 7 MUST be type "select".
4) Maximum 2 may be type "text" (for proper nouns only).
5) Use "checkbox" ONLY if multiple selections are narratively meaningful.
6) Each "select" must have 4–7 options.
7) Each select MUST include ONE option for "기타(직접 입력)" OR "상관없음(자동 생성)".
8) Options must be hyper-specific and visually evocative. (No generic labels).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT FIELD VALIDATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Exactly 4–5 questions must have "category": "vibe".
- Exactly 4–5 questions must have "category": "situation".
- If type != "select" AND type != "checkbox", options MUST be an empty array [].
- If type != "text", placeholder MUST be "".
- required MUST always be true.
- IDs must be sequential (q1, q2, q3 ...).
If any rule is violated, regenerate internally before responding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY SELF-CHECK (MANDATORY BEFORE OUTPUT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before finalizing, verify:
1) Did I use the 12 Vibe examples to create deep, thematic questions instead of trivial ones?
2) Are situation questions concrete and immediate?
3) Are there ZERO sliders?
4) Are at least 7 selects present, and do they include "기타/상관없음"?
5) Are plot secrets protected?
6) Is keyword grounding visible in EVERY label?
7) Did I strictly follow the empty array/string rules for options/placeholder?
If not, internally fix before output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SCHEMA (STRICT JSON ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST respond with ONLY a JSON object in this exact schema:
{
  "_extractedKeywords": ["string"],
  "title": "가제 (Korean, immersive and thematic title)",
  "questions": [
    {
      "id": "q1",
      "category": "vibe" | "situation",
      "label": "Korean question text",
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
2) The user's specific answers to the "Taste Lens" (Vibe) and "Starting Premise" (Situation).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"The user designed the VIBE and the SITUATION. YOU must now design the SECRET PLOT and the ENGINE SCHEMA."
The Hidden Plot must be brutally concrete, structurally robust, and mathematically tied to the schema entities. Do NOT use vague tropes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PUBLIC WORLD (Player-Facing Vibe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Structure using markdown bullet points:
- [Atmosphere & Texture]: Sensory details and overall mood based on the Vibe answers.
- [Absolute Rules/Taboos]: Strictly forbidden or physically impossible things.
- [Societal State]: Public power dynamics and daily struggles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. HIDDEN PLOT (The Blackbox - CRITICAL FOR ENGINE LOGIC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST structure this field using markdown bullet points. This section is strictly divided into two parts: "The Objective Truth" and "The Progression Framework".
You MUST explicitly use the exact Proper Nouns defined in your "worldSchema".

PART A: 사건의 전말 (The Objective Truth)
- [궁극적 진실]: 턴 1 이전에 이미 벌어진 팩트. 누가, 왜, 어떻게 이 상황을 만들었는지 육하원칙으로 상세히 기술.
- [단서의 조각들]: 이 진실을 증명할 수 있는 결정적 물리적/정보적 단서 3가지가 현재 스키마의 어느 Location이나 NPC에게 있는지 구체적으로 매핑.
- [핵심 반전]: 주인공(유저)이 턴 1 시점에 상황에 대해 완전히 오해하고 있는 단 하나의 사실.

PART B: 서사 전개 프레임워크 (The Progression Framework)
- [적대자의 목적과 동선]: 유저가 진실을 파헤치는 동안, 흑막은 자신의 목적을 달성하거나 유저를 방해하기 위해 '현재' 어떤 단계적인 행동을 취하고 있는가?
- [국면 전환 타임라인]: 스토리가 발단->전개->절정으로 넘어갈 때 (또는 Clock이 쌓일 때), 스토리를 다음 페이즈로 강제 견인할 굵직한 사건(Event) 3가지 배치.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ENGINE SCHEMA (worldSchema - STRICT INTEGRITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATE distinct, memorable Korean proper nouns for everything. NO generic placeholders.
- protagonist: MUST include "startingLocationId" which matches exactly one location ID from the locations array.
- locations (Min 4): Form a logical map. "connectedTo" MUST ONLY contain IDs that actually exist in this array.
- npcs (Min 3): Each needs a "motive" (public behavior) and a "secret" (hidden truth tied to the Hidden Plot).
- items (Min 4): Must be story-relevant clues/tools. "initialLocationId" MUST match an existing location ID.
- winConditions / loseConditions: Concrete narrative milestones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. OPENING SCENE (openingText) - EXPOSITION FOCUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Write 2-3 paragraphs of highly immersive opening narration.
- MUST explicitly establish the Protagonist: Reveal their 'role', 'limitation', and immediate physical/mental condition.
- MUST establish the Environment: Vividly describe the sensory details (smell, temperature, lighting) of the "startingLocationId".
- MUST establish the Hook: Introduce the immediate crisis based EXACTLY on the user's "Situation" answers. Preserve the mystery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. NARRATIVE PERSPECTIVE & WRITING STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Perspective: 2nd person. OMIT the subject "당신은". Describe actions directly (e.g., "굳게 닫힌 문을 조심스럽게 밀고 들어간다.").
- Tense & Tone: Use 반말/평서문 (~한다, ~했다). 
- DIALOGUE RULE: All spoken dialogue MUST be enclosed in \`<<\` and \`>>\`. (e.g., 남자가 외쳤다. <<거기 멈춰!>>)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SELF-CHECK (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before outputting JSON, silently verify:
1. Is the "hiddenPlot" split into Truth and Framework, heavily referencing schema IDs?
2. Does "protagonist.startingLocationId" EXACTLY match a location ID?
3. Are all IDs in "connectedTo" real locations?
4. Does the "openingText" explicitly describe the protagonist's identity and the starting location's sensory details?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SCHEMA (STRICT JSON ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "title": "Story title (Korean, Immersive)",
  "publicWorld": "string (Markdown bullets)",
  "hiddenPlot": "string (Markdown bullets for PART A and PART B. > 600 characters)",
  "openingText": "string (2-3 paragraphs. Deep exposition of character, location, and immediate crisis)",
  "initialThemeColor": "string (HEX code)",
  "climaxThemeColor": "string (HEX code)",
  "accentColor": "string (HEX code)",
  "worldSchema": {
    "protagonist": { "id": "pc", "name": "string", "role": "string", "limitation": "string", "startingLocationId": "string" },
    "locations": [ { "id": "loc1", "name": "string", "desc": "string", "connectedTo": ["loc2"] } ],
    "npcs": [ { "id": "npc1", "name": "string", "role": "string", "motive": "string", "secret": "string" } ],
    "items": [ { "id": "item1", "name": "string", "desc": "string", "initialLocationId": "loc1" } ],
    "winConditions": [ { "id": "win1", "desc": "string" } ],
    "loseConditions": [ { "id": "lose1", "desc": "string" } ]
  }
}
`
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

const PHASE_ACT1 = `
[PHASE: ACT 1 - 발단 (Introduction & Exposition)]
- 디렉팅 목표: 세계관의 질감, 유저(주인공)의 신분과 제약 조건, 그리고 현재 장소의 물리적 구조를 유저에게 자연스럽게 각인시키십시오.
- 서술 규칙: 다짜고짜 스토리를 급전개시키지 마십시오. 유저가 주변 환경을 둘러보고, 이 세계의 불문율이나 분위기를 파악할 수 있도록 깊이 있는 묘사에 비중을 두십시오.
- 선택지 방향: '주변 환경 탐색', '가진 물건 확인', '현재 상황 파악' 등 정보 수집과 상황 이해를 돕는 선택지를 반드시 포함하십시오.
`;

const PHASE_ACT2 = `
[PHASE: ACT 2 - 전개 (Rising Action & Investigation)]
- 디렉팅 목표: 본격적인 갈등과 위협을 노출시키며, P2의 [단서의 조각들]을 추적하도록 유도하십시오.
- 서술 규칙: 행동에는 분명한 대가(Cost)가 따릅니다. 무모한 행동 시 부상을 입거나 아이템을 잃게 만드십시오.
- 선택지 방향: '위험 감수(Risk)와 정보 획득' vs '안전(Safety)과 기회 상실' 사이에서 고민하게 만드는 무거운 선택지를 제공하십시오.
`;

const PHASE_ACT3 = `
[PHASE: ACT 3 - 절정 (Climax)]
- 디렉팅 목표: 호흡을 짧고 긴박하게 유지하십시오. 흑막의 실체나 치명적인 위협이 유저의 눈앞에 직접적으로 들이닥쳐야 합니다.
- 서술 규칙: 부정적 플래그(exhausted 등)가 있다면 가차 없이 치명적인 결과(영구적 손실, 신체 절단 등)로 연결하십시오.
- 선택지 방향: 생존이나 돌이킬 수 없는 피해를 결정짓는, 극단적이고 폭력적인 선택지를 제공하십시오.
`;

const PHASE_ENDING = `
[PHASE: ENDING - 결말 (Resolution)]
- 디렉팅 목표: 진척도 시계(Clocks)가 임계점을 넘었습니다. 이야기를 완전히 종결시키십시오.
- 서술 규칙: 승리 혹은 파멸의 결과를 3~5문단으로 장엄하게, 영화의 엔딩 씬처럼 묘사하십시오.
- 선택지 룰: 새로운 행동 선택지를 주지 마십시오. "options" 배열을 빈 배열([])로 반환하십시오.
- 상태 변경: 반드시 "isEnding": true 로 설정하십시오.
`;

export async function callPrompt3(session, selectedOption) {
    const storyContext = buildStoryContext(session);
    const state = session.gameState;
    const clocks = state.clocks || { win: 0, lose: 0 };
    const maxClock = Math.max(clocks.win, clocks.lose);

    let currentPhasePrompt = PHASE_ACT1;
    if (maxClock >= 10 || state.turnCount >= 20) currentPhasePrompt = PHASE_ENDING;
    else if (maxClock >= 7 || state.turnCount >= 14) currentPhasePrompt = PHASE_ACT3;
    else if (maxClock >= 3 || state.turnCount >= 5) currentPhasePrompt = PHASE_ACT2;

    const playerAction = selectedOption
        ? `The player chose: "${selectedOption.text}"`
        : 'This is the genesis of the story. Describe the starting scene based on the SITUATION setup.';

    const systemPrompt = `You are the Game Master of a structured interactive text RPG.
You are not merely writing prose. You are running a strict narrative simulation engine.

────────────────────────────────────────
0. CURRENT NARRATIVE PHASE (HARD CONTROL)
────────────────────────────────────────
${currentPhasePrompt}

────────────────────────────────────────
1. CANON CONTINUITY & SCHEMA DISCIPLINE
────────────────────────────────────────
[World Vibe]: ${session.synopsis.publicWorld || 'N/A'}
[Hidden Plot]: ${session.synopsis.hiddenPlot || 'N/A'}
[World Schema]: ${JSON.stringify(session.synopsis.worldSchema || {})}
[Past Key Events]: ${state.eventLedger ? state.eventLedger.join('\\n') : 'None'}
[Story History]:\n${storyContext}
[Current State]: ${JSON.stringify(state)}

SCHEMA BINDING & PHYSICAL REALITY (CRITICAL):
You MUST treat the worldSchema as a strict physical engine.
1. Spatial Awareness: When describing the current location, explicitly hint at the exits or paths leading to locations in the "connectedTo" array. Options for movement MUST logically align with these paths.
2. NPC Motive Injection: If an NPC is present, their dialogue and actions MUST be heavily colored by their "motive" and "secret".
3. Item Relevance: If a schema "item" is relevant or in the inventory, explicitly describe its physical presence, weight, or condition.

────────────────────────────────────────
2. NARRATIVE ENGINE RULES (INTEGRATING HIDDEN PLOT)
────────────────────────────────────────
1. Fragmentation of Truth: Never reveal the full [사건의 전말] at once. Reveal fragments ONLY when the player investigates the mapped clues or presses NPCs.
2. Framework-Driven Guidance: If the player stalls, trigger events from the [적대자의 목적과 동선] or [국면 전환 타임라인] to force the story forward.
3. Invisible Hand Options: Ensure at least ONE option subtly hooks the player toward a clue or location mentioned in the Hidden Plot without being meta. (e.g., "환풍구 안쪽에서 바스락거리는 소리가 들린다. 덮개를 뜯어낸다.")

────────────────────────────────────────
3. STATE INTEGRITY & CAUSALITY (CoT)
────────────────────────────────────────
Evaluate the outcome BEFORE writing text. Explain your logic in the \`logicalReasoning\` JSON field first.
- Reference the current Phase penalty, relevant \`flags\`, and \`inventory\`.
- PATCH-BASED STATE UPDATE: Only output the DELTA in \`statePatch\`. NEVER wipe the inventory or flags array. Preserve unmentioned state implicitly.

────────────────────────────────────────
4. PROGRESS CLOCKS & ANTI-STALLING
────────────────────────────────────────
- \`track_win\`: +1 if the player takes a meaningful risk, discovers a clue, or progresses the plot.
- \`track_lose\`: +1 if the player wastes time, repeats an action, or fails a check.
- ANTI-STALLING: If the player repeats the same intent or stalls, trigger a logical catastrophic consequence and set \`track_lose\` = 1.

────────────────────────────────────────
5. NARRATIVE PERSPECTIVE & WRITING STYLE
────────────────────────────────────────
- Perspective: 2nd Person. STRICTLY OMIT the subject "당신은" or "너는". Describe actions directly.
- Tense & Tone: Use 반말/평서문 (~한다, ~했다). Keep descriptions sensory and visceral.
- DIALOGUE FORMATTING (CRITICAL): ALL spoken dialogue MUST be enclosed exactly in \`<<\` and \`>>\`. (e.g., 정호는 피를 토하며 외쳤다. <<당장 여기서 벗어나!>>)

────────────────────────────────────────
6. CHOICE SPECIFICITY & DIVERSITY
────────────────────────────────────────
FORBIDDEN GENERIC VERBS: NEVER use "조사한다", "검토한다", "알아본다", "대화한다", "확인한다", "생각해본다", "접근한다", "방법을 찾는다".

- TEXT ↔ OPTION LOCK: Every object, NPC, or location mentioned in an option MUST be explicitly described in the preceding story text.
- DIVERSITY: Vary formats (Physical action, Dialogue/Stance, Deduction, Risk Trade-off). Choosing A MUST sacrifice B.

────────────────────────────────────────
OUTPUT SCHEMA (STRICT JSON ONLY)
────────────────────────────────────────
{
  "logicalReasoning": "string (1-3 sentences explaining causality based on phase/flags/inventory/hidden plot)",
  "text": "string (1-4 paragraphs of story. 주어 생략. Dialogue uses << >>)",
  "turnSummary": "string (1-sentence concise Korean summary of this turn's events)",
  "statePatch": {
    "addFlags": ["string"], "removeFlags": ["string"], "addItems": ["string"], "removeItems": ["string"], "locationChange": "string or null"
  },
  "clockDelta": {
    "track_win": "number (0 or 1)",
    "track_lose": "number (0 or 1)"
  },
  "tensionLevel": "number (1-10)",
  "options": [
    { "id": "opt1", "text": "string (Highly specific action/dialogue. NO generic verbs.)" },
    { "id": "opt2", "text": "string (Highly specific action/dialogue. NO generic verbs.)" }
  ],
  "isEnding": "boolean",
  "endingType": "string ('win', 'lose', 'neutral', or null)",
  "nodeTitle": "string (2-4 word short label for this scene, in Korean)"
}
`;

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