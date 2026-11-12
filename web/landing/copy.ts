// Words for the landing sections, in English and Filipino. Kept here (not in src/i18n/*.json) so the landing
// work never collides with other edits to the shared dictionaries.
import { useT, type Lang } from "../../src/i18n";
import type { PhotoKey } from "./photos";

export type Text = { en: string; fil: string };

export function useLang(): Lang {
  return useT().lang;
}

export const pick = (t: Text, lang: Lang) => t[lang];

export const COPY = {
  heroTitle: { en: "Rehearse important calls with an AI partner.", fil: "Mag-practice ng mahahalagang tawag kasama ang AI." },
  heroBody: {
    en: "Job, scholarship and visa interviews, client calls, calls home. Sanay plays the other person and tells you how you did. On the real call, it removes the noise around you.",
    fil: "Job, scholarship at visa interview, client call, tawag pauwi. Si Sanay ang gaganap na kausap mo at sasabihin kung kumusta ka. Sa totoong tawag, tatanggalin nito ang ingay sa paligid mo.",
  },
  heroStatus: {
    en: "Practice calls open soon. Noise removal works today: try it on your own voice.",
    fil: "Malapit nang buksan ang practice calls. Gumagana na ngayon ang pagtanggal ng ingay: subukan sa sarili mong boses.",
  },
  backToTop: { en: "Back to top", fil: "Bumalik sa itaas" },
  scrollHint: { en: "Scroll to step inside", fil: "Mag-scroll para pumasok" },
  railLabel: { en: "Chapters", fil: "Mga kabanata" },

  /** The scroll journey: the night before the call, to the morning of it. */
  chapters: [
    {
      id: "start",
      rail: { en: "Sanay", fil: "Sanay" },
      kicker: { en: "sanay", fil: "sanay" },
      title: { en: "Rehearse important calls with an AI partner.", fil: "Mag-practice ng mahahalagang tawag kasama ang AI." },
      body: {
        en: "Job, scholarship and visa interviews, client calls, calls home. Sanay plays the other person, tells you how you did, and on the real call removes the noise around you.",
        fil: "Job, scholarship at visa interview, client call, tawag pauwi. Si Sanay ang gaganap na kausap mo, sasabihin kung kumusta ka, at sa totoong tawag, tatanggalin ang ingay sa paligid mo.",
      },
    },
    {
      id: "practice",
      rail: { en: "Practice", fil: "Practice" },
      kicker: { en: "practice", fil: "practice" },
      title: { en: "Practice with someone patient.", fil: "Mag-practice kasama ang mapagpasensyang kausap." },
      body: {
        en: "Pick a situation. Sanay plays the interviewer, the client or the officer, out loud and at your pace. Say it again as many times as you need.",
        fil: "Pumili ng sitwasyon. Si Sanay ang interviewer, client o officer, nagsasalita at sa bilis na kaya mo. Ulitin hangga’t kailangan mo.",
      },
    },
    {
      id: "score",
      rail: { en: "Your score", fil: "Score mo" },
      kicker: { en: "your score", fil: "score mo" },
      title: { en: "See what went well.", fil: "Tingnan kung ano ang maganda." },
      body: {
        en: "After each call you get a score, the one thing to try next, and your answers to play back.",
        fil: "Pagkatapos ng bawat tawag, may score ka, isang bagay na susubukan sa susunod, at mapapakinggan mo ulit ang mga sagot mo.",
      },
    },
    {
      id: "real",
      rail: { en: "Real call", fil: "Totoong tawag" },
      kicker: { en: "the real call", fil: "totoong tawag" },
      title: { en: "Sound clear on the real one.", fil: "Malinaw sa totoong tawag." },
      body: {
        en: "Turn Sanay on in Zoom, Meet or Teams. The tricycle, the rooster and the karaoke next door stay out of the call.",
        fil: "I-on ang Sanay sa Zoom, Meet o Teams. Hindi na maririnig ang tricycle, ang tandang at ang karaoke ng kapitbahay.",
      },
    },
    {
      id: "people",
      rail: { en: "For everyone", fil: "Para sa lahat" },
      kicker: { en: "for everyone", fil: "para sa lahat" },
      title: { en: "For every Filipino with a call that matters.", fil: "Para sa bawat Pilipinong may mahalagang tawag." },
      body: {
        en: "Students, job seekers, OFWs and their families, nurses, freelancers, and Lolo and Lola.",
        fil: "Mga estudyante, naghahanap ng trabaho, mga OFW at pamilya nila, mga nurse, freelancer, at sina Lolo at Lola.",
      },
    },
    {
      id: "ready",
      rail: { en: "Ready", fil: "Handa na" },
      kicker: { en: "your turn", fil: "ikaw na" },
      title: { en: "Sanay ka na.", fil: "Sanay ka na." },
      body: {
        en: "The night before is for practice. The morning of, you are ready.",
        fil: "Ang gabi bago ang tawag ay para sa practice. Pagdating ng umaga, handa ka na.",
      },
    },
  ],
  signUp: { en: "Create your account", fil: "Gumawa ng account" },

  hero: {
    title: { en: "Sound your best on every call.", fil: "Pinakamaayos mong boses, sa bawat tawag." },
    body: {
      en: "Sanay cleans up how you sound, live on Zoom, Meet and Teams: the noise around you removed, and a masculine or feminine voice if you want one. Practise before the call that matters, then sound clear on the real one.",
      fil: "Pinapaganda ng Sanay ang tunog mo, live sa Zoom, Meet at Teams: tanggal ang ingay sa paligid, at may panlalaki o pambabaeng boses kung gusto mo. Mag-practice bago ang mahalagang tawag, tapos maging malinaw sa totoong tawag.",
    },
  },
  steps: {
    kicker: { en: "How Sanay improves your calls", fil: "Paano pinapaganda ng Sanay ang mga tawag mo" },
  },
  /** The pinned facts (after Sellix's "100x / 5x / 100%"): one big statement each, all true. */
  facts: [
    {
      big: { en: "Practise first.", fil: "Mag-practice muna." },
      label: { en: "An AI partner plays the other person on the call", fil: "Isang AI ang gaganap na kausap mo sa tawag" },
      body: {
        en: "Pick your job, scholarship or visa interview. Sanay asks the questions out loud, you answer, and you go again until it feels easy.",
        fil: "Piliin ang job, scholarship o visa interview mo. Magtatanong si Sanay nang malakas, sasagot ka, at uulit ka hanggang madali na.",
      },
    },
    {
      big: { en: "Know what to fix.", fil: "Alamin ang aayusin." },
      label: { en: "A score after every practice call", fil: "May score pagkatapos ng bawat practice call" },
      body: {
        en: "Clarity, pace, filler words and how the call flowed, with the one thing to try next and your answers to play back.",
        fil: "Linaw, bilis, filler words at daloy ng tawag, kasama ang isang bagay na susubukan sa susunod at ang mga sagot mong mapapakinggan ulit.",
      },
    },
    {
      big: { en: "Just you.", fil: "Ikaw lang." },
      label: { en: "The noise around you is removed while you talk", fil: "Tinatanggal ang ingay sa paligid habang nagsasalita ka" },
      body: {
        en: "The other person hears you, not the tricycle, the rooster or the karaoke next door. It happens as you talk, right on your own computer.",
        fil: "Ikaw ang maririnig ng kausap mo, hindi ang tricycle, tandang o karaoke sa kapitbahay. Nangyayari ito habang nagsasalita ka, sa sarili mong computer."
      },
    },
  ],
  features: {
    title: { en: "Everything for the call, before it and during it.", fil: "Lahat para sa tawag, bago at habang nangyayari ito." },
    body: { en: "Practise, see how you did, then sound clear when it counts.", fil: "Mag-practice, alamin kung kumusta ka, tapos maging malinaw kapag mahalaga na." },
    more: { en: "Try it now", fil: "Subukan ngayon" },
    rows: [
      {
        id: "practice",
        label: { en: "Practice calls", fil: "Practice calls" },
        title: { en: "A patient partner on the other side", fil: "Mapagpasensyang kausap sa kabila" },
        body: {
          en: "Pick a situation and Sanay plays the other person, out loud, at your pace. Start easy, then make it harder.",
          fil: "Pumili ng sitwasyon at si Sanay ang gaganap na kausap mo, nagsasalita, sa bilis mo. Magsimula sa madali, tapos pahirapin.",
        },
      },
      {
        id: "score",
        label: { en: "Your score", fil: "Score mo" },
        title: { en: "Know what to fix next", fil: "Alamin ang susunod na aayusin" },
        body: {
          en: "A score you can read in a second, what went well, one thing to try, and your weak moments to replay.",
          fil: "Score na mababasa mo agad, kung ano ang maganda, isang bagay na susubukan, at ang mga mahinang bahagi na mapapakinggan ulit.",
        },
      },
      {
        id: "real",
        label: { en: "Clear voice", fil: "Malinaw na boses" },
        title: { en: "Sound clear on the real call", fil: "Malinaw sa totoong tawag" },
        body: {
          en: "Sanay sits between your mic and Zoom, Meet or Teams, takes out the noise, and can give you a masculine or feminine voice.",
          fil: "Nasa pagitan ng mic mo at ng Zoom, Meet o Teams ang Sanay, tinatanggal ang ingay, at puwede kang bigyan ng panlalaki o pambabaeng boses.",
        },
      },
      {
        id: "english",
        label: { en: "Say it in English", fil: "Sabihin sa English" },
        title: { en: "From Taglish to the words you need", fil: "Mula Taglish papunta sa salitang kailangan mo" },
        body: {
          en: "Say what you mean in Filipino or Taglish and see it in clear English, simple or formal, ready to say in your own voice.",
          fil: "Sabihin ang gusto mo sa Filipino o Taglish at makita ito sa malinaw na English, simple o pormal, handang sabihin sa sarili mong boses.",
        },
      },
    ],
    flow: {
      mic: { en: "Your mic", fil: "Mic mo" },
      sanay: { en: "Sanay", fil: "Sanay" },
      clean: { en: "Noise removed", fil: "Walang ingay" },
      apps: { en: "Zoom · Meet · Teams", fil: "Zoom · Meet · Teams" },
    },
    english: {
      said: { en: "“Pasensya na po, medyo late ako kasi traffic sa EDSA.”", fil: "“Pasensya na po, medyo late ako kasi traffic sa EDSA.”" },
      simple: { en: "Sorry, I’m a little late because of traffic.", fil: "Sorry, I’m a little late because of traffic." },
      formal: { en: "My apologies for the delay. Traffic was heavier than expected.", fil: "My apologies for the delay. Traffic was heavier than expected." },
      simpleLabel: { en: "Simple", fil: "Simple" },
      formalLabel: { en: "Formal", fil: "Pormal" },
    },
  },
  numbers: {
    title: { en: "Sanay in numbers", fil: "Sanay sa mga numero" },
    items: [
      { n: "3", label: { en: "Voices: masculine, feminine and your own", fil: "Boses: panlalaki, pambabae at sa’yo" } },
      { n: "2", label: { en: "Languages: English and Filipino", fil: "Wika: English at Filipino" } },
      { n: "6", label: { en: "Practice situations to start with", fil: "Practice na sitwasyon para magsimula" } },
      { n: "6", label: { en: "Communities it is made for", fil: "Komunidad na pinaggawaan nito" } },
      { n: "¼ s", label: { en: "To clean your voice, live", fil: "Para linisin ang boses mo, live" } },
      { n: "0", label: { en: "Recordings kept by the voice lab", fil: "Recording na itinatago ng voice lab" } },
    ],
  },
  picker: {
    title: { en: "What call are you getting ready for?", fil: "Anong tawag ang pinaghahandaan mo?" },
    body: { en: "Pick one and see how the practice call starts.", fil: "Pumili ng isa at tingnan kung paano magsisimula ang practice call." },
    prompt: { en: "I’m getting ready for", fil: "Pinaghahandaan ko ang" },
    who: { en: "Played by Sanay", fil: "Si Sanay ang gaganap" },
    length: { en: "About {n} minutes", fil: "Mga {n} minuto" },
    soon: { en: "Practice calls open soon. Test your voice today.", fil: "Malapit nang buksan ang practice calls. Subukan ang boses mo ngayon." },
  },
  noise: {
    title: { en: "The noise stays out of the call.", fil: "Hindi na kasama sa tawag ang ingay." },
    body: {
      en: "Sanay cleans your voice on your own computer, live, so the other person hears you and not the street.",
      fil: "Nililinis ng Sanay ang boses mo sa sarili mong computer, live, kaya ikaw ang naririnig, hindi ang kalye.",
    },
    items: [
      { id: "tricycle", en: "Tricycles", fil: "Tricycle" },
      { id: "rooster", en: "Roosters", fil: "Tandang" },
      { id: "karaoke", en: "Karaoke next door", fil: "Karaoke ng kapitbahay" },
      { id: "rain", en: "Rain on the roof", fil: "Ulan sa bubong" },
      { id: "fan", en: "Electric fans", fil: "Electric fan" },
      { id: "dog", en: "Barking dogs", fil: "Tahol ng aso" },
    ],
  },
  privacy: {
    title: { en: "Private by design.", fil: "Pribado mula umpisa." },
    body: {
      en: "Your voice is yours. Sanay does the cleaning on your own computer instead of sending your voice away.",
      fil: "Sa’yo ang boses mo. Ginagawa ng Sanay ang paglilinis sa sarili mong computer, hindi ipinapadala kung saan.",
    },
    a: { en: "Cleaned on your device", fil: "Nililinis sa device mo" },
    aBody: { en: "Noise removal and the voices run on your own computer.", fil: "Sa sarili mong computer tumatakbo ang pagtanggal ng ingay at ang mga boses." },
    b: { en: "Nothing saved from the voice lab", fil: "Walang sine-save ang voice lab" },
    bBody: { en: "Testing your voice here never uploads or keeps it.", fil: "Ang pagsubok ng boses dito ay hindi ina-upload o itinatago." },
  },
  world: {
    title: { en: "From your home to a call anywhere.", fil: "Mula sa bahay mo, sa tawag kahit saan." },
    body: {
      en: "Practise for the employer in Dubai, the embassy officer, the client in Toronto, and the family waiting for your call.",
      fil: "Mag-practice para sa employer sa Dubai, sa embassy officer, sa client sa Toronto, at sa pamilyang naghihintay ng tawag mo.",
    },
  },
  final: {
    title: { en: "Your next important call is coming. Be ready for it.", fil: "Paparating na ang susunod mong mahalagang tawag. Maging handa." },
    body: { en: "Start with your voice today. Practice calls are next.", fil: "Magsimula sa boses mo ngayon. Susunod ang practice calls." },
  },
  score: {
    title: { en: "Scholarship interview", fil: "Scholarship interview" },
    done: { en: "Call finished · 6 min", fil: "Tapos ang tawag · 6 min" },
    ready: { en: "Ready", fil: "Handa" },
    good: { en: "Went well", fil: "Maganda" },
    goodBody: { en: "Clear answers and a calm pace.", fil: "Malinaw ang sagot at kalmado ang bilis." },
    next: { en: "Try next", fil: "Subukan sa susunod" },
    nextBody: { en: "Pause for a breath before your first answer.", fil: "Huminga muna bago ang unang sagot." },
    replay: { en: "Play back your answer", fil: "Pakinggan ulit ang sagot mo" },
  },
  meet: {
    title: { en: "Video call", fil: "Video call" },
    you: { en: "You", fil: "Ikaw" },
    them: { en: "Ma’am Santos", fil: "Ma’am Santos" },
    noise: { en: "Tricycle outside", fil: "Tricycle sa labas" },
    clean: { en: "Only your voice", fil: "Boses mo lang" },
  },

  call: {
    label: { en: "Preview of a practice call", fil: "Silip sa isang practice call" },
    title: { en: "Practice call", fil: "Practice call" },
    topic: { en: "Scholarship interview", fil: "Scholarship interview" },
    them: { en: "The panel, played by Sanay", fil: "Ang panel, si Sanay ang gaganap" },
    yourTurn: { en: "Your turn to answer", fil: "Ikaw na ang sasagot" },
    mute: { en: "Mute", fil: "Mute" },
    captions: { en: "Captions", fil: "Captions" },
    end: { en: "End", fil: "Tapusin" },
  },

  navHow: { en: "How it works", fil: "Paano ito gumagana" },
  navWho: { en: "Who it’s for", fil: "Para kanino" },

  wallTitle: { en: "Every call that matters, practised first.", fil: "Bawat mahalagang tawag, napa-practice muna." },
  wallHint: { en: "Drag to look around", fil: "I-drag para tumingin sa paligid" },
  wallPrev: { en: "Turn the wall left", fil: "Iikot pakaliwa" },
  wallNext: { en: "Turn the wall right", fil: "Iikot pakanan" },
  wallLine: { en: "Practice line", fil: "Practice line" },

  whoTitle: { en: "Who Sanay is for", fil: "Para kanino ang Sanay" },

  howTitle: { en: "How it works", fil: "Paano ito gumagana" },
  howPause: { en: "Pause the cards", fil: "I-pause ang mga card" },
  howPlay: { en: "Play the cards", fil: "I-play ang mga card" },

  packsTitle: { en: "Practice packs", fil: "Mga practice pack" },
  packsBody: {
    en: "Practice calls are on their way to Sanay. Each pack is a real situation, with someone on the other side who is patient and kind. You can test your voice today.",
    fil: "Paparating na sa Sanay ang practice calls. Bawat pack ay totoong sitwasyon, at mabait at pasensyoso ang kausap mo. Puwede mo nang subukan ang boses mo ngayon.",
  },
  packsCta: { en: "Test your voice", fil: "Subukan ang boses mo" },
  minutes: { en: "min", fil: "min" },

  credits: { en: "Photos", fil: "Mga larawan" },
};

