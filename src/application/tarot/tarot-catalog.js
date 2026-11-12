'use strict';

const MAJORS = [
  ['FOOL','The Fool','beginnings, openness and a willing step','explore a fresh direction','avoid careless leaps'],
  ['MAGICIAN','The Magician','initiative, skill and focused action','use the tools already available','avoid manipulation or scattered effort'],
  ['HIGH_PRIESTESS','The High Priestess','intuition, quiet knowledge and patience','listen before acting','avoid forcing what is not yet clear'],
  ['EMPRESS','The Empress','growth, care and creative abundance','nurture what can develop','avoid overgiving or complacency'],
  ['EMPEROR','The Emperor','structure, authority and boundaries','create a stable plan','avoid rigidity or control'],
  ['HIEROPHANT','The Hierophant','tradition, learning and shared standards','seek tested guidance','avoid following convention blindly'],
  ['LOVERS','The Lovers','values, relationship and meaningful choice','choose in line with your values','avoid decisions made only to please others'],
  ['CHARIOT','The Chariot','direction, discipline and forward movement','align effort behind one course','avoid pushing without balance'],
  ['STRENGTH','Strength','courage, patience and inner steadiness','respond with calm confidence','avoid force or suppressed tension'],
  ['HERMIT','The Hermit','reflection, discernment and inward guidance','make room for honest review','avoid isolating beyond what helps'],
  ['WHEEL_OF_FORTUNE','Wheel of Fortune','change, cycles and shifting conditions','adapt to a turning point','avoid assuming any phase is permanent'],
  ['JUSTICE','Justice','fairness, accountability and clear consequences','weigh facts and obligations','avoid selective reasoning'],
  ['HANGED_MAN','The Hanged Man','pause, surrender and a new perspective','look again before deciding','avoid passive delay without learning'],
  ['DEATH','Death','ending, release and transformation','let an outdated phase close','avoid clinging to what has completed'],
  ['TEMPERANCE','Temperance','balance, integration and measured progress','combine resources patiently','avoid extremes'],
  ['DEVIL','The Devil','attachment, pressure and limiting patterns','name what has too much control','avoid denying unhealthy dependence'],
  ['TOWER','The Tower','disruption, truth and necessary restructuring','respond to what is being revealed','avoid rebuilding on the same weak base'],
  ['STAR','The Star','hope, renewal and authentic direction','restore trust through small steps','avoid wishful thinking without action'],
  ['MOON','The Moon','uncertainty, sensitivity and incomplete information','move carefully while clarity develops','avoid treating fear as fact'],
  ['SUN','The Sun','clarity, vitality and visible progress','act openly and acknowledge progress','avoid overconfidence'],
  ['JUDGEMENT','Judgement','review, awakening and a consequential choice','answer what now asks for change','avoid repeating an old pattern unexamined'],
  ['WORLD','The World','completion, integration and wider perspective','recognize what has been achieved','avoid delaying closure'],
];
const SUITS = Object.freeze({
  WANDS: ['initiative and creative drive','momentum and enterprise','impulsive effort or burnout'],
  CUPS: ['feelings and connection','empathy and emotional openness','idealization or emotional avoidance'],
  SWORDS: ['thought, truth and decision','clarity and honest communication','conflict, anxiety or harsh judgment'],
  PENTACLES: ['resources, work and practical stability','steady material progress','overfocus on security or possessions'],
});
const MINOR_THEMES = Object.freeze({
  WANDS: Object.freeze({
    ACE: 'Inspiration, initiative, a new spark', TWO: 'Planning, choices, looking ahead', THREE: 'Progress, expansion, wider possibilities', FOUR: 'Stability, celebration, a shared milestone', FIVE: 'Competition, differing priorities, productive friction', SIX: 'Recognition, confidence, visible progress', SEVEN: 'Conviction, boundaries, standing your ground', EIGHT: 'Momentum, swift movement, active communication', NINE: 'Resilience, caution, staying prepared', TEN: 'Responsibility, pressure, carrying too much', PAGE: 'Curiosity, exploration, an encouraging idea', KNIGHT: 'Bold action, energy, rapid pursuit', QUEEN: 'Confidence, warmth, independent vision', KING: 'Leadership, direction, purposeful action',
  }),
  CUPS: Object.freeze({
    ACE: 'Emotional openness, care, a fresh connection', TWO: 'Partnership, mutual understanding, connection', THREE: 'Support, networking, collaboration', FOUR: 'Disengagement, reflection, overlooked possibilities', FIVE: 'Disappointment, grief, noticing what remains', SIX: 'Memory, familiarity, reconnecting with the past', SEVEN: 'Many options, imagination, unclear priorities', EIGHT: 'Moving on, seeking deeper meaning, release', NINE: 'Contentment, appreciation, a personal wish', TEN: 'Emotional harmony, belonging, shared wellbeing', PAGE: 'Sensitivity, openness, an intuitive message', KNIGHT: 'Emotional pursuit, invitation, idealism', QUEEN: 'Empathy, emotional depth, intuitive care', KING: 'Emotional balance, compassion, steady support',
  }),
  SWORDS: Object.freeze({
    ACE: 'Clarity, truth, a decisive insight', TWO: 'Difficult choice, pause, competing perspectives', THREE: 'Heartache, difficult truth, emotional release', FOUR: 'Rest, recovery, mental pause', FIVE: 'Conflict, tension, the cost of winning', SIX: 'Transition, gradual recovery, moving forward', SEVEN: 'Strategy, discretion, acting carefully', EIGHT: 'Restriction, self-doubt, limited perspective', NINE: 'Worry, overthinking, mental pressure', TEN: 'A difficult ending, acceptance, release', PAGE: 'Curiosity, alertness, direct communication', KNIGHT: 'Fast thinking, direct action, strong opinions', QUEEN: 'Discernment, independence, clear boundaries', KING: 'Reason, authority, balanced judgment',
  }),
  PENTACLES: Object.freeze({
    ACE: 'A practical opening, resources, solid potential', TWO: 'Balancing priorities, adapting, managing resources', THREE: 'Teamwork, skill, building something well', FOUR: 'Security, control, holding on tightly', FIVE: 'Material strain, isolation, seeking support', SIX: 'Giving and receiving, fairness, practical support', SEVEN: 'Patience, assessment, long-term effort', EIGHT: 'Practice, craftsmanship, focused improvement', NINE: 'Independence, earned comfort, self-reliance', TEN: 'Long-term stability, legacy, shared resources', PAGE: 'Learning, practical planning, a useful opportunity', KNIGHT: 'Consistency, patience, dependable effort', QUEEN: 'Resourcefulness, care, practical stability', KING: 'Stewardship, reliability, material leadership',
  }),
});
const RANKS = [
  ['ACE','Ace','a new opening'],['TWO','Two','choice and balance'],['THREE','Three','development and collaboration'],
  ['FOUR','Four','stability and limits'],['FIVE','Five','friction and adjustment'],['SIX','Six','movement and rebalancing'],
  ['SEVEN','Seven','assessment and perseverance'],['EIGHT','Eight','focused activity'],['NINE','Nine','experience and nearing completion'],
  ['TEN','Ten','completion and consequence'],['PAGE','Page','curiosity and a message'],['KNIGHT','Knight','pursuit and momentum'],
  ['QUEEN','Queen','mature inner expression'],['KING','King','directed outer mastery'],
];

