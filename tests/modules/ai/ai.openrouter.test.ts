import { env } from "../../../src/config/env";
import { callOpenRouter } from "../../../src/modules/ai/ai.openrouter";

describe("callOpenRouter", () => {
  const originalKey = env.openrouterApiKey;
  const originalModel = env.openrouterModel;
  const originalAppUrl = env.appUrl;

  afterEach(() => {
    env.openrouterApiKey = originalKey;
    env.openrouterModel = originalModel;
    env.appUrl = originalAppUrl;
    jest.restoreAllMocks();
  });

  it("uses the configured model and supports JSON multimodal requests", async () => {
    env.openrouterApiKey = "test-openrouter-key";
    env.openrouterModel = "test/model";
    env.appUrl = "https://bran.example";

    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await callOpenRouter({
      systemPrompt: "Return JSON",
      userPrompt: "Analyze this",
      maxTokens: 100,
      temperature: 0.1,
      json: true,
      images: [{ buffer: Buffer.from("image"), mimetype: "image/png" }]
    });

    expect(result).toBe('{"ok":true}');
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.model).toBe("test/model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content[1].image_url.url).toMatch(
      /^data:image\/png;base64,/
    );
    expect((request?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-openrouter-key"
    );
  });

  it("returns a useful error without exposing the API key", async () => {
    env.openrouterApiKey = "secret-openrouter-key";
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "insufficient credits" } }), {
        status: 402,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(
      callOpenRouter({
        systemPrompt: "system",
        userPrompt: "user",
        maxTokens: 10,
        temperature: 0
      })
    ).rejects.toThrow("insufficient credits");
  });
});
