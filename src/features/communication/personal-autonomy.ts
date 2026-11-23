import type {
  BelongingItem,
  CaregiverPermissionKey,
  CaregiverRelationship,
  DailyRoutineItem,
  PersonalChoiceOption,
  RestaurantMenuItem,
  ShoppingCatalogItem,
} from '../../types';

export interface VoiceRulePhrase {
  id: string;
  textEn: string;
  textHi: string;
}

/**
 * Feature 17: My Voice, My Rules — Consent & Autonomy phrases (no hardcoded personal info)
 */
export const MY_VOICE_MY_RULES_PHRASES: VoiceRulePhrase[] = [
  { id: 'vrule_no', textEn: 'No.', textHi: 'नहीं।' },
  { id: 'vrule_stop', textEn: 'Stop.', textHi: 'रुकिए।' },
  { id: 'vrule_not_now', textEn: 'Not now.', textHi: 'अभी नहीं।' },
  { id: 'vrule_disagree', textEn: 'I disagree.', textHi: 'मैं सहमत नहीं हूँ।' },
  { id: 'vrule_wait', textEn: 'Please wait.', textHi: 'कृपया प्रतीक्षा करें।' },
  { id: 'vrule_more_time', textEn: 'Give me more time.', textHi: 'मुझे थोड़ा और समय दें।' },
  { id: 'vrule_decide', textEn: 'I want to decide myself.', textHi: 'मैं स्वयं निर्णय लेना चाहता/चाहती हूँ।' },
  { id: 'vrule_ask_first', textEn: 'Please ask before helping.', textHi: 'मदद करने से पहले कृपया पूछें।' },
  { id: 'vrule_privacy', textEn: 'I want some privacy.', textHi: 'मुझे थोड़ी निजता चाहिए।' },
  { id: 'vrule_change', textEn: 'I want to change my answer.', textHi: 'मैं अपना उत्तर बदलना चाहता/चाहती हूँ।' },
];

/**
 * Feature 2: Comfort & Personal Needs presets
 */
export const COMFORT_PRESET_REQUESTS: VoiceRulePhrase[] = [
  { id: 'comf_hot', textEn: 'I am feeling hot.', textHi: 'मुझे गर्मी लग रही है।' },
  { id: 'comf_cold', textEn: 'I am feeling cold.', textHi: 'मुझे ठंड लग रही है।' },
  { id: 'comf_bright', textEn: 'The room is too bright.', textHi: 'कमरे में बहुत ज़्यादा रोशनी है।' },
  { id: 'comf_noise', textEn: 'There is too much noise.', textHi: 'यहाँ बहुत शोर हो रहा है।' },
  { id: 'comf_pillow', textEn: 'Please adjust my pillow.', textHi: 'कृपया मेरा तकिया ठीक कर दें।' },
  { id: 'comf_position', textEn: 'Please change my position.', textHi: 'कृपया मेरी स्थिति बदल दें।' },
  { id: 'comf_privacy', textEn: 'I need some privacy.', textHi: 'मुझे थोड़ी निजता चाहिए।' },
  { id: 'comf_beside', textEn: 'I need someone beside me.', textHi: 'मुझे अपने पास किसी की ज़रूरत है।' },
  { id: 'comf_clothes', textEn: 'My clothes are uncomfortable.', textHi: 'मेरे कपड़े असहज लग रहे हैं।' },
  { id: 'comf_sit', textEn: 'I want to sit up.', textHi: 'मैं उठकर बैठना चाहता/चाहती हूँ।' },
  { id: 'comf_lie', textEn: 'I want to lie down.', textHi: 'मैं लेटना चाहता/चाहती हूँ।' },
];

/**
 * Feature 3: Bring Me Something presets
 */
export const DEFAULT_BELONGINGS: BelongingItem[] = [
  { id: 'bel_water', labelEn: 'Water bottle', labelHi: 'पानी की बोतल', iconKey: 'droplet' },
  { id: 'bel_phone', labelEn: 'Mobile phone', labelHi: 'मोबाइल फ़ोन', iconKey: 'smartphone' },
  { id: 'bel_glasses', labelEn: 'Glasses', labelHi: 'चश्मा', iconKey: 'glasses' },
  { id: 'bel_headphones', labelEn: 'Headphones', labelHi: 'हेडफ़ोन', iconKey: 'headphones' },
  { id: 'bel_blanket', labelEn: 'Blanket', labelHi: 'कंबल', iconKey: 'layers' },
  { id: 'bel_pillow', labelEn: 'Pillow', labelHi: 'तकिया', iconKey: 'square' },
  { id: 'bel_medicine', labelEn: 'Medicine', labelHi: 'दवाई', iconKey: 'pill' },
  { id: 'bel_remote', labelEn: 'Remote control', labelHi: 'रिमोट कंट्रोल', iconKey: 'tv' },
  { id: 'bel_books', labelEn: 'Books', labelHi: 'किताबें', iconKey: 'book' },
  { id: 'bel_personal', labelEn: 'Personal belongings', labelHi: 'मेरा निजी सामान', iconKey: 'bag' },
];

