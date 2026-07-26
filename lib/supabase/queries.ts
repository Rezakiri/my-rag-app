import { supabase } from './client';

export async function searchDocuments(queryEmbedding: number[], limit = 3) {
  console.log("🔍 Embedding length being sent to DB:", queryEmbedding.length);

  // Convert the JS array into a string format like "[0.1, -0.2, ...]"
  // This is much more reliable for Supabase pgvector RPC calls
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embeddingString,
    match_count: limit
  });

  if (error) {
    console.error('❌ Supabase search error:', error);
    throw error;
  }

  return data || [];
}