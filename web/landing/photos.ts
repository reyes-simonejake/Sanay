// Photographs of real Filipinos, all free to use (Pexels License or Unsplash License), each checked on its
// source page for the place it was taken. Served from the hosts' own image CDNs, which allow hotlinking and
// send CORS headers (the dot portraits sample their pixels).

export interface Photo {
  /** Image URL at a given width. */
  src: (w: number) => string;
  /** Source page, for the credits. */
  page: string;
  /** Photographer's handle on the source site. */
  by: string;
  site: "Pexels" | "Unsplash";
  alt: { en: string; fil: string };
  /** CSS object-position, to keep faces in frame. */
  focus?: string;
}

const pexels = (id: number, ext: "jpeg" | "png" = "jpeg") => (w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}?auto=compress&cs=tinysrgb&w=${w}`;
const unsplash = (path: string) => (w: number) => `https://images.unsplash.com/${path}?auto=format&fit=crop&q=70&w=${w}`;

export const PHOTOS = {
  graduate: {
    src: pexels(37152961),
    page: "https://www.pexels.com/photo/37152961/",
    by: "kimymoto",
    site: "Pexels",
    alt: { en: "A smiling graduate in a red gown", fil: "Nakangiting graduate na naka-pulang toga" },
    focus: "50% 25%",
  },
  students: {
    src: pexels(37144327),
    page: "https://www.pexels.com/photo/37144327/",
    by: "kimymoto",
    site: "Pexels",
    alt: { en: "Two high school students in uniform", fil: "Dalawang high school student na naka-uniporme" },
    focus: "50% 30%",
  },
  waving: {
    src: unsplash("photo-1585790641228-36685639c56e"),
    page: "https://unsplash.com/photos/_in8No6ABMw",
    by: "Ryan Mendoza",
    site: "Unsplash",
    alt: { en: "A man waving hello on a video call from home in Cavite", fil: "Lalaking kumakaway sa video call mula sa bahay sa Cavite" },
    focus: "60% 40%",
  },
  doctor: {
    src: pexels(29088257),
    page: "https://www.pexels.com/photo/29088257/",
    by: "Justyn Abacajan",
    site: "Pexels",
    alt: { en: "A young doctor in a white coat in Davao", fil: "Batang doktor na naka-puting coat sa Davao" },
    focus: "50% 20%",
  },
  nurses: {
    src: pexels(32486496),
    page: "https://www.pexels.com/photo/32486496/",
    by: "高橋",
    site: "Pexels",
    alt: { en: "A team of nurses in a hospital ward in Baguio", fil: "Mga nurse sa isang ward ng ospital sa Baguio" },
  },
  mother: {
    src: pexels(27848687),
    page: "https://www.pexels.com/photo/27848687/",
    by: "Zachary Angeles",
    site: "Pexels",
    alt: { en: "A mother cheek to cheek with her baby in Manila", fil: "Isang nanay na nakadikit ang pisngi sa kanyang baby sa Maynila" },
    focus: "45% 35%",
  },
  hug: {
    src: pexels(19524029),
    page: "https://www.pexels.com/photo/19524029/",
    by: "kimymoto",
    site: "Pexels",
    alt: { en: "Three women hugging and laughing in Manila", fil: "Tatlong babaeng nagyayakapan at nagtatawanan sa Maynila" },
    focus: "50% 30%",
  },
  lolas: {
    src: pexels(32326425),
    page: "https://www.pexels.com/photo/32326425/",
    by: "Elgene Buhong",
    site: "Pexels",
    alt: { en: "Three smiling grandmothers in the Cordillera", fil: "Tatlong nakangiting lola sa Cordillera" },
    focus: "50% 35%",
  },
  lola: {
    src: unsplash("photo-1609126137948-b166f8b8462f"),
    page: "https://unsplash.com/photos/Ic-FbT-IKXA",
    by: "Beth Macdonald",
    site: "Unsplash",
    alt: { en: "A grey-haired woman in Pampanga", fil: "Babaeng may puting buhok sa Pampanga" },
    focus: "50% 30%",
  },
  teacher: {
    src: unsplash("photo-1609126385558-bc3fc5082b0a"),
    page: "https://unsplash.com/photos/N64Ygz8CPsA",
    by: "Beth Macdonald",
    site: "Unsplash",
    alt: { en: "A teacher smiling during a class in Pampanga", fil: "Gurong nakangiti habang nagkaklase sa Pampanga" },
    focus: "55% 35%",
  },
  sariSari: {
    src: unsplash("photo-1790523895653-532b2b797174"),
    page: "https://unsplash.com/photos/_-wzXGIGt0M",
    by: "Josh Marty",
    site: "Unsplash",
    alt: { en: "A couple minding their sari-sari store", fil: "Mag-asawang nagbabantay ng kanilang sari-sari store" },
  },
  laughing: {
    src: unsplash("photo-1595986630530-969786b19b4d"),
    page: "https://unsplash.com/photos/R6dSBkz32B8",
    by: "Ghen Mar Cuaño",
    site: "Unsplash",
    alt: { en: "A woman laughing at a message on her phone", fil: "Babaeng natatawa sa mensahe sa kanyang phone" },
    focus: "50% 30%",
  },
  barongCall: {
    src: pexels(40529366, "png"),
    page: "https://www.pexels.com/photo/40529366/",
    by: "Ramius Aquiler",
    site: "Pexels",
    alt: { en: "A man in a barong on a phone call in Manila", fil: "Lalaking naka-barong na may kausap sa phone sa Maynila" },
    focus: "50% 30%",
  },
  barong: {
    src: pexels(20702957),
    page: "https://www.pexels.com/photo/20702957/",
    by: "Terence B",
    site: "Pexels",
    alt: { en: "A young man in a barong, smiling", fil: "Binatang naka-barong, nakangiti" },
    focus: "50% 25%",
  },
  ferry: {
    src: pexels(37104731, "png"),
    page: "https://www.pexels.com/photo/37104731/",
    by: "Ramius Aquiler",
    site: "Pexels",
    alt: { en: "A traveller on a ferry deck looking out to sea in Cebu", fil: "Pasaherong nakatanaw sa dagat mula sa ferry sa Cebu" },
  },
  kids: {
    src: unsplash("photo-1527821468487-b724210d296a"),
    page: "https://unsplash.com/photos/Ks4t8IK8Kgw",
    by: "Avel Chuklanov",
    site: "Unsplash",
    alt: { en: "Children laughing and playing outside", fil: "Mga batang tumatawa at naglalaro sa labas" },
  },
  taho: {
    src: pexels(36499543),
    page: "https://www.pexels.com/photo/36499543/",
    by: "meetjoeblack",
    site: "Pexels",
    alt: { en: "A taho vendor resting between rounds in Taal", fil: "Magtataho na nagpapahinga sa Taal" },
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;
