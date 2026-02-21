/**
 * prompts.js — 3 prompt builders for the game pipeline
 * @module llm/prompts
 *
 * Prompt #1: user background → follow-up question form (JSON schema)
 * Prompt #2: background + form answers → synopsis / opening / theme
 * Prompt #3: turn progression → story text + options + state update
 */

import { chatCompletion } from './apiClient.js';
import { safeParseJSON } from './parse.js';
import * as treeEngine from '../core/treeEngine.js';

// ─── Prompt #1: Background → Follow-up Questions ───────────────────

/**
 * Build and call Prompt #1.
 * @param {string} userBackground — user's initial background text
 * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
 */
export async function callPrompt1(userBackground) {
    const messages = [
        {
            role: 'system',
            content: `You are a senior narrative game designer creating a structured interactive text RPG.

The user will provide a short background description for their story.

Your goal is to generate 3-5 highly relevant follow-up questions that are tightly tied to the user's concept,
BUT with a strict UX policy: minimize typing and prefer structured choices.

## Extract & Target
- First, extract 3-6 key elements from the user's input (genre, setting, keywords, implied themes, core gimmick).
- Every question MUST explicitly reference at least ONE extracted element in its label (Korean).

## CRITICAL UX POLICY (Typing Minimization)
1) Question type distribution (HARD RULES)
- You MUST produce 3 to 5 questions total.
- At least 3 questions MUST be type "select".
- You MAY include at most 1 "slider" (only for intensity/difficulty).
- You MAY include at most 1 "text".
- You MUST NOT use "textarea" (0 allowed). Do NOT use "textarea" even for creative details.
- Use "checkbox" only if multiple selections truly matter; otherwise prefer "select".

2) Options design (for select)
- Each "select" must have 4-7 options.
- Include one option for "자동(추천)" OR "상관없음(자동 생성)" so the user can proceed without decisions.
- Include one option for "기타(직접 입력)" only if truly necessary.
  (If you include "기타(직접 입력)", the UI can later reveal a text field, but do NOT add extra questions here.)

3) Avoid generic templates
- Do NOT ask generic RPG setup questions that could fit any story.
- Each question must be concept-specific and materially affect story generation.

## Content Requirements (still mandatory, but obey UX policy)
- At least ONE question must clarify the main conflict / driving problem.
- At least ONE question must define the protagonist’s role/motivation/constraint.
- At least ONE question must define world rules/constraints relevant to the concept.
- At least ONE question must influence gameplay direction (stakes/difficulty/branching style).

## Language & Tone
- Write ALL labels in Korean.
- Make the wording immersive and specific to the user's concept.

## Output Format
You MUST respond with ONLY a JSON object in this exact schema:

{
  "title": "string (a short, concept-aware title for the questionnaire in Korean)",
  "questions": [
    {
      "id": "q1",
      "label": "string (Korean)",
      "type": "select" | "text" | "textarea" | "slider" | "checkbox",
      "options": ["..."],
      "placeholder": "...",
      "min": 0,
      "max": 10,
      "required": true
    }
  ]
}

## Field rules inside the schema
- If type != "select", set options to [].
- If type is not "text", set placeholder to "".
- If type != "slider", keep min=0 and max=10 (ignored by UI).
`
        },
        {
            role: 'user',
            content: userBackground,
        },
    ];

    const result = await chatCompletion(messages, { jsonMode: true });
    if (!result.ok) return result;

    const parsed = safeParseJSON(result.content);
    if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };

    return { ok: true, data: parsed.data };
}

// ─── Prompt #2: Form Answers → Synopsis + Opening + Theme ──────────

/**
 * Build and call Prompt #2.
 * @param {string} userBackground
 * @param {Object} formAnswers — { [questionId]: answer }
 * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
 */
