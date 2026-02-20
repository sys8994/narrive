/**
 * prompts.js — 3 prompt builders for the game pipeline
 * @module llm/prompts
 *
 * Prompt #1: user background → follow-up question form (JSON schema)
 * Prompt #2: background + form answers → synopsis / opening / theme
 * Prompt #3: turn progression → story text + options + state update
 */

import { chatCompletion } from './openaiClient.js';
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

Your task is NOT to generate generic RPG questions.
Your task is to carefully analyze the user's specific concept and generate 3-5 highly relevant follow-up questions that:

- Clarify the core conflict
- Define the protagonist’s role and motivation
- Establish the world’s rules and constraints
- Set the emotional tone and stakes
- Shape the intended gameplay direction

## Critical Requirements

1. Concept-Specific Design
- You MUST extract key elements from the user’s input (genre, setting, keywords, implied themes).
- Each question MUST directly relate to those extracted elements.
- Do NOT generate template-like or generic RPG questions.
- Avoid repeating common default categories unless clearly relevant.

2. Conflict-Centered Structure
At least ONE question must clarify:
- The main conflict or driving problem of the story.

3. Protagonist Definition
At least ONE question must define:
- Who the player character is in this specific world.
- Their role, limitation, or special position.

4. World Constraints
If the concept implies:
- Realistic setting → ask about realism boundaries (e.g., investigative depth, violence level).
- Fantasy/SF setting → ask about rule systems (magic limits, technology level).
- Mystery → ask about type of mystery (closed room, conspiracy, psychological, etc).
- Survival → ask about scarcity, time pressure, or danger level.

5. Gameplay Direction
Include at least ONE question that influences:
- Difficulty or stakes
- Branching style (moral dilemma vs puzzle solving vs action-heavy)

6. Question Quality
- Each question must meaningfully influence future story generation.
- Avoid superficial flavor-only questions.
- Questions should reduce ambiguity and strengthen narrative consistency.

7. Question Types
- Use "select" when structured options make sense.
- Use "text" for short clarifications.
- Use "textarea" for deeper creative input.
- Use "slider" only for intensity/difficulty scales.
- Do NOT use slider randomly.

8. Language
- Write ALL question labels in Korean.
- Make the tone immersive and engaging, not mechanical.

9. Quantity
- Generate exactly 3 to 5 questions.

You MUST respond with ONLY a JSON object in this exact schema:

{
  "title": "string (a short, concept-aware title for the questionnaire)",
  "questions": [
    {
      "id": "q1",
      "label": "string (the question text in Korean)",
      "type": "select" | "text" | "textarea" | "slider" | "checkbox",
      "options": ["..."],       
      "placeholder": "...",     
      "min": 0, 
      "max": 10,     
      "required": true
    }
  ]
}`
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

Language Rule:
- Write title, systemSynopsis, and openingText in Korean.
- Use immersive but disciplined prose (avoid excessive purple prose).

You MUST respond with ONLY a JSON object in this exact schema:

{
  "title": "string (story title, engaging and thematic)",
  "systemSynopsis": "string (3-5 structured paragraphs clearly covering: world rules, protagonist role, core conflict, escalation path, possible endings)",
  "openingText": "string (1-2 paragraphs of immersive opening narration)",
  "themeColor": "#RRGGBB",
  "accentColor": "#RRGGBB"
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

## Continuity Context (internal reference)
You are continuing an existing story.

You MUST:
- Treat all previous events as canon.
- Respect the current game state exactly as provided.
- Ensure cause-and-effect continuity from the player's last action.
- Directly reference specific elements already present in the scene.

Do NOT introduce major new world rules or unexplained elements.

---

## CRITICAL RULE: Choice Anchoring (VERY IMPORTANT)

Each choice MUST be directly grounded in elements explicitly mentioned in the current story text.

This means:

- If an object appears in a choice, it must be clearly described in the story text.
- If a location appears in a choice, it must already exist in the scene.
- If an NPC appears in a choice, they must have been introduced in the text.

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
    "location": "string",
    "inventory": ["string"],
    "turnCount": number,
    "isEnding": false
  },
  "isEnding": false,
  "endingType": "good" | "bad" | "neutral" | null,
  "nodeTitle": "string"
}`
        },
        {
            role: 'user',
            content: `## Story So Far\n${contextLines}\n\n## Current State\n${stateInfo}\n\n## Player Action\n${playerAction}`,
        },
    ];

    const result = await chatCompletion(messages, { jsonMode: true });
    if (!result.ok) return result;

    const parsed = safeParseJSON(result.content);
    if (!parsed.ok) return { ok: false, error: `JSON 파싱 실패: ${parsed.error}`, raw: parsed.raw };

    return { ok: true, data: parsed.data };
}
