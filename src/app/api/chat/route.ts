import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProvider, getProviderForUser, resolveModel, type ChatMessage } from '@/lib/ai/provider';
import { buildUserContext } from '@/lib/ai/context';
import { toolDefinitions, toolExecutors } from '@/lib/ai/tools';

const SYSTEM_PROMPT = `You are Synapse, an AI second brain and life management assistant. You help users manage their habits, todos, notes, journal, calendar, goals, and inbox through natural conversation.

Key principles:
- Be concise and actionable in your responses
- Use the available tools to take actions on the user's behalf when they ask
- Proactively suggest actions based on context (e.g., logging habits, scheduling tasks)
- Reference the user's current data when relevant
- When in doubt, ask for clarification rather than assuming
- Keep responses focused and avoid unnecessary verbosity

You have access to tools that let you create todos, log habits, create notes, add inbox items, create calendar events, search notes, check habits status, get todos, and set reminders. Use them whenever the user's request calls for action.`;

const MAX_TOOL_ITERATIONS = 5;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const {
      message,
      conversationId,
      provider: providerName,
      model: modelShorthand,
    } = body as {
      message: string;
      conversationId?: string;
      provider?: string;
      model?: string;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get or create conversation
    let conversationIdResolved = conversationId;
    if (!conversationIdResolved) {
      const conversation = await prisma.aiConversation.create({
        data: {
          userId,
          provider: providerName ?? 'anthropic',
          model: modelShorthand ? resolveModel(providerName ?? 'anthropic', modelShorthand) : 'claude-sonnet-4-20250514',
          title: message.slice(0, 100),
        },
      });
      conversationIdResolved = conversation.id;
    }

    // Save user message
    await prisma.aiMessage.create({
      data: {
        conversationId: conversationIdResolved,
        role: 'user',
        content: message,
      },
    });

    // Build context
    const userContext = await buildUserContext(userId);

    // Get conversation history
    const history = await prisma.aiMessage.findMany({
      where: { conversationId: conversationIdResolved },
      orderBy: { createdAt: 'asc' },
      take: 50, // Keep context window manageable
    });

    // Build messages array
    const messages: ChatMessage[] = history.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));

    // Add current user message (already saved, so it's in history)
    const provider = providerName
      ? getProvider(providerName)
      : await getProviderForUser(userId);
    const model = modelShorthand
      ? resolveModel(providerName ?? 'anthropic', modelShorthand)
      : undefined;

    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n--- USER CONTEXT ---\n${userContext}`;

    // ─── Streaming response with tool handling ──────────────────────────────

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let assistantContent = '';

        try {
          let currentMessages = [...messages];
          let iteration = 0;

          while (iteration < MAX_TOOL_ITERATIONS) {
            const result = await provider.chat(currentMessages, {
              model,
              systemPrompt: fullSystemPrompt,
              tools: toolDefinitions,
            });

            if (result.usage) {
              totalPromptTokens += result.usage.promptTokens;
              totalCompletionTokens += result.usage.completionTokens;
            }

            // If no tool calls, we're done — stream the text response
            if (!result.toolCalls || result.toolCalls.length === 0) {
              assistantContent = result.content ?? '';

              // Stream the content in chunks
              if (assistantContent) {
                const chunk = JSON.stringify({ type: 'text', text: assistantContent });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }

              break;
            }

            // We have tool calls — execute them
            const toolResults: { id: string; name: string; result: string }[] = [];

            for (const toolCall of result.toolCalls) {
              const toolName = toolCall.function.name;
              const executor = toolExecutors[toolName];

              // Notify client about tool call
              const toolStartChunk = JSON.stringify({
                type: 'tool_start',
                tool: toolName,
                callId: toolCall.id,
              });
              controller.enqueue(encoder.encode(`data: ${toolStartChunk}\n\n`));

              let toolResult: string;
              if (executor) {
                try {
                  const params = JSON.parse(toolCall.function.arguments);
                  const execResult = await executor(userId, params);
                  toolResult = JSON.stringify(execResult);
                } catch (err) {
                  toolResult = JSON.stringify({
                    success: false,
                    error: err instanceof Error ? err.message : 'Tool execution failed',
                  });
                }
              } else {
                toolResult = JSON.stringify({
                  success: false,
                  error: `Unknown tool: ${toolName}`,
                });
              }

              toolResults.push({
                id: toolCall.id,
                name: toolName,
                result: toolResult,
              });

              // Notify client about tool result
              const toolEndChunk = JSON.stringify({
                type: 'tool_result',
                tool: toolName,
                callId: toolCall.id,
                result: JSON.parse(toolResult),
              });
              controller.enqueue(encoder.encode(`data: ${toolEndChunk}\n\n`));
            }

            // Add assistant message with tool calls to conversation
            currentMessages.push({
              role: 'assistant',
              content: result.content ?? '',
              tool_calls: toolResults.map((tr) => ({
                id: tr.id,
                type: 'function' as const,
                function: {
                  name: tr.name,
                  arguments: '',
                },
              })),
            });

            // Add tool results as messages
            for (const tr of toolResults) {
              currentMessages.push({
                role: 'tool',
                content: tr.result,
                tool_call_id: tr.id,
              });
            }

            // If there was text content from this turn, include it in the assistant response
            if (result.content) {
              assistantContent += result.content;
            }

            iteration++;
          }

          // If we hit max iterations, add a note
          if (iteration >= MAX_TOOL_ITERATIONS) {
            const maxMsg = JSON.stringify({
              type: 'text',
              text: '\n\n[I reached the maximum number of tool calls for this response. Please continue the conversation if you need more actions taken.]',
            });
            controller.enqueue(encoder.encode(`data: ${maxMsg}\n\n`));
          }

          // Save assistant message
          if (assistantContent) {
            await prisma.aiMessage.create({
              data: {
                conversationId: conversationIdResolved!,
                role: 'assistant',
                content: assistantContent,
                tokensUsed: totalPromptTokens + totalCompletionTokens,
              },
            });
          }

          // Update conversation timestamp
          await prisma.aiConversation.update({
            where: { id: conversationIdResolved! },
            data: { updatedAt: new Date() },
          });

          // Send final metadata
          const metaChunk = JSON.stringify({
            type: 'done',
            conversationId: conversationIdResolved,
            usage: {
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
            },
          });
          controller.enqueue(encoder.encode(`data: ${metaChunk}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const errMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorChunk = JSON.stringify({ type: 'error', error: errMessage });
          controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}