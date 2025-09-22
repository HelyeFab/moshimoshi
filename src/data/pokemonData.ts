// Pokemon data utilities and sprite management

// Pokemon names - Gen 1 & 2 focus with some additional favorites
export const POKEMON_NAMES: Record<number, string> = {
  1: "Bulbasaur", 2: "Ivysaur", 3: "Venusaur",
  4: "Charmander", 5: "Charmeleon", 6: "Charizard",
  7: "Squirtle", 8: "Wartortle", 9: "Blastoise",
  10: "Caterpie", 11: "Metapod", 12: "Butterfree",
  13: "Weedle", 14: "Kakuna", 15: "Beedrill",
  16: "Pidgey", 17: "Pidgeotto", 18: "Pidgeot",
  19: "Rattata", 20: "Raticate",
  21: "Spearow", 22: "Fearow",
  23: "Ekans", 24: "Arbok",
  25: "Pikachu", 26: "Raichu",
  27: "Sandshrew", 28: "Sandslash",
  29: "Nidoran♀", 30: "Nidorina", 31: "Nidoqueen",
  32: "Nidoran♂", 33: "Nidorino", 34: "Nidoking",
  35: "Clefairy", 36: "Clefable",
  37: "Vulpix", 38: "Ninetales",
  39: "Jigglypuff", 40: "Wigglytuff",
  41: "Zubat", 42: "Golbat",
  43: "Oddish", 44: "Gloom", 45: "Vileplume",
  46: "Paras", 47: "Parasect",
  48: "Venonat", 49: "Venomoth",
  50: "Diglett", 51: "Dugtrio",
  52: "Meowth", 53: "Persian",
  54: "Psyduck", 55: "Golduck",
  56: "Mankey", 57: "Primeape",
  58: "Growlithe", 59: "Arcanine",
  60: "Poliwag", 61: "Poliwhirl", 62: "Poliwrath",
  63: "Abra", 64: "Kadabra", 65: "Alakazam",
  66: "Machop", 67: "Machoke", 68: "Machamp",
  69: "Bellsprout", 70: "Weepinbell", 71: "Victreebel",
  72: "Tentacool", 73: "Tentacruel",
  74: "Geodude", 75: "Graveler", 76: "Golem",
  77: "Ponyta", 78: "Rapidash",
  79: "Slowpoke", 80: "Slowbro",
  81: "Magnemite", 82: "Magneton",
  83: "Farfetch'd", 84: "Doduo", 85: "Dodrio",
  86: "Seel", 87: "Dewgong",
  88: "Grimer", 89: "Muk",
  90: "Shellder", 91: "Cloyster",
  92: "Gastly", 93: "Haunter", 94: "Gengar",
  95: "Onix", 96: "Drowzee", 97: "Hypno",
  98: "Krabby", 99: "Kingler", 100: "Voltorb",
  101: "Electrode", 102: "Exeggcute", 103: "Exeggutor",
  104: "Cubone", 105: "Marowak",
  106: "Hitmonlee", 107: "Hitmonchan",
  108: "Lickitung", 109: "Koffing", 110: "Weezing",
  111: "Rhyhorn", 112: "Rhydon",
  113: "Chansey", 114: "Tangela",
  115: "Kangaskhan", 116: "Horsea", 117: "Seadra",
  118: "Goldeen", 119: "Seaking",
  120: "Staryu", 121: "Starmie",
  122: "Mr. Mime", 123: "Scyther",
  124: "Jynx", 125: "Electabuzz",
  126: "Magmar", 127: "Pinsir",
  128: "Tauros", 129: "Magikarp", 130: "Gyarados",
  131: "Lapras", 132: "Ditto",
  133: "Eevee", 134: "Vaporeon", 135: "Jolteon", 136: "Flareon",
  137: "Porygon", 138: "Omanyte", 139: "Omastar",
  140: "Kabuto", 141: "Kabutops",
  142: "Aerodactyl", 143: "Snorlax",
  144: "Articuno", 145: "Zapdos", 146: "Moltres",
  147: "Dratini", 148: "Dragonair", 149: "Dragonite",
  150: "Mewtwo", 151: "Mew",
  // Gen 2
  152: "Chikorita", 153: "Bayleef", 154: "Meganium",
  155: "Cyndaquil", 156: "Quilava", 157: "Typhlosion",
  158: "Totodile", 159: "Croconaw", 160: "Feraligatr",
  169: "Crobat",
  172: "Pichu", 173: "Cleffa", 174: "Igglybuff", 175: "Togepi", 176: "Togetic",
  196: "Espeon", 197: "Umbreon",
  215: "Sneasel",
  243: "Raikou", 244: "Entei", 245: "Suicune",
  249: "Lugia", 250: "Ho-Oh",
  251: "Celebi",
};

// Pokemon rarity classification
export type PokemonRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical';

export interface PokemonInfo {
  id: number;
  name: string;
  caught: boolean;
  catchDate?: string;
  rarity: PokemonRarity;
}

