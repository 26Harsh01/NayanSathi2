import type { PersonalBirthdayReminder } from '../../types';

export type FactCategory =
  | 'Animals'
  | 'Space'
  | 'Science'
  | 'History'
  | 'Nature'
  | 'Human Body'
  | 'Technology';

export interface DailyFact {
  id: string;
  category: FactCategory;
  fact: string;
}

export const FACT_CATEGORIES: FactCategory[] = [
  'Animals',
  'Space',
  'Science',
  'History',
  'Nature',
  'Human Body',
  'Technology',
];

export const DAILY_FACTS: DailyFact[] = [
  { id: 'f_an_1', category: 'Animals', fact: 'Sea otters hold hands while sleeping on water so they do not drift apart.' },
  { id: 'f_an_2', category: 'Animals', fact: 'Elephants can recognize themselves in a mirror and show gentle care for injured herd members.' },
  { id: 'f_an_3', category: 'Animals', fact: 'A group of flamingos is called a flamboyance.' },
  { id: 'f_sp_1', category: 'Space', fact: 'One day on Venus lasts longer than an entire year on Venus because it spins very slowly.' },
  { id: 'f_sp_2', category: 'Space', fact: 'Sunlight takes about 8 minutes and 20 seconds to travel from the Sun to Earth.' },
  { id: 'f_sp_3', category: 'Space', fact: 'There are more stars in the observable universe than grains of sand on all of Earth’s beaches.' },
  { id: 'f_sc_1', category: 'Science', fact: 'Hot water can sometimes freeze slightly faster than cold water under certain conditions, known as the Mpemba effect.' },
  { id: 'f_sc_2', category: 'Science', fact: 'Natural honey stored in sealed jars can remain edible for thousands of years without spoiling.' },
  { id: 'f_sc_3', category: 'Science', fact: 'Sound travels more than four times faster through water than it does through air.' },
  { id: 'f_hi_1', category: 'History', fact: 'Takshashila and Nalanda in ancient India were among the earliest residential universities in the world.' },
  { id: 'f_hi_2', category: 'History', fact: 'Chess originated in India around the 6th century under the name Chaturanga.' },
  { id: 'f_hi_3', category: 'History', fact: 'Zero as a written placeholder and mathematical number was formalized in ancient Indian mathematics.' },
  { id: 'f_na_1', category: 'Nature', fact: 'Trees in a forest share nutrients with younger saplings through underground fungal networks.' },
  { id: 'f_na_2', category: 'Nature', fact: 'Raindrops are not tear-shaped; small falling drops look closer to tiny rounded buns.' },
  { id: 'f_na_3', category: 'Nature', fact: 'Bamboo is one of the fastest-growing plants on Earth, with some species growing over 30 cm in a day.' },
  { id: 'f_hb_1', category: 'Human Body', fact: 'Your heart beats roughly 100,000 times every single day to keep oxygen flowing smoothly.' },
  { id: 'f_hb_2', category: 'Human Body', fact: 'Even though the human brain is only about 2% of body weight, it uses nearly 20% of the body’s energy.' },
  { id: 'f_hb_3', category: 'Human Body', fact: 'Human fingerprints remain distinct even between identical twins.' },
  { id: 'f_te_1', category: 'Technology', fact: 'The first computer mouse built in the 1960s had a carved wooden shell and two metal wheels.' },
  { id: 'f_te_2', category: 'Technology', fact: 'Modern assistive eye-tracking cameras detect infrared and visible pupil/iris reflections many times per second.' },
  { id: 'f_te_3', category: 'Technology', fact: 'Voyager 1, launched in 1977, is still sending signals back from interstellar space.' },
];

export interface DailyJoke {
  id: string;
  language: 'en' | 'hi';
  type: 'qa' | 'short';
  setup: string;
  punchline?: string;
}

