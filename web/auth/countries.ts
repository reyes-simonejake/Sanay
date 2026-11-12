// ISO 3166-1 alpha-2 codes; names come from the browser (Intl.DisplayNames) in the UI language.
const CODES =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(
    " ",
  );

/** Countries sorted by name in `lang`, with the Philippines first. */
export function countries(lang: "en" | "fil"): { code: string; name: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([lang === "fil" ? "fil" : "en"], { type: "region" });
  } catch {
    names = null;
  }
  const list = CODES.map((code) => ({ code, name: names?.of(code) ?? code }));
  list.sort((a, b) => a.name.localeCompare(b.name, lang));
  const ph = list.findIndex((c) => c.code === "PH");
  if (ph > 0) list.unshift(...list.splice(ph, 1));
  return list;
}

export function countryName(code: string, lang: "en" | "fil") {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([lang === "fil" ? "fil" : "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