export async function callPrompt2(userBackground, formAnswers) {
    const answersText = Object.entries(formAnswers)
        .map(([id, val]) => `${id}: ${val}`)
        .join('\n');

    const messages = [
        {
            role: 'system',
            content: `You are a senior narrative architect designing the foundational world and rules of an interactive text RPG.

Based on:
1) The user's original background concept
2) The structured answers provided in the questionnaire

Your task is to generate a complete, internally coherent story foundation that will guide many future turns without collapsing or contradicting itself.

This is NOT just a creative summary.
It is a structural blueprint for a long-running interactive narrative.

## Core Design Requirements

1. Canonical World Definition
- Clearly define the setting (time, place, atmosphere).
- Establish what is possible and what is NOT possible in this world.
- If realistic → no supernatural elements unless explicitly requested.
- If fantasy/SF → define rule constraints (limits of magic, tech, power scale).

2. Central Conflict Axis
- Explicitly define the main driving conflict.
- Define what is at stake.
- Clarify why the player must act.

3. Protagonist Role
- Clearly define who the player character is.
- Define their strengths, weaknesses, limitations.
- Define what they do NOT know at the start.

4. Narrative Direction
- Describe how tension should escalate across 15–25 turns.
- Suggest types of mid-game complications.
- Define possible ending directions (good/bad/neutral).
- Avoid infinite wandering structure.

5. Consistency Safeguards
- Avoid introducing undefined factions or powers.
- Avoid tonal drift.
- Avoid deus ex machina solutions.
- Avoid random genre switching.

6. Internal Coherence
The systemSynopsis must be detailed enough that:
- A game master could run 20+ consistent turns using only this document.
- Character motivations remain stable.
- The world rules prevent logical contradictions.

7. Opening Scene Design
The openingText must:
- Immediately place the player inside a specific moment.
- Reflect tone and stakes.
- Avoid vague exposition.
- Imply the central conflict without fully revealing it.

8. Color Logic
- themeColor must match the emotional tone (dark for tense/mysterious, muted for tragic, etc.).
- accentColor must be complementary and readable against themeColor.
- Do NOT choose random colors. Choose psychologically consistent ones.

9. Auto-Naming and WorldSchema (CRITICAL)
- You MUST construct a structured "worldSchema" JSON object.
- If the user did not explicitly provide names for characters, places, or items, YOU MUST GENERATE THEM.
- Generate a protagonist name, 3+ NPC names, 4+ location names, 4+ item names, and 6+ event flags.
- Names must be DISTINCT, MEMORABLE, KOREAN, and fit the genre/tone.
- NEVER use generic placeholders like "주인공", "친구", "어떤 장소", "그 남자" in the schema or the text.
- Use these newly generated proper nouns inside the openingText.

Language Rule:
- Write title, systemSynopsis, and openingText in Korean.
- Use immersive but disciplined prose (avoid excessive purple prose).

You MUST respond with ONLY a JSON object in this exact schema:

{
  "title": "string (story title, engaging and thematic)",
  "systemSynopsis": "string (3-5 structured paragraphs clearly covering: world rules, protagonist role, core conflict, escalation path, possible endings)",
  "openingText": "string (1-2 paragraphs of immersive opening narration using PROPER NOUNS)",
  "themeColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "worldSchema": {
    "world": { "genre": "string", "tone": "string", "rules": ["string"] },
    "protagonist": { "id": "pc", "name": "string", "role": "string", "goal": "string", "limitation": "string" },
    "locations": [ { "id": "string", "name": "string", "desc": "string", "connectedTo": ["string"] } ],
    "npcs": [ { "id": "string", "name": "string", "role": "string", "motive": "string", "secret": "string", "relation": "string" } ],
    "items": [ { "id": "string", "name": "string", "type": "string", "desc": "string", "initialLocationId": "string" } ],
    "events": [ { "id": "string", "name": "string", "trigger": "string", "effect": "string" } ],
    "winConditions": [ { "id": "string", "desc": "string", "check": "string" } ],
    "loseConditions": [ { "id": "string", "desc": "string", "check": "string" } ]
  }
}`
        },
        {
            role: 'user',
            content: `## 배경 컨셉\n${userBackground}\n\n## 상세 답변\n${answersText}`,
        },
    ];

    const result = await chatCompletion(messages, { jsonMode: true });
    if (!result.ok) return result;

    const parsed = safeParseJSON(result.content);
    if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };

    return { ok: true, data: parsed.data };
}

// ─── Prompt #3: Turn Progression ───────────────────────────────────

/**
 * Build context from the story so far (last N nodes on the path).
 */
function buildStoryContext(session, maxNodes = 6) {
    const path = treeEngine.getPathToRoot(session, session.currentNodeId);
    const recentIds = path.slice(-maxNodes);
    return recentIds.map((id) => {
        const node = session.nodesById[id];
        const selectedOpt = node.selectedOptionId
            ? (node.options.find((o) => o.id === node.selectedOptionId)?.text || '')
            : '';
        return {
            text: node.text,
            chosen: selectedOpt,
        };
    });
}

/**
 * Build and call Prompt #3 (turn progression).
 * @param {Object} session — current GameSessionBlob
 * @param {Object|null} selectedOption — { id, text } of chosen option, null for initial options
 * @returns {Promise<{ok:boolean, data?:Object, error?:string}>}
 */
