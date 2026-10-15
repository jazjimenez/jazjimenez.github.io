// Worked examples from the TagaBaybay project website demo
// (https://mango-cats.github.io/tagabaybay-docs/web/), MangoCats Research Group.
// The real system is a Rust library; these are precomputed traces so the site
// stays fully static. To go live later, swap `lookup` for a call to a WASM build
// or an API.

export type Step = { from: string; to: string; rule: string }
export type Trace = { ipa: string; tokens: string[]; steps: Step[]; nativized: string; notes: string }

export const EXAMPLES: Record<string, Trace> = {
  computer: {
    ipa: '/kəmˈpjuː.tɚ/',
    tokens: ['c', 'o', 'm', 'p', 'u', 't', 'er'],
    steps: [
      { from: 'c', to: 'k', rule: "c → k (before 'o')" },
      { from: 'o', to: 'o', rule: 'short vowel o' },
      { from: 'm', to: 'm', rule: 'invariant consonant' },
      { from: 'p', to: 'p', rule: 'invariant consonant' },
      { from: 'u', to: 'yu', rule: 'phonetic /juː/ glide resolution' },
      { from: 't', to: 't', rule: 'invariant consonant' },
      { from: 'er', to: 'er', rule: 'rhotic unstressed coda' },
    ],
    nativized: 'kompyuter',
    notes: 'KWF standard loanword nativization: preserving phonotactic glide /j/.',
  },
  traffic: {
    ipa: '/ˈtræf.ɪk/',
    tokens: ['t', 'r', 'a', 'ff', 'i', 'c'],
    steps: [
      { from: 't', to: 't', rule: 'invariant consonant' },
      { from: 'r', to: 'r', rule: 'invariant consonant' },
      { from: 'a', to: 'a', rule: 'vowel /æ/ → /a/' },
      { from: 'ff', to: 'p', rule: 'geminate reduction ff → f/p → p' },
      { from: 'i', to: 'i', rule: 'high front vowel' },
      { from: 'c', to: 'k', rule: 'coda c → k' },
    ],
    nativized: 'trapik',
    notes: 'Geminate reduction and final coda hardening.',
  },
  schedule: {
    ipa: '/ˈskɛdʒ.uːl/',
    tokens: ['s', 'ch', 'e', 'd', 'u', 'le'],
    steps: [
      { from: 's', to: 'is', rule: 'initial sC prothesis' },
      { from: 'ch', to: 'k', rule: 'ch → k in Greek-derived loans' },
      { from: 'e', to: 'e', rule: 'mid front vowel' },
      { from: 'd', to: 'd', rule: 'invariant consonant' },
      { from: 'u', to: 'yu', rule: 'glide expansion' },
      { from: 'le', to: 'l', rule: 'silent final -e deletion' },
    ],
    nativized: 'iskedyul',
    notes: 'Prosthetic /i/ insertion before s-cluster obeying Filipino phonotactics.',
  },
  basketball: {
    ipa: '/ˈbæs.kɪt.bɔːl/',
    tokens: ['b', 'a', 's', 'k', 'e', 't', 'b', 'a', 'll'],
    steps: [
      { from: 'b-a-s-k-e-t', to: 'basket', rule: 'syllable 1 cascade' },
      { from: 'b', to: 'b', rule: 'invariant consonant' },
      { from: 'a-ll', to: 'ol', rule: '-all → -ol phonetic rounding' },
    ],
    nativized: 'basketbol',
    notes: 'Codified in KWF Manwal sa Masinop na Pagsulat (Almario, 2014).',
  },
  straight: {
    ipa: '/streɪt/',
    tokens: ['s', 't', 'r', 'a', 'igh', 't'],
    steps: [
      { from: 's', to: 'is', rule: 'sC cluster prosthetic /i/ repair' },
      { from: 't-r', to: 'tr', rule: 'onset cluster retention' },
      { from: 'a-igh', to: 'ey', rule: 'tetragraph cascade aigh → ey' },
      { from: 't', to: 't', rule: 'invariant coda' },
    ],
    nativized: 'istreyt',
    notes: 'Greedy multigraph tokenizer identifies the igh tetragraph and applies prothesis.',
  },
  cake: {
    ipa: '/keɪk/',
    tokens: ['c', 'a', 'k', 'e'],
    steps: [
      { from: 'c', to: 'k', rule: 'c → k' },
      { from: 'a', to: 'ey', rule: 'diphthong /eɪ/ resolution' },
      { from: 'k', to: 'k', rule: 'invariant coda' },
      { from: 'e', to: '∅', rule: 'silent terminal -e truncation' },
    ],
    nativized: 'keyk',
    notes: 'English diphthong spelling nativization.',
  },
  xylophone: {
    ipa: '/ˈzaɪ.lə.foʊn/',
    tokens: ['x', 'y', 'l', 'o', 'ph', 'o', 'n', 'e'],
    steps: [
      { from: 'x', to: 's', rule: 'word-initial x → s' },
      { from: 'y', to: 'ay', rule: 'vocalic y /aɪ/ → ay' },
      { from: 'l', to: 'l', rule: 'liquid consonant' },
      { from: 'o', to: 'o', rule: 'unstressed vowel' },
      { from: 'ph', to: 'p', rule: 'digraph ph → p/f → p' },
      { from: 'o', to: 'o', rule: 'vowel retention' },
      { from: 'n', to: 'n', rule: 'nasal coda' },
      { from: 'e', to: '∅', rule: 'silent final -e' },
    ],
    nativized: 'saylopon',
    notes: 'Shows initial x-reduction and ph digraph mapping.',
  },
  chalk: {
    ipa: '/tʃɔːk/',
    tokens: ['ch', 'a', 'l', 'k'],
    steps: [
      { from: 'ch', to: 'ts', rule: 'affricate ch → ts' },
      { from: 'a-l', to: 'o', rule: 'silent l / alk → ok backing' },
      { from: 'k', to: 'k', rule: 'voiceless velar coda' },
    ],
    nativized: 'tsok',
    notes: 'Phonotactic adaptation of a silent liquid in English codas.',
  },
  taxi: {
    ipa: '/ˈtæk.si/',
    tokens: ['t', 'a', 'x', 'i'],
    steps: [
      { from: 't', to: 't', rule: 'invariant stop' },
      { from: 'a', to: 'a', rule: 'open front vowel' },
      { from: 'x', to: 'ks', rule: 'medial cluster x → ks' },
      { from: 'i', to: 'i', rule: 'high front vowel' },
    ],
    nativized: 'taksi',
    notes: 'Explicit phonotactic spelling of English /ks/ cluster.',
  },
  amoxicillin: {
    ipa: '/əˌmɒk.sɪˈsɪl.ɪn/',
    tokens: ['a', 'm', 'o', 'x', 'i', 'c', 'i', 'll', 'i', 'n'],
    steps: [
      { from: 'a', to: 'a', rule: 'word-initial vowel retention' },
      { from: 'm', to: 'm', rule: 'bilabial nasal' },
      { from: 'o', to: 'o', rule: 'mid back vowel' },
      { from: 'x', to: 'ks', rule: 'medial cluster x → ks' },
      { from: 'i', to: 'i', rule: 'high front vowel' },
      { from: 'c', to: 's', rule: "c → s (before front vowel 'i')" },
      { from: 'i', to: 'i', rule: 'high front vowel' },
      { from: 'll', to: 'l', rule: 'degemination ll → l' },
      { from: 'i', to: 'i', rule: 'high front vowel' },
      { from: 'n', to: 'n', rule: 'alveolar nasal coda' },
    ],
    nativized: 'amoksisilin',
    notes: 'Degemination (ll → l), x-cluster expansion (x → ks), and front-vowel softening (c → s).',
  },
  doxycycline: {
    ipa: '/ˌdɒk.sɪˈsaɪ.kliːn/',
    tokens: ['d', 'o', 'x', 'y', 'c', 'y', 'c', 'l', 'i', 'ne'],
    steps: [
      { from: 'd', to: 'd', rule: 'invariant voiced stop' },
      { from: 'o', to: 'o', rule: 'short vowel o' },
      { from: 'x', to: 'ks', rule: 'medial cluster x → ks' },
      { from: 'y', to: 'i', rule: 'unstressed vocalic y → i' },
      { from: 'c', to: 's', rule: 'c → s (before front vowel)' },
      { from: 'y', to: 'ay', rule: 'phonetic diphthong /aɪ/ → ay' },
      { from: 'c', to: 'k', rule: "c → k (before consonant 'l')" },
      { from: 'l', to: 'l', rule: 'lateral liquid' },
      { from: 'i', to: 'i', rule: 'front vowel retention' },
      { from: 'ne', to: 'n', rule: 'silent word-final -e truncation' },
    ],
    nativized: 'doksisayklin',
    notes: 'Dual resolution of y: unstressed /ɪ/ → i vs. stressed /aɪ/ → ay.',
  },
}

export const EXAMPLE_WORDS = Object.keys(EXAMPLES)

export function lookup(word: string): Trace | undefined {
  return EXAMPLES[word.trim().toLowerCase()]
}
