import { getSetting } from "@/lib/settings";

/** آیا کلید OpenAI فعال است؟ */
export async function llmEnabled(): Promise<boolean> {
  return Boolean(await getSetting("openai.api_key"));
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** فراخوانی LLM (OpenAI) — در نبود کلید، null برمی‌گرداند */
export async function llmChat(messages: LlmMessage[], opts?: { temperature?: number; json?: boolean }): Promise<string | null> {
  const apiKey = await getSetting("openai.api_key");
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: opts?.temperature ?? 0.4,
        messages,
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
