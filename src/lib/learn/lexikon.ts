// Wetter-Lexikon für die Lernseite. Inhaltlich an DWD-Terminologie angelehnt.
// Erweiterbar: weitere Einträge einfach unten ergänzen.

export type LexCategory =
  | "grundlagen"
  | "konvektion"
  | "wind"
  | "niederschlag"
  | "warnung"
  | "daten";

export const CATEGORY_LABEL: Record<LexCategory, string> = {
  grundlagen: "Grundlagen",
  konvektion: "Konvektion & Gewitter",
  wind: "Wind",
  niederschlag: "Niederschlag",
  warnung: "Warnung",
  daten: "Daten & Modelle",
};

export interface LexEntry {
  term: string;
  slug: string;
  category: LexCategory;
  definition: string;
  example?: string;
  related?: string[];
}

export const LEXIKON: LexEntry[] = [
  // — Grundlagen —
  {
    term: "Taupunkt",
    slug: "taupunkt",
    category: "grundlagen",
    definition:
      "Temperatur, bei der die Luft mit Wasserdampf gesättigt ist (100 % relative Feuchte). Je kleiner der Abstand zur Lufttemperatur (Spread), desto feuchter die Luft.",
    example:
      "20 °C Luft bei 18 °C Taupunkt fühlt sich schwül an; 20 °C bei 5 °C Taupunkt ist trocken.",
  },
  {
    term: "Nullgradgrenze",
    slug: "nullgradgrenze",
    category: "grundlagen",
    definition:
      "Höhe über NN, in der die Lufttemperatur 0 °C erreicht. Die Schneefallgrenze liegt meist 100–300 m darunter, weil Schnee beim Fallen zunächst noch etwas schmilzt.",
  },
  {
    term: "Bewölkungsschichten",
    slug: "bewoelkungsschichten",
    category: "grundlagen",
    definition:
      "Tiefe (bis ~2 km), mittelhohe (2–7 km) und hohe Wolken (über 7 km). Open-Meteo liefert häufig nur die Gesamtbedeckung in Prozent.",
  },
  {
    term: "Troposphäre",
    slug: "troposphaere",
    category: "grundlagen",
    definition:
      "Unterste Schicht der Atmosphäre (etwa 8 km an den Polen, bis 15 km am Äquator). Hier läuft praktisch das gesamte Wettergeschehen ab.",
  },
  {
    term: "Hoch- und Tiefdruckgebiet",
    slug: "hoch-tief",
    category: "grundlagen",
    definition:
      "Im Hoch sinkt Luft ab – meist ruhiges, trockenes Wetter. Im Tief steigt Luft auf – häufig Wolken und Niederschlag.",
  },
  {
    term: "Kalt-, Warmfront, Okklusion",
    slug: "fronten",
    category: "grundlagen",
    definition:
      "Grenzen zwischen Luftmassen. Die Kaltfront schiebt sich unter warme Luft (kurze, kräftige Schauer/Gewitter), die Warmfront gleitet auf (länger anhaltender Regen). Bei der Okklusion holt die Kaltfront die Warmfront ein.",
  },
  {
    term: "Trog und Rücken",
    slug: "trog-ruecken",
    category: "grundlagen",
    definition:
      "Trog = Vorstoß kalter Höhenluft nach Süden; hebt und destabilisiert die Luft. Rücken = warmer Höhenkeil; stabilisiert, meist mit Hochdruck verbunden.",
  },
  {
    term: "Höhentief",
    slug: "hoehentief",
    category: "grundlagen",
    definition:
      "Von der Höhenströmung abgeschnürtes Tief, oft langlebig und träge. Bringt über Tage wiederholt Schauer und Gewitter.",
  },

  // — Konvektion & Gewitter —
  {
    term: "CAPE",
    slug: "cape",
    category: "konvektion",
    definition:
      "Convective Available Potential Energy (J/kg): die Energie, die ein aufsteigendes Luftpaket gewinnen kann. Hohe Werte begünstigen kräftige Aufwinde. Grob: 500–1000 mäßig, 1500–2500 hoch, über 2500 sehr hoch.",
    related: ["cin", "lifted-index", "labilitaet"],
  },
  {
    term: "CIN",
    slug: "cin",
    category: "konvektion",
    definition:
      "Convective Inhibition (J/kg): Energiebarriere, die den Aufstieg anfangs unterdrückt – ein Deckel. Löst er sich auf, kann Konvektion explosionsartig starten.",
    related: ["cape"],
  },
  {
    term: "Lifted Index",
    slug: "lifted-index",
    category: "konvektion",
    definition:
      "Differenz aus Umgebungstemperatur und der Temperatur eines auf 500 hPa gehobenen Luftpakets. Negative Werte bedeuten labile Schichtung; unter −5 deutet auf kräftige Gewitter hin.",
    example: "Stammt meist aus dem GFS-Modell und kann in Datensätzen fehlen.",
    related: ["cape", "labilitaet"],
  },
  {
    term: "Labilität",
    slug: "labilitaet",
    category: "konvektion",
    definition:
      "Nimmt die Temperatur mit der Höhe stark ab, steigt ein einmal angehobenes Luftpaket von selbst weiter auf. Labile Schichtung ist die Grundzutat für Gewitter.",
    related: ["cape", "lifted-index"],
  },
  {
    term: "Windscherung",
    slug: "windscherung",
    category: "konvektion",
    definition:
      "Änderung von Windrichtung und/oder -geschwindigkeit mit der Höhe. Starke Scherung trennt Auf- und Abwind und organisiert Gewitter zu Multi- und Superzellen.",
    related: ["superzelle", "helicity"],
  },
  {
    term: "Helicity (SRH)",
    slug: "helicity",
    category: "konvektion",
    definition:
      "Maß für die Drehung im scherungsbehafteten Wind (Storm-Relative Helicity). Hohe Werte begünstigen rotierende Aufwinde und damit Superzellen.",
    related: ["windscherung", "superzelle"],
  },
  {
    term: "Einzelzelle",
    slug: "einzelzelle",
    category: "konvektion",
    definition:
      "Gewitter aus einer einzigen Zelle, kurzlebig (etwa 30–60 Minuten). Kann lokal Starkregen, kleinen Hagel und Downbursts bringen.",
    related: ["multizelle", "superzelle"],
  },
  {
    term: "Multizelle",
    slug: "multizelle",
    category: "konvektion",
    definition:
      "Verbund mehrerer Zellen in verschiedenen Entwicklungsstadien. An der Böenfront entstehen laufend neue Zellen – der häufigste Gewittertyp.",
    related: ["einzelzelle", "boeenfront"],
  },
  {
    term: "Superzelle",
    slug: "superzelle",
    category: "konvektion",
    definition:
      "Langlebiges Gewitter mit einem rotierenden Aufwind (Mesozyklone). Höchstes Potenzial für großen Hagel, schwere Sturmböen und Tornados.",
    related: ["helicity", "windscherung", "hagel"],
  },
  {
    term: "Bow Echo",
    slug: "bow-echo",
    category: "konvektion",
    definition:
      "Bogenförmig verformte Gewitterlinie im Radarbild. Deutet auf schwere, geradlinige Sturmböen (Downbursts) entlang des Bogens hin.",
    related: ["downburst", "mcs"],
  },
  {
    term: "MCS",
    slug: "mcs",
    category: "konvektion",
    definition:
      "Mesoscale Convective System: großräumiger, langlebiger Gewitterkomplex. Bringt flächigen Starkregen und Sturmböen über mehrere Stunden.",
    related: ["bow-echo", "starkregen"],
  },
  {
    term: "Downburst",
    slug: "downburst",
    category: "konvektion",
    definition:
      "Heftiger Abwind aus einem Gewitter, der am Boden auffächert und geradlinige Sturm- bis Orkanböen erzeugt. Wird oft mit Tornadoschäden verwechselt.",
    related: ["boeenfront", "boe"],
  },
  {
    term: "Böenfront",
    slug: "boeenfront",
    category: "konvektion",
    definition:
      "Vorderkante der kühlen Abwinde eines Gewitters. Erkennbar an plötzlicher Windzunahme und -drehung, oft mit Wolkenrolle oder Staubwand.",
    related: ["downburst", "multizelle"],
  },
  {
    term: "Lightning Jump",
    slug: "lightning-jump",
    category: "konvektion",
    definition:
      "Plötzlicher, starker Anstieg der Blitzrate einer Zelle. Gilt als Frühindikator für eine bevorstehende Intensivierung.",
  },

  // — Wind —
  {
    term: "Beaufort (Bft)",
    slug: "beaufort",
    category: "wind",
    definition:
      "Skala der Windstärke von 0 bis 12. Bft 7 ≈ 50 km/h (steifer Wind), Bft 9 ≈ 75 km/h (Sturm), Bft 10 ≈ 90 km/h (schwerer Sturm), Bft 12 ab 118 km/h (Orkan).",
    related: ["boe"],
  },
  {
    term: "Böe",
    slug: "boe",
    category: "wind",
    definition:
      "Kurzzeitige Windspitze, deutlich über dem Mittelwind. Der DWD warnt nach Böenspitzen, nicht nach dem mittleren Wind.",
    related: ["beaufort", "downburst"],
  },

  // — Niederschlag —
  {
    term: "Starkregen",
    slug: "starkregen",
    category: "niederschlag",
    definition:
      "Große Regenmenge in kurzer Zeit mit Gefahr lokaler Überflutungen. Der DWD staffelt nach Stundensumme bzw. Mehrstundenmenge in markant, heftig und extrem.",
    related: ["mcs", "radolan"],
  },
  {
    term: "Hagel",
    slug: "hagel",
    category: "niederschlag",
    definition:
      "Eiskörner aus kräftigen Gewittern. Ab etwa 2 cm Durchmesser Unwetter; sehr große Steine (über 5 cm) treten fast nur in Superzellen auf.",
    related: ["superzelle"],
  },
  {
    term: "RADOLAN",
    slug: "radolan",
    category: "niederschlag",
    definition:
      "DWD-Radarprodukt mit geeichten Niederschlagsmengen: Radardaten werden mit Bodenstationen abgeglichen. Liefert die Ist-Niederschlagsmenge in mm.",
    related: ["dbz", "nowcast"],
  },
  {
    term: "dBZ / Reflektivität",
    slug: "dbz",
    category: "niederschlag",
    definition:
      "Radarmaß für Größe und Menge der Tropfen. Höhere dBZ bedeuten intensiveren Niederschlag; über die Z-R-Beziehung in mm/h umgerechnet – das ist aber nicht direkt der Bodenregen.",
    related: ["radolan"],
  },

  // — Warnung & Daten —
  {
    term: "Warnstufe (DWD)",
    slug: "warnstufe",
    category: "warnung",
    definition:
      "Vierstufiges DWD-System: Stufe 1 Wetterwarnung (Gelb), Stufe 2 Markantes Wetter (Orange), Stufe 3 Unwetterwarnung (Rot), Stufe 4 Extremes Unwetter (Violett).",
  },
  {
    term: "Nowcast",
    slug: "nowcast",
    category: "daten",
    definition:
      "Kürzestfrist-Vorhersage für die nächsten 0–2 Stunden, direkt aus Radar und Beobachtung extrapoliert. Genauer als ein Modell, aber nur sehr kurzfristig.",
    related: ["radolan", "beobachtung-modell"],
  },
  {
    term: "Ensemble",
    slug: "ensemble",
    category: "daten",
    definition:
      "Mehrere Modellläufe mit leicht variierten Startbedingungen. Die Bandbreite der Ergebnisse zeigt, wie sicher oder unsicher eine Prognose ist.",
    related: ["modell-spread"],
  },
  {
    term: "Modell-Spread",
    slug: "modell-spread",
    category: "daten",
    definition:
      "Streuung der Vorhersagen innerhalb eines Ensembles oder zwischen Modellen. Großer Spread bedeutet höhere Unsicherheit.",
    related: ["ensemble"],
  },
  {
    term: "Beobachtung vs. Modell",
    slug: "beobachtung-modell",
    category: "daten",
    definition:
      "Beobachtungen (Station, Radar) zeigen den Ist-Zustand. Modelle rechnen die Zukunft. Der Nowcast liegt dazwischen und überbrückt die ersten Stunden.",
    related: ["nowcast"],
  },
];

export function lexFirstLetter(term: string): string {
  const c = term.trim().charAt(0).toUpperCase();
  const map: Record<string, string> = { "Ä": "A", "Ö": "O", "Ü": "U" };
  return map[c] ?? c;
}

export function searchLexikon(query: string): LexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return LEXIKON;
  return LEXIKON.filter(
    (e) =>
      e.term.toLowerCase().includes(q) ||
      e.definition.toLowerCase().includes(q) ||
      (e.example?.toLowerCase().includes(q) ?? false),
  );
}