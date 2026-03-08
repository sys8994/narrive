/**
 * prompts.js — 3 prompt builders for the game pipeline
 * @module llm/prompts
 */

import { chatCompletion } from './apiClient.js';
import { safeParseJSON } from './parse.js';
import * as treeEngine from '../core/treeEngine.js';
import { getNarrativePhaseKey } from '../core/narrativeEngine.js';

// ─── Situation Question Pool (15 categories) ─────────────────────────

const SITUATION_POOL = [
  { id: 'LOCATION', desc: 'Physical Location (현재 당신이 숨어있거나 갇혀있는 구체적인 장소)', example: '현재 당신은 무너진 성벽 뒤에 몸을 숨기고 있습니다. 이곳은 구체적으로 어떤 장소입니까?' },
  { id: 'ROLE', desc: 'Surface Role/Cover (당신이 타인을 속이기 위해 사용 중인 가짜 신분)', example: '당신은 현재 적진에 잠입한 상태입니다. 당신이 내세우고 있는 가짜 직업이나 신분은 무엇입니까?' },
  { id: 'DANGER', desc: 'Immediate Visceral Danger (지금 당장 덮쳐오는 위협적인 존재)', example: '당신을 쫓는 그림자가 문턱까지 다가왔습니다. 그 정체는 무엇입니까?' },
  { id: 'ITEM', desc: 'Crucial Item (당신이 사수해야 하거나 탈취해야 하는 목표 물건)', example: '당신의 품 안에는 목숨보다 소중한 물건이 하나 들어 있습니다. 그것은 무엇입니까?' },
  { id: 'CONDITION', desc: 'Physical/Mental Condition (현재 주인공의 건강이나 정신 상태의 결함)', example: '당신은 부상을 입었거나 극심한 피로에 시달리고 있습니다. 현재 당신의 몸 상태는 어떠합니까?' },
  { id: 'WEATHER', desc: 'Weather/Time (현재 시점의 기상 상황이나 시간대)', example: '창밖으로 보이는 바깥세상의 풍경은 어떤 날씨와 시간대입니까?' },
  { id: 'ACCIDENT', desc: 'Recent Minor Accident (방금 전 계획을 꼬이게 만든 사소한 돌발 사고)', example: '몇 분 전, 당신의 완벽한 계획을 망칠 뻔한 예기치 못한 실수는 무엇이었습니까?' },
  { id: 'COMPANION', desc: 'Companion/NPC (지금 함께 있는 조력자나 도망자)', example: '당신과 함께 숨을 죽이고 있는 동행자는 누구입니까?' },
  { id: 'SOUND', desc: 'Sound/Noise (어둠 속에서 들려오는 신경이 쓰이는 소리)', example: '정적을 깨고 저 멀리서 들려오는 가장 불길한 소리는 무엇입니까?' },
  { id: 'SCENT', desc: 'Scent/Smell (장소를 지배하는 독특한 냄새나 악취)', example: '이 차가운 공간을 가득 채우고 있는 기이한 냄새는 무엇입니까?' },
  { id: 'OBSTACLE', desc: 'Visible Obstacle (당신의 앞길을 가로막고 있는 물리적 장애물)', example: '탈출을 위해 반드시 넘어야 하지만, 현재로서는 불가능해 보이는 장애물은 무엇입니까?' },
  { id: 'GEAR', desc: 'Current Gear/Weapon (당신이 현재 손에 쥐고 있는 장비나 무기)', example: '현재 당신이 유일하게 의지할 수 있는 도구나 무기는 무엇입니까?' },
  { id: 'REGRET', desc: 'Recent Regret/Thought (방금 전 머릿속을 스친 과거의 그림자나 후회)', example: '이 위기의 순간, 문득 머릿속을 스치고 지나가는 가장 뼈아픈 후회는 무엇입니까?' },
  { id: 'MESSAGE', desc: 'Cryptic Message (최근에 전달받은 누군가의 메세지나 쪽지)', example: '누군가 당신의 주머니에 몰래 찔러 넣었던 짧은 쪽지에는 어떤 문구가 적혀 있었습니까?' },
  { id: 'SCAR', desc: 'Physical Scar/Mark (주인공만이 가진 몸의 흉터나 특별한 표식)', example: '당신의 몸 어디에, 어떤 과거를 증명하는 흉터나 표식이 남아 있습니까?' },
];

