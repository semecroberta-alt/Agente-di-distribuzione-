# Agente di Distribuzione — The Reconstruction Audit

Monitora il feed Substack, e quando esce un nuovo articolo genera con Claude
tutte le bozze di distribuzione (LinkedIn, carosello, Telegram, traduzione EN,
hook) e te le manda via email per la revisione finale. Non pubblica nulla
in autonomia — quella parte resta sempre tua.

## Cosa serve prima di iniziare

1. **Un account Netlify** (gratuito) — se ne hai già uno per la PWA Loop, riusalo.
2. **Una API key Anthropic** — da [console.anthropic.com](https://console.anthropic.com), sezione API Keys. Questo è un costo a consumo (paghi per token usati, non un abbonamento fisso).
3. **Una API key Resend** — registrati gratis su [resend.com](https://resend.com). Il piano free include 100 email al giorno, più che sufficiente. Per iniziare puoi usare il loro indirizzo di test `onboarding@resend.dev` come mittente, senza dover verificare un dominio. Quando vuoi mandare da un indirizzo tipo `agente@reconstructionaudit.com`, verifichi il dominio nel pannello Resend (richiede di aggiungere record DNS).
4. **L'URL del feed RSS di Substack** — di solito è `https://[tuo-sottodominio].substack.com/feed`. Verificalo aprendolo nel browser: deve restituire un XML.

## Setup

1. Carica questa cartella su un repository GitHub (nuovo repo, anche privato).
2. Su Netlify: "Add new site" → "Import an existing project" → collega il repository.
3. Nelle impostazioni del sito Netlify, vai su **Site configuration → Environment variables** e aggiungi:
   - `SUBSTACK_FEED_URL` → l'URL del tuo feed
   - `ANTHROPIC_API_KEY` → la tua chiave Anthropic
   - `RESEND_API_KEY` → la tua chiave Resend
   - `NOTIFY_EMAIL` → l'email dove vuoi ricevere le bozze (la tua)
   - `FROM_EMAIL` → opzionale, lascia vuoto per usare `onboarding@resend.dev`
4. Fai il deploy. Netlify rileva automaticamente la funzione schedulata grazie al blocco `config` nel file della funzione — non serve configurare nulla nel dashboard per il cron.

## Come verificare che funzioni

La funzione è schedulata ogni 6 ore (`0 */6 * * *`). Per testarla subito senza aspettare:
- Vai su **Functions** nel dashboard Netlify, trova `distribute-agent`, e usa il pulsante per eseguirla manualmente (o vai sull'URL della funzione, tipo `https://tuosito.netlify.app/.netlify/functions/distribute-agent`).
- Controlla i log della funzione per eventuali errori.
- Se hai pubblicato un articolo di recente, dovresti ricevere l'email entro pochi secondi.

## Cosa fa la "memoria" dell'agente

Usa **Netlify Blobs** (incluso, gratuito, nessun database esterno da configurare) per ricordare il link dell'ultimo articolo già processato. Così non ti manda la stessa email due volte.

## Modificare il tono o i derivati generati

Il system prompt è nel file `netlify/functions/distribute-agent.mts`, nella costante `SYSTEM_PROMPT`. Modificalo lì e rifai il deploy (basta un push su GitHub, Netlify si aggiorna da solo).

## Limiti da tenere a mente

- L'agente legge solo il **primo** elemento del feed. Se pubblichi due articoli nello stesso intervallo di 6 ore, il secondo viene processato al giro successivo — va bene per il tuo ritmo di pubblicazione attuale, ma tienilo a mente.
- Non pubblica nulla in autonomia: è progettato apposta per fermarsi alla bozza via email. Se in futuro vuoi automatizzare anche la pubblicazione (es. su LinkedIn), è un passo successivo separato — comporta collegare le API di ogni piattaforma, con rischio reputazionale più alto se qualcosa va storto.
- Costi: Claude API a consumo (pochi centesimi per articolo, dipende dalla lunghezza), Resend gratuito sotto i 100 email/giorno, Netlify gratuito per questo volume di esecuzioni.
