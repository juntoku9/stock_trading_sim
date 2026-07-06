import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenAI } from '@google/genai';

type AssistantPayload = {
  userMessage?: string;
  userContext?: {
    realName?: string;
    cash?: number;
    portfolioValue?: number;
    holdingsSummary?: string;
    marketSummary?: string;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({
      error: 'The AI assistant is unavailable until GEMINI_API_KEY is configured. This is a virtual simulation. No real financial advice is given.',
    });
    return;
  }

  const body = req.body as AssistantPayload;
  const userMessage = body?.userMessage?.trim();

  if (!userMessage) {
    res.status(400).json({ error: 'A message is required.' });
    return;
  }

  const context = body.userContext ?? {};

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const systemInstruction = `
      You are "Alpha", a helpful and knowledgeable financial advisor for PaperTrade Pro.
      Respond in a clear, friendly, and professional manner. No jargon or underscores.

      USER CONTEXT:
      - Name: ${context.realName || 'Trader'}
      - Virtual Cash: $${Number(context.cash ?? 0).toLocaleString()}
      - Portfolio Value: $${Number(context.portfolioValue ?? 0).toLocaleString()}
      - Holdings: ${context.holdingsSummary || 'None'}
      - Recent Market: ${context.marketSummary || 'Unavailable'}

      RULES:
      1. Be helpful and clear.
      2. Use Google Search for current news.
      3. Mandatory disclaimer: This is a virtual simulation. No real financial advice is given.
      4. Respond in plain text only — no Markdown syntax (no asterisks, headers, or
         backticks). The chat window renders raw text, so Markdown shows as literal symbols.
         Use simple hyphen bullets and blank lines for structure.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userMessage,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || 'External Source',
      uri: chunk.web?.uri || '#',
    })).filter((source: { uri: string }) => source.uri !== '#');

    res.status(200).json({
      text: response.text || "I'm sorry, I encountered an error processing your request.",
      sources: sources?.length ? sources : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown assistant error.';
    res.status(500).json({ error: message });
  }
}
