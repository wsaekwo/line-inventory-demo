export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
      <p className="font-display text-2xl italic text-ivory">Appraisal Register</p>
      <p className="max-w-sm text-sm text-muted">
        This app is meant to be opened from LINE. Open your LINE Official Account and tap
        &ldquo;New Item&rdquo; on the menu, or the LIFF link the bot sends you.
      </p>
      <code className="mt-4 rounded-tag border border-hairline bg-surface px-3 py-2 font-mono text-xs text-brass">
        /api/webhook — bot backend
      </code>
    </main>
  );
}