/** The communities, in the order the "Who it's for" list shows them. */
export const COMMUNITIES: { id: string; photo: PhotoKey; name: Text; body: Text }[] = [
  {
    id: "students",
    photo: "graduate",
    name: { en: "Students", fil: "Mga estudyante" },
    body: {
      en: "Scholarship and admission interviews, oral reports and your first recitation in English.",
      fil: "Interview para sa scholarship at admission, oral report, at ang unang recitation mo sa English.",
    },
  },
  {
    id: "jobs",
    photo: "barong",
    name: { en: "Job seekers", fil: "Naghahanap ng trabaho" },
    body: {
      en: "First interviews, final interviews and the calls that come after, in support, sales, admin or as a virtual assistant.",
      fil: "Unang interview, final interview, at ang mga tawag pagkatapos, sa support, sales, admin o bilang virtual assistant.",
    },
  },
  {
    id: "ofw",
    photo: "mother",
    name: { en: "OFWs and families", fil: "Mga OFW at pamilya" },
    body: {
      en: "Agency and embassy interviews, a new employer on video, and Sunday calls home that sound like home.",
      fil: "Interview sa agency at embassy, ang bagong employer sa video, at mga tawag pauwi tuwing Linggo na parang magkatabi lang kayo.",
    },
  },
  {
    id: "health",
    photo: "doctor",
    name: { en: "Nurses and caregivers", fil: "Mga nurse at caregiver" },
    body: {
      en: "Interviews for hospitals here and abroad, and handovers in calm, clear English.",
      fil: "Interview para sa mga ospital dito at sa abroad, at mga handover sa kalmado at malinaw na English.",
    },
  },
  {
    id: "freelance",
    photo: "waving",
    name: { en: "Freelancers", fil: "Mga freelancer" },
    body: {
      en: "Client calls, rate talks and weekly check-ins from home, with the rooster and the tricycle left out.",
      fil: "Client calls, usapang rate at lingguhang check-in mula sa bahay, nang hindi naririnig ang tandang at tricycle.",
    },
  },
  {
    id: "elders",
    photo: "lola",
    name: { en: "Lolo and Lola", fil: "Sina Lolo at Lola" },
    body: {
      en: "Video check-ups, calls to the bank and long chats with the grandkids, loud and clear.",
      fil: "Video check-up, tawag sa bangko at mahahabang kuwentuhan kasama ang mga apo, malakas at malinaw.",
    },
  },
];

