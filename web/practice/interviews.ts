// The practice interviews: written question sets, no AI. Each question lists the points a good
// answer usually covers (checked with simple word matching) and a tip in English and Filipino.
// Questions are asked in English, the language being practised; `fil` explains them in Filipino.

export type InterviewType = "bpo" | "job" | "abroad" | "scholarship" | "college";

export interface Question {
  /** What the interviewer says. */
  ask: string;
  /** What it means, in Filipino (shown under the question when Filipino is chosen). */
  fil: string;
  /** Points a good answer covers: each inner list is one point, any of its words counts. */
  points: string[][];
  /** The same points in plain words, shown to the person (English and Filipino). */
  names: { en: string[]; fil: string[] };
  tip: { en: string; fil: string };
}

export interface Interview {
  type: InterviewType;
  /** Words that mean this interview when the person names it out loud. */
  match: string[];
  /** How the interviewer names it back ("a call center interview"). */
  spoken: string;
  questions: Question[];
}

const ABOUT_YOU: Question = {
  ask: "Tell me about yourself.",
  fil: "Ikuwento mo ang tungkol sa sarili mo.",
  points: [
    ["my name", "i am", "i'm"],
    ["graduate", "graduated", "studied", "student", "school", "college", "degree", "course", "senior high"],
    ["experience", "worked", "work", "job", "intern", "part-time", "volunteer"],
    ["goal", "want to", "hope", "looking for", "plan", "dream"],
  ],
  names: { en: ["Who you are", "What you studied", "Your experience", "Your goal"], fil: ["Kung sino ka", "Ang pinag-aralan mo", "Ang experience mo", "Ang goal mo"] },
  tip: {
    en: "Use four parts: who you are, what you studied, your experience, and what you want next. Keep it under a minute.",
    fil: "Apat na parte: sino ka, ano ang pinag-aralan mo, ang experience mo, at ano ang gusto mo next. Wag lalampas ng isang minuto.",
  },
};

