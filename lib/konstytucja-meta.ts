/**
 * Warstwa „eksperta-politologa + projektanta" — DODATKI wizualne i edukacyjne
 * NAD wiernym tekstem Konstytucji (samego tekstu nie zmieniamy). Kolory i
 * streszczenia rozdziałów oraz reflektory na artykuły-kamienie milowe.
 */

export interface RozdzialMeta {
  /** Kolor akcentu (spójny z paletą strony). */
  color: string
  /** Ludzki tytuł (do wyświetlenia — dokument ma ALL CAPS). */
  nazwa: string
  /** Jednozdaniowe „co tu znajdziesz". */
  summary: string
}

/** Meta per slug rozdziału. Ikony: components/konstytucja/RozdzialIcon.tsx. */
export const ROZDZIAL_META: Record<string, RozdzialMeta> = {
  rzeczpospolita: {
    color: '#7c5cdb',
    nazwa: 'Rzeczpospolita',
    summary: 'Fundamenty państwa: dobro wspólne, demokratyczne państwo prawne, zwierzchnictwo Narodu, trójpodział władzy i symbole RP.',
  },
  'wolnosci-prawa-obowiazki': {
    color: '#e11d48',
    nazwa: 'Wolności, prawa i obowiązki człowieka i obywatela',
    summary: 'Katalog wolności i praw — od godności i równości po wolność słowa — oraz obowiązki wobec wspólnoty.',
  },
  'zrodla-prawa': {
    color: '#2f6fed',
    nazwa: 'Źródła prawa',
    summary: 'Hierarchia prawa: Konstytucja, ustawy, ratyfikowane umowy międzynarodowe i rozporządzenia.',
  },
  'sejm-i-senat': {
    color: '#0e8f8f',
    nazwa: 'Sejm i Senat',
    summary: 'Władza ustawodawcza — wybory, kadencja, prawa posłów i senatorów, tryb uchwalania ustaw i referendum.',
  },
  prezydent: {
    color: '#b91c1c',
    nazwa: 'Prezydent Rzeczypospolitej Polskiej',
    summary: 'Głowa państwa — wybór, kompetencje, relacje z rządem i parlamentem oraz odpowiedzialność.',
  },
  'rada-ministrow': {
    color: '#d97706',
    nazwa: 'Rada Ministrów i administracja rządowa',
    summary: 'Władza wykonawcza — powoływanie rządu, kompetencje premiera i ministrów, administracja rządowa.',
  },
  'samorzad-terytorialny': {
    color: '#1f9d55',
    nazwa: 'Samorząd terytorialny',
    summary: 'Wspólnoty lokalne — gmina, powiat, województwo: ich zadania, samodzielność i finanse.',
  },
  'sady-i-trybunaly': {
    color: '#4f46e5',
    nazwa: 'Sądy i Trybunały',
    summary: 'Władza sądownicza — niezawisłe sądy, Trybunał Konstytucyjny i Trybunał Stanu.',
  },
  'kontrola-panstwowa': {
    color: '#0891b2',
    nazwa: 'Organy kontroli państwowej i ochrony prawa',
    summary: 'Strażnicy państwa — NIK, Rzecznik Praw Obywatelskich i Krajowa Rada Radiofonii i Telewizji.',
  },
  'finanse-publiczne': {
    color: '#ca8a04',
    nazwa: 'Finanse publiczne',
    summary: 'Pieniądze państwa — budżet, dług publiczny, podatki i Narodowy Bank Polski.',
  },
  'stany-nadzwyczajne': {
    color: '#ea580c',
    nazwa: 'Stany nadzwyczajne',
    summary: 'Wyjątkowe sytuacje — stan wojenny, wyjątkowy i klęski żywiołowej — oraz granice ograniczeń praw.',
  },
  'zmiana-konstytucji': {
    color: '#9333ea',
    nazwa: 'Zmiana Konstytucji',
    summary: 'Jak zmienia się ustawę zasadniczą — zaostrzony tryb i szczególne większości.',
  },
  'przepisy-koncowe': {
    color: '#334155',
    nazwa: 'Przepisy przejściowe i końcowe',
    summary: 'Wejście w życie Konstytucji i uporządkowanie prawa na styku starego i nowego ustroju.',
  },
}

export interface Landmark {
  tytul: string
  why: string
}

/** Reflektory na artykuły-kamienie milowe (nr artykułu → krótkie „dlaczego ważny"). */
export const LANDMARKS: Record<number, Landmark> = {
  1: { tytul: 'Dobro wspólne', why: 'Rzeczpospolita to dobro wspólne wszystkich obywateli — punkt wyjścia całej Konstytucji.' },
  2: { tytul: 'Demokratyczne państwo prawne', why: 'Władza działa według prawa, nie ponad nim — z zasadą sprawiedliwości społecznej.' },
  4: { tytul: 'Zwierzchnictwo Narodu', why: 'Władza należy do Narodu, który sprawuje ją przez przedstawicieli lub bezpośrednio.' },
  7: { tytul: 'Zasada legalizmu', why: 'Organy władzy działają wyłącznie na podstawie i w granicach prawa.' },
  8: { tytul: 'Nadrzędność Konstytucji', why: 'Konstytucja jest najwyższym prawem RP i stosuje się ją bezpośrednio.' },
  10: { tytul: 'Trójpodział władzy', why: 'Ustrój opiera się na podziale i równowadze władz: ustawodawczej, wykonawczej i sądowniczej.' },
  25: { tytul: 'Bezstronność światopoglądowa', why: 'Równouprawnienie kościołów i bezstronność państwa w sprawach przekonań.' },
  30: { tytul: 'Godność człowieka', why: 'Przyrodzona i niezbywalna godność — źródło wszystkich wolności i praw, nienaruszalna.' },
  31: { tytul: 'Wolność', why: 'Wolność pod ochroną prawa; ograniczyć ją można tylko ustawą i tylko w koniecznym zakresie.' },
  32: { tytul: 'Równość wobec prawa', why: 'Wszyscy są równi i mają prawo do równego traktowania; zakaz dyskryminacji.' },
  47: { tytul: 'Życie prywatne', why: 'Prawo do ochrony życia prywatnego, rodzinnego i do decydowania o sobie.' },
  54: { tytul: 'Wolność słowa', why: 'Wolność wyrażania poglądów i informacji; zakaz cenzury prewencyjnej.' },
  61: { tytul: 'Prawo do informacji', why: 'Obywatel ma prawo do informacji o działalności organów władzy publicznej.' },
  126: { tytul: 'Prezydent — głowa państwa', why: 'Najwyższy przedstawiciel RP i gwarant ciągłości władzy państwowej.' },
  235: { tytul: 'Zmiana Konstytucji', why: 'Zaostrzony tryb zmiany ustawy zasadniczej — wymaga szczególnych większości.' },
}
