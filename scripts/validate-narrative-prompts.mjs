import { readFile } from 'node:fs/promises';
import { createSession, getPrefetchSnapshot } from '../src/core/gameEngine.js';
import { buildPrompt3Messages } from '../src/llm/prompts.js';

const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, condition: Boolean(condition), detail });
}

function makeSampleSession() {
  const worldSchema = {
    protagonist: {
      id: 'pc',
      name: '서해온',
      role: '등대 기록관',
      limitation: '정전이 길어지면 과거의 음성을 현재와 구분하지 못한다',
      startingLocationId: 'loc_lighthouse',
    },
    locations: [
      {
        id: 'loc_lighthouse',
        name: '등대 하부',
        desc: '녹슨 발전기와 젖은 전선이 낮게 웅웅거리는 좁은 공간.',
        connectedTo: ['loc_archive'],
      },
      {
        id: 'loc_archive',
        name: '침수 기록실',
        desc: '바닷물이 무릎까지 차오르고 오래된 항해 일지가 떠다닌다.',
        connectedTo: ['loc_lighthouse', 'loc_pier'],
      },
      {
        id: 'loc_pier',
        name: '검은 부두',
        desc: '안개와 경고등 사이로 구조선의 불빛이 끊겼다 이어진다.',
        connectedTo: ['loc_archive'],
      },
    ],
    npcs: [
      {
        id: 'npc_yunseo',
        name: '윤서',
        role: '무전 기사',
        initialLocationId: 'loc_lighthouse',
        personality: '짧게 말하지만 숫자와 호출부호는 절대 틀리지 않는다',
        motive: '마지막 구조 신호를 다시 잡으려 한다',
        secret: '침수 기록실의 삭제된 항해 일지를 이미 한 번 읽었다',
      },
      {
        id: 'npc_captain_han',
        name: '한 대위',
        role: '실종 구조대장',
        initialLocationId: 'loc_pier',
        personality: '명령조로 말하지만 죄책감이 드러나면 말을 삼킨다',
        motive: '부두에 남은 생존자를 모으려 한다',
        secret: '등대의 신호를 일부러 늦춘 적이 있다',
      },
    ],
    items: [
      {
        id: 'item_logbook',
        name: '젖은 항해 일지',
        desc: '마지막 페이지에 등대 점멸 순서가 손톱으로 긁혀 있다.',
        initialLocationId: 'loc_lighthouse',
      },
    ],
    milestones: [
      {
        id: 'ms_act1_signal',
        order: 1,
        phase: 'ACT1',
        trigger: 'turn 1 or first direct interaction with 윤서',
        goal: '무전 신호가 외부 구조 요청이 아니라 등대 내부에서 반복 송출된 것임을 드러낸다',
        revealOrEscalation: '윤서의 수신기가 같은 문장을 7초 간격으로 반복한다',
        requiredSchemaRefs: ['loc_lighthouse', 'npc_yunseo', 'item_logbook'],
        completedFlag: 'milestone_signal_origin_seen',
      },
      {
        id: 'ms_act2_archive',
        order: 2,
        phase: 'ACT2',
        trigger: 'insight >= 1 or archive reached',
        goal: '침수 기록실에서 삭제된 항해 일지를 확인한다',
        revealOrEscalation: '등대가 구조를 지연시킨 기록이 드러난다',
        requiredSchemaRefs: ['loc_archive', 'npc_captain_han', 'item_logbook'],
        completedFlag: 'milestone_archive_truth_seen',
      },
    ],
    winConditions: [{ id: 'win1', desc: '신호의 출처를 밝혀 생존자를 부두로 보낸다' }],
    loseConditions: [{ id: 'lose1', desc: '반복 신호에 속아 등대 내부에 갇힌다' }],
  };

  const session = createSession({
    title: '칠초마다 우는 등대',
    publicWorld: '- 폭풍 고립\n- 낡은 해안 구조 체계',
    hiddenPlot: '- [사건의 전말]: 등대의 반복 신호는 구조 요청이 아니라 과거 사고를 덮기 위한 자동 방송이다.\n- [서사 전개 프레임워크]: 신호 원점 확인 -> 기록실 진입 -> 부두의 대위와 대면.',
    openingText: '폭풍은 사흘째 등대를 닫아걸었다.\n\n바다는 모든 구조 신호를 같은 목소리로 되돌려 보냈다.',
    entryLabel: '등대에 들어선다',
    initialThemeColor: '#101820',
    climaxThemeColor: '#030608',
    accentColor: '#d7b46a',
    model: 'test-model',
    temperature: 0.7,
    worldSchema,
    storyLength: '중편',
  });

  const root = session.nodesById[session.rootNodeId];
  root.options = [{ id: 'start', text: '등대의 안쪽 문을 민다' }];
  root.selectedOptionId = 'start';

  const node1 = {
    id: 'node1',
    parentId: session.rootNodeId,
    depth: 1,
    text: '문이 거칠게 열렸다. 윤서가 젖은 수신기를 움켜쥐고 같은 호출부호를 세 번 반복했다.',
    options: [
      { id: 'opt_hide', text: '빛을 끄고 기록실로 몸을 숨긴다' },
      { id: 'opt_confront', text: '윤서에게 반복 신호의 출처를 추궁한다' },
    ],
    selectedOptionId: 'opt_hide',
    stateSnapshot: {
      ...session.gameState,
      eventLedger: ['윤서가 등대 내부에서 반복되는 호출부호를 포착했다.'],
      clocks: { tension: 1, insight: 0 },
      turnCount: 1,
    },
    turnSummary: '윤서가 등대 내부에서 반복되는 호출부호를 포착했다.',
  };

  session.nodesById[node1.id] = node1;
  session.edges.push({ from: session.rootNodeId, optionId: 'start', to: node1.id });
  session.currentNodeId = node1.id;
  session.gameState = { ...node1.stateSnapshot };

  return { session, node1 };
}