/**
 * Feature 1: My Choices visual options across 7 daily choice categories
 */
export const DEFAULT_PERSONAL_CHOICES: PersonalChoiceOption[] = [
  // Eat
  { id: 'ch_eat_khichdi', category: 'eat', labelEn: 'Warm Khichdi / Dal-Rice', labelHi: 'खिचड़ी / दाल-चावल', iconKey: 'utensils' },
  { id: 'ch_eat_fruit', category: 'eat', labelEn: 'Fresh Fruit Bowl', labelHi: 'ताज़े फल', iconKey: 'apple' },
  { id: 'ch_eat_roti', category: 'eat', labelEn: 'Soft Roti & Sabzi', labelHi: 'रोटी और सब्ज़ी', iconKey: 'utensils' },
  { id: 'ch_eat_soup', category: 'eat', labelEn: 'Warm Vegetable Soup', labelHi: 'गरम सूप', iconKey: 'soup' },
  // Drink
  { id: 'ch_drink_water', category: 'drink', labelEn: 'Plain Water', labelHi: 'सादा पानी', iconKey: 'droplet' },
  { id: 'ch_drink_chai', category: 'drink', labelEn: 'Tea / Chai', labelHi: 'चाय', iconKey: 'coffee' },
  { id: 'ch_drink_milk', category: 'drink', labelEn: 'Warm Milk', labelHi: 'गरम दूध', iconKey: 'cup' },
  { id: 'ch_drink_juice', category: 'drink', labelEn: 'Fresh Juice', labelHi: 'ताज़ा जूस', iconKey: 'citrus' },
  // Wear
  { id: 'ch_wear_cotton', category: 'wear', labelEn: 'Light Cotton Clothes', labelHi: 'हल्के सूती कपड़े', iconKey: 'shirt' },
  { id: 'ch_wear_warm', category: 'wear', labelEn: 'Warm Sweater / Shawl', labelHi: 'गरम स्वेटर / शॉल', iconKey: 'shirt' },
  { id: 'ch_wear_pajama', category: 'wear', labelEn: 'Comfortable Nightwear', labelHi: 'आरामदायक कपड़े', iconKey: 'shirt' },
  // Watch
  { id: 'ch_watch_news', category: 'watch', labelEn: 'News Program', labelHi: 'समाचार', iconKey: 'tv' },
  { id: 'ch_watch_music', category: 'watch', labelEn: 'Music / Bhajans / Songs', labelHi: 'संगीत / गाने', iconKey: 'music' },
  { id: 'ch_watch_movie', category: 'watch', labelEn: 'A Movie or Show', labelHi: 'फ़िल्म या धारावाहिक', iconKey: 'film' },
  { id: 'ch_watch_sports', category: 'watch', labelEn: 'Sports Match', labelHi: 'खेल मैच', iconKey: 'tv' },
  // Activity
  { id: 'ch_act_read', category: 'activity', labelEn: 'Listen to Audio / Book', labelHi: 'किताब / ऑडियो सुनना', iconKey: 'book' },
  { id: 'ch_act_rest', category: 'activity', labelEn: 'Quiet Rest', labelHi: 'शांत आराम', iconKey: 'moon' },
  { id: 'ch_act_sit_outside', category: 'activity', labelEn: 'Sit Near Window / Balcony', labelHi: 'खिड़की / बालकनी में बैठना', iconKey: 'sun' },
  // Where
  { id: 'ch_where_room', category: 'where', labelEn: 'Stay in My Room', labelHi: 'अपने कमरे में रहना', iconKey: 'home' },
  { id: 'ch_where_living', category: 'where', labelEn: 'Go to Living Room', labelHi: 'लिविंग रूम में जाना', iconKey: 'sofa' },
  { id: 'ch_where_garden', category: 'where', labelEn: 'Go Outside / Garden', labelHi: 'बाहर बगीचे में जाना', iconKey: 'trees' },
  // Person
  { id: 'ch_person_family', category: 'person', labelEn: 'Family Member', labelHi: 'परिवार के सदस्य', iconKey: 'users' },
  { id: 'ch_person_caregiver', category: 'person', labelEn: 'Primary Caregiver', labelHi: 'मुख्य देखभालकर्ता', iconKey: 'heart' },
  { id: 'ch_person_friend', category: 'person', labelEn: 'Call a Friend', labelHi: 'मित्र से बात करना', iconKey: 'phone' },
];

