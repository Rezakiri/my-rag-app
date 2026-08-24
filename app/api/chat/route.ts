import Groq from 'groq-sdk';
import { getEmbedding } from '@/lib/ai/huggingface';
import { searchDocuments } from '@/lib/supabase/queries';

// 1. SAFETY CHECK: Prevent SDK crash if env var is missing in Vercel
if (!process.env.GROQ_API_KEY) {
  console.error("❌ CRITICAL: GROQ_API_KEY is missing from Vercel Environment Variables");
}

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY || 'dummy-key-to-prevent-init-crash' 
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid message string is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log("1. Generating embedding for:", message);
    
    // 2. Convert user question to embedding
    const questionEmbedding = await getEmbedding(message);
    
    // SAFETY CHECK: Ensure embedding is actually an array
    if (!Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
      throw new Error("getEmbedding failed to return a valid array. Check your embedding API key/service.");
    }
    console.log("2. Embedding generated successfully. Length:", questionEmbedding.length);

    // 3. Search database for relevant documents
    console.log("3. Searching Supabase...");
    const relevantDocs = await searchDocuments(questionEmbedding, 3);
    console.log("📦 RAW DOCS FROM DB:", relevantDocs);

    // 4. SAFETY CHECK: Prevent the "Cannot read properties of null" crash
    // If Supabase is asleep or returns null, this prevents the 500 error
    const safeDocs = Array.isArray(relevantDocs) ? relevantDocs : [];
    
    // Build context safely
    const context = safeDocs
      .map((doc: any) => doc?.content || '')
      .filter(Boolean) // Remove any empty strings
      .join('\n\n');
      
    console.log("📝 CONTEXT STRING LENGTH:", context.length);

    // 5. Call Groq LLM with a bulletproof prompt
    const prompt = `You are a helpful assistant. Answer the user's question based ONLY on the provided context. 

<context>
${context || "No relevant context found in the database. Please inform the user that you don't have enough information to answer."}
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
      model: 'llama-3.3-70b-versatile',
      stream: true,
    });

    // 6. Stream response back to frontend WITH PROPER HEADERS
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
        } catch (streamError) {
          console.error("❌ Streaming error:", streamError);
          controller.error(streamError);
        } finally {
          controller.close();
        }
      },
    });

    // CRITICAL: Next.js requires explicit headers for streaming responses to work reliably on Vercel
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive', // This is HTTP response streaming keep-alive (GOOD), not DB keep-alive
      },
    });

  } catch (error: any) {
    // 7. Return the ACTUAL error message to the Vercel logs so you can debug it
    console.error('❌ RAG API CRASH DETAILS:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process request', 
      details: error.message || String(error)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
