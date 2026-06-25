import { getStore } from "@netlify/blobs";
import Parser from "rss-parser";
import { Resend } from "resend";

// ---- Il system prompt della Fase 1, incollato qui ----
const SYSTEM_PROMPT = `
Sei l'agente di distribuzione editoriale di "The Reconstruction Audit", newsletter bilingue (IT/EN) di Roberta Polenghi Semec.

Voce editoriale — non derogabile:
- Diretta, densa, anti-consolatoria. Mai motivazionale in senso convenzionale.
- Filosoficamente fondata: ogni affermazione ha una struttura logica, non slogan.
- Italiano: usa sempre forme neutre plurali (es. "le persone che lavorano" non "i lavoratori").
- Nessun emoji decorativo, nessun tono da coach motivazionale da social.
- Frasi brevi, ritmo serrato. Niente giri di parole per "addolcire" un concetto.

Quando ricevi un articolo, genera:

1. Post LinkedIn (IT) — 150-200 parole, hook nelle prime due righe, max 3 hashtag pertinenti.
2. Copy carosello LinkedIn (5-7 slide) — una frase forte per slide, progressione tesi → tensione → snodo → conclusione. Indica anche il testo della slide di copertina.
3. Post Telegram (@reconstructionaudit) — più diretto e breve, taglio da "nota interna", può chiudere con una domanda aperta.
4. Traduzione EN dell'articolo — non letterale, riscritta mantenendo il registro anti-consolatorio (resisti alla deriva motivazionale tipica dell'inglese).
5. 3 varianti di hook/teaser (una riga ciascuna).

Cosa NON fare:
- Non ammorbidire le affermazioni scomode dell'articolo originale.
- Non aggiungere CTA generiche ("scopri di più", "seguimi per altri contenuti").
- Non inventare statistiche o citazioni non presenti nell'articolo.

Formato output: sezioni separate e numerate come sopra, pronte per copia-incolla.
`.trim();

export default async () => {
  const SUBSTACK_FEED_URL = process.env.SUBSTACK_FEED_URL;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
  const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

  if (!SUBSTACK_FEED_URL || !ANTHROPIC_API_KEY || !RESEND_API_KEY || !NOTIFY_EMAIL) {
    console.error("Variabili d'ambiente mancanti. Controlla SUBSTACK_FEED_URL, ANTHROPIC_API_KEY, RESEND_API_KEY, NOTIFY_EMAIL.");
    return new Response("Configurazione incompleta", { status: 500 });
  }

  try {
    // 1. Leggi il feed Substack
    const parser = new Parser();
    const feed = await parser.parseURL(SUBSTACK_FEED_URL);

    if (!feed.items || feed.items.length === 0) {
      return new Response("Nessun articolo nel feed", { status: 200 });
    }

    const latest = feed.items[0];

    // 2. Controlla se l'abbiamo già processato (Netlify Blobs come "memoria")
    const store = getStore("agent-state");
    const lastSeenLink = await store.get("last-seen-link");

    if (latest.link === lastSeenLink) {
      return new Response("Nessun nuovo articolo da processare", { status: 200 });
    }

    const articleTitle = latest.title || "Senza titolo";
    const articleText =
      (latest as any)["content:encoded"] || latest.content || latest.contentSnippet || "";

    if (!articleText) {
      console.error("Articolo trovato ma senza contenuto testuale leggibile.");
      return new Response("Articolo senza contenuto", { status: 200 });
    }

    // 3. Chiama Claude per generare i derivati
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Titolo: ${articleTitle}\n\nTesto articolo:\n${articleText}`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Errore chiamata Claude API:", errText);
      return new Response("Errore generazione contenuti", { status: 502 });
    }

    const claudeData = await claudeResponse.json();
    const generatedContent = (claudeData.content || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n\n");

    // 4. Invia l'email con le bozze
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: `Agente Reconstruction Audit <${FROM_EMAIL}>`,
      to: NOTIFY_EMAIL,
      subject: `Bozze pronte: ${articleTitle}`,
      text: `Nuovo articolo rilevato: ${articleTitle}\nLink originale: ${latest.link}\n\n---\n\n${generatedContent}`,
    });

    // 5. Aggiorna la memoria: questo articolo è stato processato
    await store.set("last-seen-link", latest.link);

    return new Response("OK: bozze generate e inviate via email", { status: 200 });
  } catch (err) {
    console.error("Errore imprevisto nell'agente:", err);
    return new Response("Errore imprevisto", { status: 500 });
  }
};

// Esegue ogni 6 ore. Sintassi cron standard.
export const config = {
  schedule: "0 */6 * * *",
};
