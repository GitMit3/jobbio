# Jobbio

Jobbsökningsverktyg: analysera ditt CV mot ATS-krav, matcha det mot jobbannonser,
skräddarsy ansökningar och håll koll på var du sökt.

**Status:** Alla fyra steg är byggda – ATS-analys, jobbmatchning, skräddarsydd
ansökan och ansökningsspårning.

## Teknik

| Del | Val |
| --- | --- |
| Frontend | React 19 + Vite |
| API | Vercel Functions (`/api`), samma handlers körs lokalt via Vite-middleware |
| AI | Anthropic Claude (`claude-opus-5`) med structured outputs |
| Filinläsning | pdf.js och mammoth – körs i webbläsaren, lazy-laddade |
| Data/auth | Supabase (Postgres + auth), används av ansökningsspårningen |
| Typsnitt | Archivo (rubriker) och Inter (brödtext) via Google Fonts |
| Hosting | Vercel |

API-nyckeln till Anthropic ligger enbart på servern. Webbläsaren pratar med
`/api/*`, aldrig direkt med Anthropic.

## Tre körlägen

Läget väljs uppe till höger och sparas i webbläsaren. Alla tre använder samma
prompter och scheman ur `shared/` – skillnaden är bara vägen fram till modellen.

**Manuellt (standard).** Appen bygger prompten, du kopierar den och kör den i
Claude.ai, och klistrar tillbaka svaret. Ingen nyckel, ingen kostnad. Priset är
två klipp-och-klistra per körning.

**Claude Code (bara lokalt).** Ett knapptryck, som API-läget, men prompten körs
genom din lokala Claude Code i headless-läge (`claude -p`). Autentiseringen är
din vanliga inloggning, så analysen går mot **abonnemanget** i stället för
API-krediter. Kräver att Claude Code är installerat och inloggat:

```bash
npm install -g @anthropic-ai/claude-code
claude          # logga in, avsluta sedan
claude --version
```

Läget är avsiktligt spärrat till utvecklingsmiljön. `vite.config.js` sätter
`JOBBIO_LOCAL_RUNTIME=1` när dev-servern startar, och `api/claude-code.js`
svarar 403 utan den – en deploy har ingen CLI att anropa och ska inte låtsas
annat. Räkna med 60–120 sekunder per körning; hela Claude Code-runtimen startar
per anrop. Valfria inställningar i `.env`: `JOBBIO_LOCAL_MODEL`,
`JOBBIO_LOCAL_EFFORT`, `JOBBIO_LOCAL_TIMEOUT_MS`.