export const DAILY_JOKES: DailyJoke[] = [
  {
    id: 'jk_en_1',
    language: 'en',
    type: 'qa',
    setup: 'Why did the bicycle stand still in the garden?',
    punchline: 'Because it was two-tired!',
  },
  {
    id: 'jk_en_2',
    language: 'en',
    type: 'qa',
    setup: 'What do you call a sleeping bull in the sunshine?',
    punchline: 'A bulldozer!',
  },
  {
    id: 'jk_en_3',
    language: 'en',
    type: 'qa',
    setup: 'Why did the math book look so cheerful today?',
    punchline: 'Because someone finally helped solve all its problems!',
  },
  {
    id: 'jk_en_4',
    language: 'en',
    type: 'short',
    setup: 'A warm cup of tea says to the biscuit: "You make every morning sweeter—please don’t crumble under pressure!"',
  },
  {
    id: 'jk_hi_1',
    language: 'hi',
    type: 'qa',
    setup: 'अध्यापक: बताओ, सबसे पुराना जानवर कौन-सा है?',
    punchline: 'छात्र: ज़ेबरा, क्योंकि वह आज भी ब्लैक एंड व्हाइट में आता है!',
  },
  {
    id: 'jk_hi_2',
    language: 'hi',
    type: 'qa',
    setup: 'चाँद ने सूरज से मुस्कुराकर क्या कहा?',
    punchline: 'तुम दिन भर चमकते हो, अब थोड़ी चाय पीकर मुझे चमकने दो!',
  },
  {
    id: 'jk_hi_3',
    language: 'hi',
    type: 'short',
    setup: 'माली ने पौधे से कहा: "तुम रोज़ इतने खुश कैसे रहते हो?" पौधे ने कहा: "मैं जड़ों से जुड़ा रहता हूँ और धूप में मुस्कुराता हूँ!"',
  },
  {
    id: 'jk_hi_4',
    language: 'hi',
    type: 'qa',
    setup: 'कंप्यूटर को ठंड क्यों लग गई?',
    punchline: 'क्योंकि उसने अपनी सारी विंडोज़ खुली छोड़ दी थीं!',
  },
];

export type StoryCategory =
  | 'Inspirational'
  | 'Moral'
  | 'Animal'
  | 'Friendship'
  | 'Family'
  | 'Interesting';

export interface ShortStory {
  id: string;
  category: StoryCategory;
  language: 'en' | 'hi';
  title: string;
  body: string;
  takeaway: string;
}

export const STORY_CATEGORIES: StoryCategory[] = [
  'Inspirational',
  'Moral',
  'Animal',
  'Friendship',
  'Family',
  'Interesting',
];

