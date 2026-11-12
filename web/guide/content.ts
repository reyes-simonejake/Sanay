// The Sanay user manual, in English and Filipino. Plain data: the Guide page renders it.
import type { Lang } from "../auth/backend";

export type Block =
  | { p: string }
  | { steps: string[] }
  | { list: string[] }
  | { tip: string }
  | { note: string }
  | { rows: [string, string][] }
  | { qa: [string, string][] };

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
}

const en: Chapter[] = [
  {
    id: "start",
    title: "Getting started",
    summary: "What Sanay does and what you need.",
    minutes: 2,
    blocks: [
      { p: "Sanay sits between your microphone and your call app. It removes background noise and can give you a masculine or feminine AI voice, live, while you talk. The other person hears only the result." },
      { p: "Sanay sends its sound to a virtual microphone. Your call app (Zoom, Google Meet, Teams, Discord and others) listens to that virtual microphone instead of your real one." },
      { list: ["A Windows 10 or Windows 11 computer", "Any microphone or headset", "The free VB-Cable virtual microphone from VB-Audio (chapter 3)", "For the AI voices: an NVIDIA graphics card. Without one, Sanay uses its built-in voice instead"] },
      { note: "Your audio is processed on your own computer. It is not uploaded." },
    ],
  },
  {
    id: "practice",
    title: "Practice before the real call",
    summary: "Practice interview, Say it in English, and Pronunciation.",
    minutes: 3,
    blocks: [
      { p: "Sanay helps you get ready before an important call, right in your browser. Open your account and choose one of the three practice tools. They work in Chrome on a computer or an Android phone, and they're free." },
      { rows: [["Practice interview", "A practice partner asks you real interview questions out loud. You answer by talking, then get your Ready score, tips and your answers to replay."], ["Say it in English", "Say what you mean in Filipino or Taglish, and get a clear English line to read out in your own voice."], ["Pronunciation", "Short drills for sounds that are easy to mix up, like F and P or V and B: first listen, then say it."]] },
      { steps: ["In your account, open Practice interview and pick the interviewer's voice: feminine or masculine.", "Tap Start. The interviewer asks what interview you're preparing for. Say it, or tap a choice on the screen.", "Answer each question out loud. Tap “I'm done” when you finish, or just stop talking for a few seconds.", "At the end, listen to your feedback, replay your answers, and read the tip under each one."] },
      { tip: "Use earphones so the interviewer's voice doesn't go into your mic, and practice in a quiet spot." },
      { note: "Practice needs internet: Chrome sends your voice to Google to write down your words. Your recordings stay on your device." },
    ],
  },
  {
    id: "vbcable",
    title: "Install the virtual microphone",
    summary: "VB-Cable carries Sanay's sound into your call app.",
    minutes: 3,
    blocks: [
      { p: "VB-Cable is a small, free virtual audio cable made by VB-Audio. You install it once." },
      { steps: ["Download the VB-Cable driver pack from vb-audio.com/Cable.", "Open the downloaded zip and extract it to a folder.", "Right-click VBCABLE_Setup_x64.exe and choose Run as administrator.", "Click Install Driver and wait for the confirmation.", "Restart your computer."] },
      { p: "After the restart, Windows has two new devices: CABLE Input (where Sanay sends its sound) and CABLE Output (the microphone your call app uses)." },
      { tip: "The installer can show “Not responding” for a few seconds. That is normal; let it finish." },
    ],
  },
  {
    id: "setup",
    title: "Set up Sanay",
    summary: "Choose your microphone and your voice.",
    minutes: 2,
    blocks: [
      { steps: ["Open Sanay. The first time, a short setup checks for VB-Cable and lets you pick your microphone.", "Choose a voice: Masculine, Feminine or Natural (your own voice, cleaned).", "Click the orb to switch Sanay on. A living, coloured orb means the call hears your chosen voice."] },
      { rows: [["Coloured, moving orb", "On: the call hears your chosen voice"], ["Thin ring of light", "Off: the call hears your normal microphone"], ["Ring with “Not reaching your call yet”", "Something is missing, such as the virtual microphone. Sanay shows what to fix"]] },
      { tip: "Noise cleanup is always on, under every voice. There is nothing extra to switch on." },
    ],
  },
  {
    id: "calls",
    title: "Use it in a call",
    summary: "Pick CABLE Output as the microphone in your call app.",
    minutes: 2,
    blocks: [
      { p: "In your call app's audio settings, choose CABLE Output as the microphone. You only do this once per app." },
      { rows: [["Zoom", "Settings → Audio → Microphone → CABLE Output"], ["Google Meet", "More options → Settings → Audio → Microphone → CABLE Output"], ["Microsoft Teams", "Settings → Devices → Microphone → CABLE Output"], ["Discord", "User Settings → Voice & Video → Input Device → CABLE Output"]] },
      { p: "Keep your speakers or headphones set as usual. Only the microphone changes." },
      { tip: "Before an important call, test your voice on the Sanay website or in a test call with a friend." },
    ],
  },
  {
    id: "pill",
    title: "The floating pill",
    summary: "Switch Sanay on or off without leaving your call.",
    minutes: 1,
    blocks: [
      { p: "The pill stays on top of every window, including your call. It shows Live or Off and the voice in use." },
      { rows: [["Click", "Switch Sanay on or off"], ["Drag", "Move it anywhere on your screen; it remembers the spot"], ["Right-click", "Open the Sanay window"]] },
      { p: "An amber mark on the pill means something changed, for example the AI voice was not ready and Sanay used its basic voice. It clears when you open Sanay." },
      { tip: "Hidden the pill by mistake? Turn it back on in Sanay → Settings → Floating on/off pill." },
    ],
  },
  {
    id: "voices",
    title: "The voices",
    summary: "Masculine, Feminine and Natural.",
    minutes: 2,
    blocks: [
      { rows: [["Masculine", "A deep, confident voice"], ["Feminine", "A light, clear voice"], ["Natural", "Your own voice, with the noise removed"]] },
      { p: "Masculine and Feminine are AI voices that run on your computer's graphics card. They add about a quarter of a second of delay. While an AI voice starts, or if it is unavailable, Sanay uses its built-in voice so the call never goes silent." },
      { tip: "Speak at your normal pace. Natural keeps your words the clearest." },
    ],
  },
  {
    id: "help",
    title: "Troubleshooting",
    summary: "Quick fixes for common problems.",
    minutes: 3,
    blocks: [
      {
        qa: [
          ["The other person hears nothing", "Check that your call app's microphone is CABLE Output, that the Sanay orb is lit, and that the right microphone is chosen in Sanay → Settings."],
          ["They hear my normal voice", "Sanay is off or set to Natural. Click the orb or the pill, and choose Masculine or Feminine."],
          ["“AI voice not ready”", "The AI voice is starting or unavailable, so Sanay uses its basic voice for now. Wait a few seconds. AI voices need an NVIDIA graphics card."],
          ["My voice sounds choppy", "Close heavy apps such as games or video editors, and keep a laptop plugged in."],
          ["The other person hears an echo", "Keep Echo cancellation on in Sanay → Settings. It removes what your speakers play from your mic, with any mic. Give it a few seconds at the start of a call to learn your room."],
          ["I hear myself", "Turn off Hear yourself in Sanay → Settings. Echo cancellation pauses while it's on."],
          ["“Not reaching your call yet”", "Sanay shows what is missing, usually the virtual microphone. Install VB-Cable (chapter 3) and restart."],
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    summary: "Where your voice goes.",
    minutes: 1,
    blocks: [
      { p: "For your calls, Sanay processes your voice on your own computer. The AI voices run locally too. Nothing you say on a call is uploaded or recorded." },
      { p: "Recordings you make in the voice lab or the mic test stay in memory and are discarded when you leave." },
      { p: "The practice tools are different: to write down your words, Chrome's speech recognition sends your voice to Google, and Say it in English sends the text to MyMemory, a free translation service. Sanay itself saves nothing; your practice recordings stay on your device." },
    ],
  },
];

const fil: Chapter[] = [
  {
    id: "start",
    title: "Pagsisimula",
    summary: "Ano ang ginagawa ng Sanay at ano ang kailangan mo.",
    minutes: 2,
    blocks: [
      { p: "Nasa pagitan ng mikropono mo at ng call app ang Sanay. Tinatanggal nito ang ingay sa paligid at kaya kang bigyan ng panlalaki o pambabaeng AI voice, live, habang nagsasalita ka. Ang resulta lang ang naririnig ng kausap mo." },
      { p: "Ipinapadala ng Sanay ang tunog sa isang virtual na mikropono. Iyon ang pinakikinggan ng call app mo (Zoom, Google Meet, Teams, Discord at iba pa) sa halip na ang totoong mic mo." },
      { list: ["Computer na Windows 10 o Windows 11", "Kahit anong mikropono o headset", "Ang libreng VB-Cable virtual microphone mula sa VB-Audio (chapter 3)", "Para sa mga AI voice: NVIDIA graphics card. Kung wala, ang built-in na boses ng Sanay ang gagamitin"] },
      { note: "Sa sarili mong computer pinoproseso ang audio mo. Hindi ito ina-upload." },
    ],
  },
  {
    id: "practice",
    title: "Mag-practice bago ang totoong tawag",
    summary: "Practice interview, Sabihin sa English, at Pronunciation.",
    minutes: 3,
    blocks: [
      { p: "Tinutulungan ka ng Sanay na maghanda bago ang mahalagang tawag, dito mismo sa browser mo. Buksan ang account mo at pumili sa tatlong practice tool. Gumagana ang mga ito sa Chrome sa computer o Android phone, at libre." },
      { rows: [["Practice interview", "May practice partner na magtatanong sa'yo ng totoong interview questions nang malakas. Sasagot ka sa pagsasalita, tapos makukuha mo ang Ready score, mga tip, at mapapakinggan mo ulit ang mga sagot mo."], ["Sabihin sa English", "Sabihin ang gusto mong sabihin sa Filipino o Taglish, at makakakuha ka ng malinaw na English na babasahin mo sa sarili mong boses."], ["Pronunciation", "Maiikling drill para sa mga tunog na madaling mapagpalit, gaya ng F at P o V at B: makinig muna, tapos sabihin."]] },
      { steps: ["Sa account mo, buksan ang Practice interview at piliin ang boses ng interviewer: pambabae o panlalaki.", "Pindutin ang Start. Itatanong ng interviewer kung anong interview ang pinaghahandaan mo. Sabihin mo, o pumili sa screen.", "Sagutin nang malakas ang bawat tanong. Pindutin ang “Tapos na ako” pag tapos ka na, o huminto lang sa pagsasalita nang ilang segundo.", "Sa dulo, pakinggan ang feedback mo, pakinggan ulit ang mga sagot mo, at basahin ang tip sa ilalim ng bawat isa."] },
      { tip: "Mag-earphones para hindi pumasok sa mic mo ang boses ng interviewer, at mag-practice sa tahimik na lugar." },
      { note: "Kailangan ng internet ang practice: ipinapadala ng Chrome ang boses mo sa Google para maisulat ang mga salita mo. Nasa device mo lang ang mga recording." },
    ],
  },
  {
    id: "vbcable",
    title: "I-install ang virtual microphone",
    summary: "Dinadala ng VB-Cable ang tunog ng Sanay sa call app mo.",
    minutes: 3,
    blocks: [
      { p: "Ang VB-Cable ay maliit at libreng virtual audio cable mula sa VB-Audio. Isang beses mo lang itong ii-install." },
      { steps: ["I-download ang VB-Cable driver pack mula sa vb-audio.com/Cable.", "Buksan ang na-download na zip at i-extract sa isang folder.", "I-right-click ang VBCABLE_Setup_x64.exe at piliin ang Run as administrator.", "I-click ang Install Driver at hintayin ang kumpirmasyon.", "I-restart ang computer mo."] },
      { p: "Pagkatapos mag-restart, may dalawang bagong device ang Windows: CABLE Input (kung saan ipinapadala ng Sanay ang tunog) at CABLE Output (ang mikroponong gagamitin ng call app mo)." },
      { tip: "Puwedeng lumabas ang “Not responding” sa installer nang ilang segundo. Normal iyon; hayaan lang matapos." },
    ],
  },
  {
    id: "setup",
    title: "I-set up ang Sanay",
    summary: "Piliin ang mikropono at boses mo.",
    minutes: 2,
    blocks: [
      { steps: ["Buksan ang Sanay. Sa unang beses, may maikling setup na titingin sa VB-Cable at hahayaan kang pumili ng mikropono.", "Pumili ng boses: Panlalaki, Pambabae o Natural (sarili mong boses, nilinis).", "I-click ang bilog para i-on ang Sanay. Kapag buhay at may kulay ang bilog, ang napili mong boses ang naririnig sa tawag."] },
      { rows: [["May kulay at gumagalaw na bilog", "On: ang napili mong boses ang naririnig sa tawag"], ["Manipis na singsing ng liwanag", "Off: ang karaniwan mong mikropono ang naririnig"], ["Singsing na may “Hindi pa umaabot sa tawag mo”", "May kulang, gaya ng virtual microphone. Ipinapakita ng Sanay kung ano ang aayusin"]] },
      { tip: "Laging naka-on ang paglinis ng ingay, sa bawat boses. Wala nang ibang kailangang i-on." },
    ],
  },
  {
    id: "calls",
    title: "Gamitin sa tawag",
    summary: "Piliin ang CABLE Output bilang mikropono sa call app mo.",
    minutes: 2,
    blocks: [
      { p: "Sa audio settings ng call app mo, piliin ang CABLE Output bilang mikropono. Isang beses lang ito bawat app." },
      { rows: [["Zoom", "Settings → Audio → Microphone → CABLE Output"], ["Google Meet", "More options → Settings → Audio → Microphone → CABLE Output"], ["Microsoft Teams", "Settings → Devices → Microphone → CABLE Output"], ["Discord", "User Settings → Voice & Video → Input Device → CABLE Output"]] },
      { p: "Hayaan ang speakers o headphones mo gaya ng dati. Ang mikropono lang ang papalitan." },
      { tip: "Bago ang mahalagang tawag, subukan ang boses mo sa Sanay website o sa test call kasama ang kaibigan." },
    ],
  },
  {
    id: "pill",
    title: "Ang lumulutang na pill",
    summary: "I-on o i-off ang Sanay nang hindi umaalis sa tawag.",
    minutes: 1,
    blocks: [
      { p: "Nasa ibabaw ng bawat window ang pill, pati ng tawag mo. Ipinapakita nito kung Live o Off at kung anong boses ang gamit." },
      { rows: [["I-click", "I-on o i-off ang Sanay"], ["I-drag", "Ilipat kahit saan sa screen; tatandaan nito ang puwesto"], ["I-right-click", "Buksan ang Sanay window"]] },
      { p: "Kapag may amber na marka ang pill, may nagbago, halimbawa hindi pa handa ang AI voice kaya basic na boses muna ang ginamit. Nawawala ito kapag binuksan mo ang Sanay." },
      { tip: "Naitago ang pill nang hindi sinasadya? I-on ulit sa Sanay → Settings → Lumulutang na on/off pill." },
    ],
  },
  {
    id: "voices",
    title: "Ang mga boses",
    summary: "Panlalaki, Pambabae at Natural.",
    minutes: 2,
    blocks: [
      { rows: [["Panlalaki", "Malalim at kumpiyansang boses"], ["Pambabae", "Magaan at malinaw na boses"], ["Natural", "Sarili mong boses, tinanggalan ng ingay"]] },
      { p: "Ang Panlalaki at Pambabae ay mga AI voice na tumatakbo sa graphics card ng computer mo. Nagdadagdag sila ng mga isang-kapat na segundong delay. Habang nagsisimula ang AI voice, o kung hindi ito available, built-in na boses muna ang gamit para hindi mawalan ng tunog ang tawag." },
      { tip: "Magsalita sa karaniwan mong bilis. Pinakamalinaw ang mga salita sa Natural." },
    ],
  },
  {
    id: "help",
    title: "Pag-aayos ng problema",
    summary: "Mabilis na solusyon sa karaniwang problema.",
    minutes: 3,
    blocks: [
      {
        qa: [
          ["Walang naririnig ang kausap ko", "Tiyaking CABLE Output ang mikropono ng call app mo, naka-ilaw ang bilog ng Sanay, at tama ang napiling mikropono sa Sanay → Settings."],
          ["Karaniwan kong boses ang naririnig nila", "Naka-off o naka-Natural ang Sanay. I-click ang bilog o ang pill, at piliin ang Panlalaki o Pambabae."],
          ["“Hindi pa handa ang AI voice”", "Nagsisimula pa o hindi available ang AI voice, kaya basic na boses muna. Maghintay ng ilang segundo. Kailangan ng NVIDIA graphics card ang mga AI voice."],
          ["Putol-putol ang boses ko", "Isara ang mabibigat na app gaya ng laro o video editor, at i-plug in ang laptop."],
          ["May echo na naririnig ang kausap ko", "Panatilihing naka-on ang Pagtanggal ng echo sa Sanay → Settings. Tinatanggal nito sa mic mo ang tunog ng speakers mo, sa kahit anong mic. Ilang segundo sa simula ng tawag para matutunan nito ang kuwarto mo."],
          ["Naririnig ko ang sarili ko", "I-off ang Pakinggan ang sarili sa Sanay → Settings. Naka-pause ang pagtanggal ng echo habang naka-on ito."],
          ["“Hindi pa umaabot sa tawag mo”", "Ipinapakita ng Sanay ang kulang, kadalasan ang virtual microphone. I-install ang VB-Cable (chapter 3) at mag-restart."],
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    summary: "Saan napupunta ang boses mo.",
    minutes: 1,
    blocks: [
      { p: "Sa mga tawag mo, sa sarili mong computer pinoproseso ng Sanay ang boses mo. Lokal din tumatakbo ang mga AI voice. Walang ina-upload o nire-record sa sinasabi mo sa tawag." },
      { p: "Ang mga recording na ginawa mo sa voice lab o sa mic test ay nasa memory lang at binubura kapag umalis ka." },
      { p: "Iba ang mga practice tool: para maisulat ang mga salita mo, ipinapadala ng speech recognition ng Chrome ang boses mo sa Google, at ipinapadala ng Sabihin sa English ang text sa MyMemory, isang libreng translation service. Walang sine-save ang Sanay; nasa device mo lang ang mga practice recording mo." },
    ],
  },
];

export const GUIDE: Record<Lang, Chapter[]> = { en, fil };
