import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDefaultModel, getProviderForUser, type ChatMessage } from '@/lib/ai/provider';
import { buildUserContext } from '@/lib/ai/context';
import { confirmableToolDefinitions, isReadOnlyToolName, prepareActionProposal, toolExecutors } from '@/lib/ai/tools';
import { serializeTextEvent } from '@/lib/ai/events';

const SYSTEM_PROMPT = `You are Synapse, an AI second brain and life management assistant. You help users manage their habits, todos, notes, journal, calendar, goals, and inbox through natural conversation.

Key principles:
- Be concise and actionable in your responses
- Read data with the available tools when it helps answer the user
- Task creation may be proposed through the create_todo tool, but it is never applied until the user confirms the review card
- Other changes to tasks, habits, notes, calendar, or inbox are unavailable; describe them as suggestions without claiming completion
- Reference the user's current data when relevant
- When in doubt, ask for clarification rather than assuming
- Keep responses focused and avoid unnecessary verbosity

You can read notes, habits, and todos. You can propose creating a task for explicit confirmation. Never claim a proposed action has already happened.`;

const MAX_TOOL_ITERATIONS = 5;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const { message, conversationId } = body as {
      message: string;
      conversationId?: string;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Provider selection is always derived from the authenticated user's saved
    // settings. Request-level overrides could otherwise spend shared operator
    // credentials or select an unexpectedly expensive model.
    const provider = await getProviderForUser(userId);

    // Get or create conversation
    let conversationIdResolved = conversationId;
    if (conversationIdResolved) {
      // Verify ownership of the conversation
      const convo = await prisma.aiConversation.findFirst({
        where: { id: conversationIdResolved, userId },
      });
      if (!convo) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }
    if (!conversationIdResolved) {
      const conversation = await prisma.aiConversation.create({
        data: {
          userId,
          provider: provider.name,
          model: getDefaultModel(provider.name),
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
              systemPrompt: fullSystemPrompt,
              tools: confirmableToolDefinitions,
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
                const chunk = serializeTextEvent(assistantContent);
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }

              break;
            }

            // We have tool calls — execute them
            const toolResults: { id: string; name: string; result: string }[] = [];
            let proposalCreated = false;

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
              if (toolName === 'create_todo') {
                try {
                  const prepared = prepareActionProposal(
                    toolName,
                    JSON.parse(toolCall.function.arguments)
                  );
                  if (!prepared.success) {
                    toolResult = JSON.stringify({ success: false, error: prepared.error });
                  } else {
                    const proposal = await prisma.aiActionProposal.create({
                      data: {
                        userId,
                        conversationId: conversationIdResolved!,
                        toolName,
                        arguments: prepared.arguments,
                        summary: prepared.summary,
                        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
                      },
                    });
                    proposalCreated = true;
                    toolResult = JSON.stringify({ success: true, pendingConfirmation: true });
                    const proposalChunk = JSON.stringify({
                      type: 'action_proposal',
                      action: {
                        id: proposal.id,
                        summary: proposal.summary,
                        details: prepared.details,
                        status: proposal.status,
                        expiresAt: proposal.expiresAt,
                      },
                    });
                    controller.enqueue(encoder.encode(`data: ${proposalChunk}\n\n`));
                  }
                } catch {
                  toolResult = JSON.stringify({ success: false, error: 'Invalid task proposal' });
                }
              } else if (isReadOnlyToolName(toolName) && executor) {
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

            if (proposalCreated) {
              const proposalMessage = result.content?.trim() ||
                'Review the proposed task below. Nothing will change unless you confirm it.';
              assistantContent += proposalMessage;
              controller.enqueue(
                encoder.encode(`data: ${serializeTextEvent(proposalMessage)}\n\n`)
              );
              break;
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
              content: '\n\n[I reached the maximum number of tool calls for this response. Please continue the conversation if you need more information.]',
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
