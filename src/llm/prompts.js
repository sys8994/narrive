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
3) ALL questions MUST not be type "text" ("select" type is highly recommanded).
4) Use "checkbox" ONLY if multiple selections are narratively meaningful.
5) Each "select" must have 4–7 options. 
   *(주의: "기타(직접 입력)" 또는 "상관 없음" 옵션은 시스템이 자동 추가하므로 절대 직접 생성하지 마십시오.)*
6) Options must be hyper-specific and visually evocative. (No generic labels).

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
4) Are at least 7 selects present? (DO NOT include "기타" or "상관없음")
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
      "options": ["A", "B", "C"],
      "placeholder": "...",
      "required": true
    }
  ]
}`
    },
    { role: 'user', content: userBackground }
  ];

  const result = await chatCompletion(messages, { jsonMode: true, temperature: 0.8 });
  if (!result.ok) return result;

  const parsed = safeParseJSON(result.content);
  if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };

  // Inject mandatory options for select-type questions at the engine level
  if (Array.isArray(parsed.data.questions)) {
    parsed.data.questions.forEach(q => {
      if (q.type === 'select' && Array.isArray(q.options)) {
        if (!q.options.includes('기타(직접 입력)')) q.options.push('기타(직접 입력)');
        if (!q.options.includes('상관 없음(자동 생성)')) q.options.push('상관 없음(자동 생성)');
      }
    });
  }

  return { ok: true, data: parsed.data };
}





// ─── Prompt #2: Form Answers → Synopsis + Opening + Theme ──────────

export async function callPrompt2(userBackground, formAnswers, storyLength = '중편') {
  const answersText = Object.entries(formAnswers).map(([id, val]) => `${id}: ${val}`).join('\n');

  // 분량에 따른 가이드라인 동적 생성
  const lengthGuidance = storyLength === '단편'
    ? "[스토리 분량: 단편 (Short)] 빠르고 강렬한 전개. Locations 2~3개, NPCs 1~2명, Items 2~3개로 제한하여 밀도를 높이십시오."
    : storyLength === '장편'
      ? "[스토리 분량: 장편 (Long)] 깊고 방대한 서사. Locations 5개 이상, NPCs 4명 이상, Items 5개 이상으로 다채로운 세계를 구성하십시오."
      : "[스토리 분량: 중편 (Medium)] 표준적인 볼륨. Locations 3~4개, NPCs 2~3명, Items 3~4개로 균형 잡힌 세계를 구성하십시오.";

  const messages = [
    {
      role: 'system',
      content: `You are an elite Narrative Architect and Game Logic Engineer for a structured interactive text RPG.