/**
 * Feature 6: Doctor Visit Mode quick phrases & body areas
 */
export const DOCTOR_VISIT_PHRASES: VoiceRulePhrase[] = [
  { id: 'doc_hurt', textEn: 'Where does it hurt?', textHi: 'कहाँ दर्द हो रहा है?' },
  { id: 'doc_when', textEn: 'When did it start?', textHi: 'यह कब शुरू हुआ?' },
  { id: 'doc_how', textEn: 'How am I feeling?', textHi: 'मैं कैसा महसूस कर रहा/रही हूँ?' },
  { id: 'doc_q', textEn: 'I have a question.', textHi: 'मेरा एक सवाल है।' },
  { id: 'doc_repeat', textEn: 'Please explain that again.', textHi: 'कृपया इसे फिर से समझाएँ।' },
  { id: 'doc_time', textEn: 'I need more time.', textHi: 'मुझे थोड़ा और समय चाहिए।' },
  { id: 'doc_caregiver', textEn: 'I want my caregiver present.', textHi: 'मैं चाहता/चाहती हूँ कि मेरे देखभालकर्ता साथ रहें।' },
  { id: 'doc_private', textEn: 'I want to communicate privately.', textHi: 'मैं अकेले में बात करना चाहता/चाहती हूँ।' },
];

export const BODY_REGIONS: { id: string; labelEn: string; labelHi: string }[] = [
  { id: 'head', labelEn: 'Head / Eyes / Jaw', labelHi: 'सिर / आँखें / जबड़ा' },
  { id: 'neck', labelEn: 'Neck / Throat', labelHi: 'गर्दन / गला' },
  { id: 'chest', labelEn: 'Chest / Breathing', labelHi: 'छाती / साँस' },
  { id: 'abdomen', labelEn: 'Stomach / Abdomen', labelHi: 'पेट' },
  { id: 'left_arm', labelEn: 'Left Arm / Shoulder', labelHi: 'बायाँ हाथ / कंधा' },
  { id: 'right_arm', labelEn: 'Right Arm / Shoulder', labelHi: 'दायाँ हाथ / कंधा' },
  { id: 'back', labelEn: 'Upper / Lower Back', labelHi: 'पीठ / कमर' },
  { id: 'left_leg', labelEn: 'Left Leg / Foot', labelHi: 'बायाँ पैर' },
  { id: 'right_leg', labelEn: 'Right Leg / Foot', labelHi: 'दायाँ पैर' },
];

/**
 * Feature 10: Default visual routines
 */
export const DEFAULT_DAILY_ROUTINES: DailyRoutineItem[] = [
  {
    id: 'rt_morning_water',
    section: 'morning',
    titleEn: 'Morning Hydration & Wake-up Check',
    titleHi: 'सुबह पानी और आराम जाँच',
    instructionsEn: 'Sit comfortably, take a few sips of warm water, and adjust lighting.',
    instructionsHi: 'आराम से बैठें, थोड़ा गुनगुना पानी पिएँ और रोशनी ठीक करें।',
    scheduledTime: '07:30',
    status: 'pending',
  },
  {
    id: 'rt_hygiene_fresh',
    section: 'hygiene',
    titleEn: 'Personal Hygiene & Freshen Up',
    titleHi: 'व्यक्तिगत स्वच्छता और फ्रेश होना',
    instructionsEn: 'Wash face, oral care, and ensure fresh comfortable clothes.',
    instructionsHi: 'मुँह धोना, दाँतों की सफ़ाई और साफ़ आरामदायक कपड़े।',
    scheduledTime: '08:00',
    status: 'pending',
  },
  {
    id: 'rt_meals_breakfast',
    section: 'meals',
    titleEn: 'Nutritious Breakfast',
    titleHi: 'सुबह का नाश्ता',
    instructionsEn: 'Choose breakfast preference in My Choices or confirm comfort before eating.',
    instructionsHi: 'खाने से पहले पसंद और आराम की पुष्टि करें।',
    scheduledTime: '08:45',
    status: 'pending',
  },
  {
    id: 'rt_med_morning',
    section: 'medication',
    titleEn: 'Morning Medication Check',
    titleHi: 'सुबह की दवाई जाँच',
    instructionsEn: 'Verify scheduled doses with caregiver before confirming intake.',
    instructionsHi: 'दवाई लेने के बाद स्पष्ट रूप से पुष्टि करें।',
    scheduledTime: '09:15',
    status: 'pending',
  },
  {
    id: 'rt_rest_afternoon',
    section: 'rest',
    titleEn: 'Afternoon Rest & Posture Adjustment',
    titleHi: 'दोपहर आराम और पोजीशन बदलना',
    instructionsEn: 'Dim bright lights, adjust pillow support, and rest comfortably.',
    instructionsHi: 'तेज़ रोशनी कम करें, तकिया ठीक करें और आराम करें।',
    scheduledTime: '14:00',
    status: 'pending',
  },
  {
    id: 'rt_evening_social',
    section: 'evening',
    titleEn: 'Evening Music, Family Time or Light Activity',
    titleHi: 'शाम का समय: परिवार या संगीत',
    instructionsEn: 'Connect with family, listen to music, or review day in Wellbeing Journal.',
    instructionsHi: 'परिवार से बात करें, संगीत सुनें या दैनिक डायरी लिखें।',
    scheduledTime: '18:00',
    status: 'pending',
  },
];

