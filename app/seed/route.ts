import { NextResponse } from 'next/server';
import { getEmbedding } from '../../lib/ai/huggingface';
import { supabase } from '../../lib/supabase/client';

export async function GET() {
  const testText = "The refund policy allows returns within 30 days of purchase. You must provide a receipt.";
  
  try {
    const realEmbedding = await getEmbedding(testText);
    
    const { error } = await supabase
      .from('documents')
      .insert({
        content: testText,
        embedding: realEmbedding,
        metadata: { source: 'seed' }
      });

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Database seeded with a REAL vector!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}