Input Data:
1) The user's original background concept.
2) The user's specific answers to the "Taste Lens" (Vibe) and "Starting Premise" (Situation).
3) Target Story Length: ${storyLength}

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
${lengthGuidance}
- protagonist: MUST include "startingLocationId" which matches exactly one location ID from the locations array.
- locations (Min 4): Form a logical map. "connectedTo" MUST ONLY contain IDs that actually exist in this array.
- npcs (Min 3): Each needs a "motive" (public behavior) and a "secret" (hidden truth tied to the Hidden Plot).
- items (Min 4): Must be story-relevant clues/tools. "initialLocationId" MUST match an existing location ID.
- winConditions / loseConditions: Concrete narrative milestones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. OPENING SCENE (openingText) - MACRO PROLOGUE FOCUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Write 2-3 paragraphs of a cinematic PROLOGUE. Each paragraph must be separated by two line breaks.
- Focus on the macro-level world-building, the overarching atmosphere, the societal tension, or the history of the world.
- Make it sound like a movie trailer voiceover setting the grand stage.
- DO NOT describe the protagonist's immediate physical actions, their exact starting location, or the immediate Turn 1 crisis here. Leave the immediate action for the game engine to start.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. NARRATIVE PERSPECTIVE & WRITING STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Perspective: 2nd person. OMIT the subject "당신은" or "너는". Describe actions directly (e.g., "굳게 닫힌 문을 조심스럽게 밀고 들어간다.").
- Tense & Tone: Use 반말/평서문 (~한다, ~했다). 
- DIALOGUE RULE: All spoken dialogue MUST be enclosed in \`<<\` and \`>>\`. (e.g., 남자가 외쳤다. <<거기 멈춰!>>)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SELF-CHECK (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before outputting JSON, silently verify:
1. Is the "hiddenPlot" split into Truth and Framework, heavily referencing schema IDs?
2. Does "protagonist.startingLocationId" EXACTLY match a location ID?
3. Are all IDs in "connectedTo" real locations?
4. Does the "openingText" act as a MACRO PROLOGUE without explicitly starting the immediate physical action?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SCHEMA (STRICT JSON ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
"title": "Story title (Korean, Immersive)",
  "publicWorld": "string (Markdown bullets)",
  "hiddenPlot": "string (Markdown bullets for PART A and PART B. > 600 characters)",
  "openingText": "string (2-3 paragraphs. Cinematic PROLOGUE setting the macro world vibe. No immediate character actions. Each paragraph separated by two line breaks.)",
  "initialThemeColor": "string (HEX code)",
  "climaxThemeColor": "string (HEX code)",
  "accentColor": "string (HEX code)",
  "entryLabel": "string (Korean, 2-3 words, 세계관과 스토리에 따라 달라짐. '모험을 시작합니다', '문이 열립니다', '어둠이 걷힙니다', '건물 안으로 진입합니다' 이런 식으로.)",
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

  const result = await chatCompletion(messages, { jsonMode: true, temperature: 0.8 });
  if (!result.ok) return result;
  const parsed = safeParseJSON(result.content);
  if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };
  return { ok: true, data: parsed.data };
}







// ─── Prompt #3: Turn Progression (Dynamic Narrative Phases & Schema Injection) ────────

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
    const turnLabel = node.depth === 0 ? "Prologue/Background" : node.depth;
    if (isRecent) {
      const allOptions = node.options.map(o => `- ${o.text}`).join('\n');
      contextString += `[Turn ${turnLabel}] (FULL)\nText: ${node.text}\nOptions Provided:\n${allOptions}\nAction Taken: ${selectedOpt}\n\n`;
    } else {
      const summary = node.turnSummary || node.text.substring(0, 50) + "...";
      contextString += `[Turn ${turnLabel}] (SUMMARY)\nSummary: ${summary}\nAction Taken: ${selectedOpt}\n\n`;
    }
  });
  return contextString;
}

/**
 * buildDynamicSchemaContext — Filter and format the world schema for the current turn.
 */
function buildDynamicSchemaContext(session) {
  const { gameState, synopsis } = session;
  const worldSchema = synopsis.worldSchema || {};
  const currentLocationId = gameState.location;

  // 1. Current Location
  const currentLoc = worldSchema.locations?.find(l => l.id === currentLocationId);
  const locString = currentLoc
    ? `[CURRENT LOCATION: ${currentLoc.name} (ID: ${currentLoc.id})]\n- ${currentLoc.desc}`
    : `[CURRENT LOCATION: Unknown (ID: ${currentLocationId})]`;

  // 2. Visible Exits
  const connectedLocs = worldSchema.locations?.filter(l => currentLoc?.connectedTo?.includes(l.id)) || [];
  const exitsString = connectedLocs.length > 0
    ? `[VISIBLE EXITS / PATHS]\n` + connectedLocs.map(l => `- ${l.name} (Move to ID: ${l.id})`).join('\n')
    : `[VISIBLE EXITS / PATHS]\n- None apparent.`;

  // 3. Items in Room
  const itemsHere = worldSchema.items?.filter(i => i.initialLocationId === currentLocationId && !gameState.inventory.includes(i.name)) || [];
  const itemsString = itemsHere.length > 0
    ? `[ITEMS IN THIS ROOM (Can be picked up or examined)]\n` + itemsHere.map(i => `- ${i.name}: ${i.desc}`).join('\n')
    : `[ITEMS IN THIS ROOM]\n- No visible items.`;

  // 4. Inventory
  const inventoryString = `[INVENTORY/KEY ITEMS HELD]\n- ${gameState.inventory.length > 0 ? gameState.inventory.join(', ') : 'Empty.'}`;

  // 5. Active NPCs (Randomly pick 1)
  let npcString = "[ACTIVE NPC POTENTIAL]\n- (중요) 설정된 NPC가 없더라도, 현재 상황에 맞는 새로운 인물(행인, 적, 조력자 등)을 세계관에 맞게 즉석에서 창조하여 유저의 서사에 개입시키십시오. 주인공이 혼자 돌아다니며 독백하거나 탐색만 하게 두지 마십시오. 항상 타인 또는 외부 요소와의 활발한 상호작용이 일어나야 합니다.";
  if (worldSchema.npcs && worldSchema.npcs.length > 0) {
    const randomNpc = worldSchema.npcs[Math.floor(Math.random() * worldSchema.npcs.length)];
    npcString = `[ACTIVE NPC POTENTIAL (Consider involving them)]\n- ${randomNpc.name} (${randomNpc.role}): Public Motive is '${randomNpc.motive}'\n- (중요) 이 NPC 또는 상황에 맞는 새로운 주변 인물들을 서사에 적극 개입시키십시오. 주인공 혼자 탐색이나 독백으로 시간을 보내게 하지 말고 대화와 상호작용을 유도하십시오.`;
  }

  return `${locString}\n\n${exitsString}\n\n${itemsString}\n\n${inventoryString}\n\n${npcString}`;
}

const PHASE_ACT1 = `
[PHASE: ACT 1 - 발단 (Introduction & Exposition)]
- 서사 템포: 유유하고 상세한 호흡. 긴장감은 아직 수면 아래에 있습니다.
- 서술 목표: 일상적이거나 평온해 보이지만 묘한 이질감이 느껴지는 분위기를 조성하십시오. 혼자 방치되어 공간만 관찰하게 두지 말고, 누군가와의 만남이나 가벼운 사건의 발생 등 본격적인 이야기의 '시작'을 알리는 동적인 이벤트를 전개하십시오.
- 선택지 방향: 타인(또는 주요 사물)과 직접적으로 대화하거나 개입하는 등, 사회적 상호작용과 구체적인 행동을 이끌어내는 선택지를 제시하십시오. 단순 정보 수집 목적의 선택지는 지양합니다.
`;

const PHASE_ACT1_INITIAL = `
[PHASE: ACT 1 (START) - 첫 번째 전개 (Initial Action)]
- 상황: 프롤로그(Turn 0)는 이미 끝났습니다. 유저는 이제 게임의 첫 번째 행동을 시작한 상태입니다.
- 서술 목표: 배경 설명을 장황하게 반복(Echo)하지 마십시오. 유저의 첫 번째 선택에 대한 "즉각적이고 물리적인 결과"와 타인의 반응, 들이닥친 사건 등 "현재 진행형의 감각 정보"를 제공하여 능동적인 씬(Scene)을 첫 문장부터 시작하십시오.
- 금기 사항: 프롤로그의 문장을 복붙하거나, "문명은 멸망했다...", "당신은 눈을 떴다..." 같은 고립된 고독한 분위기로만 몰아가는 것은 치명적인 오류입니다.
`;

const PHASE_ACT2 = `
[PHASE: ACT 2 - 전개 (Rising Action & Conflict)]
- 서사 템포: 호흡이 점차 빨라지고, 갈등과 위기가 본격적으로 표면화됩니다.
- 서술 목표: 유저의 목적 달성을 가로막는 물리적, 사회적 장애물(적대자, 배신자, 돌발적인 사고)을 가차 없이 등장시키십시오. 정적인 추리나 정보 수집이 아니라, 살아 숨쉬는 인물 간의 갈등이나 구체적인 위기 상황 속으로 유저를 던져 넣으십시오.
- 선택지 방향: 희생이나 위험을 감수하고(Risk) 장애물을 정면 돌파할 것인지, 또 다른 기회비용을 내고 우회할 것인지를 강요하는 갈등형 선택지를 제시하십시오.
`;

const PHASE_ACT3 = `
[PHASE: ACT 3 - 절정 (Climax)]
- 서사 템포: 서술의 호흡이 가장 짧고 격정적이며, 폭력적이고 숨막히는 긴장감을 유지합니다.
- 서술 목표: 이야기의 모든 갈등이 한 공간에서 폭발하는 최후의 위기 상황입니다. 돌아갈 길은 없으며, 가장 위협적인 존재와의 직접적이고 최후의 대면을 스펙터클하게 서술하십시오.
- 선택지 방향: 목숨을 걸거나 스스로의 일부를 영구히 희생해야만 하는, 극단적이고 치명적인 선택지 2개를 강제하십시오.
`;

const PHASE_RESOLUTION = `
[PHASE: RESOLUTION - 결말부 진입 (The Dust Settles)]
- 톤 앤 매너: 모든 갈등이 방금 종료되었습니다. 승리했다면 안도감이, 패배했다면 돌이킬 수 없는 절망감이 지배합니다.
- 서술 목표: 클락(Clock) 점수에 따라 이번 사건이 어떻게 일단락되었는지 직후의 상황을 2~3문단으로 묘사하십시오.
- 특수 룰 (CRITICAL):
  1. \`statePatch.addFlags\` 배열에 반드시 \`"epilogue_ready"\`를 추가하십시오.
  2. 선택지는 오직 다음 1개만 출력하십시오: [{"id": "opt_epilogue", "text": "에필로그를 확인한다."}]
  3. 아직 게임을 끝내지 마십시오. \`isEnding\`은 false여야 합니다.
`;