/**
 * Feature 11: Shopping & Restaurant preset catalogs
 */
export const DEFAULT_SHOPPING_CATALOG: ShoppingCatalogItem[] = [
  { id: 'shop_fruit', nameEn: 'Fresh Fruits', nameHi: 'ताज़े फल', category: 'Groceries' },
  { id: 'shop_milk', nameEn: 'Milk & Dairy', nameHi: 'दूध और डेयरी', category: 'Groceries' },
  { id: 'shop_bread', nameEn: 'Bread / Biscuits', nameHi: 'ब्रेड / बिस्कुट', category: 'Groceries' },
  { id: 'shop_tea', nameEn: 'Tea / Coffee', nameHi: 'चाय / कॉफ़ी', category: 'Pantry' },
  { id: 'shop_soap', nameEn: 'Soap / Toiletries', nameHi: 'साबुन / दैनिक वस्तुएँ', category: 'Personal Care' },
  { id: 'shop_tissues', nameEn: 'Soft Tissues', nameHi: 'टिशू पेपर', category: 'Personal Care' },
  { id: 'shop_notebook', nameEn: 'Notebook / Pen', nameHi: 'नोटबुक / पेन', category: 'Personal' },
  { id: 'shop_charger', nameEn: 'Charging Cable', nameHi: 'चार्जर केबल', category: 'Device Care' },
];

export const RESTAURANT_MENU_ITEMS: RestaurantMenuItem[] = [
  { id: 'rest_soup', nameEn: 'Hot Vegetable Soup', nameHi: 'गरम वेजिटेबल सूप', category: 'meals' },
  { id: 'rest_dal_rice', nameEn: 'Dal, Rice & Soft Roti', nameHi: 'दाल, चावल और नरम रोटी', category: 'meals' },
  { id: 'rest_khichdi', nameEn: 'Plain Soft Khichdi', nameHi: 'सादा नरम खिचड़ी', category: 'meals' },
  { id: 'rest_idli', nameEn: 'Steamed Idli & Sambar', nameHi: 'इडली और सांबर', category: 'snacks' },
  { id: 'rest_sandwich', nameEn: 'Soft Vegetable Sandwich', nameHi: 'वेज सैंडविच', category: 'snacks' },
  { id: 'rest_water', nameEn: 'Warm / Room-Temp Water', nameHi: 'सादा / गुनगुना पानी', category: 'drinks' },
  { id: 'rest_juice', nameEn: 'Fresh Fruit Juice', nameHi: 'ताज़ा जूस', category: 'drinks' },
  { id: 'rest_chai', nameEn: 'Light Tea / Coffee', nameHi: 'हल्की चाय / कॉफ़ी', category: 'drinks' },
  { id: 'rest_fruit_custard', nameEn: 'Soft Fruit Bowl / Dessert', nameHi: 'ताज़े फल / मीठा', category: 'dessert' },
];

/**
 * Feature 12: Public Interaction Mode phrases
 */
