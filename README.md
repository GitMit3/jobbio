# Jobbio

Jobbsökningsverktyg: analysera ditt CV mot ATS-krav, matcha det mot jobbannonser,
skräddarsy ansökningar och håll koll på var du sökt.

**Status:** Steg 1 (CV-upload + ATS-analys) och steg 2 (jobbmatchning) är byggda.
Steg 3–4 (skräddarsydd ansökan, ansökningsspårning) är inte påbörjade.

## Teknik

| Del | Val |
| --- | --- |
| Frontend | React 19 + Vite |
| API | Vercel Functions (`/api`), samma handlers körs lokalt via Vite-middleware |
| AI | Anthropic Claude (`claude-opus-5`) med structured outputs |
| Filinläsning | pdf.js och mammoth – körs i webbläsaren, lazy-laddade |
| Data/auth | Supabase – förberett men inte inkopplat ännu |
| Hosting | Vercel |

API-nyckeln till Anthropic ligger enbart på servern. Webbläsaren pratar med
`/api/*`, aldrig direkt med Anthropic.

## Kom igång

```bash
npm install
cp .env.example .env      # fyll i ANTHROPIC_API_KEY
npm run dev               # http://localhost:5173
```

`npm run dev` startar både frontend och API:t – ingen `vercel dev` behövs.
Vite laddar `.env` och skickar in servervariablerna i dev-serverns Node-process
(se `vite.config.js`).

Testa utan eget CV: klicka **Exempel-CV** och sedan **Analysera CV**.

Övriga kommandon:

```bash
npm run build     # produktionsbygge till dist/
npm run preview   # förhandsgranska bygget (utan API:t – det kräver Vercel)
```

## Deploy till Vercel

1. Koppla repot i Vercel. Ramverket detekteras som Vite; inga byggkommandon behöver ändras.
2. Lägg in `ANTHROPIC_API_KEY` som Environment Variable (Production + Preview).
3. Deploya. Varje fil i `api/` blir en serverless-funktion med 60 s timeout (`vercel.json`).

## Projektstruktur

```
api/
  analyze-cv.js        POST: CV-text in, strukturerad ATS-analys ut
  match-job.js         POST: CV + annons in, matchning och kravlista ut
  fetch-job-ad.js      POST: URL in, annonstext ut (SSRF-skyddad)
  _lib/claude.js       Anthropic-klient, modellval, felöversättning
  _lib/http.js         JSON-body-läsning och svar (Vercel och Vite)
  _lib/htmlToText.js   HTML → annonstext, med schema.org JobPosting först
src/
  App.jsx              Flikar, delat CV-tillstånd, resultatvyer
  hooks/
    useAsyncAction.js  status/fel/resultat för ett API-anrop, med avbrott
  components/
    CvUploader.jsx     Inklistring, filuppladdning, målroll
    AnalysisResult.jsx ATS-poäng, topplista, nyckelord, sektion för sektion
    JobAdInput.jsx     Annons via inklistring eller länk
    MatchResult.jsx    Matchningsprocent, motivering, krav grupperade
    ScoreRing.jsx      Poängringen, delad av båda vyerna
  lib/
    api.js             fetch-wrapper mot /api
    extractText.js     PDF/Word/text → ren text, helt i webbläsaren
    supabase.js        Supabase-klient (oanvänd tills vidare)
    sampleCv.js        Exempel-CV för att testa flödet
```

## Filuppladdning

`.pdf`, `.docx`, `.txt` och `.md` läses **i webbläsaren** – filen laddas aldrig
upp till servern. Texten hamnar i textrutan där du kan rätta den innan analysen.
Det speglar också hur ett ATS läser din fil: ser texten trasig ut där, gör den
det i systemet också.

- PDF läses med pdf.js. Textfragment grupperas till rader efter position; en rad
  per rad i originalet, max 20 sidor.
- Word läses med mammoth (`extractRawText`). Formatering, tabeller och textrutor
  förenklas till löpande text.