**API.** Analysen körs mot Anthropic med din nyckel. Kräver krediter på
[console.anthropic.com](https://console.anthropic.com/settings/keys); ett Claude
Pro- eller Max-abonnemang ger inte API-tillgång. Det här är det enda automatiska
läget som fungerar i en deploy.

Skillnaden i hur schemat framtvingas: API-läget använder structured outputs, så
Anthropic garanterar formen. De andra två skickar med schemat i klartext och
validerar svaret med Zod – därför kan de klaga på formatet, vilket API-läget
aldrig gör.

## Kom igång

```bash
npm install
npm run dev               # http://localhost:5173
```

Det räcker för manuellt läge och flikarna 01–03. För API-läget och för
ansökningsspårningen behövs `.env`:

```bash
cp .env.example .env
```

- **API-läge:** fyll i `ANTHROPIC_API_KEY`.
- **Claude Code-läge:** ingen konfiguration alls, bara Claude Code installerat.
- **Ansökningsspårning:** fyll i `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY`,
  se nästa avsnitt.

`npm run dev` startar både frontend och API:t – ingen `vercel dev` behövs.
Vite laddar `.env` och skickar in servervariablerna i dev-serverns Node-process
(se `vite.config.js`).

Testa utan eget CV: klicka **Exempel-CV** och sedan knappen under textrutan.

Övriga kommandon:

```bash
npm run build     # produktionsbygge till dist/
npm run preview   # förhandsgranska bygget (utan API:t – det kräver Vercel)
```

## Supabase

Behövs bara för flik 04. Utan konfiguration fungerar resten av appen som vanligt
och fliken visar en instruktion i stället för att krascha.

1. Skapa ett projekt på [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → klistra in `supabase/schema.sql` → **Run**.
   Skriptet skapar tabellen `applications`, indexet, RLS-reglerna och en trigger
   för `updated_at`. Det går att köra om utan att data försvinner.
3. **Project Settings → API** → kopiera *Project URL* och *anon public*-nyckeln
   till `VITE_SUPABASE_URL` respektive `VITE_SUPABASE_ANON_KEY` i `.env`.
4. **Authentication → Providers → Email**: stäng av *Confirm email* om du vill
   kunna skapa konto och logga in direkt utan att vänta på ett mejl. Låter du det
   vara på behöver du klicka bekräftelselänken innan första inloggningen.
5. Starta om `npm run dev` – Vite läser `.env` vid uppstart.

Anon-nyckeln är avsedd att ligga i webbläsaren; det som skyddar data är
**Row Level Security**. Varje policy i schemat kräver `auth.uid() = user_id`, så
en inloggad användare kan bara läsa och ändra sina egna rader. Kör du inte
`schema.sql` finns inga policies, och då släpper Postgres inte igenom någonting
alls.

## Deploy till Vercel

1. Koppla repot i Vercel. Ramverket detekteras som Vite; inga byggkommandon behöver ändras.
2. Lägg in `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY`
   som Environment Variables (Production + Preview).
3. Deploya. Varje fil i `api/` blir en serverless-funktion med 60 s timeout (`vercel.json`).

## Projektstruktur

```
api/
  analyze-cv.js        POST: CV-text in, strukturerad ATS-analys ut
  match-job.js         POST: CV + annons in, matchning och kravlista ut
  fetch-job-ad.js      POST: URL in, annonstext ut (SSRF-skyddad)
  tailor-application.js POST: CV + annons in, CV-utdrag och brev ut
  claude-code.js       POST: kör vilken som helst av prompterna via lokal CLI
  _lib/claudeCode.js   Startar `claude -p`, dev-spärr, felöversättning
  _lib/claude.js       Anthropic-klient, modellval, felöversättning
  _lib/http.js         JSON-body-läsning och svar (Vercel och Vite)
  _lib/htmlToText.js   HTML → annonstext, med schema.org JobPosting först
supabase/
  schema.sql           Tabell, index, RLS-policies och updated_at-trigger
shared/
  atsAnalysis.js       Schema och prompt för ATS-analysen
  jobMatch.js          Schema och prompt för jobbmatchningen
  application.js       Schema, prompt och textrendering för ansökan
  cvDocument.js        Tolkar CV-text till struktur för mallar och export
  improveCv.js         Schema och prompt för att genomföra valda förslag
  manualMode.js        Bygger manuell prompt, validerar inklistrat svar
src/
  App.jsx              Flikar, lägesväxling, delat CV-tillstånd
  hooks/
    useFeatureRun.js   Driver en analys i något av de tre körlägena
    useAuth.js         Håller Supabase-sessionen
  components/
    CvUploader.jsx     Inklistring, filuppladdning, målroll
    AnalysisResult.jsx ATS-poäng, topplista, nyckelord, sektion för sektion
    JobAdInput.jsx     Annons via inklistring eller länk
    MatchResult.jsx    Matchningsprocent, motivering, krav grupperade
    ApplicationInputs.jsx  Underlagskoll och start av ansökan
    ApplicationResult.jsx  Redigerbara dokument, platshållare, export
    ApplicationsBoard.jsx  Dashboard: lägg till, filtrera, byt status, ta bort
    AuthPanel.jsx      Inloggning och kontoskapande
    ManualRunner.jsx   Kopiera prompt, klistra tillbaka svar
    ScoreMeter.jsx     Poängen som randmått, delad av båda vyerna
    ImprovedCv.jsx     Omskrivet CV, ändringar, platshållare
    CvExport.jsx       Mallval, förhandsvisning och nedladdning
    CvPreview.jsx      CV:t satt i vald mall – samma markup på skärm och papper
  lib/
    api.js             fetch-wrapper mot /api
    applications.js    CRUD mot Supabase, statusvärden, felöversättning
    export.js          Kopiering, nedladdning, ordräkning
    cvTemplates.js     Mallarnas metadata och blockgruppering
    docxExport.js      Bygger .docx (lazy-laddad)
    suggestions.js     Vilka förslag som går att kryssa i
    extractText.js     PDF/Word/text → ren text, helt i webbläsaren
    supabase.js        Supabase-klient, null när konfiguration saknas
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

### Åtgärda förslagen

Varje förslag, åtgärd och saknat nyckelord i analysen har en kryssruta. Välj det
du vill genomföra och tryck **Åtgärda** – `api/improve-cv.js` skriver om CV:t
enligt just de valda punkterna och lämnar resten orört.

Resultatet är ett redigerbart CV plus tre listor: **ändringar** (före och efter
för varje rad som rörts), **platshållare** att fylla i själv, och **gick inte att
genomföra** – valda förslag som skulle ha krävt påhittade uppgifter, med skäl.
Det sista är avsiktligt synligt: modellen ska hellre erkänna att den inte kan
än att gissa fram en merit.

**Använd som mitt CV** ersätter texten i vänsterspalten, så du kan analysera om
och se hur poängen förändras.

Känd begränsning: modellen sätter fler platshållare än den ombeds. Prompten
säger max sex och att befintliga uppgifter aldrig ska bytas mot platshållare,
men i mätning landade den på tio och gjorde ändå om "2021 - nu" till
"2021-[startmånad]". Välj färre förslag åt gången om det blir för många hål –
och kom ihåg att texten är redigerbar.

### Mallar och export

Det omskrivna CV:t kan laddas ner som **text**, **Word** eller **PDF**, i tre
mallar: Klassisk, Modern och Kompakt. Valet sparas i webbläsaren.

Mallarna är avsiktligt **enspaltiga, utan tabeller, textrutor eller ikoner**.
Tvåspaltiga CV ser snyggare ut men läses ofta sönder av ett ATS – kolumnerna
flätas ihop till obegriplig text – och hela appen går ut på att komma igenom
just ett ATS. Skillnaden mellan mallarna ligger därför i typografi och rytm:
serif mot sans, centrerat mot vänsterställt, accentfärg, och radtäthet.

- **PDF** går via webbläsarens utskriftsdialog (*Spara som PDF*). Det ger ett
  riktigt textlager som går att markera och söka i. Ett PDF renderat som bild
  hade varit osynligt för ett ATS.
- **Word** byggs med `docx` och använder Words egna rubrikstilar och riktiga
  punktlistor – inte manuella bindestreck – eftersom det är den strukturen en
  parser letar efter. Biblioteket laddas först när du klickar, så huvudbundeln
  påverkas inte.

`shared/cvDocument.js` tolkar den rena texten till struktur: namn, titel,
kontaktrader, sektionsrubriker i versaler, poster med datum, och punkter.
Det som inte känns igen blir vanlig text i stället för att tappas bort.

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

## Steg 3: Skräddarsydd ansökan

Utgår från CV:t och annonsen som redan ligger i appen – inget behöver klistras in
igen. `api/tailor-application.js` returnerar:

```jsonc
{
  "roleTitle": "Kundsupportspecialist",
  "company": "Nordic SaaS AB",
  "cvSummary": "…",                 // omskriven profiltext, 3–4 meningar
  "cvBullets": [
    {
      "rewritten": "Hanterade [antal] ärenden per vecka i mejl och telefon.",
      "basis": "Ansvarig för support till kunder via mejl och telefon",
      "requirement": "2 års erfarenhet av förstalinjesupport"
    }
  ],
  "coverLetter": { "greeting": "…", "opening": "…", "body": ["…"], "closing": "…", "signoff": "…" },
  "keywordsUsed": ["förstalinjesupport", "SLA"],
  "placeholders": [{ "marker": "[antal]", "what": "Antal ärenden per vecka." }]
}
```

**Inget hittas på.** Prompten förbjuder påhittad erfarenhet, kompetens och
siffror; allt ska gå att spåra till CV:t. Saknas ett mätvärde som skulle göra
texten starkare skrivs en platshållare i hakparenteser i stället för en gissning,
och den listas under `placeholders`. Uppfyller CV:t inte ett krav utelämnas
kravet hellre än att texten tänjer på sanningen.

UI:t sätter ihop fälten till två redigerbara dokument – CV-utdrag och personligt
brev. Platshållarna visas som en checklista som bockas av allteftersom du ersätter
dem i texten, `basis` visar vad varje punkt bygger på i ditt CV, och **Återställ**
tar tillbaka den genererade versionen. Export sker som kopiering eller nedladdning
till `.txt`; filnamnet innehåller roll och företag.

## Steg 4: Ansökningsspårning

Kräver inloggning. Varje rad har företag, roll, datum, status, länk till annonsen
och en fri anteckning. Statusarna är `skickad`, `svar`, `intervju` och `avslag` –
samma fyra i UI:t, i `src/lib/applications.js` och i check-villkoret i
`schema.sql`.

Räknarna högst upp fungerar som filter: klicka på en status för att bara se de
ansökningarna. Statusbyte sparas direkt via en `select` i raden.

Statusbyten och borttagningar är **optimistiska** – UI:t uppdateras först och
rullas tillbaka om Supabase säger nej, med felet synligt. Det gör listan
följsam utan att ljuga om vad som faktiskt sparats.

### Gränser

- CV-text mellan 200 och 60 000 tecken, annonstext mellan 100 och 40 000. Längre texter avvisas i stället för att klippas.
- Ansökan exporteras som `.txt`. PDF och Word finns inte ännu.
- CV, annons och ansökningstext sparas inte någonstans. De skickas till Anthropic
  för analysen och kastas därefter, och redigeringar lever bara i fliken – laddar
  du om sidan är de borta. Bara ansökningsspårningen lagrar data, och då i din
  egen Supabase.
- Ansökningarna kan inte redigeras i efterhand annat än status. Fel i företag
  eller roll får tas bort och läggas till på nytt.

## Design

Svart botten, rött som enda accent, benvitt som text – Milans rossoneri. De
röd-svarta ränderna är bärande snarare än dekorativa: de återkommer i loggan,
som kant på framhävda paneler, och i poängmåttet där varje rand är fem poäng.

Uttrycket är redaktionellt: skarpa hörn, hårfina linjer, ingen mjuk skuggning.
Rubriker och etiketter sätts i Archivo med versaler och spärrad tracking, all
data i monospace så siffror står i kolumn. Numrerade flikar (`01`, `02`) och
sektioner ger dokumentkänsla i stället för app-känsla.

Färgerna gör två jobb samtidigt, så de hålls isär: rött är varumärket och
används strukturellt, medan status har egna hues – grönt för uppfyllt, gult för
delvis, rött för saknat. Poängmåttet byter färg med nivån så att en svag poäng
syns innan du hunnit läsa siffran.
