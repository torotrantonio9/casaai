export const metadata = {
  title: "Privacy Policy - CasaAI",
  description: "Informativa sulla privacy di CasaAI ai sensi del GDPR",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        Informativa sulla Privacy
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Ultimo aggiornamento: 19 marzo 2026
      </p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            1. Titolare del Trattamento
          </h2>
          <p>
            Il Titolare del trattamento dei dati personali è CasaAI S.r.l., con
            sede legale in Italia. Per qualsiasi comunicazione relativa al
            trattamento dei dati personali è possibile contattare il Titolare
            all&apos;indirizzo email: privacy@casaai.it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            2. Responsabile della Protezione dei Dati (DPO)
          </h2>
          <p>
            Il Responsabile della Protezione dei Dati è contattabile
            all&apos;indirizzo: dpo@casaai.it. Il DPO è a disposizione per
            qualsiasi chiarimento in merito al trattamento dei dati personali.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            3. Dati Personali Raccolti
          </h2>
          <p>CasaAI raccoglie le seguenti categorie di dati personali:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Dati di registrazione:</strong> nome, cognome, indirizzo
              email, numero di telefono, ruolo (acquirente o agente immobiliare).
            </li>
            <li>
              <strong>Dati di navigazione:</strong> indirizzo IP, tipo di
              browser, pagine visitate, orari di accesso, dati raccolti tramite
              cookie e tecnologie similari.
            </li>
            <li>
              <strong>Dati relativi agli annunci:</strong> informazioni sugli
              immobili pubblicati, fotografie, indirizzi, prezzi.
            </li>
            <li>
              <strong>Dati di comunicazione:</strong> messaggi scambiati
              attraverso la piattaforma tra acquirenti e agenzie.
            </li>
            <li>
              <strong>Dati di pagamento:</strong> elaborati direttamente da
              Stripe Inc. in qualità di responsabile del trattamento. CasaAI non
              memorizza dati di carte di credito.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            4. Finalità e Base Giuridica del Trattamento
          </h2>
          <p>I dati personali sono trattati per le seguenti finalità:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Esecuzione del contratto (Art. 6.1.b GDPR):</strong>{" "}
              registrazione, gestione account, pubblicazione annunci, gestione
              lead, elaborazione pagamenti.
            </li>
            <li>
              <strong>Legittimo interesse (Art. 6.1.f GDPR):</strong> analisi
              statistiche aggregate per il miglioramento del servizio, prevenzione
              frodi, sicurezza della piattaforma.
            </li>
            <li>
              <strong>Consenso (Art. 6.1.a GDPR):</strong> invio di
              comunicazioni commerciali, profilazione tramite AI per suggerimenti
              personalizzati.
            </li>
            <li>
              <strong>Obbligo legale (Art. 6.1.c GDPR):</strong> adempimento di
              obblighi fiscali e normativi.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            5. Trattamento tramite Intelligenza Artificiale
          </h2>
          <p>
            CasaAI utilizza sistemi di intelligenza artificiale per fornire
            suggerimenti personalizzati nella ricerca di immobili, valutazioni
            automatiche del valore degli immobili e generazione di descrizioni.
            Tali trattamenti si basano su dati aggregati e anonimizzati. Le
            valutazioni AI sono indicative e non costituiscono perizia
            professionale.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            6. Conservazione dei Dati
          </h2>
          <p>
            I dati personali sono conservati per il tempo strettamente necessario
            alle finalità per cui sono stati raccolti. I dati degli account
            vengono conservati fino alla cancellazione dell&apos;account da parte
            dell&apos;utente. I dati relativi alle transazioni vengono conservati
            per 10 anni come previsto dalla normativa fiscale italiana.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            7. Diritti dell&apos;Interessato
          </h2>
          <p>
            Ai sensi degli artt. 15-22 del GDPR, l&apos;interessato ha diritto
            di:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Accedere ai propri dati personali (Art. 15).</li>
            <li>Rettificare i dati inesatti (Art. 16).</li>
            <li>
              Ottenere la cancellazione dei dati (&quot;diritto all&apos;oblio&quot;, Art.
              17).
            </li>
            <li>Limitare il trattamento (Art. 18).</li>
            <li>
              Ricevere i dati in formato strutturato e portabile (Art. 20).
            </li>
            <li>Opporsi al trattamento (Art. 21).</li>
            <li>
              Non essere sottoposto a decisioni basate esclusivamente su
              trattamento automatizzato (Art. 22).
            </li>
          </ul>
          <p className="mt-2">
            Per esercitare i propri diritti, scrivere a: privacy@casaai.it. È
            inoltre possibile esportare i propri dati dalla sezione Account del
            proprio profilo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            8. Cookie Policy
          </h2>
          <p>CasaAI utilizza le seguenti categorie di cookie:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Cookie tecnici (necessari):</strong> essenziali per il
              funzionamento della piattaforma, autenticazione e sicurezza.
            </li>
            <li>
              <strong>Cookie analitici:</strong> utilizzati per raccogliere dati
              statistici anonimi sull&apos;utilizzo del sito.
            </li>
            <li>
              <strong>Cookie di preferenza:</strong> per memorizzare le
              preferenze di ricerca e le impostazioni dell&apos;utente.
            </li>
          </ul>
          <p className="mt-2">
            È possibile gestire le preferenze sui cookie in qualsiasi momento
            attraverso le impostazioni del browser.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            9. Trasferimento Dati Extra-UE
          </h2>
          <p>
            Alcuni dati possono essere trasferiti verso paesi terzi (USA) per
            l&apos;utilizzo di servizi cloud (Supabase, Vercel) e di AI (Anthropic,
            OpenAI). Tali trasferimenti avvengono sulla base di clausole
            contrattuali tipo approvate dalla Commissione Europea (Art. 46.2.c
            GDPR).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            10. Contatti e Reclami
          </h2>
          <p>
            Per qualsiasi domanda o reclamo relativo al trattamento dei dati
            personali è possibile contattare: privacy@casaai.it. L&apos;interessato
            ha inoltre diritto di proporre reclamo all&apos;Autorità Garante per la
            Protezione dei Dati Personali (www.garanteprivacy.it).
          </p>
        </section>
      </div>
    </div>
  );
}