- Inskannade PDF:er saknar textlager och ger felmeddelande – ingen OCR körs.
- Gamla `.doc`, `.rtf` och `.pages` avvisas med besked om att spara om filen.
- Max 10 MB.

Båda parsers laddas först vid uppladdning, så huvudbundeln påverkas knappt
(~6 kB); pdf.js och mammoth hamnar i egna chunkar.

## Steg 1: Så fungerar ATS-analysen

`api/analyze-cv.js` skickar CV:t till Claude med ett JSON-schema (Zod →
structured outputs), så svaret alltid har samma form:

```jsonc
{
  "overallScore": 62,          // 0–100, sammanvägt
  "summary": "…",
  "topActions": ["…"],         // 3–5 viktigaste åtgärderna
  "atsRisks": ["…"],           // maskinläsbarhet: rubriker, datumformat, spalter …
  "sections": [                // Kontaktuppgifter, Profil, Erfarenhet, Utbildning, Kompetenser …
    {
      "name": "Arbetslivserfarenhet",
      "present": true,
      "score": 55,
      "verdict": "…",
      "strengths": ["…"],
      "suggestions": [{ "issue": "…", "action": "…", "example": "…", "priority": "hög" }]
    }
  ],
  "presentKeywords": ["…"],
  "missingKeywords": [{ "keyword": "SLA", "reason": "…", "priority": "medel" }]
}
```

Modell och tankedjup styrs med `ANTHROPIC_MODEL` och `ANTHROPIC_EFFORT`
(`low` | `medium` | `high` | `xhigh` | `max`, default `medium`). Höj `ANTHROPIC_EFFORT`
om analyserna känns ytliga – det kostar mer och tar längre tid.

## Steg 2: Jobbmatchning

Annonsen klistras in eller hämtas från en länk. `api/match-job.js` skickar CV och
annons till Claude med ett eget JSON-schema och får tillbaka:

```jsonc
{
  "roleTitle": "Backendutvecklare",
  "company": "Acme AB",
  "matchPercent": 62,               // skallkrav väger tyngre än meriterande
  "verdict": "möjlig match",        // stark (75+) | möjlig (45–74) | svag (<45)
  "motivation": "…",
  "requirements": [
    {
      "requirement": "3 års erfarenhet av Node.js",
      "type": "skallkrav",          // eller "meriterande"
      "status": "uppfylls",         // uppfylls | delvis | saknas
      "evidence": "Backendutvecklare sedan 2020",
      "comment": "Ange antal år explicit."
    }
  ]
}
```

UI:t grupperar kraven i uppfylls / uppfylls delvis / saknas. CV:t delas mellan
flikarna – lägg in det en gång under CV-analys, matcha sedan mot flera annonser.

### Hämtning från länk

`api/fetch-job-ad.js` hämtar sidan på servern och plockar ut annonstexten. Den
letar först efter schema.org `JobPosting` i JSON-LD, vilket många jobbsajter
lägger in – det ger ren annonstext utan menyer. Saknas den används sidans
`<body>`, och användaren varnas om att rensa bort det som inte hör till annonsen.

Eftersom URL:en kommer från användaren och hämtas av vår server är den
SSRF-skyddad: bara http/https, DNS-slagning kontrolleras mot privata och
interna adressintervall (inklusive molnmetadata på 169.254.169.254), och varje
omdirigering kontrolleras om – max tre hopp, 3 MB och 12 sekunder.

Alla sajter går inte att hämta. Sidor som kräver inloggning eller renderar
annonsen med JavaScript ger ett tydligt besked om att klistra in texten istället.

### Gränser

- CV-text mellan 200 och 60 000 tecken, annonstext mellan 100 och 40 000. Längre texter avvisas i stället för att klippas.
- Inget sparas: ingen inloggning, ingen databas. Texterna skickas till Anthropic
  för analysen och kastas därefter.
