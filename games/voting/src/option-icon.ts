const VOTING_OPTION_ICONS: Readonly<Record<string, string>> = {
  Popcorn: '🍿', Pizza: '🍕', Candy: '🍬', Nachos: '🌮',
  'Beach day': '🏖️', 'Movie marathon': '🎬', 'Road trip': '🚙', 'Stay home': '🏠',
  'Hot chocolate': '☕', Tea: '🫖', Coffee: '☕', Cider: '🍎',
  'Big city': '🏙️', Cabin: '🛖', Island: '🏝️', 'Theme park': '🎢',
  Dog: '🐶', Cat: '🐱', Rabbit: '🐰', Parrot: '🦜',
  Tacos: '🌮', Noodles: '🍜', Burgers: '🍔', Breakfast: '🥞',
  Pop: '🎤', Rock: '🎸', 'Hip-hop': '🎧', Throwbacks: '📻',
  'Good food': '🍽️', 'Great music': '🎶', 'Fun games': '🎲', 'The people': '🫶',
  Fly: '🪶', Teleport: '✨', 'Pause time': '⏸️', 'Read minds': '🧠',
  Bake: '🧁', Game: '🎮', Read: '📖', Nap: '😴',
  Bowling: '🎳', 'Mini golf': '⛳', Karaoke: '🎤', Arcade: '🕹️',
  Spring: '🌷', Summer: '☀️', Autumn: '🍂', Winter: '❄️',
  Cake: '🍰', 'Ice cream': '🍦', Brownies: '🍫', Fruit: '🍓',
  Dance: '💃', Cook: '🍳', Paint: '🎨', 'Play music': '🎹',
  Explore: '🧭', Create: '✂️', Socialize: '🥳', Recharge: '🔋',
  'Big sofa': '🛋️', Armchair: '🪑', 'Floor cushions': '🛏️', 'By the window': '🪟',
  Trophy: '🏆', 'Snack pick': '🍿', 'Playlist control': '🎵', 'Bragging rights': '😎',
  Forest: '🌲', Ocean: '🌊', Mountains: '⛰️', Home: '🏡',
  Pancakes: '🥞', Eggs: '🍳', Pastries: '🥐', Smoothies: '🥤',
  Plants: '🪴', Blankets: '🧺', Speakers: '🔊', Books: '📚',
  Serious: '🧐', Silly: '🤪', Candid: '📸', Dramatic: '🎭',
};

export function votingOptionIcon(option: string): string {
  return VOTING_OPTION_ICONS[option] ?? '❤️';
}

export function votingRecapIcon(detail: string): string {
  const option = Object.keys(VOTING_OPTION_ICONS).find((candidate) => detail.startsWith(candidate));
  return option === undefined ? '❤️' : VOTING_OPTION_ICONS[option]!;
}