function semantics({ cardId, displayName, arcana, suit = null, rank = null, core, opportunity, caution }) {
  const subject = suit ? SUITS[suit][0] : core;
  return Object.freeze({
    cardId, displayName, arcana, ...(suit ? { suit, rank } : {}),
    coreThemes: [core], opportunities: [opportunity], cautions: [caution],
    reflectiveGuidance: `Consider how ${core} is showing up, then choose one grounded response.`,
    careerThemes: [`At work, consider ${subject}.`], relationshipThemes: [`In relationships, consider ${subject}.`],
    moneyThemes: [`With money, consider ${subject} without treating the card as a guarantee.`],
    generalThemes: [`This card invites reflection on ${core}.`],
    symbolicKeywords: core.split(/, | and /).slice(0, 4),
  });
}

const majorCards = MAJORS.map(([id, name, core, opportunity, caution]) => semantics({ cardId: `MAJOR_${id}`, displayName: name, arcana: 'MAJOR', core, opportunity, caution }));
const minorCards = Object.entries(SUITS).flatMap(([suit, suitMeaning]) => RANKS.map(([rank, rankName, rankMeaning]) => semantics({
  cardId: `${suit}_${rank}`, displayName: `${rankName} of ${suit[0]}${suit.slice(1).toLowerCase()}`, arcana: 'MINOR', suit, rank,
  core: MINOR_THEMES[suit][rank], opportunity: `${suitMeaning[1]} through ${rankMeaning}`,
  caution: suitMeaning[2],
})));
const TAROT_CATALOG = Object.freeze([...majorCards, ...minorCards]);
const BY_ID = new Map(TAROT_CATALOG.map((card) => [card.cardId, card]));

function tarotCard(cardId) { return BY_ID.get(cardId) || null; }
module.exports = { TAROT_CATALOG, tarotCard };
