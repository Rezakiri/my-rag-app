export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.JINA_API_KEY}`
    },
    body: JSON.stringify({
      model: "jina-embeddings-v2-base-en",
      input: text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jina AI API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  // Jina returns the vector inside data[0].embedding
  return result.data[0].embedding;
}