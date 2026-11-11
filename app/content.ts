// Gym facts gathered from Instagram (@golden_hour_21) and Google Maps.
// Anything marked CONFIRM needs a check with the owner before launch.

export const gym = {
  name: "Golden Hour",
  fullName: "Golden Hour Fitness Planet",
  nickname: "House of Beasts",
  tagline: "Be a part of elite",
  address: "305 Sagar Road, Saddar Cantt, Lahore",
  phone: "+92 321 4220245",
  whatsapp: "https://wa.me/923214220245",
  instagram: "https://www.instagram.com/golden_hour_21/",
  mapsLink:
    "https://www.google.com/maps/place/Golden+Hour+Fitness+Planet/@31.54876,74.377006,17z",
  mapsEmbed:
    "https://www.google.com/maps?q=Golden+Hour+Fitness+Planet,+305+Sagar+Rd,+Saddar+Cantt,+Lahore&output=embed",
  rating: "4.7",
  reviewCount: 23,
  followers: "5.6k",
};

// Matches the recent Instagram timings post (DOsmUfeDemj); Google Maps disagrees.
export const timings = [
  { who: "Women", hours: "10 am – 5 pm" },
  { who: "Everyone, morning", hours: "6 am – 10 am" },
  { who: "Everyone, evening", hours: "5 pm – 1 am" },
];

// Real member and coach photos from Instagram, used in the proof wall.
export const members = ["037", "043", "059", "063", "068", "080", "119", "155", "161", "185", "204", "208"].map(
  (n) => `/images/ig/${n}.jpg`,
);

export const programs = [
  {
    title: "Open floor membership",
    body: "Free weights, machines and cardio, with a trainer on the floor whenever you train.",
  },
  {
    title: "Personal training",
    body: "One-to-one sessions with a certified coach who plans, spots and corrects every set.",
  },
  {
    title: "Women's sessions",
    body: "Dedicated daytime hours for women, with female members training alongside each other.",
  },
  {
    title: "Transformation and diet plans",
    body: "A training block paired with a meal plan, checked in on until the numbers move.",
  },
];

export const floor = [
  { src: "/images/reception.jpg", alt: "Brass Golden Hour reception desk against a black wall", caption: "Reception" },
  { src: "/images/floor-lamps.jpg", alt: "Long dumbbell rack under brass pendant lamps", caption: "Free weights" },
  { src: "/images/leg-zone.jpg", alt: "Leg press and hack squat machines on turf", caption: "Leg machines" },
  { src: "/images/cardio-corner.jpg", alt: "Air bikes, treadmill and cable station", caption: "Cardio and cables" },
  { src: "/images/mirror-wall.jpg", alt: "Squat racks in front of lit mirror wall", caption: "Racks" },
  { src: "/images/dumbbells.jpg", alt: "Close-up of a rubber dumbbell rack", caption: "Dumbbells" },
];

// Real Google reviews, lightly trimmed.
export const reviews = [
  {
    quote:
      "The trainer has become Mr Pakistan in classic physique. The atmosphere is very friendly, and they broke records of cleanliness of other gyms near them.",
    author: "Google review",
  },
  {
    quote:
      "Good for physical exercise, with a trainer available all the time for males and females. The people who train here are very nice and helpful.",
    author: "Google review",
  },
  { quote: "Gym is fantastic and facilities are amazing.", author: "MohiD Ali, Google review" },
];