function pickSituationCategories(count = 5) {
  // Always include Location and Role
  const mandatory = SITUATION_POOL.filter(p => p.id === 'LOCATION' || p.id === 'ROLE');
  const others = SITUATION_POOL.filter(p => p.id !== 'LOCATION' && p.id !== 'ROLE');

  // Shuffle others
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  const selected = [...mandatory, ...others.slice(0, count - 2)];
  return selected.map(s => `- ${s.desc}: (e.g., "${s.example}")`).join('\n');
}

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
STEP 1) EXTRACT THEMES (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Extract 3–5 key thematic elements from the user's input.
   - These may be emotional (e.g., isolation, decay), structural (e.g., collapsing empire), aesthetic (e.g., neon-lit city), or ideological.
2. Output them FIRST in "_extractedKeywords".
3. Use these keywords to **inspire** the content of your questions, but DO NOT forcefully inject the exact Korean keyword strings into the question sentences if it makes them sound unnatural or robotic (e.g., "이 [고독]의 세계에서..."). Write natural, flowing Korean sentences.

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
Definition: The fundamental "World-Building Foundation" (The Pillar Settings).
Goal: Establish the core rules, era, technology/magic level, and the physical/social reality of the universe.
Tone: Professional, analytical yet evocative.

YOU MUST ask questions about these core pillars (adapted to the user's background):
1. **Era & Technology/Magic Level** (e.g., Is this a decaying high-tech future, a mythic past with active gods, or a realistic 1920s noir?)
2. **Metaphysical Reality/Realism** (e.g., How "grounded" is this world? Are there supernatural elements, or is it strictly realistic/hard-boiled?)
3. **The Dominant Power/System** (e.g., Who or what truly controls the world? A megacorporation, a divine decree, or chaotic anarchy?)
4. **The World's "Original Sin" or Great Flaw** (e.g., What is the fundamental problem or scarcity that drives the world's tension?)

GOOD EXAMPLES (MUST be adapted to user's specific background):
- "이 세계의 문명과 기술은 어느 시점에 멈춰 있거나 도달해 있습니까?"
- "이 세계의 현실성은 어느 정도입니까? (초자연적 현상의 유무와 강도)"
- "사회 시스템을 지배하는 가장 거대하고 압도적인 상위 존재는 무엇입니까?"
- "자원 고갈, 전쟁, 혹은 알 수 없는 저주 중 이 세계를 무너뜨리고 있는 근본 원인은 무엇입니까?"
- "인간성을 증명하거나 포기하게 만드는 이 세계만의 잔혹한 사회적 규칙은 무엇입니까?"

MUST NOT Ask: Trivial visual details (e.g., "벽지 색깔은 무엇인가요?"), meta-game settings (difficulty level, UI), or plot secrets.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY 2: "situation" (Exactly 4–5 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Definition: Micro-level Turn 1 Inciting Incident.
The player must be placed in a concrete present-tense dilemma.

You MUST generate questions based on these specific categories (Pre-selected for this session):
${pickSituationCategories(5)}

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
6) **HYPER-SPECIFIC OPTIONS**: Options must NOT be generic labels. They must be evocative, specific, and descriptive.
   - BAD: "미래", "과거", "판타지", "현실적"
   - GOOD: "강철과 증기가 지배하는 빅토리아풍 스팀펑크 시기", "마력이 메말라 화약 무기가 마침내 마법을 압도하기 시작한 과도기", "극사실주의에 기반한, 19세기 말 런던의 차갑고 축축한 뒷골목 분위기"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT FIELD VALIDATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Exactly 4–5 questions must have "category": "vibe".
- Exactly 4–5 questions must have "category": "situation".
- If type != "select" AND type != "checkbox", options MUST be an empty array [].
- If type != "text", placeholder MUST be "".
- required MUST always be true.
- IDs must be sequential (q1, q2, q3 ...).
- **STRICT JSON ESCAPING**: Never use unescaped double quotes inside strings. Use single quotes or Korean brackets instead.
If any rule is violated, regenerate internally before responding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY SELF-CHECK (MANDATORY BEFORE OUTPUT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before finalizing, verify:
1) Are the questions directly derived from and relevant to the user's background? (Do NOT ask generic questions if the background is specific).
2) Are the options evocative, hyper-specific, and visually descriptive? (No generic 1-2 word labels).
3) Are there EXACTLY 4-5 "vibe" and 4-5 "situation" questions?
4) Is it strictly JSON only without extra conversational text?
5) Did I protect plot secrets?
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
    ? "[스토리 분량: 단편 (Short)] 빠르고 강렬한 전개. Locations 2~3개, NPCs 1~2명으로 제한하여 밀도를 높이십시오."
    : storyLength === '장편'
      ? "[스토리 분량: 장편 (Long)] 깊고 방대한 서사. Locations 5개 이상, NPCs 4명 이상으로 다채로운 세계를 구성하십시오."
      : "[스토리 분량: 중편 (Medium)] 표준적인 볼륨. Locations 3~4개, NPCs 2~3명으로 균형 잡힌 세계를 구성하십시오.";

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
"The user designed the VIBE and the SITUATION. YOU must now design the NARRATIVE BACKBONE and the ENGINE SCHEMA."
The Narrative Backbone must be brutally concrete, structurally robust, and mathematically tied to the schema entities. Do NOT use vague tropes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. STORY STRUCTURE PLANNING (Chain-of-Thought — MANDATORY FIRST STEP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before writing ANY other field, you MUST perform this analysis in "_storyStructurePlanning" and output it as the FIRST field of your JSON.

Analyze the user's background concept and vibe answers to determine:
1) **장르 적합성 분석**: 이 세계관/장르에 반전(twist), 비밀 흑막, 숨겨진 진실 같은 비선형적 서사 장치가 자연스러운가? (예: 추리/스릴러/공포 → 반전이 자연스럽다 / 생존/액션 어드벤처/일상 드라마 → 반전이 억지스럽다)
2) **구조 판정**: 위 분석에 따라 "TWIST" (반전/숨겨진 진실 중심) 또는 "LINEAR" (직선적 갈등 고조 중심) 중 하나를 명시적으로 선택.
3) **판정 근거**: 왜 그 구조가 이 스토리에 적합한지 1-2문장으로 서술.

