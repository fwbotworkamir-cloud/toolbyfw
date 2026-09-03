/**
 * Title classifier — extracts patterns, power words, format, and structure
 * from article titles to reverse-engineer what Discover favors.
 */

const POWER_WORDS = [
  // Urgency
  'breaking', 'urgent', 'now', 'today', 'just', 'new', 'latest', 'update', 'finally', 'alert',
  // Curiosity
  'secret', 'hidden', 'surprising', 'unexpected', 'strange', 'weird', 'mysterious', 'shocking',
  'revealed', 'truth', 'actually', 'really', 'turns out', 'nobody',
  // Value
  'best', 'worst', 'top', 'ultimate', 'essential', 'complete', 'definitive', 'proven',
  'free', 'simple', 'easy', 'fast', 'quick',
  // Emotion
  'beautiful', 'stunning', 'incredible', 'amazing', 'brilliant', 'terrifying', 'heartbreaking',
  'hilarious', 'perfect', 'gorgeous', 'insane', 'wild', 'epic', 'massive',
  // Authority
  'expert', 'scientist', 'doctor', 'study', 'research', 'official', 'confirmed', 'according',
  // Exclusivity
  'exclusive', 'first', 'only', 'rare', 'limited', 'inside', 'leaked', 'never before',
  // Negative / warning
  'avoid', 'stop', 'never', 'mistake', 'wrong', 'warning', 'danger', 'risk', 'fail', 'scam',
  'toxic', 'deadly', 'ban', 'banned'
];

const EMOTIONAL_TRIGGERS = [
  'fear', 'anger', 'joy', 'surprise', 'disgust', 'sadness', 'trust', 'anticipation'
];

const EMOTION_WORDS = {
  fear: ['terrifying', 'scary', 'danger', 'risk', 'warning', 'threat', 'deadly', 'alarming', 'crisis'],
  anger: ['outrage', 'furious', 'slams', 'blasts', 'attacks', 'destroys', 'rips', 'calls out', 'backlash'],
  joy: ['amazing', 'beautiful', 'wonderful', 'celebrate', 'love', 'happy', 'joy', 'delightful', 'brilliant'],
  surprise: ['shocking', 'unexpected', 'surprising', 'unbelievable', 'incredible', 'stunning', 'bombshell', 'twist'],
  disgust: ['gross', 'disgusting', 'toxic', 'horrible', 'worst', 'terrible', 'awful', 'nasty'],
  sadness: ['heartbreaking', 'tragic', 'devastating', 'loss', 'dies', 'death', 'mourns', 'farewell'],
  trust: ['proven', 'expert', 'study', 'research', 'official', 'confirmed', 'science', 'data'],
  anticipation: ['upcoming', 'soon', 'coming', 'launch', 'reveal', 'preview', 'rumor', 'leak', 'expected']
};

