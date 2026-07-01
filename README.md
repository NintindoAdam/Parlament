# Parlament — interaktywna mapa sali posiedzeń Sejmu

Interaktywny plan sali Sejmu RP. Najedź na miejsce, aby zobaczyć posła (zdjęcie,
imię i nazwisko, klub, okręg), a po kliknięciu otwórz jego pełny profil.

- **Stack:** Next.js (App Router, statyczny eksport) · TypeScript · Tailwind CSS
- **Dane:** [otwarte API Sejmu RP](https://api.sejm.gov.pl) + biografie z Wikipedii
- **Hosting:** GitHub Pages (build i dane generowane automatycznie przez GitHub Actions)

## Jak to działa

Większość danych nie zmienia się z dnia na dzień, więc nie pobieramy ich w
trakcie działania strony. Zamiast tego skrypt synchronizacji pobiera dane raz i
zapisuje je w projekcie:

- `data/mps.json`, `data/clubs.json`, `data/meta.json` — dane posłów i klubów,
- `data/wiki/{id}.json` — streszczenia biografii,
- `public/photos/{id}.jpg`, `public/photos-mini/{id}.jpg` — zdjęcia.

Strona buduje się ze statycznych plików (`output: 'export'`), więc jest szybka i
nie wymaga serwera.

## Publikacja (GitHub Pages)

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) przy
każdym pushu:

1. uruchamia `npm run sync` — pobiera świeże dane z API Sejmu (krok ten jest
   zarazem testem dostępności API — wynik widać w logach Akcji),
2. buduje statyczną stronę (`npm run build`),
3. publikuje katalog `out/` na GitHub Pages.

W ustawieniach repozytorium wybierz **Settings → Pages → Source: GitHub Actions**.

## Konfiguracja

| Zmienna | Opis | Domyślnie |
| --- | --- | --- |
| `SEJM_TERM` | Numer kadencji Sejmu | `10` |
| `DATA_AS_OF` | Etykieta „stan na" w nagłówku | dzisiejsza data |
| `NEXT_PUBLIC_BASE_PATH` | Prefiks ścieżki (na Pages ustawiany automatycznie) | `` |
