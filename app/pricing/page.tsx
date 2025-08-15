export default function Pricing() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Pricing</h1>
      <ul className="space-y-4">
        <li className="border rounded p-4">
          <h2 className="font-semibold">Free</h2>
          <p>10 checks / month. No LLM. Core evidence aggregation.</p>
        </li>
        <li className="border rounded p-4">
          <h2 className="font-semibold">Pro</h2>
          <p>LLM cross-check, multilingual embeddings & translations. Priority queue.</p>
        </li>
      </ul>
    </main>
  );
}