// ─── FandomWire verticals ───────────────────────────────────────
// Keyword → vertical routing for FW's actual beats. Checked in order;
// first hit wins, so put the most specific franchises before broad terms.
const FW_VERTICALS = [
  ['marvel', ['marvel', 'mcu', 'avengers', 'spider-man', 'spiderman', 'x-men', 'deadpool', 'wolverine', 'thor ', 'loki', 'fantastic four', 'venom', 'daredevil', 'thunderbolts', 'doctor doom']],
  ['dc', [' dc ', 'dcu', 'batman', 'superman', 'joker', 'wonder woman', 'aquaman', 'james gunn', 'the flash', 'suicide squad', 'peacemaker', 'supergirl']],
  ['anime', ['anime', 'manga', 'one piece', 'naruto', 'dragon ball', 'jujutsu kaisen', 'demon slayer', 'attack on titan', 'my hero academia', 'mha', 'hunter x hunter', 'studio ghibli', 'chainsaw man', 'bleach', 'solo leveling', 'one punch man', 'boruto', 'black clover', 'fire force', 'crunchyroll', 'shonen', 'gundam', 'evangelion', 'apothecary diaries', 'makoto shinkai', 'frieren', 'dandadan', 'kagurabachi', 'sakamoto days', 'kaiju no', 'spy x family', 'haikyuu', 'blue lock', 'tokyo ghoul', 'mushoku tensei', 're:zero', 'vinland saga', 'dr. stone', 'toriyama', 'kishimoto', 'togashi', 'isekai']],
  ['star-wars', ['star wars', 'mandalorian', 'jedi', 'skywalker', 'ahsoka', 'grogu', 'darth']],
  ['gaming', ['playstation', 'ps5', 'xbox', 'nintendo', 'video game', 'gta ', 'elden ring', 'call of duty', 'fortnite', 'zelda', 'pokemon', 'steam ', 'gamer', 'esports', 'twitch', 'god of war', 'final fantasy', 'ghost of yotei', 'ghost of y014dtei', 'ghost of tsushima', 'dawnwalker', 'helldivers', 'baldur', 'cyberpunk 2077', 'witcher', 'assassin', 'dark souls', 'soulslike', 'marvel rivals', 'mortal shell', 'onimusha', 'crimson desert', 'wolverine game', 'insomniac', 'capcom', 'square enix', 'fromsoft', 'ubisoft', 'game pass', 'ps plus', 'roblox', 'minecraft', 'overwatch', 'valorant', 'apex legends', 'monster hunter', 'street fighter', 'tekken', 'resident evil', 'silent hill', 'metal gear', 'kingdom hearts', 'persona ', 'nioh', 'starfield', 'fallout', 'skyrim', 'diablo', 'warcraft', 'destiny 2', 'genshin', 'honkai', 'wardogs', 'zero company']],
  ['horror', ['horror', 'stephen king', 'slasher', 'a24', 'blumhouse', 'conjuring', 'scream ']],
  ['tv', ['netflix', 'hbo', 'disney+', 'disney plus', 'prime video', 'hulu', 'apple tv', 'season ', 'episode', 'series finale', 'showrunner', 'renewed', 'spinoff', 'spin-off', 'stranger things', 'game of thrones', 'house of the dragon', 'the boys', 'squid game', 'reacher', 'yellowstone', 'lioness', 'landman', 'taylor sheridan', 'silo', 'severance', 'the walking dead', 'ted lasso', 'rick and morty']],
  ['movies', ['box office', 'trailer', 'movie', 'film ', 'director', 'sequel', 'oscar', 'cinema', 'blockbuster', 'imax', 'a-lister']],
  ['wwe', ['wwe', 'wrestlemania', 'aew', 'wrestler', 'john cena', 'roman reigns']],
  ['celebrity', ['celebrity', 'actor', 'actress', 'singer', 'rapper', 'taylor swift', 'kardashian', 'red carpet', 'dating', 'divorce', 'net worth']],
];

// Hard-off-topic markers. A title matching these and NO vertical is noise
// (politics/finance/sport desks bleeding through domain: queries).
const OFF_TOPIC = [
  'election', 'senate', 'congress', 'parliament', 'minister', 'president trump', 'white house',
  'tariff', 'stock market', 'federal reserve', 'inflation', 'gdp', 'crypto',
  'war in', 'ceasefire', 'gaza', 'ukraine', 'nato', 'cyber attack', 'cyberattack', 'may be behind',
  'premier league', 'nfl ', 'nba ', 'mlb ', 'cricket', 'transfer news', 'grand prix',
  'covid', 'vaccine', 'court rules', 'lawsuit settl', 'murder trial', 'arrested for',
];

// Number roles in a headline. These are different SEO/Discover levers:
// a calendar year is a freshness qualifier, a sequel digit is the topic's
// name, a leading count is a listicle format signal.
const NUMBER_TYPES = [
  ['year',           t => /\b(19[5-9]\d|20[0-3]\d)\b/.test(t)],
  ['money',          t => /[\$£€]\s?\d|\d+(\.\d+)?\s?(million|billion)\b/i.test(t)],
  ['franchise-unit', t => /\b(season|episode|chapter|part|vol(ume)?|phase|ep)\s?\.?\s?\d/i.test(t)],
  ['leading-count',  t => /^\d/.test(t.trim())],
  ['age',            t => /\b\d{1,2}[- ]year[- ]old\b|\baged \d/i.test(t)],
  ['score-percent',  t => /\d+\s?%|\b\d{1,2}(\.\d)?\/10\b/.test(t)],
  // sequel digit: word-attached number once years are stripped (Deadpool 3, GTA 6)
  ['sequel-digit',   t => /[A-Za-z]\s\d{1,2}\b/.test(t.replace(/\b(19[5-9]\d|20[0-3]\d)\b/g, ''))],
];

