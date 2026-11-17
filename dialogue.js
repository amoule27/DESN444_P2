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
    // After this turn the barista asks the student to tap their card on the terminal (Phase 2).
    // Optional audio: audio/pay.mp3 (this line) and audio/pay_ok.mp3 ("Parfait, c’est approuvé. Merci!").
    pay: {
      fr: 'Parfait! Vous pouvez taper votre carte ici, s’il vous plaît.',
      en: 'Perfect! You can tap your card here, please.',
    },
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

// Keep a copy of the café script, then define the speaking assessment given at the info desk.
export const CAFE = LINES.slice();

// Assessment audio files use the prefix "a" (audio/a1_barista.mp3, audio/a1_opt1.mp3, ...).
export const ASSESS = [
  {
    fr: 'Bonjour! Bienvenue à Montréal! Comment ça va?',
    en: 'Hello! Welcome to Montréal! How are you?',
    options: [
      { fr: 'Ça va bien, et vous?', en: 'I’m doing well, and you?', ok: true },
      { fr: 'Je veux apprendre le français.', en: 'I want to learn French.' },
      { fr: 'Bon.', en: 'Good.' },
    ],
  },
  {
    fr: 'Comment vous appelez-vous?',
    en: 'What is your name?',
    options: [
      { fr: 'Je m’appelle Alex.', en: 'My name is Alex.', ok: true },
      { fr: 'J’ai vingt ans.', en: 'I am twenty years old.' },
      { fr: 'Oui, merci.', en: 'Yes, thank you.' },
    ],
  },
  {
    fr: 'Qu’est-ce qui vous amène à Montréal?',
    en: 'What brings you to Montréal?',
    options: [
      { fr: 'Je suis ici pour pratiquer mon français.', en: 'I am here to practice my French.', ok: true },
      { fr: 'Il fait froid.', en: 'It is cold.' },
      { fr: 'Je ne sais pas.', en: 'I don’t know.' },
    ],
  },
];