export const SHORT_STORIES: ShortStory[] = [
  {
    id: 'st_insp_en',
    category: 'Inspirational',
    language: 'en',
    title: 'The Lantern on the Hill',
    body: 'Every evening, an elderly weaver hung a warm brass lantern outside her hillside cottage. Travellers walking home after dusk never lost their way along the winding path. When someone asked why she kept lighting it even on rainy nights, she smiled and replied, "One steady light does not need to brighten the whole mountain—just the very next step."',
    takeaway: 'Small daily kindnesses guide others further than we ever realize.',
  },
  {
    id: 'st_moral_en',
    category: 'Moral',
    language: 'en',
    title: 'Two Pebbles in the Jar',
    body: 'A grandfather kept an empty glass jar on his kitchen shelf. Each night, he placed one smooth pebble inside for a moment that brought peace that day—a warm breeze, a child’s laugh, or a shared cup of chai. By winter, the jar shone near the window, reminding everyone in the home that quiet joys quietly add up.',
    takeaway: 'Noticing small good moments builds lasting gratitude.',
  },
  {
    id: 'st_ani_en',
    category: 'Animal',
    language: 'en',
    title: 'The Sparrow and the Raindrop',
    body: 'During a hot summer afternoon, a thirsty little sparrow waited beneath a mango branch. A single cool cloud drifted overhead and released a gentle shower onto the broad green leaves. The sparrow drank from a leaf-cup and sang three cheerful notes, reminding the sleepy orchard that patience brings refreshment.',
    takeaway: 'Nature always shares enough when we wait calmly.',
  },
  {
    id: 'st_fri_en',
    category: 'Friendship',
    language: 'en',
    title: 'The Shared Umbrella',
    body: 'When sudden monsoon rain caught Meera outside the library, her neighbour Arjun noticed her waiting by the doorway. Without a word, he walked over holding his wide blue umbrella so they could both walk comfortably under its shelter. By the time they reached home, they were laughing about how the best journeys happen side by side.',
    takeaway: 'True friendship makes stormy days effortless.',
  },
  {
    id: 'st_fam_en',
    category: 'Family',
    language: 'en',
    title: 'Sunday Morning Chai',
    body: 'Every Sunday morning, the whole household gathered on the veranda around a steaming kettle of cardamom tea. Grandparents shared childhood tales, children drew chalk birds on the courtyard tiles, and everyone slowed down just enough to truly listen to one another.',
    takeaway: 'Presence is the finest gift a family shares.',
  },
  {
    id: 'st_int_en',
    category: 'Interesting',
    language: 'en',
    title: 'The Clockmaker of Jaipur',
    body: 'Centuries ago, astronomers and artisans in Jaipur built towering stone sundials so anyone walking through the courtyard could read the hour simply by looking at a shadow. Even without batteries or gears, sunlight and thoughtful geometry told time faithfully for generations.',
    takeaway: 'Curiosity and patience turn simple sunlight into wonder.',
  },
  {
    id: 'st_insp_hi',
    category: 'Inspirational',
    language: 'hi',
    title: 'पहाड़ी का छोटा दीया',
    body: 'गाँव के मोड़ पर एक दादी रोज़ शाम को मिट्टी का छोटा दीया जलाकर रखती थीं। रास्ते से गुज़रने वाले हर यात्री को उस हल्की रोशनी से आगे का रास्ता साफ़ दिखाई देता था। दादी मुस्कुराकर कहती थीं, "हमें पूरा पहाड़ रोशन नहीं करना, बस अगला कदम सुरक्षित बनाना है।"',
    takeaway: 'छोटी-सी नेकी भी किसी का पूरा दिन रोशन कर सकती है।',
  },
  {
    id: 'st_fam_hi',
    category: 'Family',
    language: 'hi',
    title: 'बरामदे की चाय और कहानियाँ',
    body: 'रविवार की सुबह घर के सभी सदस्य बरामदे में बैठकर अदरक वाली चाय का आनंद लेते थे। दादाजी पुराने दिनों की मज़ेदार बातें सुनाते और सब लोग ध्यान से एक-दूसरे की बात सुनते। उस एक घंटे की मुस्कान पूरे हफ्ते के लिए ऊर्जा दे जाती थी।',
    takeaway: 'परिवार के साथ बिताया शांत समय सबसे अनमोल होता है।',
  },
];

export interface QuizQuestion {
  id: string;
  kind: 'riddle' | 'trivia';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'qz_1',
    kind: 'riddle',
    question: 'I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?',
    options: ['A Cloud', 'A Map', 'A Mirror', 'A Dream'],
    correctIndex: 1,
    explanation: 'A map shows cities, mountains, and oceans on paper!',
  },
  {
    id: 'qz_2',
    kind: 'trivia',
    question: 'Which planet in our solar system is known for its bright rings made of ice and rock?',
    options: ['Mars', 'Mercury', 'Saturn', 'Venus'],
    correctIndex: 2,
    explanation: 'Saturn is famous for its wide, shimmering ring system.',
  },
  {
    id: 'qz_3',
    kind: 'riddle',
    question: 'What goes up whenever rain comes down?',
    options: ['An Umbrella', 'A Kite', 'A Submarine', 'A Feather'],
    correctIndex: 0,
    explanation: 'We open and raise an umbrella as soon as rain starts falling.',
  },
  {
    id: 'qz_4',
    kind: 'trivia',
    question: 'Which classical string instrument did Pandit Ravi Shankar play around the world?',
    options: ['Flute', 'Tabla', 'Sitar', 'Harmonium'],
    correctIndex: 2,
    explanation: 'Pandit Ravi Shankar was an iconic virtuoso of the sitar.',
  },
  {
    id: 'qz_5',
    kind: 'riddle',
    question: 'What has hands and a face, yet never holds anything or smiles?',
    options: ['A Painting', 'A Clock', 'A Book', 'A Leaf'],
    correctIndex: 1,
    explanation: 'A clock has hour and minute hands on a numbered face.',
  },
  {
    id: 'qz_6',
    kind: 'trivia',
    question: 'Which gas do green plants take in during daylight to make food and release oxygen?',
    options: ['Carbon Dioxide', 'Helium', 'Neon', 'Argon'],
    correctIndex: 0,
    explanation: 'Plants absorb carbon dioxide during photosynthesis and release fresh oxygen.',
  },
];