이 분석 결과는 이후 hiddenPlot 작성 방식에 직접 반영됩니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PUBLIC WORLD (Player-Facing Vibe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Structure using markdown bullet points:
- [Atmosphere & Texture]: Sensory details and overall mood based on the Vibe answers.
- [Absolute Rules/Taboos]: Strictly forbidden or physically impossible things.
- [Societal State]: Public power dynamics and daily struggles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. HIDDEN PLOT (The Narrative Backbone)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST structure this field using markdown bullet points.
You MUST explicitly use the exact Proper Nouns defined in your "worldSchema".

**CRITICAL: Adapt the content based on your "_storyStructurePlanning" verdict.**

IF verdict is "TWIST" (비선형 구조):
PART A: 사건의 전말 (The Objective Truth)
- [궁극적 진실]: 턴 1 이전에 이미 벌어진 팩트. 누가, 왜, 어떻게 이 상황을 만들었는지 육하원칙으로 상세히 기술.
- [단서의 조각들]: 이 진실을 증명할 수 있는 결정적 물리적/정보적 단서 3가지가 현재 스키마의 어느 Location이나 NPC에게 있는지 구체적으로 매핑.
- [핵심 반전]: 주인공(유저)이 턴 1 시점에 상황에 대해 완전히 오해하고 있는 단 하나의 사실.

IF verdict is "LINEAR" (선형 구조):
PART A: 핵심 갈등 구도 (The Core Conflict)
- [중심 갈등]: 이 이야기의 핵심 갈등(생존, 탈출, 복수, 수호 등)이 무엇이며, 왜 해결이 어려운지 구체적으로 기술.
- [위협의 실체]: 주인공을 위협하는 적대적 세력/환경/상황의 구체적 성격과 강도. 스키마의 NPC/Location과 매핑.
- [숨겨진 깊이]: 반전은 아니지만, 유저가 진행하면서 점진적으로 깨닫게 되는 세계의 더 깊은 맥락 1가지. (예: 적이 단순한 악이 아니라 나름의 이유가 있었다는 것 등)

PART B: 서사 전개 프레임워크 (The Progression Framework) — 두 구조 모두 공통:
- [적대자/갈등의 에스컬레이션]: 유저가 행동할수록, 적대자나 핵심 갈등이 어떻게 단계적으로 격화되는가?
- [국면 전환 트리거]: 스토리가 발단->전개->절정으로 넘어갈 때, 스토리를 다음 페이즈로 강제 견인할 굵직한 사건(Event) 3가지 배치.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ENGINE SCHEMA (worldSchema - STRICT INTEGRITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATE distinct, memorable Korean proper nouns for everything. NO generic placeholders.
${lengthGuidance}
- protagonist: MUST include "startingLocationId" which matches exactly one location ID from the locations array.
- locations (Min 4): Form a logical map. "connectedTo" MUST ONLY contain IDs that actually exist in this array.
- npcs (Min 3): Each needs a "personality" (detailed persona, speech style, habits), a "motive" (public behavior), and a "secret" (hidden truth tied to the Hidden Plot).
- winConditions / loseConditions: Replace these with "milestones" (major narrative goals/turning points) that can be triggered when the new Clocks (tension/insight) reach a certain level.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. OPENING SCENE (openingText) - MACRO PROLOGUE FOCUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Write 3-4 paragraphs of a cinematic PROLOGUE. 
- EACH paragraph MUST be separated by EXACTLY TWO line breaks (\n\n).
- To ensure maximum readability, each paragraph should NOT exceed 2-3 sentences.
- Focus on the macro-level world-building, the overarching atmosphere, the societal tension, or the history of the world.
- Make it sound like a movie trailer voiceover setting the grand stage.
- DO NOT describe the protagonist's immediate physical actions, their exact starting location, or the immediate Turn 1 crisis here. Leave the immediate action for the game engine to start.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. THUMBNAIL DIRECTION (thumbnailDirection) - CINEMATIC VISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Design the visual direction for the story's thumbnail image.
- State the desired camera angle, lens width, lighting style, color grading, and texture (e.g., "Wide angle shot, anamorphic lens, low-key moody lighting, desaturated teal and orange, grainy film texture. Focus on a lone ruined watchtower.").
- It must evoke a highly professional, non-AI aesthetic (like a real movie poster or analog photography).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. PROMPT-SPECIFIC NARRATIVE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Writing Style: Cinematic, present-tense, immersive, and sensory-driven.
- Formatting: Use frequent paragraph breaks for readability (like a web novel). 
  - Each paragraph MUST be separated by EXACTLY TWO line breaks (\\n\\n).
  - Each paragraph should consist of only 1-3 sentences.
- Omit the subject "당신은" or "너는" and focus on direct action.
- Use the 3-part micro-structure for 'knowledgeText' as defined in the schema.
- NEVER break the fourth wall. No game mechanics talk in the story text. 
- DIALOGUE RULE: All spoken dialogue MUST be enclosed in \`<<\` and \`>>\`. (e.g., 남자가 외쳤다. <<거기 멈춰!>>)
- **STRICT JSON ESCAPING RULE (CRITICAL)**: 
  - NEVER use the double quote character (\") inside any string value. 
  - If you need to quote something other than dialogue, use single quotes (') or Korean brackets (「 」, 『 』).
  - Unescaped double quotes will break the system; this is a fatal error.

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
You MUST respond with ONLY a JSON object in this exact schema. Do NOT provide multiple blocks. The "_storyStructurePlanning" must be the FIRST KEY within this single JSON object.

{
  "_storyStructurePlanning": {
    "genreAnalysis": "string (장르 적합성 분석 — 이 세계관에 반전이 자연스러운지 분석)",
    "verdict": "TWIST | LINEAR",
    "reasoning": "string (판정 근거 1-2문장)"
  },
  "title": "Story title (Korean, Immersive)",
  "publicWorld": "string (Markdown bullets)",
  "hiddenPlot": "string (Markdown bullets for PART A and PART B, adapted to the verdict above. > 600 characters)",
  "openingText": "string (2-3 paragraphs. Cinematic PROLOGUE setting the macro world vibe. No immediate character actions. Each paragraph separated by two line breaks.)",
  "thumbnailDirection": "string (Specific camera, lighting, and art direction for the poster. In English.)",
  "initialThemeColor": "string (HEX code)",
  "climaxThemeColor": "string (HEX code)",
  "accentColor": "string (HEX code)",
  "entryLabel": "string (Korean, 2-3 words. e.g., '모험을 시작합니다', '문이 열립니다')",
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

function buildStoryContext(session, targetNodeId) {
  const path = treeEngine.getPathToRoot(session, targetNodeId);
  if (path.length === 0) return { contextString: "", openingBlacklist: "" };
  let contextString = "## Story History (Chronological)\n";
  const recentOpeningLines = [];

  path.forEach((id, index) => {
    const node = session.nodesById[id];
    const selectedOpt = node.selectedOptionId
      ? (node.options.find((o) => o.id === node.selectedOptionId)?.text || '')
      : 'None (Start)';
    const turnLabel = node.depth === 0 ? "Prologue/Background" : node.depth;

    // FULL HISTORY INJECTION: 앵무새 현상과 톤 변질을 막기 위해 전체 텍스트를 그대로 주입.
    const allOptions = node.options.map(o => `- ${o.text}`).join('\n');
    contextString += `[Turn ${turnLabel}]\nText: ${node.text}\nOptions Provided:\n${allOptions}\nUser Choice: ${selectedOpt}\n\n`;

    // 최근 턴의 첫 문장(첫 마침표/느낌표/물음표까지)을 추출하여 blacklist용으로 수집
    if (node.text && index > 0) { // 프롤로그(index 0) 제외
      const firstSentenceMatch = node.text.match(/^(.{10,80}?[.!?])/);
      if (firstSentenceMatch) {
        recentOpeningLines.push(firstSentenceMatch[1].trim());
      }
    }
  });

  // 최근 5턴의 opening lines만 blacklist로 사용
  const blacklistLines = recentOpeningLines.slice(-5);
  let openingBlacklist = "";
  if (blacklistLines.length > 0) {
    openingBlacklist = `
[OPENING LINE BLACKLIST — ABSOLUTE PROHIBITION]
The following sentences (or any paraphrase of them) have been used to START a turn's text before. You MUST begin your new text with a COMPLETELY DIFFERENT first sentence. These are BANNED opening sentences:
${blacklistLines.map((s, i) => `${i + 1}. "${s}"`).join('\n')}
Do NOT echo these. Do NOT reuse the same subject (weather/lighting/smell) if it already appeared in the last 3 turns' first sentences.`;
  }

  return { contextString, openingBlacklist };
}

