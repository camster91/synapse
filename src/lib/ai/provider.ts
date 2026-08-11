import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/security/secrets';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  model?: string;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string | null;
  toolCalls: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  streamChat(messages: ChatMessage[], options?: ChatOptions): ReadableStream<Uint8Array>;
}

// ─── Model Shorthand Mapping ──────────────────────────────────────────────────

const MODEL_MAP: Record<string, Record<string, string>> = {
  anthropic: {
    claude: 'claude-sonnet-4-20250514',
    'claude-sonnet': 'claude-sonnet-4-20250514',
    'claude-opus': 'claude-opus-4-20250514',
    'claude-haiku': 'claude-haiku-4-20250414',
  },
  openai: {
    gpt4: 'gpt-4o',
    'gpt-4': 'gpt-4o',
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4-turbo',
    o1: 'o1',
    'o1-mini': 'o1-mini',
    'o3-mini': 'o3-mini',
  },
  ollama: {
    local: 'llama3.1',
    llama: 'llama3.1',
    'llama3': 'llama3.1',
    'llama3.1': 'llama3.1',
    mistral: 'mistral',
    codellama: 'codellama',
    phi3: 'phi3',
  },
};

export function resolveModel(providerName: string, modelShorthand: string): string {
  const providerMap = MODEL_MAP[providerName];
  if (!providerMap) return modelShorthand;
  return providerMap[modelShorthand] ?? modelShorthand;
}

// ─── Anthropic Provider ───────────────────────────────────────────────────────

class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const model = resolveModel('anthropic', options?.model ?? 'claude');

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const systemContent = [
      ...systemMessages.map((m) => m.content),
      options?.systemPrompt ?? '',
    ].filter(Boolean).join('\n\n');

    const toolDefs = options?.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: systemContent || undefined,
      messages: nonSystemMessages.map((m) => {
        if (m.role === 'tool' && m.tool_call_id) {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: m.tool_call_id,
                content: m.content,
              },
            ],
          };
        }
        if (m.role === 'assistant' && m.tool_calls?.length) {
          return {
            role: 'assistant' as const,
            content: [
              ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ...m.tool_calls.map((tc) => ({
                type: 'tool_use' as const,
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments),
              })),
            ],
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      }),
      tools: toolDefs?.length ? toolDefs : undefined,
    });

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const toolCalls: ToolCall[] = response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
      .map((block) => ({
        id: block.id,
        type: 'function' as const,
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      }));

    return {
      content: textContent || null,
      toolCalls,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
    };
  }

  streamChat(messages: ChatMessage[], options?: ChatOptions): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream({
      start: async (controller) => {
        try {
          const model = resolveModel('anthropic', options?.model ?? 'claude');

          const systemMessages = messages.filter((m) => m.role === 'system');
          const nonSystemMessages = messages.filter((m) => m.role !== 'system');

          const systemContent = [
            ...systemMessages.map((m) => m.content),
            options?.systemPrompt ?? '',
          ].filter(Boolean).join('\n\n');

          const toolDefs = options?.tools?.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
          }));

          const stream = this.client.messages.stream({
            model,
            max_tokens: options?.maxTokens ?? 4096,
            temperature: options?.temperature ?? 0.7,
            system: systemContent || undefined,
            messages: nonSystemMessages.map((m) => {
              if (m.role === 'tool' && m.tool_call_id) {
                return {
                  role: 'user' as const,
                  content: [
                    {
                      type: 'tool_result' as const,
                      tool_use_id: m.tool_call_id,
                      content: m.content,
                    },
                  ],
                };
              }
              if (m.role === 'assistant' && m.tool_calls?.length) {
                return {
                  role: 'assistant' as const,
                  content: [
                    ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
                    ...m.tool_calls.map((tc) => ({
                      type: 'tool_use' as const,
                      id: tc.id,
                      name: tc.function.name,
                      input: JSON.parse(tc.function.arguments),
                    })),
                  ],
                };
              }
              return {
                role: m.role as 'user' | 'assistant',
                content: m.content,
              };
            }),
            tools: toolDefs?.length ? toolDefs : undefined,
          });

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const chunk = JSON.stringify({
                type: 'text',
                text: event.delta.text,
              });
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
            } else if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
          }

          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`));
          controller.close();
        }
      },
    });
  }
}

// ─── OpenAI Provider ─────────────────────────────────────────────────────────

class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const model = resolveModel('openai', options?.model ?? 'gpt4');

    const allMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      allMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      if (m.role === 'system' && !options?.systemPrompt) {
        allMessages.push({ role: 'system', content: m.content });
      } else if (m.role === 'tool' && m.tool_call_id) {
        allMessages.push({
          role: 'tool',
          content: m.content,
          tool_call_id: m.tool_call_id,
        });
      } else if (m.role === 'assistant' && m.tool_calls?.length) {
        allMessages.push({
          role: 'assistant',
          content: m.content ?? null,
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });
      } else if (m.role === 'user' || m.role === 'assistant') {
        allMessages.push({ role: m.role, content: m.content });
      }
    }

    const toolDefs = options?.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model,
      messages: allMessages,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      tools: toolDefs?.length ? toolDefs : undefined,
    });

    const choice = response.choices[0];
    const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? [])
      .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => tc.type === 'function')
      .map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

    return {
      content: choice?.message?.content ?? null,
      toolCalls,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
          }
        : undefined,
    };
  }

  streamChat(messages: ChatMessage[], options?: ChatOptions): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream({
      start: async (controller) => {
        try {
          const model = resolveModel('openai', options?.model ?? 'gpt4');

          const allMessages: OpenAI.ChatCompletionMessageParam[] = [];
          if (options?.systemPrompt) {
            allMessages.push({ role: 'system', content: options.systemPrompt });
          }

          for (const m of messages) {
            if (m.role === 'system' && !options?.systemPrompt) {
              allMessages.push({ role: 'system', content: m.content });
            } else if (m.role === 'tool' && m.tool_call_id) {
              allMessages.push({
                role: 'tool',
                content: m.content,
                tool_call_id: m.tool_call_id,
              });
            } else if (m.role === 'assistant' && m.tool_calls?.length) {
              allMessages.push({
                role: 'assistant',
                content: m.content ?? null,
                tool_calls: m.tool_calls.map((tc) => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                })),
              });
            } else if (m.role === 'user' || m.role === 'assistant') {
              allMessages.push({ role: m.role, content: m.content });
            }
          }

          const toolDefs = options?.tools?.map((t) => ({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          }));

          const stream = await this.client.chat.completions.create({
            model,
            messages: allMessages,
            max_tokens: options?.maxTokens ?? 4096,
            temperature: options?.temperature ?? 0.7,
            tools: toolDefs?.length ? toolDefs : undefined,
            stream: true,
          });

          const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            const delta = choice?.delta;
            if (delta?.content) {
              const data = JSON.stringify({ type: 'text', text: delta.content });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCallAccumulator.get(tc.index);
                if (!existing) {
                  toolCallAccumulator.set(tc.index, {
                    id: tc.id ?? '',
                    name: tc.function?.name ?? '',
                    arguments: tc.function?.arguments ?? '',
                  });
                } else {
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                }
              }
            }
          }

          // Emit accumulated tool calls if any
          if (toolCallAccumulator.size > 0) {
            const toolCalls = Array.from(toolCallAccumulator.entries())
              .sort(([a], [b]) => a - b)
              .map(([, tc]) => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              }));
            const data = JSON.stringify({ type: 'tool_calls', toolCalls });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`));
          controller.close();
        }
      },
    });
  }
}