export interface ReferenceMovieItem {
  id: string;
  title: string;
  year: number;
  language: string;
  genre: string;
  description: string;
  posterUrl?: string;
}

export const CURATED_REFERENCE_MOVIES: ReferenceMovieItem[] = [
  {
    id: 'mov_pather',
    title: 'Pather Panchali',
    year: 1955,
    language: 'Bengali',
    genre: 'Classic Drama',
    description: 'Satyajit Ray’s landmark poetic portrait of childhood, resilience, and family life in rural Bengal.',
  },
  {
    id: 'mov_taare',
    title: 'Taare Zameen Par',
    year: 2007,
    language: 'Hindi',
    genre: 'Family / Drama',
    description: 'An empathetic story celebrating creativity, patience, and understanding a young boy’s unique learning style.',
  },
  {
    id: 'mov_chakde',
    title: 'Chak De! India',
    year: 2007,
    language: 'Hindi',
    genre: 'Sports Drama',
    description: 'An inspiring sports tale about teamwork, unity, and overcoming self-doubt.',
  },
  {
    id: 'mov_3idiots',
    title: '3 Idiots',
    year: 2009,
    language: 'Hindi',
    genre: 'Comedy / Drama',
    description: 'A warm-hearted story about three engineering friends discovering curiosity, purpose, and joy.',
  },
  {
    id: 'mov_nemo',
    title: 'Finding Nemo',
    year: 2003,
    language: 'English',
    genre: 'Animated Adventure',
    description: 'A colourful ocean journey following a devoted father searching across the Great Barrier Reef.',
  },
  {
    id: 'mov_lagan',
    title: 'Lagaan',
    year: 2001,
    language: 'Hindi',
    genre: 'Historical / Sports',
    description: 'Villagers band together to learn cricket in a sweeping musical story of courage.',
  },
];

export interface FestivalEvent {
  id: string;
  nameEn: string;
  nameHi: string;
  dateStr: string; // YYYY-MM-DD or MM-DD recurring description
  month: number; // 1-12
  day: number; // 1-31
  year?: number; // present for lunar/variable dates
  kind: 'festival' | 'national' | 'special_day';
  description: string;
  greetingEn: string;
  greetingHi: string;
}