/**
 * buildDynamicSchemaContext — Filter and format the world schema for the current turn.
 */
function buildDynamicSchemaContext(session, targetNodeId) {
  const node = session.nodesById[targetNodeId];
  const gameState = node ? (node.stateSnapshot || session.gameState) : session.gameState;
  const { synopsis } = session;
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

  // 3. Flags (Key Narrative Info)
  const flagsString = `[ACTIVE FLAGS / KNOWLEDGE]\n- ${Object.keys(gameState.flags).length > 0 ? Object.keys(gameState.flags).join(', ') : 'None.'}`;

  // 4. Active NPCs (Dynamic State Injection)
  let npcString = `[GLOBAL NPC ROSTER (DYNAMIC STATE)]\n`;
  if (worldSchema.npcs && worldSchema.npcs.length > 0) {
    npcString += worldSchema.npcs.map(npc => {
      const state = gameState.npcStates?.[npc.id] || {};
      const loc = state.location || "Unknown";
      const status = state.status || "일반 상태";
      const isHere = loc === currentLocationId;

      return `- ${npc.name} (${npc.role}, ID: ${npc.id}): [위치: ${loc}]${isHere ? " (현재 방에 있음)" : ""} / [성격: ${npc.personality}] / [상태: ${status}] / Motive: '${npc.motive}' / Secret: '${npc.secret}'`;
    }).join('\n');
    npcString += `\n- (중요) 위에 나열된 NPC들의 '성격(personality)'과 '말투'를 반드시 유지하며 대화와 행동을 묘사하십시오.`;
  } else {
    npcString += `- (중요) 새로운 인물을 창조하여 즉석에서 서사에 개입시키십시오.`;
  }

  return `${locString}\n\n${exitsString}\n\n${flagsString}\n\n${npcString}`;
}

