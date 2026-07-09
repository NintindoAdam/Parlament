/**
 * Słowniczek pojęć parlamentarnych — krótkie, przystępne definicje pokazywane
 * w dymkach (`components/Term.tsx`) tam, gdzie termin się pojawia. Klucze
 * porównujemy po normalizacji (małe litery), więc `term="Sejm"` = „sejm".
 */
export interface GlossaryEntry {
  term: string
  definition: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  kworum: {
    term: 'kworum',
    definition:
      'Minimalna liczba posłów obecnych na sali, by Sejm mógł ważnie głosować — zwykle co najmniej połowa (230 z 460).',
  },
  'większość zwykła': {
    term: 'większość zwykła',
    definition:
      'Za musi być więcej niż przeciw; głosów wstrzymujących się nie liczy się. Domyślny sposób podejmowania decyzji w Sejmie.',
  },
  'większość bezwzględna': {
    term: 'większość bezwzględna',
    definition:
      'Za musi być więcej niż suma głosów przeciw i wstrzymujących się (albo co najmniej 231 — ponad połowa ustawowej liczby posłów).',
  },
  'większość kwalifikowana': {
    term: 'większość kwalifikowana',
    definition:
      'Podwyższony próg, np. 3/5 (276 głosów — do odrzucenia weta Prezydenta) lub 2/3. Wymagana przy najważniejszych decyzjach.',
  },
  czytanie: {
    term: 'czytanie',
    definition:
      'Etap prac nad projektem ustawy w Sejmie. Ustawę uchwala się po trzech czytaniach: prezentacji, debacie z poprawkami i głosowaniu.',
  },
  komisja: {
    term: 'komisja',
    definition:
      'Zespół posłów wyspecjalizowanych w danej dziedzinie, który szczegółowo analizuje projekty i przygotowuje sprawozdania dla Sejmu.',
  },
  senat: {
    term: 'Senat',
    definition:
      'Izba wyższa parlamentu (100 senatorów). Rozpatruje ustawy uchwalone przez Sejm — może je przyjąć, poprawić lub odrzucić.',
  },
  weto: {
    term: 'weto',
    definition:
      'Odmowa podpisania ustawy przez Prezydenta. Sejm może je odrzucić większością 3/5 głosów; w przeciwnym razie ustawa upada.',
  },
  'dziennik ustaw': {
    term: 'Dziennik Ustaw',
    definition:
      'Oficjalny publikator prawa. Ustawa zaczyna obowiązywać dopiero po ogłoszeniu w nim — zwykle po okresie vacatio legis.',
  },
  'inicjatywa ustawodawcza': {
    term: 'inicjatywa ustawodawcza',
    definition:
      'Prawo wniesienia projektu ustawy. Mają je m.in. rząd, grupa 15 posłów, Senat, Prezydent oraz 100 tys. obywateli.',
  },
  immunitet: {
    term: 'immunitet',
    definition:
      'Ochrona posła przed odpowiedzialnością karną bez zgody Sejmu. Jej uchylenie wymaga bezwzględnej większości ustawowej liczby posłów.',
  },
  'vacatio legis': {
    term: 'vacatio legis',
    definition:
      'Okres między ogłoszeniem ustawy a jej wejściem w życie, dający czas na przygotowanie się do nowych przepisów.',
  },
}

export function lookupTerm(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key.toLowerCase()]
}
