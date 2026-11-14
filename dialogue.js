// Dialogue for "Un cortado à Rosemont" — edit freely (teachers can change this file without touching the 3D code).
// Each turn: the barista's line (fr + en), the student's reply options (ok:true = accepted answer), and an optional cultural note.
// Audio files (optional) are looked up automatically:
//   audio/t{turn}_barista.mp3   -> barista line   (turn starts at 1)
//   audio/t{turn}_opt{n}.mp3    -> reply option n (n = position in the list below, starting at 1)
//   audio/pardon.mp3            -> "Pardon? Je n'ai pas compris."
// If a file is missing, the browser's French voice is used instead (placeholder).

export const LINES = [
  {
    fr: 'Bonjour! Qu’est-ce que je peux vous servir?',
    en: 'Hello! What can I get you?',
    options: [
      { fr: 'Bonjour! Je voudrais un cortado, s’il vous plaît.', en: 'Hello! I would like a cortado, please.', ok: true },
      { fr: 'Je veux apprendre le français.', en: 'I want to learn French.' },
      { fr: 'Bon.', en: 'Good.' },
    ],
    note: 'Québec tip: many servers say “Bonjour, hi!” Answer in French and you will usually get French back.',
  },
  {
    fr: 'Un cortado, parfait! C’est pour ici ou pour emporter?',
    en: 'A cortado, perfect! For here or to go?',
    options: [
      { fr: 'Pour emporter, s’il vous plaît.', en: 'To go, please.', ok: true },
      { fr: 'Pour ici, s’il vous plaît.', en: 'For here, please.', ok: true },
      { fr: 'Il fait beau aujourd’hui.', en: 'The weather is nice today.' },
    ],
    note: 'In Québec you will hear “pour emporter” (in France: “à emporter”).',
  },
  {
    fr: 'Ça fait quatre dollars trente et un. Débit ou crédit?',
    en: 'That’s $4.31. Debit or credit?',
    options: [
      { fr: 'Crédit, s’il vous plaît.', en: 'Credit, please.', ok: true },
      { fr: 'Débit, s’il vous plaît.', en: 'Debit, please.', ok: true },
      { fr: 'Je suis étudiant.', en: 'I am a student.' },
    ],
    note: '“Débit ou crédit?” is the usual question at the payment terminal.',
  },
  {
    fr: 'Voilà votre cortado! Bonne journée!',
    en: 'Here is your cortado! Have a good day!',
    options: [
      { fr: 'Merci beaucoup, bonne journée!', en: 'Thank you very much, have a good day!', ok: true },
      { fr: 'Merci, vous aussi!', en: 'Thanks, you too!', ok: true },
      { fr: 'Je voudrais un cortado.', en: 'I would like a cortado.' },
    ],
    note: 'In Québec, “bienvenue” also means “you’re welcome.”',
  },
];