const PHASE_ACT1_INITIAL = `
[PHASE: ACT 1 (START) - 첫 번째 전개 (Initial Action)]
- 상황: 프롤로그(Turn 0)는 이미 끝났습니다. 유저는 이제 게임의 첫 번째 행동을 시작한 상태입니다.
- 서술 목표: 배경 설명을 장황하게 반복(Echo)하지 마십시오. 유저의 첫 번째 선택에 대한 "즉각적이고 물리적인 결과"와 타인의 반응, 들이닥친 사건 등 "현재 진행형의 감각 정보"를 제공하여 능동적인 씬(Scene)을 첫 문장부터 시작하십시오.
- 금기 사항: 프롤로그의 문장을 복붙하거나, "문명은 멸망했다...", "당신은 눈을 떴다..." 같은 고립된 고독한 분위기로만 몰아가는 것은 치명적인 오류입니다.
`;

const PHASE_ACT1 = `
[PHASE: ACT 1 - 발단 (Introduction & Exposition)]
- 서사 템포: 유유하고 상세한 호흡. 긴장감은 아직 수면 아래에 있습니다.
- 서술 목표: 일상적이거나 평온해 보이지만 묘한 이질감이 느껴지는 분위기를 조성하십시오. 혼자 방치되어 공간만 관찰하게 두지 말고, 누군가와의 만남이나 가벼운 사건의 발생 등 본격적인 이야기의 '시작'을 알리는 동적인 이벤트를 전개하십시오.
- 선택지 방향: 타인(또는 주요 사물)과 직접적으로 대화하거나 개입하는 등, 사회적 상호작용과 구체적인 행동을 이끌어내는 선택지를 제시하십시오. 단순 정보 수집 목적의 선택지는 지양합니다.
`;