export async function callPrompt3(session, selectedOption) {
    const storyContext = buildStoryContext(session);
    const state = session.gameState;

    const contextLines = storyContext.map((s, i) => {
        let line = `[Turn ${i}] ${s.text}`;
        if (s.chosen) line += `\n  → Player chose: "${s.chosen}"`;
        return line;
    }).join('\n\n');

    const stateInfo = `Location: ${state.location || '(not set)'}
Inventory: ${state.inventory.length ? state.inventory.join(', ') : '(empty)'}
Turn: ${state.turnCount}`;

    const playerAction = selectedOption
        ? `The player chose: "${selectedOption.text}"`
        : 'This is the beginning of the story. Generate the first set of choices for the player.';

    const messages = [
        {
            role: 'system',
            content: `You are the game master of an interactive text RPG.

Your primary responsibility is to maintain strong narrative continuity, internal consistency, high action specificity, and tight choice-text linkage across turns.

## Story Synopsis (internal reference)
${session.synopsis.systemSynopsis}

## World Schema (CRITICAL CONSTRAINTS)
${JSON.stringify(session.worldSchema || {}, null, 2)}

## Continuity Context (internal reference)
You are continuing an existing story.

You MUST:
- Treat all previous events as canon.
- Respect the current game state exactly as provided.
- Ensure cause-and-effect continuity from the player's last action.
- Directly reference specific elements already present in the scene.

Do NOT introduce major new world rules or unexplained elements.

---

## CRITICAL RULE: Choice Anchoring and Proper Nouns (VERY IMPORTANT)

1. You MUST use the proper nouns defined in the "World Schema". 
2. Do NOT use generic placeholders like "주인공", "친구", "그 남자", "어떤 방". 
3. Always refer to the protagonist, NPCs, locations, and items by their exact schema names.
4. Each choice MUST be directly grounded in elements explicitly mentioned in the current story text.
5. If an object appears in a choice, it must be clearly described in the story text.
6. If a location appears in a choice, it must already exist in the scene.
7. If an NPC appears in a choice, they must have been introduced in the text.

DO NOT introduce new objects, rooms, hidden elements, or structural details in the choices unless they were clearly described earlier in the same scene.

The story text must naturally set up the choices.
The final 1-2 sentences of the story text should implicitly frame the available options.

---

## Scene Construction Rules

1. Scene Anchoring
- Clearly establish the physical space.
- Mention at least 2 concrete environmental details (object, sound, smell, structure).
- If there are branching interaction points (door, stairs, shadow, sound, object), they must be described before choices.

2. Specificity
Avoid vague phrasing like:
- 조사한다
- 신중히 접근한다
- 더 알아본다
- 다른 방법을 찾는다

Use specific actions:
- 문손잡이를 천천히 돌린다
- 계단 아래 어둠을 비춘다
- 벽의 금이 간 액자를 들어본다
- 삐걱거리는 바닥을 발로 눌러본다

3. Meaningful Divergence
Choices must represent clearly different physical or strategic actions.

4. Flow Continuity
The story must end at a moment of tension or decision that logically leads into the choices.

5. State Integrity
updatedState must match events.
turnCount increments by 1.
Location matches described scene.

6. Escalation
Each turn must:
- Increase tension, OR
- Reveal concrete new information, OR
- Introduce a complication tied to previous elements.

7. Style
- Write immersive but concise 1-4 paragraphs.
- Separate paragraphs with two line breaks.
- Avoid repetition.
- Write all story text and options in Korean. 존댓말 말고 반말, 즉 평서문으로 작성 (소설책 처럼).
- nodeTitle must reflect a concrete scene element (e.g., "깜박이는 전구", "잠긴 서랍", "삐걱이는 계단").

You MUST respond with ONLY a JSON object in this exact schema:
{
  "text": "string (1-4 paragraphs of story narration)",
  "options": [
    { "id": "opt1", "text": "string (choice description)" },
    { "id": "opt2", "text": "string (choice description)" }
  ],
  "updatedState": {
    "location": "string (Location ID or Name from Schema)",
    "inventory": ["string (Item Name)"],
    "flags": { "flag_key": true },
    "turnCount": number,
    "isEnding": false
  },
  "isEnding": false,
  "endingType": "good" | "bad" | "neutral" | null,
  "nodeTitle": "string (Use Proper Nouns)"
}`
        },
        {
            role: 'user',
            content: `## Story So Far\n${contextLines}\n\n## Current State\n${stateInfo}\n\n## Current Flags\n${JSON.stringify(state.flags || {})}\n\n## Player Action\n${playerAction}`,
        },
    ];

    const result = await chatCompletion(messages, { jsonMode: true });
    if (!result.ok) return result;

    const parsed = safeParseJSON(result.content);
    if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };

    return { ok: true, data: parsed.data };
}