// Legendary and Mythical Pokémon IDs
const LEGENDARY_POKEMON = new Set([
  144, 145, 146, // Articuno, Zapdos, Moltres
  150, // Mewtwo
  243, 244, 245, // Raikou, Entei, Suicune
  249, 250, // Lugia, Ho-Oh
  377, 378, 379, // Regirock, Regice, Registeel
  380, 381, // Latias, Latios
  382, 383, 384, // Kyogre, Groudon, Rayquaza
  480, 481, 482, // Uxie, Mesprit, Azelf
  483, 484, 487, // Dialga, Palkia, Giratina
  638, 639, 640, // Cobalion, Terrakion, Virizion
  641, 642, 643, 644, 645, 646, // Tornadus, Thundurus, Reshiram, Zekrom, Landorus, Kyurem
  716, 717, 718, // Xerneas, Yveltal, Zygarde
  785, 786, 787, 788, // Tapu Koko, Tapu Lele, Tapu Bulu, Tapu Fini
  791, 792, // Solgaleo, Lunala
  800, // Necrozma
  888, 889, 890, // Zacian, Zamazenta, Eternatus
  894, 895, 896, 897, 898, // Regieleki, Regidrago, Glastrier, Spectrier, Calyrex
  905, // Enamorus
]);

const MYTHICAL_POKEMON = new Set([
  151, // Mew
  251, // Celebi
  385, 386, // Jirachi, Deoxys
  489, 490, // Phione, Manaphy
  491, 492, 493, // Darkrai, Shaymin, Arceus
  494, // Victini
  647, 648, 649, // Keldeo, Meloetta, Genesect
  719, 720, 721, // Diancie, Hoopa, Volcanion
  801, 802, // Magearna, Marshadow
  807, 808, 809, // Zeraora, Meltan, Melmetal
  893, // Zarude
]);

// Starter Pokémon and their evolutions (uncommon)
const STARTER_POKEMON = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, // Gen 1
  152, 153, 154, 155, 156, 157, 158, 159, 160, // Gen 2
  252, 253, 254, 255, 256, 257, 258, 259, 260, // Gen 3
  387, 388, 389, 390, 391, 392, 393, 394, 395, // Gen 4
  495, 496, 497, 498, 499, 500, 501, 502, 503, // Gen 5
  650, 651, 652, 653, 654, 655, 656, 657, 658, // Gen 6
  722, 723, 724, 725, 726, 727, 728, 729, 730, // Gen 7
  810, 811, 812, 813, 814, 815, 816, 817, 818, // Gen 8
  906, 907, 908, 909, 910, 911, 912, 913, 914, // Gen 9
]);

// Pseudo-legendary Pokémon (uncommon)
const PSEUDO_LEGENDARY = new Set([
  147, 148, 149, // Dratini line
  246, 247, 248, // Larvitar line
  371, 372, 373, // Bagon line
  374, 375, 376, // Beldum line
  443, 444, 445, // Gible line
  633, 634, 635, // Deino line
  704, 705, 706, // Goomy line
  782, 783, 784, // Jangmo-o line
  885, 886, 887, // Dreepy line
]);

// Function to determine Pokemon rarity
export function getPokemonRarity(id: number): PokemonRarity {
  if (MYTHICAL_POKEMON.has(id)) return 'mythical';
  if (LEGENDARY_POKEMON.has(id)) return 'legendary';
  if (STARTER_POKEMON.has(id) || PSEUDO_LEGENDARY.has(id)) return 'uncommon';
  return 'common';
}

// Function to select a random Pokémon based on rarity distribution
export function getRandomPokemon(): number {
  const rand = Math.random();
  let targetRarity: 'common' | 'uncommon' | 'rare';
  
  // 60% common, 30% uncommon, 10% rare
  if (rand < 0.6) {
    targetRarity = 'common';
  } else if (rand < 0.9) {
    targetRarity = 'uncommon';
  } else {
    targetRarity = 'rare';
  }
  
  // Get all Pokémon IDs of the target rarity
  const candidates: number[] = [];
  for (let id = 1; id <= 1025; id++) {
    if (getPokemonRarity(id) === targetRarity) {
      candidates.push(id);
    }
  }
  
  // Return a random Pokémon from the candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Get Pokémon sprite URL
export function getPokemonSpriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

// Get Pokémon silhouette (we'll use CSS filters for this)
export function getPokemonSilhouetteStyle(): React.CSSProperties {
  return {
    filter: 'brightness(0) saturate(100%)',
    opacity: 0.8
  };
}

// Get Pokémon silhouette class name for dark mode support
export function getPokemonSilhouetteClassName(): string {
  return 'pokemon-silhouette';
}

// Get Pokemon name with fallback
export function getPokemonName(id: number): string {
  return POKEMON_NAMES[id] || `Pokemon #${id}`;
}

// Get small sprite for card displays
export function getPokemonSmallSpriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

// Rarity colors for UI
export const RARITY_COLORS = {
  common: 'gray',
  uncommon: 'green',
  rare: 'blue',
  legendary: 'purple',
  mythical: 'pink'
} as const;

// Get rarity badge color classes (moshimoshi theme compliant)
export function getRarityColorClasses(rarity: PokemonRarity) {
  switch (rarity) {
    case 'common':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'uncommon':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'rare':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'legendary':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'mythical':
      return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400';
  }
}