const { session, node1 } = makeSampleSession();
const messages = buildPrompt3Messages(session, node1.options[0], node1.id);
const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
const userPrompt = messages.find((m) => m.role === 'user')?.content || '';
const promptSource = await readFile(new URL('../src/llm/prompts.js', import.meta.url), 'utf8');

check(
  'session initializes to protagonist starting location',
  session.gameState.location === 'loc_lighthouse',
  `location=${session.gameState.location}`,
);
check(
  'session initializes NPC locations from worldSchema',
  session.gameState.npcStates.npc_yunseo?.location === 'loc_lighthouse'
    && session.gameState.npcStates.npc_captain_han?.location === 'loc_pier',
  JSON.stringify(session.gameState.npcStates),
);
check(
  'Prompt #2 requires NPC initialLocationId and ordered milestones',
  promptSource.includes('initialLocationId') && promptSource.includes('milestones (Min 5)'),
);
check(
  'Prompt #3 injects current location from session.worldSchema',
  systemPrompt.includes('[CURRENT LOCATION: 등대 하부 (ID: loc_lighthouse)]'),
);
check(
  'Prompt #3 injects visible exits instead of freeform movement',
  systemPrompt.includes('침수 기록실 (Move to ID: loc_archive)'),
);
check(
  'Prompt #3 injects the next arc milestone as a story guardrail',
  systemPrompt.includes('[NEXT ARC MILESTONE — STORY GUARDRAIL]')
    && systemPrompt.includes('ms_act1_signal')
    && systemPrompt.includes('milestone_signal_origin_seen'),
);
check(
  'Prompt #3 separates local NPCs from offscreen roster',
  systemPrompt.includes('[NPCS IN CURRENT LOCATION]')
    && systemPrompt.includes('윤서')
    && systemPrompt.includes('[KNOWN NPC ROSTER — OFFSCREEN CONTINUITY]')
    && systemPrompt.includes('한 대위'),
);
check(
  'Prompt #3 injects local items for grounded interaction',
  systemPrompt.includes('[LOCAL ITEMS / OBJECTS]') && systemPrompt.includes('젖은 항해 일지'),
);
check(
  'Prompt #3 uses compact ledger plus recent scenes, not full-history echo bait',
  systemPrompt.includes('## Canon Ledger')
    && systemPrompt.includes('## Recent Scenes')
    && !systemPrompt.includes('Story History (Full Record)')
    && !systemPrompt.includes('Story History (Chronological)'),
);
check(
  'Prompt #3 injects repetition blacklist and option novelty rules',
  systemPrompt.includes('[RECENT REPETITION BLACKLIST — ABSOLUTE PROHIBITION]')
    && systemPrompt.includes('빛을 끄고 기록실로 몸을 숨긴다')
    && systemPrompt.includes('OPTION NOVELTY TEST'),
);
check(
  'Prompt #3 requires arc lock and visible state change',
  systemPrompt.includes('ARC LOCK')
    && systemPrompt.includes('NO FAKE PROGRESS')
    && systemPrompt.includes('visible state change'),
);
check(
  'Prompt #3 locks Korean plain-style narration and bans polite endings',
  systemPrompt.includes('Register Lock')
    && systemPrompt.includes('Polite Style Ban')
    && systemPrompt.includes('narrativeRegister')
    && systemPrompt.includes('~습니다'),
);
check(
  'user message carries the selected player action and current clocks',
  userPrompt.includes('빛을 끄고 기록실로 몸을 숨긴다')
    && userPrompt.includes('"tension":1')
    && userPrompt.includes('"insight":0'),
);

const idlePrefetchRows = getPrefetchSnapshot(session, node1.id);
check(
  'prefetch debug snapshot reports idle option status before caching',
  idlePrefetchRows.length === 2 && idlePrefetchRows.every((row) => row.status === 'idle'),
  JSON.stringify(idlePrefetchRows),
);

session.nodesById.node2 = {
  id: 'node2',
  parentId: node1.id,
  depth: 2,
  text: '기록실 문틈에서 같은 호출부호가 더 낮게 새어 나왔다.',
  options: [],
  selectedOptionId: null,
  stateSnapshot: node1.stateSnapshot,
  visited: false,
  meta: { title: '기록실 문틈' },
};
session.edges.push({ from: node1.id, optionId: 'opt_hide', to: 'node2' });

const cachedPrefetchRows = getPrefetchSnapshot(session, node1.id);
check(
  'prefetch debug snapshot reports cached child nodes',
  cachedPrefetchRows.find((row) => row.optionId === 'opt_hide')?.status === 'cached'
    && cachedPrefetchRows.find((row) => row.optionId === 'opt_hide')?.childNodeId === 'node2',
  JSON.stringify(cachedPrefetchRows),
);

const failed = checks.filter((item) => !item.condition);
for (const item of checks) {
  const prefix = item.condition ? 'PASS' : 'FAIL';
  console.log(`[${prefix}] ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} narrative prompt validation check(s) failed.`);
  process.exit(1);
}

console.log('\nNarrative prompt validation passed.');
