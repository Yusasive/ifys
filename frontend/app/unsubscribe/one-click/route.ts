// The List-Unsubscribe target in broadcast emails. Gmail/Yahoo POST here
// (RFC 8058) when someone presses their "Unsubscribe" button; the email
// and signature ride in the query string, and the API checks them.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const res = await fetch(`${API_BASE_URL}/email/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: searchParams.get("e"), token: searchParams.get("t") }),
  });
  return new Response(null, { status: res.ok ? 200 : res.status });
}
