export default function Setup() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Setup required</h1>
      <ol className="list-decimal ml-6 space-y-2">
        <li>Set <code>TAVILY_API_KEY</code> and <code>SEARCH_PROVIDERS</code> in <code>.env.local</code>.</li>
        <li>Run <code>pnpm prisma:gen</code> and <code>pnpm prisma:migrate</code>.</li>
        <li>Restart the dev server.</li>
      </ol>
    </main>
  );
}