export const UPCOMING_FESTIVALS_AND_DAYS: FestivalEvent[] = [
  {
    id: 'day_republic',
    nameEn: 'Republic Day',
    nameHi: 'गणतंत्र दिवस',
    dateStr: 'Annual · Jan 26',
    month: 1,
    day: 26,
    kind: 'national',
    description: 'Celebrates the adoption of the Constitution of India and democratic unity.',
    greetingEn: 'Happy Republic Day!',
    greetingHi: 'गणतंत्र दिवस की हार्दिक शुभकामनाएँ!',
  },
  {
    id: 'day_health',
    nameEn: 'World Health Day',
    nameHi: 'विश्व स्वास्थ्य दिवस',
    dateStr: 'Annual · Apr 07',
    month: 4,
    day: 7,
    kind: 'special_day',
    description: 'Highlights wellbeing, accessible healthcare, and caring communities worldwide.',
    greetingEn: 'Wishing you health, comfort, and peace!',
    greetingHi: 'अच्छे स्वास्थ्य और सुख-शांति की शुभकामनाएँ!',
  },
  {
    id: 'day_yoga',
    nameEn: 'International Yoga Day',
    nameHi: 'अंतर्राष्ट्रीय योग दिवस',
    dateStr: 'Annual · Jun 21',
    month: 6,
    day: 21,
    kind: 'special_day',
    description: 'Celebrates mindful breathing, gentle movement, and inner calm.',
    greetingEn: 'Happy International Yoga Day!',
    greetingHi: 'अंतर्राष्ट्रीय योग दिवस की शुभकामनाएँ!',
  },
  {
    id: 'day_independence',
    nameEn: 'Independence Day',
    nameHi: 'स्वतंत्रता दिवस',
    dateStr: 'Annual · Aug 15',
    month: 8,
    day: 15,
    kind: 'national',
    description: 'Commemorates India’s independence and the spirit of freedom.',
    greetingEn: 'Happy Independence Day!',
    greetingHi: 'स्वतंत्रता दिवस की हार्दिक शुभकामनाएँ!',
  },
  {
    id: 'day_gandhi',
    nameEn: 'Gandhi Jayanti',
    nameHi: 'गांधी जयंती',
    dateStr: 'Annual · Oct 02',
    month: 10,
    day: 2,
    kind: 'national',
    description: 'Honours Mahatma Gandhi’s enduring message of peace and kindness.',
    greetingEn: 'Warm wishes on Gandhi Jayanti.',
    greetingHi: 'गांधी जयंती पर सादर नमन।',
  },
  {
    id: 'fest_diwali_2026',
    nameEn: 'Diwali (Festival of Lights)',
    nameHi: 'दीपावली',
    dateStr: '2026-11-08',
    month: 11,
    day: 8,
    year: 2026,
    kind: 'festival',
    description: 'A joyful festival of lamps, sweets, and light overcoming darkness.',
    greetingEn: 'Wishing you a bright and joyful Diwali!',
    greetingHi: 'दीपावली की हार्दिक शुभकामनाएँ!',
  },
  {
    id: 'day_children',
    nameEn: "Children's Day",
    nameHi: 'बाल दिवस',
    dateStr: 'Annual · Nov 14',
    month: 11,
    day: 14,
    kind: 'special_day',
    description: 'Celebrates childhood curiosity, joy, and education across India.',
    greetingEn: "Happy Children's Day!",
    greetingHi: 'बाल दिवस की शुभकामनाएँ!',
  },
  {
    id: 'day_christmas',
    nameEn: 'Christmas',
    nameHi: 'क्रिसमस',
    dateStr: 'Annual · Dec 25',
    month: 12,
    day: 25,
    kind: 'festival',
    description: 'A season of warmth, carols, family gatherings, and generosity.',
    greetingEn: 'Merry Christmas and warm holiday wishes!',
    greetingHi: 'क्रिसमस की हार्दिक शुभकामनाएँ!',
  },
  {
    id: 'fest_makar_2027',
    nameEn: 'Makar Sankranti / Pongal',
    nameHi: 'मकर संक्रांति',
    dateStr: 'Annual · Jan 14',
    month: 1,
    day: 14,
    kind: 'festival',
    description: 'Marks the harvest season, longer sunny days, and colourful kites.',
    greetingEn: 'Happy Makar Sankranti and Pongal!',
    greetingHi: 'मकर संक्रांति की हार्दिक शुभकामनाएँ!',
  },
  {
    id: 'fest_holi_2027',
    nameEn: 'Holi (Festival of Colours)',
    nameHi: 'होली',
    dateStr: '2027-03-22',
    month: 3,
    day: 22,
    year: 2027,
    kind: 'festival',
    description: 'Welcomes spring with music, laughter, and joyful colours.',
    greetingEn: 'Happy Holi! Wishing you colourful happiness.',
    greetingHi: 'होली की ढेर सारी शुभकामनाएँ!',
  },
];

export function daysUntilMonthDay(month: number, day: number, referenceDate = new Date()): number {
  const startToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  let target = new Date(referenceDate.getFullYear(), month - 1, day);
  if (target.getTime() < startToday.getTime()) {
    target = new Date(referenceDate.getFullYear() + 1, month - 1, day);
  }
  return Math.round((target.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
}

export function sortUpcomingBirthdays(
  birthdays: PersonalBirthdayReminder[],
  referenceDate = new Date()
): (PersonalBirthdayReminder & { daysAway: number })[] {
  return birthdays
    .map((b) => {
      const [mStr, dStr] = b.monthDay.split('-');
      const month = Number(mStr) || 1;
      const day = Number(dStr) || 1;
      return {
        ...b,
        daysAway: daysUntilMonthDay(month, day, referenceDate),
      };
    })
    .sort((a, b) => a.daysAway - b.daysAway);
}
