"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
export default function Support() {
  const [tickets, setTickets] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("support/tickets")
      .then((d) => setTickets(d.tickets))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="panel narrow">
      <span className="overline">CUSTOMER CARE</span>
      <h1>Let’s work it out.</h1>
      <p>
        Send a test support request. Replies appear here; no email or SMS is
        sent.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError("");
          try {
            await api("support/tickets", "POST", d);
            await load();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Subject
          <input name="subject" required minLength={3} maxLength={150} />
        </label>
        <label>
          How can we help?
          <textarea name="message" required minLength={10} maxLength={3000} />
        </label>
        <button className="primary" disabled={busy}>
          Send test request
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <h2 style={{ marginTop: 30 }}>Your requests</h2>
      {tickets.map((t) => (
        <article className="order-card" key={t.id}>
          <strong>{t.subject}</strong>
          <span className="status">{t.status}</span>
          <p>{t.message}</p>
          {t.reply && (
            <p>
              <strong>Support reply:</strong> {t.reply}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