/** Tiles of the situation wall: photographs of the moment, and lines the other person opens with. */
export type WallTile =
  | { kind: "photo"; photo: PhotoKey; who: Text; what: Text }
  | { kind: "line"; line: string; who: Text };

export const WALL: WallTile[] = [
  { kind: "photo", photo: "graduate", who: { en: "Students", fil: "Estudyante" }, what: { en: "Scholarship interview", fil: "Interview para sa scholarship" } },
  { kind: "photo", photo: "waving", who: { en: "Job seekers", fil: "Naghahanap ng trabaho" }, what: { en: "First online interview", fil: "Unang online interview" } },
  { kind: "line", line: "Tell me a little about yourself.", who: { en: "Job interview", fil: "Job interview" } },
  { kind: "photo", photo: "doctor", who: { en: "Nurses", fil: "Nurse" }, what: { en: "Hospital interview abroad", fil: "Interview sa ospital abroad" } },
  { kind: "photo", photo: "mother", who: { en: "OFW families", fil: "Pamilya ng OFW" }, what: { en: "Sunday call with Papa", fil: "Tawag kay Papa tuwing Linggo" } },
  { kind: "photo", photo: "sariSari", who: { en: "Small business", fil: "Negosyo" }, what: { en: "Ordering stock by phone", fil: "Pag-order ng paninda sa phone" } },
  { kind: "line", line: "What made you choose nursing?", who: { en: "Nurses", fil: "Nurse" } },
  { kind: "photo", photo: "lolas", who: { en: "Lolo and Lola", fil: "Lolo at Lola" }, what: { en: "Video check-up", fil: "Video check-up" } },
  { kind: "photo", photo: "teacher", who: { en: "Teachers", fil: "Guro" }, what: { en: "Parent-teacher call", fil: "Tawag sa magulang" } },
  { kind: "photo", photo: "laughing", who: { en: "Freelancers", fil: "Freelancer" }, what: { en: "First call with a new client", fil: "Unang tawag sa bagong client" } },
  { kind: "line", line: "Why do you want this scholarship?", who: { en: "Students", fil: "Estudyante" } },
  { kind: "photo", photo: "barongCall", who: { en: "Everyday calls", fil: "Araw-araw na tawag" }, what: { en: "Opening a bank account", fil: "Pagbukas ng bank account" } },

  { kind: "photo", photo: "students", who: { en: "Students", fil: "Estudyante" }, what: { en: "College admission interview", fil: "Interview para sa college" } },
  { kind: "line", line: "We loved your portfolio. When can you start?", who: { en: "Freelancers", fil: "Freelancer" } },
  { kind: "photo", photo: "nurses", who: { en: "Nurses", fil: "Nurse" }, what: { en: "Shift handover in English", fil: "Handover sa English" } },
  { kind: "photo", photo: "hug", who: { en: "Families", fil: "Pamilya" }, what: { en: "Telling everyone: I got the job", fil: "Ibinabalita: natanggap ako!" } },
  { kind: "photo", photo: "barong", who: { en: "Job seekers", fil: "Naghahanap ng trabaho" }, what: { en: "Final interview", fil: "Final interview" } },
  { kind: "line", line: "Kumusta ang linggo mo, anak?", who: { en: "Calls home", fil: "Tawag pauwi" } },
  { kind: "photo", photo: "ferry", who: { en: "Seafarers", fil: "Seaman" }, what: { en: "Interview with a manning agency", fil: "Interview sa manning agency" } },
  { kind: "photo", photo: "kids", who: { en: "Families", fil: "Pamilya" }, what: { en: "Bedtime call with Mama abroad", fil: "Tawag kay Mama bago matulog" } },
  { kind: "line", line: "Welcome to the team! Any questions for us?", who: { en: "New job", fil: "Bagong trabaho" } },
  { kind: "photo", photo: "taho", who: { en: "Small business", fil: "Negosyo" }, what: { en: "Taking orders by phone", fil: "Pagtanggap ng order sa phone" } },
  { kind: "photo", photo: "lola", who: { en: "Lolo and Lola", fil: "Lolo at Lola" }, what: { en: "A long chat with the grandkids", fil: "Kuwentuhan kasama ang mga apo" } },
  { kind: "line", line: "Hi! Can you help me upgrade my plan?", who: { en: "Customer support", fil: "Customer support" } },
];