const PHASE_EPILOGUE = `
[PHASE: EPILOGUE - 에필로그 (The Aftermath)]
- 톤 앤 매너: 정적이고 묵직한 여운.
- 서술 목표: 유저의 이전 선택들과 누적된 결과를 바탕으로, 이 세계와 주인공의 최종적인 운명을 영화의 엔딩 크레딧처럼 3~4문단으로 장엄하게 묘사하십시오.
- 특수 룰 (CRITICAL):
  1. 더 이상의 행동은 불가능합니다. "options" 배열을 반드시 빈 배열([])로 반환하십시오.
  2. 반드시 \`isEnding\`을 true 로 설정하고, \`endingType\`을 명시하여 게임을 완전히 종결하십시오.
`;

export async function callPrompt3(session, selectedOption) {
  const storyContext = buildStoryContext(session);
  const state = session.gameState;
  const clocks = state.clocks || { win: 0, lose: 0 };
  const maxClock = Math.max(clocks.win, clocks.lose);

  // ─── 분량(Length) 기반 동적 페이즈 판별 로직 ───
  // 세션 정보에서 storyLength를 가져오거나 기본값 사용
  const length = session.synopsis?.storyLength || '중편';

  // narrativeEngine으로 페이즈 판별 위임
  const phaseKey = getNarrativePhaseKey(state.turnCount, clocks, length);

  let phaseMode = phaseKey;
  let currentPhasePrompt = PHASE_ACT1;

  if (state.flags?.epilogue_ready) {
    phaseMode = "EPILOGUE";
    currentPhasePrompt = PHASE_EPILOGUE;
  } else if (phaseMode === "ENDING") {
    phaseMode = "RESOLUTION";
    currentPhasePrompt = PHASE_RESOLUTION;
  } else if (phaseMode === "ACT3") {
    currentPhasePrompt = PHASE_ACT3;
  } else if (phaseMode === "ACT2") {
    currentPhasePrompt = PHASE_ACT2;
  } else if (state.turnCount === 0) {
    currentPhasePrompt = PHASE_ACT1_INITIAL;
  }

  // 동적 텍스트 분량 조절
  let lengthDirective = "";
  if (phaseMode === "EPILOGUE" || phaseMode === "RESOLUTION" || phaseMode === "ACT3") {
    lengthDirective = "최후의 순간이거나 엔딩에 다다른 만큼, 밀도 있고 호흡이 긴 문장으로 2~4문단 분량(최소 300자 이상)을 풍부하게 서술하십시오.";
  } else {
    lengthDirective = "상황의 몰입을 돕기 위해 시각/청각적 묘사를 적극 활용하여 안정적인 1~3문단 분량(최소 200자 이상)을 서술하십시오. 너무 짧게 쓰지 마십시오.";
  }

  const playerAction = selectedOption ? selectedOption.text : (session.synopsis?.entryLabel || "모험 시작");
  const dynamicSchemaContext = buildDynamicSchemaContext(session);

  let dynamicRules = "";
  if (phaseMode === "RESOLUTION" || phaseMode === "EPILOGUE") {
    dynamicRules = `
────────────────────────────────────────
ENDING LOGIC (OVERRIDE ALL OTHER RULES)
────────────────────────────────────────
- Do NOT generate multiple diverse choices. Follow the PHASE specific rules for options exactly.
- Anti-stalling is DISABLED. Focus entirely on narrative closure and emotional resonance.
`;
  } else {
    dynamicRules = `
────────────────────────────────────────
NORMAL PLAY LOGIC: PROGRESS & ANTI-STALLING
────────────────────────────────────────
- \`track_win\`: +1 if the player takes a meaningful risk, engages in deep social interaction, or boldly overcomes an obstacle.
- \`track_lose\`: +1 if the player wastes time, avoids interaction, repeats passive observations, or fails a check.
- ANTI-STALLING: If the player stalls by just "looking around" or "thinking", immediately force an active event (someone approaches, an attack happens). Set \`track_lose\` = 1.

────────────────────────────────────────
CHOICE SPECIFICITY & DIVERSITY (CRITICAL)
────────────────────────────────────────
- OPTION QUANTITY: You MUST generate EXACTLY 2 options to save tokens. Only generate 3 if a situation absolutely demands a highly distinct third path. NEVER generate more than 3.
- FORBIDDEN PASSIVE VERBS: NEVER use "주변을 둘러본다", "조사한다", "단서를 찾는다", "생각해본다". Force direct action or dialogue.
- DIVERSITY: At least ONE option MUST involve Dialogue or Social/Physical confrontation with another entity if present. Vary approaches (Bribe vs Attack, Persuade vs Sneak).
`;
  }

  const systemPrompt = `You are the Game Master of a structured interactive text RPG.
You are not merely writing prose. You are running a strict narrative simulation engine.

────────────────────────────────────────
0. CURRENT NARRATIVE PHASE (ABSOLUTE PRIORITY)
────────────────────────────────────────
${currentPhasePrompt}
${lengthDirective}

────────────────────────────────────────
1. MANDATORY SCHEMA INJECTION & INTERACTION RULES
────────────────────────────────────────
Below is the physical reality of the current turn. You MUST follow these conditional rules based on the injected data:

${dynamicSchemaContext}

[CONDITIONAL INTERACTION RULES]
- IF [ITEMS IN THIS ROOM] is NOT empty: You MUST explicitly describe the item in the text. At least ONE option MUST allow the player to interact with or pick up this item.
- IF [ACTIVE NPC POTENTIAL] is provided: You MUST introduce this NPC into the scene this turn. They must speak or act based on their 'motive'. At least ONE option MUST involve reacting to or conversing with them.
- IF the player attempts to move: They can ONLY move to locations listed in [VISIBLE EXITS]. If you provide a movement option, it must lead to one of these exact exits.
- IF the player faces a physical obstacle: Review [INVENTORY]. If an item could logically help, subtly hint at it in the text.

────────────────────────────────────────
2. CANON CONTINUITY & ENGINE LOGIC
────────────────────────────────────────
[World Vibe]: ${session.synopsis.publicWorld || 'N/A'}
[Hidden Plot]: ${session.synopsis.hiddenPlot || 'N/A'}
[Story History]:\n${storyContext}

- Fragmentation of Truth: Never reveal the full [사건의 전말] at once. Reveal fragments ONLY through dynamic events, conflicts, or dialogue, NOT passive clue-finding.
- Invisible Hand Options: In ACT1/2, ensure at least ONE option subtly pulls the player into a social interaction or conflict related to the Hidden Plot.

────────────────────────────────────────
3. STATE INTEGRITY (PATCH-BASED)
────────────────────────────────────────
Evaluate the outcome logically. Explain it in \`logicalReasoning\` based on phase/flags/inventory.
- PATCH-BASED UPDATE: Only output the DELTA in \`statePatch\`. NEVER wipe the inventory or flags array. Preserve unmentioned state implicitly.

- ANTI-ECHO (CRITICAL): NEVER repeat, paraphrase, or summarize previous \`Text\` from [Story History]. Your \`text\` output must ONLY cover the NEW events that occur as a direct result of the \`Player Action\`.

${dynamicRules}

────────────────────────────────────────
NARRATIVE PERSPECTIVE & WRITING STYLE
────────────────────────────────────────
- Perspective: 2nd Person. STRICTLY OMIT the subject "당신은" or "너는". Describe actions directly.
- Tense & Tone: Use 반말/평서문 (~한다, ~했다). Keep descriptions sensory.
- DIALOGUE FORMATTING: ALL spoken dialogue MUST be enclosed exactly in \`<<\` and \`>>\`.

────────────────────────────────────────
OUTPUT SCHEMA (STRICT JSON ONLY)
────────────────────────────────────────
{
  "logicalReasoning": "string (2-3 sentences explaining causality)",
  "text": "string (Paragraphs of story covering ONLY new events. [TEXT VOLUME] 지시를 반드시 준수할 것. 이전 턴의 내용을 절대 반복/요약하지 말고 직후의 맹렬한 전개만 서술. 주어 생략. Dialogue uses << >>. ${lengthDirective})",
  "turnSummary": "string (1-sentence concise Korean summary of this turn)",
  "statePatch": {
    "addFlags": ["string"], "removeFlags": ["string"], "addItems": ["string"], "removeItems": ["string"], "locationChange": "string or null"
  },
  "clockDelta": {
    "track_win": "number (0 or 1)",
    "track_lose": "number (0 or 1)"
  },
  "tensionLevel": "number (1-10)",
  "options": [
    { "id": "string", "text": "string" }
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
      content: `## Player Action\n${playerAction}\n\n## Current Game State\n${JSON.stringify(state)}`
    }
  ];

  const result = await chatCompletion(messages, { jsonMode: true });
  if (!result.ok) return result;
  const parsed = safeParseJSON(result.content);
  if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };
  return { ok: true, data: parsed.data };
}

