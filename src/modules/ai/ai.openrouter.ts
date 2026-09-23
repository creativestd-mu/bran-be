import { env } from "../../config/env";

export type OpenRouterImage = {
  buffer: Buffer;
  mimetype: string;
};

export async function callOpenRouter(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  json?: boolean;
  images?: OpenRouterImage[];
}): Promise<string> {
  if (!env.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const images = params.images ?? [];
  const userContent =
    images.length === 0
      ? params.userPrompt
      : [
          { type: "text", text: params.userPrompt },
          ...images.map((image) => ({
            type: "image_url",
            image_url: {
              url: `data:${image.mimetype};base64,${image.buffer.toString("base64")}`
            }
          }))
        ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.appUrl || "https://bran.app",
      "X-Title": "Bran"
    },
    body: JSON.stringify({
      model: env.openrouterModel,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      ...(params.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: userContent }
      ]
    })
  });

  const body = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{
      message?: { content?: string | Array<{ type?: string; text?: string }> };
    }>;
  };

  if (!response.ok) {
    throw new Error(body.error?.message || `OpenRouter returned status ${response.status}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("");
  }
  return "";
}