/** Steps of "How it works", one tall card each; the big words read as one sentence across the row. */
export const STEPS: { word: Text; body: Text; light: "masculine" | "feminine" | "natural" | "brand" }[] = [
  {
    word: { en: "Pick", fil: "Pumili" },
    body: { en: "Choose a situation: an interview, a client, a call home.", fil: "Pumili ng sitwasyon: interview, client, o tawag pauwi." },
    light: "natural",
  },
  {
    word: { en: "Practice", fil: "Mag-practice" },
    body: { en: "Sanay plays the other person, out loud, at your pace.", fil: "Si Sanay ang kausap mo, nagsasalita, sa bilis na kaya mo." },
    light: "feminine",
  },
  {
    word: { en: "Improve", fil: "Gumaling" },
    body: { en: "See what went well and one thing to try next time.", fil: "Tingnan kung ano ang maganda, at isang bagay na susubukan sa susunod." },
    light: "brand",
  },
  {
    word: { en: "Sound clear", fil: "Sanay ka na" },
    body: { en: "On the real call, Sanay removes the noise around you.", fil: "Sa totoong tawag, tinatanggal ng Sanay ang ingay sa paligid mo." },
    light: "masculine",
  },
];

/** Practice packs: the situation, who it is for, how the other person opens, and its length. */
export const PACKS: { title: Text; who: Text; opener: string; minutes: number; voice: "masculine" | "feminine" | "natural" }[] = [
  { title: { en: "Scholarship interview", fil: "Interview para sa scholarship" }, who: { en: "Students", fil: "Estudyante" }, opener: "Good morning! What would this scholarship mean for you?", minutes: 5, voice: "feminine" },
  { title: { en: "Your first job interview", fil: "Ang unang job interview mo" }, who: { en: "Job seekers", fil: "Naghahanap ng trabaho" }, opener: "Thanks for joining us. Tell me a little about yourself.", minutes: 8, voice: "masculine" },
  { title: { en: "Visa interview", fil: "Visa interview" }, who: { en: "OFWs", fil: "OFW" }, opener: "Good afternoon. What will you be doing on this trip?", minutes: 6, voice: "natural" },
  { title: { en: "Meet your new employer", fil: "Kilalanin ang bagong employer" }, who: { en: "OFWs", fil: "OFW" }, opener: "Welcome aboard! Shall we go over your first week?", minutes: 7, voice: "feminine" },
  { title: { en: "A call with a new client", fil: "Tawag sa bagong client" }, who: { en: "Freelancers", fil: "Freelancer" }, opener: "We loved your portfolio. What timeline works for you?", minutes: 10, voice: "masculine" },
  { title: { en: "Helping a happy customer", fil: "Pagtulong sa masayang customer" }, who: { en: "Customer support", fil: "Customer support" }, opener: "Hi! I’d like to upgrade my plan. Can you help me?", minutes: 6, voice: "natural" },
];
