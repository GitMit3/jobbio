# Jobbio

Jobbsökningsverktyg: analysera ditt CV mot ATS-krav, matcha det mot jobbannonser,
skräddarsy ansökningar och håll koll på var du sökt.

**Status:** Steg 1 (CV-upload + ATS-analys) är byggt och går att köra fristående.
Steg 2–4 (jobbmatchning, skräddarsydd ansökan, ansökningsspårning) är inte påbörjade.

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
`/api/analyze-cv`, aldrig direkt med Anthropic.

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
3. Deploya. `api/analyze-cv.js` blir en serverless-funktion med 60 s timeout (`vercel.json`).

## Projektstruktur

```
api/
  analyze-cv.js        POST-endpoint: CV-text in, strukturerad ATS-analys ut
  _lib/claude.js       Anthropic-klient, modellval, felöversättning
  _lib/http.js         JSON-body-läsning och svar (fungerar i både Vercel och Vite)
src/
  App.jsx              Sidlayout och tillstånd (idle / loading / done / error)
  components/
    CvUploader.jsx     Inklistring, .txt-upload, målroll, knappar
    AnalysisResult.jsx Poäng, topplista, nyckelord, sektion för sektion
    ScoreRing.jsx      Poängringen
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

## Så fungerar analysen

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

### Gränser i steg 1

- Text mellan 200 och 60 000 tecken. Längre texter avvisas i stället för att klippas.
- Inget sparas: ingen inloggning, ingen databas, inget CV lagras. Texten skickas
  till Anthropic för analysen och kastas därefter.
