export async function GET() {
  return new Response("# mock metrics\n", { status: 200, headers: { "Content-Type": "text/plain" }});
}
