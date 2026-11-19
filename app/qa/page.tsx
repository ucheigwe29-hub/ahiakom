import { notFound } from "next/navigation";
export default function QA() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main style={{ padding: 20 }}>
      <h1>Responsive QA — 390px viewport</h1>
      <p>
        Development-only frame. The storefront below runs at an actual 390px CSS
        viewport.
      </p>
      <iframe
        title="Ahiakom mobile preview"
        src="/"
        style={{
          width: 390,
          height: 844,
          border: "1px solid #ccc",
          borderRadius: 16,
        }}
      />
    </main>
  );
}