export const INTERVIEWS: Interview[] = [
  {
    type: "bpo",
    match: ["call center", "call centre", "bpo", "customer service", "csr", "agent", "account", "chat support", "technical support"],
    spoken: "a call center interview",
    questions: [
      ABOUT_YOU,
      {
        ask: "Why do you want to work in a call center?",
        fil: "Bakit gusto mong magtrabaho sa call center?",
        points: [
          ["help", "assist", "customer", "customers", "people", "serve"],
          ["communication", "english", "speak", "talk", "skills"],
          ["grow", "career", "learn", "growth", "improve", "experience"],
        ],
        names: { en: ["You like helping people", "Your communication skills", "How you want to grow"], fil: ["Gusto mong tumulong sa tao", "Ang communication skills mo", "Paano mo gustong mag-grow"] },
        tip: {
          en: "Say how you like helping people, show your communication skills, and say how you want to grow.",
          fil: "Sabihin na gusto mong tumulong sa tao, ipakita ang communication skills mo, at kung paano mo gustong mag-grow.",
        },
      },
      {
        ask: "How would you handle an angry customer?",
        fil: "Paano mo haharapin ang galit na customer?",
        points: [
          ["sorry", "apologize", "apologise", "understand", "listen", "empathize"],
          ["calm", "patient", "polite", "respect"],
          ["solution", "solve", "fix", "resolve", "help", "check", "escalate"],
        ],
        names: { en: ["Listen and say sorry", "Stay calm and polite", "Give a solution"], fil: ["Makinig at mag-sorry", "Manatiling kalmado at magalang", "Magbigay ng solusyon"] },
        tip: {
          en: "Three steps: listen and say sorry, stay calm, then offer a clear solution.",
          fil: "Tatlong step: makinig at mag-sorry, manatiling kalmado, tapos magbigay ng malinaw na solusyon.",
        },
      },
      {
        ask: "Are you okay working night shifts and on holidays?",
        fil: "Okay lang ba sa'yo ang night shift at pagtatrabaho kahit holiday?",
        points: [
          ["yes", "okay", "willing", "fine", "flexible", "ready"],
          ["adjust", "sleep", "schedule", "family", "body", "used to"],
        ],
        names: { en: ["A clear yes", "How you'll adjust"], fil: ["Malinaw na yes", "Paano ka mag-a-adjust"] },
        tip: {
          en: "Answer yes clearly, then say how you will adjust: your sleep, your schedule, your family's support.",
          fil: "Sumagot ng malinaw na yes, tapos sabihin kung paano ka mag-a-adjust: tulog, schedule, suporta ng pamilya.",
        },
      },
      {
        ask: "Where do you see yourself in five years?",
        fil: "Nasaan ka sa loob ng limang taon?",
        points: [
          ["lead", "leader", "supervisor", "manager", "trainer", "promotion", "promoted", "grow"],
          ["skills", "learn", "experience", "company", "career"],
        ],
        names: { en: ["Growing into a bigger role", "Learning and building your career"], fil: ["Mas mataas na posisyon", "Pag-aaral at pagbuo ng career"] },
        tip: {
          en: "Show you want to grow inside the company, like becoming a team leader or trainer.",
          fil: "Ipakita na gusto mong mag-grow sa company, halimbawa maging team leader o trainer.",
        },
      },
    ],
  },
  {
    type: "job",
    match: ["job", "work", "company", "first job", "office", "hiring", "employment", "position", "applying"],
    spoken: "a job interview",
    questions: [
      ABOUT_YOU,
      {
        ask: "What are your strengths?",
        fil: "Ano ang mga strength o kalakasan mo?",
        points: [
          ["strength", "good at", "skilled", "hardworking", "fast learner", "responsible", "patient", "organized"],
          ["example", "for example", "for instance", "once", "when i", "in school", "at work"],
        ],
        names: { en: ["Name a strength", "A real example"], fil: ["Isang strength mo", "Isang totoong halimbawa"] },
        tip: {
          en: "Name one or two strengths and give a short real example for each.",
          fil: "Magbigay ng isa o dalawang strength at maikling totoong halimbawa para sa bawat isa.",
        },
      },
      {
        ask: "What is your weakness?",
        fil: "Ano ang weakness o kahinaan mo?",
        points: [
          ["weakness", "working on", "improve", "struggle", "sometimes"],
          ["learning", "trying", "now i", "so i", "practice", "better"],
        ],
        names: { en: ["Name a weakness", "How you're improving"], fil: ["Isang weakness mo", "Paano ka gumagaling dito"] },
        tip: {
          en: "Pick a real but small weakness, then say what you are doing to improve it.",
          fil: "Pumili ng totoong pero maliit na weakness, tapos sabihin kung ano ang ginagawa mo para gumaling dito.",
        },
      },
      {
        ask: "Why should we hire you?",
        fil: "Bakit ka namin dapat i-hire?",
        points: [
          ["skills", "skill", "experience", "hardworking", "fast learner", "dedicated", "reliable"],
          ["company", "team", "contribute", "help", "value", "role"],
        ],
        names: { en: ["Your skills", "How you'll help the team"], fil: ["Ang skills mo", "Paano ka makakatulong sa team"] },
        tip: {
          en: "Match your skills to the job, and say how you will help the team.",
          fil: "Iugnay ang skills mo sa trabaho, at sabihin kung paano ka makakatulong sa team.",
        },
      },
      {
        ask: "Do you have any questions for us?",
        fil: "May tanong ka ba para sa amin?",
        points: [["what", "how", "is there", "training", "team", "growth", "next step", "schedule"]],
        names: { en: ["Ask a good question"], fil: ["Magtanong ng magandang tanong"] },
        tip: {
          en: "Always ask one good question, like what the training is like or what a normal day looks like.",
          fil: "Laging magtanong ng isang magandang tanong, gaya ng kung ano ang training o paano ang karaniwang araw sa trabaho.",
        },
      },
    ],
  },
  {
    type: "abroad",
    match: ["visa", "embassy", "abroad", "ofw", "overseas", "employer", "consul", "work abroad", "country", "poea", "dmw"],
    spoken: "an interview for working abroad",
    questions: [
      {
        ask: "What is the purpose of your trip?",
        fil: "Ano ang dahilan ng pag-alis mo?",
        points: [
          ["work", "job", "employer", "contract", "visit", "study"],
          ["company", "position", "as a", "hospital", "factory", "household"],
        ],
        names: { en: ["Why you're going", "The job or place"], fil: ["Bakit ka aalis", "Ang trabaho o lugar"] },
        tip: {
          en: "Answer in one or two clear sentences: why you are going and for which job.",
          fil: "Sumagot sa isa o dalawang malinaw na sentence: bakit ka aalis at para sa anong trabaho.",
        },
      },
      {
        ask: "Who is your employer, and what will you do there?",
        fil: "Sino ang employer mo, at ano ang gagawin mo roon?",
        points: [
          ["company", "employer", "agency", "hospital", "hotel", "family"],
          ["position", "work as", "job", "nurse", "caregiver", "engineer", "worker", "staff"],
        ],
        names: { en: ["Your employer", "Your job title"], fil: ["Ang employer mo", "Ang job title mo"] },
        tip: {
          en: "Say the company name and your job title exactly as in your contract.",
          fil: "Sabihin ang pangalan ng company at ang job title mo, eksakto kung ano ang nasa contract.",
        },
      },
      {
        ask: "How long will you stay?",
        fil: "Gaano ka katagal doon?",
        points: [["year", "years", "month", "months", "contract"]],
        names: { en: ["How long (your contract)"], fil: ["Gaano katagal (ang contract mo)"] },
        tip: {
          en: "Give the exact length of your contract, like two years.",
          fil: "Sabihin ang eksaktong haba ng contract mo, halimbawa dalawang taon.",
        },
      },
      {
        ask: "Have you worked abroad before?",
        fil: "Nakapagtrabaho ka na ba sa abroad dati?",
        points: [["yes", "no", "before", "first time", "worked", "never"]],
        names: { en: ["A clear yes or no"], fil: ["Malinaw na yes o no"] },
        tip: {
          en: "Answer yes or no first, then add one detail. Short and honest is best.",
          fil: "Sagutin muna ng yes o no, tapos magdagdag ng isang detalye. Maikli at tapat ang pinakamaganda.",
        },
      },
      {
        ask: "Will you come back to the Philippines?",
        fil: "Babalik ka ba sa Pilipinas?",
        points: [
          ["yes", "of course", "will come back", "return"],
          ["family", "home", "children", "parents", "business", "house"],
        ],
        names: { en: ["Yes, you'll return", "Your reason (family, home)"], fil: ["Oo, babalik ka", "Ang dahilan mo (pamilya, bahay)"] },
        tip: {
          en: "Say yes, and give the reason: your family, your home, or your plans here.",
          fil: "Sabihin ang yes, at ibigay ang dahilan: pamilya mo, bahay mo, o mga plano mo rito.",
        },
      },
    ],
  },
  {
    type: "scholarship",
    match: ["scholarship", "scholar", "grant", "financial aid", "dost", "ched"],
    spoken: "a scholarship interview",
    questions: [
      ABOUT_YOU,
      {
        ask: "Why do you deserve this scholarship?",
        fil: "Bakit ka karapat-dapat sa scholarship na ito?",
        points: [
          ["grades", "study", "studies", "hard", "honor", "dream", "dedicated"],
          ["family", "help", "need", "support", "parents"],
        ],
        names: { en: ["Your effort in school", "How it helps you and your family"], fil: ["Ang sipag mo sa pag-aaral", "Paano ito makakatulong sa'yo at sa pamilya mo"] },
        tip: {
          en: "Show your effort in school and how the scholarship will help you and your family.",
          fil: "Ipakita ang sipag mo sa pag-aaral at kung paano makakatulong ang scholarship sa'yo at sa pamilya mo.",
        },
      },
      {
        ask: "What course will you take, and why?",
        fil: "Anong kurso ang kukunin mo, at bakit?",
        points: [
          ["course", "degree", "major", "take", "engineering", "nursing", "education", "it", "accountancy"],
          ["because", "want", "dream", "passion", "love", "help"],
        ],
        names: { en: ["The course", "Your personal reason"], fil: ["Ang kurso", "Ang personal mong dahilan"] },
        tip: {
          en: "Name the course, then give a personal reason you care about it.",
          fil: "Sabihin ang kurso, tapos magbigay ng personal na dahilan kung bakit mahalaga ito sa'yo.",
        },
      },
      {
        ask: "Tell me about a challenge you overcame.",
        fil: "Ikuwento ang isang pagsubok na nalampasan mo.",
        points: [
          ["problem", "challenge", "difficult", "hard", "struggle"],
          ["i did", "so i", "solved", "learned", "overcame", "decided", "worked"],
        ],
        names: { en: ["The problem", "What you did and learned"], fil: ["Ang problema", "Ang ginawa at natutunan mo"] },
        tip: {
          en: "Tell it as a short story: the problem, what you did, and what you learned.",
          fil: "Ikuwento nang maikli: ang problema, ang ginawa mo, at ang natutunan mo.",
        },
      },
      {
        ask: "How will you give back to your community?",
        fil: "Paano ka magbabalik ng tulong sa komunidad mo?",
        points: [["community", "help", "give back", "volunteer", "share", "teach", "serve", "barangay"]],
        names: { en: ["A real plan to help"], fil: ["Isang totoong plano para tumulong"] },
        tip: {
          en: "Give one real plan, like teaching younger students or volunteering in your barangay.",
          fil: "Magbigay ng isang totoong plano, gaya ng pagtuturo sa mas batang estudyante o pag-volunteer sa barangay.",
        },
      },
    ],
  },
  {
    type: "college",
    match: ["college", "university", "admission", "school", "entrance", "enroll"],
    spoken: "a college admission interview",
    questions: [
      ABOUT_YOU,
      {
        ask: "Why did you choose this school?",
        fil: "Bakit ito ang pinili mong school?",
        points: [["school", "university", "program", "known", "quality", "teachers", "course", "best"]],
        names: { en: ["Something specific about the school"], fil: ["Isang partikular na bagay tungkol sa school"] },
        tip: {
          en: "Mention something specific about the school: its program, teachers, or reputation.",
          fil: "Magbanggit ng partikular na bagay tungkol sa school: ang program, mga teacher, o reputasyon nito.",
        },
      },
      {
        ask: "What course do you want, and why?",
        fil: "Anong kurso ang gusto mo, at bakit?",
        points: [
          ["course", "degree", "major", "take", "engineering", "nursing", "education", "it", "accountancy"],
          ["because", "want", "dream", "passion", "love", "help"],
        ],
        names: { en: ["The course", "Your personal reason"], fil: ["Ang kurso", "Ang personal mong dahilan"] },
        tip: {
          en: "Name the course, then give a personal reason you care about it.",
          fil: "Sabihin ang kurso, tapos magbigay ng personal na dahilan kung bakit mahalaga ito sa'yo.",
        },
      },
      {
        ask: "What do you like to do in your free time?",
        fil: "Ano ang hilig mong gawin sa free time mo?",
        points: [["like", "enjoy", "love", "hobby", "play", "read", "sports", "music", "draw"]],
        names: { en: ["A hobby you enjoy"], fil: ["Isang hobby na gusto mo"] },
        tip: {
          en: "Share one or two hobbies and what they taught you.",
          fil: "Magbahagi ng isa o dalawang hobby at kung ano ang natutunan mo mula rito.",
        },
      },
      {
        ask: "What are your goals after college?",
        fil: "Ano ang mga goal mo pagkatapos ng college?",
        points: [["work", "career", "job", "become", "goal", "help", "business", "board exam"]],
        names: { en: ["A clear goal"], fil: ["Isang malinaw na goal"] },
        tip: {
          en: "Give a clear goal, and how this course takes you there.",
          fil: "Magbigay ng malinaw na goal, at kung paano ka dadalhin ng kursong ito roon.",
        },
      },
    ],
  },
];

export const interviewOf = (type: InterviewType) => INTERVIEWS.find((i) => i.type === type)!;

/** Which interview the person named out loud, or null if it is unclear. */
export function detectInterview(said: string): InterviewType | null {
  const text = ` ${said.toLowerCase()} `;
  // Most specific first, so "call center job" is BPO and "scholarship for college" is a scholarship.
  const order: InterviewType[] = ["bpo", "abroad", "scholarship", "college", "job"];
  for (const type of order) {
    if (interviewOf(type).match.some((w) => text.includes(w))) return type;
  }
  return null;
}