const PHASE_ACT2 = `
[PHASE: ACT 2 - 전개 (Rising Action & Conflict)]
- 서사 템포: 긴장감이 점차 고조되며, 장르(추리, 공포, 드라마 등)에 맞는 심리적 또는 물리적 위기가 본격적으로 표면화됩니다.
- 서술 목표: 유저의 목적 달성을 방해하는 장애물(적대자, 숨겨진 진실, 돌발적인 사고)을 가차 없이 등장시키십시오. 단, 이야기의 본래 장르와 분위기를 무시한 채 무작정 몬스터와 싸우거나 주먹다짐을 하는 물리적 전투 액션씬으로 획일화되어서는 절대 안 됩니다.
- 선택지 방향: 위기를 극복하거나 위험을 감수하는 선택지를 제시하되, 물리적인 타격("맞서 싸운다")에만 의존하지 마십시오. 대화, 기지 발휘, 약점 공략, 도주, 은폐 등 장르에 가장 어울리고 영리한 선택지들을 강요하십시오. 이전 턴과 유사한 방식(예: 계속해서 맞서기)을 또 한 번 반복 제시하는 것을 절대 금지합니다.
`;

const PHASE_ACT3 = `
[PHASE: ACT 3 - 절정 (Climax)]
- 서사 템포: 서술의 호흡이 가장 짧고 격정적이며, 각 장르에 걸맞은 최고조의 숨막히는 긴장감을 유지합니다.
- 서술 목표: 이야기의 모든 갈등이 폭발하는 최후의 위기(선택) 상황입니다. (경고: 이전 상황을 절대 요약하거나 회상하지 마십시오. 오직 '현재 눈앞에 닥친 가장 치명적이고 결정적인 이 순간'에만 100% 집중하십시오. 불필요하게 피가 튀는 물리적 폭력 액션씬으로만 한정 짓지 말고 서사적 폭발력을 높이십시오.)
- 선택지 방향: 목숨을 걸거나 스스로의 일부를 영구히 희생해야만 하는, 극단적이고 치명적인 선택지 2개를 강제하십시오. (이전 액션과 반복되는 단순한 선택지는 금지)
`;

const PHASE_RESOLUTION = `
[PHASE: RESOLUTION - 결말부 진입 (The Dust Settles)]
- 톤 앤 매너: 모든 갈등이 방금 종료되었습니다. 승리했다면 안도감이, 패배했다면 돌이킬 수 없는 절망감이 지배합니다.
- 서술 목표: 최후의 물리적 충돌이 끝난 '직후의 고요한 현장 상황'을 묘사하십시오. (경고: "수많은 위기를 넘어", "지금까지의 험난한 여정 끝에" 등 여태까지의 사건을 요약하거나 회상하는 감상적인 문장을 절대 쓰지 마십시오. 오직 먼지가 가라앉는 현재의 정적에만 집중하십시오.)
- 특수 룰 (CRITICAL):
  1. \`statePatch.addFlags\` 배열에 반드시 \`"epilogue_ready"\`를 추가하십시오.
  2. 선택지는 오직 다음 1개만 출력하십시오: [{"id": "opt_epilogue", "text": "에필로그를 확인한다."}]
  3. 아직 게임을 끝내지 마십시오. \`isEnding\`은 false여야 합니다.
`;

const PHASE_EPILOGUE = `
[PHASE: EPILOGUE - 에필로그 (The Aftermath)]
- 톤 앤 매너: 정적이고 묵직한 여운.
- 서술 목표: 이전 결과를 바탕으로 살아남은 세계의 모습이나 남겨진 이들의 후일담을 묘사하십시오. (경고 절대주의: 주인공이 "어떤 길을 걸어왔는지", "어떤 모험을 했는지" 과거의 이력을 총정리하며 나열하지 마십시오. 사건 이후 완전히 뒤바뀐 '현재의 풍경'과 '미래의 여운'만 담백하게 보여주어야 합니다.)
- 특수 룰 (CRITICAL):
  1. 더 이상의 행동은 불가능합니다. "options" 배열을 반드시 빈 배열([])로 반환하십시오.
  2. 반드시 \`isEnding\`을 true 로 설정하고, \`endingType\`을 명시하여 게임을 완전히 종결하십시오.
`;