class Classifier {
  // Which roles the digits in this title play. [] when no digits.
  detectNumberTypes(title) {
    if (!/\d/.test(title || '')) return [];
    const hits = NUMBER_TYPES.filter(([, test]) => test(title)).map(([name]) => name);
    return hits.length ? hits : ['other'];
  }

  // Returns the FW vertical slug, or null if no beat matches.
  detectVertical(title) {
    const lower = ` ${(title || '').toLowerCase()} `;
    for (const [vertical, keys] of FW_VERTICALS) {
      if (keys.some(k => lower.includes(k))) return vertical;
    }
    return null;
  }

  // Entertainment gate: on a vertical → yes; off-topic marker → no;
  // otherwise unknown (kept, tagged 'other').
  isOffTopic(title) {
    const lower = ` ${(title || '').toLowerCase()} `;
    if (this.detectVertical(title)) return false;
    return OFF_TOPIC.some(k => lower.includes(k));
  }

  classify(title) {
    if (!title) return null;

    // Normalize GDELT-style spacing artifacts: "long - term" → "long-term", "Roo : Listen" → "Roo: Listen"
    let normalized = title
      .replace(/\s+([—–\-])\s+/g, '$1')  // collapse spaces around dashes
      .replace(/\s+:\s+/g, ': ')          // normalize colon spacing
      .replace(/\s+\.\s+/g, '.')          // collapse spaces around dots  
      .replace(/\s+,\s+/g, ', ')          // normalize comma spacing
      .replace(/\s+'/g, "'")              // fix quote spacing
      .replace(/'\s+/g, "'")
      .replace(/\s{2,}/g, ' ')            // collapse multiple spaces
      .trim();

    // Strip trailing " - SourceName" that GDELT appends
    normalized = normalized.replace(/\s*-\s*[A-Z][A-Za-z\s.!]+$/, '').trim();

    const lower = normalized.toLowerCase();
    const words = lower.split(/\s+/);

    return {
      fw_vertical: this.detectVertical(normalized) || 'other',
      format: this.detectFormat(lower, words),
      title_structure: this.detectStructure(normalized, lower, words),
      power_words: this.extractPowerWords(lower),
      emotional_triggers: this.detectEmotions(lower),
      title_sentiment: this.guessSentiment(lower),
      title_word_count: words.length,
      title_char_count: normalized.length,
      title_has_number: /\d/.test(normalized),
      title_has_question: normalized.includes('?'),
      title_has_colon: normalized.includes(':'),
      title_has_dash: /[—–\-]/.test(normalized) && normalized.split(/[—–\-]/).length > 1,
      title_starts_with_number: /^\d/.test(normalized.trim()),
    };
  }

  detectFormat(lower, words) {
    // Listicle: starts with or contains a number followed by list-like words
    if (/^\d+\s/.test(lower) || /\b\d+\s+(best|worst|top|ways|things|tips|reasons|signs|facts|steps|mistakes|rules|ideas|hacks|secrets|places|foods|apps)\b/.test(lower)) {
      return 'listicle';
    }
    // How-to
    if (/^how\s+to\b/.test(lower) || /\bhow\s+to\b/.test(lower) || /^a\s+guide\s+to\b/.test(lower)) {
      return 'how-to';
    }
    // Question
    if (lower.includes('?')) {
      if (/^(why|what|how|when|where|who|which|is|are|can|do|does|should|will|could|would)\b/.test(lower)) {
        return 'explainer';
      }
      return 'question-bait';
    }
    // Review / comparison
    if (/\bvs\.?\b|\bversus\b|\bcompared\b|\breview\b|\brated\b/.test(lower)) {
      return 'review';
    }
    // Opinion / editorial
    if (/^(why|i think|opinion|the case for|the case against|the problem with|the truth about)\b/.test(lower)) {
      return 'opinion';
    }
    // Breaking news
    if (/^(breaking|just in|update|report|exclusive|official)\b/.test(lower) || /\b(announces?|confirmed|reveals?|launches?|dies|killed|arrested|fired|resigned)\b/.test(lower)) {
      return 'news';
    }
    // Guide / resource
    if (/\b(guide|handbook|checklist|cheat\s*sheet|beginner|everything you need|101)\b/.test(lower)) {
      return 'guide';
    }
    // Story / narrative
    if (/\b(story|journey|experience|confession|behind the scenes|inside)\b/.test(lower)) {
      return 'narrative';
    }

    return 'general';
  }

  detectStructure(original, lower, words) {
    // Detect the structural template of the title
    const patterns = [];

    if (/^\d+\s/.test(lower)) patterns.push('NUMBER_START');
    if (/^how\s+to\b/.test(lower)) patterns.push('HOW_TO_START');
    if (/^why\b/.test(lower)) patterns.push('WHY_START');
    if (/^what\b/.test(lower)) patterns.push('WHAT_START');
    if (/^the\b/.test(lower)) patterns.push('THE_START');

    if (original.includes(':')) patterns.push('HAS_COLON');
    if (/[—–]/.test(original)) patterns.push('HAS_EMDASH');
    if (original.includes('?')) patterns.push('HAS_QUESTION');
    if (original.includes('!')) patterns.push('HAS_EXCLAIM');
    if (/["']/.test(original)) patterns.push('HAS_QUOTES');
    if (/\(.*\)/.test(original)) patterns.push('HAS_PARENS');

    if (words.length <= 5) patterns.push('SHORT');
    else if (words.length <= 10) patterns.push('MEDIUM');
    else if (words.length <= 15) patterns.push('LONG');
    else patterns.push('VERY_LONG');

    // Detect common Discover title templates
    if (/^\d+\s\w+\s(to|for|that|you|of)\b/.test(lower)) patterns.push('TPL_N_THINGS');
    if (/:\s*(what|how|why|everything)\b/.test(lower)) patterns.push('TPL_TOPIC_COLON_EXPLAINER');
    if (/^the\s+\w+\s+(you|that|everyone)\b/.test(lower)) patterns.push('TPL_THE_X_YOU');
    if (/^(this|these|that|here)\b.*\b(will|can|could|might)\b/.test(lower)) patterns.push('TPL_THIS_WILL');
    if (/\byou\s+(need|should|must|have)\b/.test(lower)) patterns.push('TPL_YOU_NEED');

    return patterns.join(' | ');
  }

  extractPowerWords(lower) {
    return POWER_WORDS.filter(w => {
      if (w.includes(' ')) return lower.includes(w);
      return new RegExp(`\\b${w}\\b`).test(lower);
    });
  }

  detectEmotions(lower) {
    const detected = [];
    for (const [emotion, words] of Object.entries(EMOTION_WORDS)) {
      for (const w of words) {
        if (lower.includes(w)) {
          detected.push(emotion);
          break;
        }
      }
    }
    return detected;
  }

  guessSentiment(lower) {
    const positive = ['best', 'amazing', 'beautiful', 'brilliant', 'perfect', 'love', 'great',
      'incredible', 'wonderful', 'happy', 'stunning', 'gorgeous', 'excellent', 'fantastic'];
    const negative = ['worst', 'terrible', 'awful', 'horrible', 'danger', 'risk', 'avoid',
      'never', 'wrong', 'fail', 'scam', 'toxic', 'deadly', 'ban', 'dies', 'killed', 'crisis'];

    let score = 0;
    for (const w of positive) if (lower.includes(w)) score++;
    for (const w of negative) if (lower.includes(w)) score--;

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  // Generate a normalized pattern string for tracking recurring structures
  toPattern(title) {
    return title
      .replace(/\d+/g, '{N}')
      .replace(/"[^"]*"/g, '{QUOTE}')
      .replace(/'[^']*'/g, '{QUOTE}')
      .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, '{NAME}')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 80);
  }
}

module.exports = Classifier;