/**
 * Generate a highly descriptive prompt for Gemini Flash Image based on the user's synopsis input.
 * Principles:
 * 1. Calm movie poster vibe
 * 2. Focus on location/atmosphere/objects rather than direct character depictions (unless strictly necessary)
 * 3. NO TEXT OR LETTERS
 * 4. Adapt art style based on the genre (realistic, cartoonish, dreamy, mysterious, geometric, etc.)
 */
export function generateImagePrompt(userBackground, accumulatedValues, publicWorld, openingText) {
  const vibe = accumulatedValues.vibe || "mysterious";
  const situation = accumulatedValues.situation || "";
  const worldDesc = publicWorld || "";
  const openingDesc = openingText || "";

  return `Create a cinematic, calm movie poster style image.
Context: ${vibe}, ${situation}, ${userBackground}.
Atmosphere Details: ${worldDesc}. ${openingDesc}.
Focus strongly on the atmosphere, the environment, location, or key symbolic objects.
Do NOT show characters directly or prominently unless strictly necessary for the context. Instead, emphasize the mood and setting.
Art Style: Choose the most appropriate art style based on the context (e.g., hyper-realistic photography, stylized cartoon, dreamy surrealism, dark mysterious digital art, geometric abstract, etc.).
NO TEXT, NO LETTERS, NO NUMBERS, NO TYPOGRAPHY AT ALL in the image.
Masterpiece, highly detailed, evocative lighting, strong composition.`;
}