export async function callPrompt3(session, selectedOption, targetNodeId = null) {
  const effectiveNodeId = targetNodeId || session.currentNodeId;
  const node = session.nodesById[effectiveNodeId];
  const { contextString: storyContext, openingBlacklist } = buildStoryContext(session, effectiveNodeId);
  const state = node ? (node.stateSnapshot || session.gameState) : session.gameState;
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
  const dynamicSchemaContext = buildDynamicSchemaContext(session, effectiveNodeId);

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
- \`tension_delta\`: (+1 or -1) Increases when the situation becomes more urgent, dangerous, or high-stakes. Decreases during moments of reprieve or safety.
- \`insight_delta\`: (+1) Increases when the player uncovers a piece of the [Hidden Plot] or gains crucial knowledge (Key Info).
- ANTI-STALLING: If the player stalls, increase \`tension_delta\` by 1 and trigger an external crisis immediately.

────────────────────────────────────────
DYNAMIC WORLD STATE UPDATES (CRITICAL)
────────────────────────────────────────
- Use \`statePatch.npcStates\` to dynamically update the location and status of NPCs.
- NPCs should act according to their \`personality\`, \`motive\`, and \`secret\`.

────────────────────────────────────────
CHOICE SPECIFICITY & DIVERSITY (CRITICAL)
────────────────────────────────────────
- OPTION QUANTITY: You MUST generate EXACTLY 2 options to save tokens. Only generate 3 if a situation absolutely demands a highly distinct third path.
- FORBIDDEN PASSIVE VERBS: NEVER use passive/stalling verbs like "주변을 둘러본다", "조사한다", "단서를 찾는다", "생각해본다". Force direct action or dialogue.
- DIVERSITY & PROGRESS: Options MUST NOT simply repeat the same action style from the last turn. Every turn MUST introduce a fundamentally NEW tactical or narrative approach.
- ZERO ACTION-BIAS: Do NOT default to mindless violence or physical fighting unless the genre is explicitly an action game. For horror, mystery, or drama, enforce genre-appropriate choices like Persuade, Intimidate, Hide, Escape, Sabotage, Use Object, or Bribe.
`;
  }

  const systemPrompt = `You are a highly creative and adaptive interactive fiction writer and strict Game Master.
You are tasked with continuing a rich narrative based on the user's entire journey so far.

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
- IF [GLOBAL NPC ROSTER] is provided: You MUST introduce one of these NPCs into the scene this turn. They must speak or act according to their listed 'personality'. At least ONE option MUST involve reacting to or conversing with them.
- IF the player attempts to move: They can ONLY move to locations listed in [VISIBLE EXITS]. If you provide a movement option, it must lead to one of these exact exits.
- IF the player uncovers important information: Set a descriptive flag in \`statePatch.addFlags\` to track this 'insight'.

────────────────────────────────────────
2. CANON CONTINUITY & CREATIVE WRITING
────────────────────────────────────────
[World Vibe]: ${session.synopsis.publicWorld || 'N/A'}
[Hidden Plot]: ${session.synopsis.hiddenPlot || 'N/A'}

- Creative Continuity: You are provided with the ENTIRE [Story History] below. Read it carefully. Your goal is to WRITE THE NEXT CHAPTER logically and creatively. DO NOT summarize, repeat, or say "As you did X". Simply describe what happens NEXT in vivid detail based on the [User Choice] of the latest turn.
- Tone Consistency: Match the tone, style, and pacing established in the history.
- Director's Cut (CoT): Before writing the text, use \`directorNotes\` to explicitly plan how this new scene will incorporate the [Hidden Plot] and adapt to the player's ongoing journey.

[Story History (Full Record)]:\n${storyContext}

────────────────────────────────────────
3. STATE INTEGRITY (PATCH-BASED)
────────────────────────────────────────
Evaluate the outcome logically. Explain it in \`logicalReasoning\` based on phase and flags.
- PATCH-BASED UPDATE: Only output the DELTA in \`statePatch\`. NEVER wipe the flags array. Preserve unmentioned state implicitly.

- STRICT ANTI-ECHO (CRITICAL): You are prone to repeating the previous turn's narrative (The Parrot Effect). YOU MUST NEVER summarize, echo, or paraphrase what just happened in the immediate previous turn. Every single turn MUST contain massive, undeniable timeline progression.
- DO NOT ECHO THE CHOICE: Do not re-state the [User Choice] in your text. Immediately show the REACTION or CONSEQUENCE of that choice, escalating the situation dramatically.
- START-WITH-ACTION: 텍스트의 첫 문장은 예열 없이 **무조건 새로운 사건의 돌발, 외부 환경의 즉각적인 변화, 혹은 NPC의 새로운 대사/반응(Dialogue)**으로 거칠게 시작하십시오. 이전 상황을 반복 묘사하면 치명적입니다.
- ATMOSPHERE ECONOMY (CRITICAL): 날씨, 빗소리, 조명, 냄새 등 배경 분위기 묘사는 이야기 전체를 통틀어 아껴서 사용하십시오. 동일한 배경 요소(예: "차가운 빗줄기")가 이전 3턴 내에 이미 등장했다면, 그것을 다시 첫 문장에 쓰는 것은 치명적인 오류입니다. 배경 묘사 대신 인물의 행동, 감정, 대화, 또는 새로운 사건으로 즉시 전환하십시오.
${openingBlacklist}

${dynamicRules}

────────────────────────────────────────
NARRATIVE PERSPECTIVE & WRITING STYLE
────────────────────────────────────────
- Perspective: 2nd Person. STRICTLY OMIT the subject "당신은" or "너는". Describe actions directly.
- Tense & Tone: Use 반말/평서문 (~한다, ~했다). Keep descriptions sensory.
- DIALOGUE FORMATTING: ALL spoken dialogue MUST be enclosed exactly in \`<<\` and \`>>\`.
- **STRICT JSON ESCAPING RULE (CRITICAL)**: NEVER use the double quote character (\") inside any string value. Use single quotes (') for all other quoting needs. Unescaped double quotes break the JSON parser.

────────────────────────────────────────
OUTPUT SCHEMA (STRICT JSON ONLY)
────────────────────────────────────────
{
  "directorNotes": {
    "plotAlignment": "string (이 턴의 전개가 [사건의 전말]이나 [서사 전개 프레임워크]의 어느 부분과 어떻게 연결되는지 구체적으로 1-2문장 기획)",
    "schemaInvolvement": "string (GLOBAL NPC ROSTER 중 어떤 인물을 현재 씬에 기습적으로 끌어들일 것인지 기획. 없으면 'None')"
  },
  "logicalReasoning": "string (2-3 sentences explaining causality)",
  "text": "string (Paragraphs covering ONLY the NEW events. 이전 내용을 절대 반복/요약하지 말고 직후의 맹렬한 씬(Scene)만 액션으로 시작할 것. 주어 생략. Dialogue uses << >>. ${lengthDirective})",
  "turnSummary": "string (1-sentence concise Korean summary of this turn)",
  "statePatch": {
    "addFlags": ["string"], "removeFlags": ["string"], "locationChange": "string or null",
    "npcStates": { "npcId": { "location": "string", "status": "string" } }
  },
  "clockDelta": {
    "tension_delta": "number (-1, 0, or 1)",
    "insight_delta": "number (0 or 1)"
  },
  "tensionLevel": "number (1-10)",
  "options": [
    { "id": "string", "text": "string" }
  ],
  "isEnding": "boolean",
  "endingType": "string (e.g., 'win', 'lose', 'neutral', 'sacrifice', 'escape', 'tragic_death', etc.)",
  "nodeTitle": "string (2-4 word short label for this scene, in Korean)"
}
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `## Player Action\n${playerAction}\n\n## Current Game State\n${JSON.stringify(state)
        } `
    }
  ];

  const result = await chatCompletion(messages, { jsonMode: true });
  if (!result.ok) return result;
  const parsed = safeParseJSON(result.content);
  if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error} `, raw: parsed.raw };
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
export function generateImagePrompt(userBackground, accumulatedValues, publicWorld, openingText, thumbnailDirection) {
  const vibe = accumulatedValues.vibe || "mysterious";
  const situation = accumulatedValues.situation || "";
  const worldDesc = publicWorld || "";
  const openingDesc = openingText || "";
  const direction = thumbnailDirection || "High-end cinematic photography, dramatic lighting, sharp focus.";

  return `Create a highly professional, cinematic movie poster image.
  Context: ${vibe}, ${situation}, ${userBackground}.
Atmosphere: ${worldDesc}. ${openingDesc}.

[STRICT CINEMATIC DIRECTION]
${direction}

[CORE PRINCIPLES]
  - AVOID the generic "AI generated" look.Use realistic textures, subtle film grain, or authentic illustrative styles(e.g.vintage poster, analog photograph, concept art).
- Focus strongly on the environment, location, or symbolic objects.
- Do NOT show characters prominently unless absolutely necessary.
- NO TEXT, NO LETTERS, NO NUMBERS, NO TYPOGRAPHY AT ALL.
- Masterpiece, highly detailed, evocative composition.`;
}
