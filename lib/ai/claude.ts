import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non configurata");
  }
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export interface StreamChatOptions {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}

/**
 * Stream a chat response from Claude.
 * Returns a ReadableStream of SSE-formatted chunks.
 * NOTE: does NOT send a "done" event — the caller (chat/route.ts) handles that.
 */
export function streamChat({
  systemPrompt,
  messages,
  maxTokens = 2048,
}: StreamChatOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const client = getAnthropic();
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6-20250514",
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({
              type: "text",
              content: event.delta.text,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        // Do NOT send "done" here — the caller handles it
        controller.close();
      } catch (error) {
        console.error("[claude.ts] Stream error:", error);
        const msg =
          error instanceof Error ? error.message : "Errore AI sconosciuto";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", content: msg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });
}

/**
 * Non-streaming call to Claude for structured JSON responses.
 */
export async function chatJSON<T>(options: {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<T> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: options.maxTokens ?? 2048,
    system: options.systemPrompt,
    messages: [{ role: "user", content: options.userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON from response (handles ```json ... ``` blocks)
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Risposta AI non contiene JSON valido");
  }
  const jsonStr = jsonMatch[1] ?? jsonMatch[0];
  return JSON.parse(jsonStr) as T;
}