// ─── Ollama (Local) Provider ──────────────────────────────────────────────────

class OllamaProvider implements AIProvider {
  name = 'ollama';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const model = resolveModel('ollama', options?.model ?? 'local');

    const allMessages: { role: string; content: string }[] = [];
    if (options?.systemPrompt) {
      allMessages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const m of messages) {
      if (m.role !== 'system') {
        allMessages.push({ role: m.role, content: m.content });
      } else if (!options?.systemPrompt) {
        allMessages.push({ role: 'system', content: m.content });
      }
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: allMessages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content ?? null,
      toolCalls: [],
      usage: data.prompt_eval_count
        ? {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
          }
        : undefined,
    };
  }

  streamChat(messages: ChatMessage[], options?: ChatOptions): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream({
      start: async (controller) => {
        try {
          const model = resolveModel('ollama', options?.model ?? 'local');

          const allMessages: { role: string; content: string }[] = [];
          if (options?.systemPrompt) {
            allMessages.push({ role: 'system', content: options.systemPrompt });
          }
          for (const m of messages) {
            if (m.role !== 'system') {
              allMessages.push({ role: m.role, content: m.content });
            } else if (!options?.systemPrompt) {
              allMessages.push({ role: 'system', content: m.content });
            }
          }

          const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: allMessages,
              stream: true,
            }),
          });

          if (!response.ok) {
            throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.message?.content) {
                  const data = JSON.stringify({ type: 'text', text: parsed.message.content });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              } catch {
                // skip malformed lines
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`));
          controller.close();
        }
      },
    });
  }
}

// ─── Provider Factory ─────────────────────────────────────────────────────────

const providers: Record<string, () => AIProvider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
  ollama: () => new OllamaProvider(),
};

export function getProvider(providerName?: string): AIProvider {
  const name = providerName ?? process.env.DEFAULT_AI_PROVIDER ?? 'anthropic';
  const factory = providers[name];
  if (!factory) {
    throw new Error(
      `Unknown provider: "${name}". Available: ${Object.keys(providers).join(', ')}`
    );
  }
  return factory();
}

export function getAvailableProviders(): string[] {
  const available: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) available.push('anthropic');
  if (process.env.OPENAI_API_KEY) available.push('openai');
  if (process.env.OLLAMA_BASE_URL) available.push('ollama');
  return available;
}

/**
 * Get an AI provider configured with the user's personal API keys, falling back
 * to environment variables when the user hasn't set their own keys.
 */
export async function getProviderForUser(userId: string): Promise<AIProvider> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferredAiProvider: true,
      anthropicApiKey: true,
      openaiApiKey: true,
      ollamaBaseUrl: true,
    },
  });

  const providerName = user?.preferredAiProvider ?? process.env.DEFAULT_AI_PROVIDER ?? 'anthropic';
  const encryptionKey = process.env.SYNAPSE_ENCRYPTION_KEY;
  const decryptUserKey = (value: string | null | undefined) => {
    if (!value) return undefined;
    if (!encryptionKey && value.startsWith('v1:')) {
      throw new Error('SYNAPSE_ENCRYPTION_KEY is required to use saved AI provider keys');
    }
    return encryptionKey ? decryptSecret(value, encryptionKey) : value;
  };

  switch (providerName) {
    case 'openai':
      return new OpenAIProvider(decryptUserKey(user?.openaiApiKey));
    case 'ollama':
      return new OllamaProvider(user?.ollamaBaseUrl ?? undefined);
    case 'anthropic':
    default:
      return new AnthropicProvider(decryptUserKey(user?.anthropicApiKey));
  }
}