export const PUBLIC_INTERACTION_CORE: VoiceRulePhrase[] = [
  { id: 'pub_eyes', textEn: 'I communicate using my eyes.', textHi: 'मैं अपनी आँखों की गति से संवाद करता/करती हूँ।' },
  { id: 'pub_time', textEn: 'Please give me time to respond.', textHi: 'कृपया उत्तर देने के लिए मुझे समय दें।' },
  { id: 'pub_direct', textEn: 'Please speak directly to me.', textHi: 'कृपया सीधे मुझसे बात करें।' },
  { id: 'pub_understand', textEn: 'I understand you.', textHi: 'मैं आपकी बात समझ गया/गई हूँ।' },
  { id: 'pub_repeat', textEn: 'Please repeat that.', textHi: 'कृपया इसे दोहराएँ।' },
  { id: 'pub_assist', textEn: 'I need assistance.', textHi: 'मुझे सहायता चाहिए।' },
  { id: 'pub_caregiver', textEn: 'Please contact my caregiver.', textHi: 'कृपया मेरे देखभालकर्ता से संपर्क करें।' },
  { id: 'pub_device', textEn: 'Please do not move my device.', textHi: 'कृपया मेरे डिवाइस को न हिलाएँ।' },
  { id: 'pub_options', textEn: 'Please show me the available options.', textHi: 'कृपया मुझे उपलब्ध विकल्प दिखाएँ।' },
];

export const PUBLIC_CONTEXT_PHRASES: Record<
  'transport' | 'shopping' | 'appointments' | 'everyday',
  VoiceRulePhrase[]
> = {
  transport: [
    { id: 'pub_tr_stop', textEn: 'Please stop at the accessible entrance.', textHi: 'कृपया सुगम प्रवेश द्वार पर रुकें।' },
    { id: 'pub_tr_slow', textEn: 'Please go slowly over bumps.', textHi: 'कृपया उबड़-खाबड़ रास्ते पर धीरे चलें।' },
    { id: 'pub_tr_seat', textEn: 'I need space and support to transfer.', textHi: 'मुझे बैठने में सहायता और जगह चाहिए।' },
  ],
  shopping: [
    { id: 'pub_sh_price', textEn: 'How much does this cost?', textHi: 'इसकी कीमत क्या है?' },
    { id: 'pub_sh_show', textEn: 'Can you hold it closer so I can see?', textHi: 'क्या आप इसे पास लाकर दिखा सकते हैं?' },
    { id: 'pub_sh_pay', textEn: 'My caregiver will complete the payment.', textHi: 'मेरे देखभालकर्ता भुगतान करेंगे।' },
  ],
  appointments: [
    { id: 'pub_ap_checkin', textEn: 'I am here for my scheduled appointment.', textHi: 'मैं अपनी निर्धारित अपॉइंटमेंट के लिए आया/आई हूँ।' },
    { id: 'pub_ap_screen', textEn: 'Please face me so I can type my answer.', textHi: 'कृपया सामने रहें ताकि मैं आँखों से जवाब टाइप कर सकूँ।' },
    { id: 'pub_ap_copy', textEn: 'I have a printed Medical Card and Passport.', textHi: 'मेरे पास मेडिकल कार्ड और कम्युनिकेशन पासपोर्ट है।' },
  ],
  everyday: [
    { id: 'pub_ev_thank', textEn: 'Thank you for your patience.', textHi: 'आपके धैर्य के लिए धन्यवाद।' },
    { id: 'pub_ev_yes', textEn: 'Yes, that is helpful.', textHi: 'हाँ, यह मददगार है।' },
    { id: 'pub_ev_no', textEn: 'No thank you, I am fine.', textHi: 'नहीं धन्यवाद, मैं ठीक हूँ।' },
  ],
};

export const PERSONAL_INTEREST_OPTIONS = [
  'Music',
  'Movies',
  'Cricket',
  'Football',
  'Reading',
  'Drawing',
  'Photography',
  'Cooking',
  'Gardening',
  'Travelling',
  'Family activities',
];

export function calculateAgeFromDob(dob?: string): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 && age <= 130 ? age : null;
}

export function buildPersonalIntroductionText(
  preferredName: string,
  customIntro?: string
): string {
  const cleanedCustom = customIntro?.trim();
  if (cleanedCustom) return cleanedCustom;
  const displayName = preferredName.trim() || 'Friend';
  return `Hello! My name is ${displayName}. I communicate using eye movements and assistive technology. Please give me enough time to respond.`;
}

export function isPermissionAllowedForCaregiver(
  caregiver: CaregiverRelationship | null,
  actingAsPatientOwner: boolean,
  permission: CaregiverPermissionKey
): boolean {
  if (actingAsPatientOwner) return true;
  if (!caregiver || !caregiver.consentGranted) return false;
  return Boolean(caregiver[permission]);
}
