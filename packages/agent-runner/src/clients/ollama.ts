type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function chatOllama(opts: {
  model?: string;
  messages: Msg[];
  baseUrl?: string;
  temperature?: number;
}) {
  const {
    model = "llama3.1:8b",
    messages,
    baseUrl = "http://localhost:11434",
    temperature = 0,
  } = opts;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature },
    }),
  });
  if (!res.ok) throw new Error(`LLM error: ${res.status}`);
  const data: any = await res.json();

  // chat API returns { message: { role, content }, ... }
  const content =
    data?.message?.content ??
    data?.response ?? // fallback if server returns a 'response' field
    "";
  return String(content);
}
