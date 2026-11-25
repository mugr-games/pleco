// Audience: middle and high school students (ages ~11-18).
// 20 categories x 25 subtopics x ~20 kept questions = ~10,000 questions.
export const AUDIENCE = 'middle and high school students (ages 11-18)';

export const CATEGORIES = [
  { id: 'minecraft', name: 'Minecraft', icon: '⛏️', hint: 'mobs, biomes, building, crafting, survival, redstone basics, servers, YouTubers teens watch' },
  { id: 'gaming', name: 'Video Games', icon: '🎮', hint: 'Fortnite, Roblox, Pokemon, Mario, Zelda, Among Us, Call of Duty, consoles, gaming habits' },
  { id: 'fashion', name: 'Fashion', icon: '👟', hint: 'school outfits, sneakers, hoodies, brands teens like, accessories, picture day' },
  { id: 'styles', name: 'Styles & Aesthetics', icon: '✨', hint: 'room decor, hairstyles, aesthetics like cottagecore or y2k, phone cases, nails' },
  { id: 'history', name: 'History', icon: '🏛️', hint: 'what kids learn in history class: ancient Egypt, Rome, Greece, explorers, famous inventions, presidents' },
  { id: 'food', name: 'Food & Drink', icon: '🍕', hint: 'school lunch, snacks, fast food, candy, sleepover food, drinks teens like' },
  { id: 'movies', name: 'Movies & TV', icon: '🎬', hint: 'Marvel, Disney, Pixar, Netflix shows, Harry Potter, Star Wars, movies teens watch' },
  { id: 'music', name: 'Music', icon: '🎵', hint: 'pop stars, rap, songs on TikTok, band class, concerts, playlists, music apps' },
  { id: 'animals', name: 'Animals', icon: '🐟', hint: 'pets, zoo animals, ocean animals, bugs, animals in cartoons, dream pets' },
  { id: 'sports', name: 'Sports', icon: '⚽', hint: 'school sports, PE class, NBA, NFL, soccer, Olympics, skateboarding' },
  { id: 'internet', name: 'Internet & Memes', icon: '📱', hint: 'TikTok, YouTube, Snapchat, memes, slang, streamers, group chats' },
  { id: 'science', name: 'Science & Space', icon: '🔭', hint: 'science class, planets, dinosaurs, the human body, experiments, volcanoes' },
  { id: 'geography', name: 'Geography & Travel', icon: '🗺️', hint: 'countries, famous landmarks, field trips, family vacations, theme parks' },
  { id: 'school', name: 'School Life', icon: '🎒', hint: 'classes, teachers, homework, lunch, lockers, tests, field trips, school dances' },
  { id: 'home', name: 'Around the House', icon: '🛋️', hint: 'chores, bedrooms, family habits, siblings, weekends, sleepovers' },
  { id: 'anime', name: 'Cartoons & Anime', icon: '📺', hint: 'SpongeBob, Pokemon, Naruto, Demon Slayer, My Hero Academia, Cartoon Network, Disney Channel' },
  { id: 'tech', name: 'Tech & Gadgets', icon: '💻', hint: 'phones, apps, earbuds, gaming setups, school laptops, chargers' },
  { id: 'holidays', name: 'Holidays & Traditions', icon: '🎃', hint: 'Halloween, Christmas, birthdays, summer break, snow days, Valentine\'s Day at school' },
  { id: 'cars', name: 'Cars & Transport', icon: '🚗', hint: 'the school bus, bikes, scooters, dream cars, road trips, learning to drive' },
  { id: 'weird', name: 'Weird & Specific', icon: '🌀', hint: 'funny hypotheticals, would-you-rather style situations, oddly specific everyday moments' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
