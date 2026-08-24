import Groq from 'groq-sdk';
import { getEmbedding } from '@/lib/ai/huggingface';
import { searchDocuments } from '@/lib/supabase/queries';

// The '!' tells TypeScript this variable will not be undefined
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // 1. Convert user question to embedding
    const questionEmbedding = await getEmbedding(message);

    // 2. Search database for relevant documents
    const relevantDocs = await searchDocuments(questionEmbedding, 3);
    console.log("📦 RAW DOCS FROM DB:", relevantDocs);

    // 3. Build context from retrieved documents
    const context = relevantDocs.map((doc: any) => doc.content).join('\n\n');
    console.log("📝 CONTEXT STRING LENGTH:", context.length);
    console.log("📝 CONTEXT STRING:", context);

    // 4. Call Groq LLM with a bulletproof Llama 3 prompt
    const prompt = `You are a helpful assistant. Answer the user's question based ONLY on the provided context. 

<context>
${context}
</context>

Question: ${message}

Answer:`;

    console.log("🤖 FINAL PROMPT SENT TO GROQ:\n", prompt);

    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      model: 'mixtral-8x7b-32768',
      stream: true,
    });

    // 5. Stream response back to frontend
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          controller.enqueue(new TextEncoder().encode(content));
        }
        controller.close();
      },
    });

    return new Response(stream);
  } catch (error) {
    console.error('RAG API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), { status: 500 });
  }
}
