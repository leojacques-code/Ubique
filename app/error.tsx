"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>La page n’a pas pu être chargée.</h1>
      <p>Vos données enregistrées sont conservées.</p>
      <button onClick={reset}>Réessayer</button>
    </main>
  );
}
