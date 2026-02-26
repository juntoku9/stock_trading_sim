
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Loader2, 
  ExternalLink,
  Terminal
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { UserProfile, Stock } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; uri: string }[];
}

interface AIAssistantProps {
  user: UserProfile;
  stocks: Stock[];
  portfolioValue: number;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ user, stocks, portfolioValue }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: `Hello ${user.realName}! I'm Alpha, your virtual trading advisor. I see your portfolio is currently worth $${portfolioValue.toLocaleString()}. How can I help you with the market today?` 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const holdingsSummary = user.holdings.map(h => {
        const stock = stocks.find(s => s.symbol === h.symbol);
        return `${h.shares} shares of ${h.symbol} ($${stock?.price.toFixed(2)})`;
      }).join(', ');

      const marketSummary = stocks.slice(0, 5).map(s => `${s.symbol}: $${s.price.toFixed(2)}`).join(', ');

      const systemInstruction = `
        You are "Alpha", a helpful and knowledgeable financial advisor for PaperTrade Pro.
        Respond in a clear, friendly, and professional manner. No jargon or underscores.
        
        USER CONTEXT:
        - Name: ${user.realName}
        - Virtual Cash: $${user.cash.toLocaleString()}
        - Portfolio Value: $${portfolioValue.toLocaleString()}
        - Holdings: ${holdingsSummary || 'None'}
        - Recent Market: ${marketSummary}

        RULES:
        1. Be helpful and clear.
        2. Use Google Search for current news.
        3. Mandatory disclaimer: This is a virtual simulation. No real financial advice is given.
        4. Use Markdown for lists or formatting.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMessage,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "I'm sorry, I encountered an error processing your request.";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'External Source',
        uri: chunk.web?.uri || '#'
      })).filter((s: any) => s.uri !== '#');

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: text,
        sources: sources?.length ? sources : undefined
      }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm having trouble connecting to my servers. Please try again in a moment." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black shadow-lg flex items-center justify-center transition-all duration-200 z-50 group ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <Bot className="w-7 h-7" />
        <span className="absolute right-20 bg-black border border-zinc-800 text-yellow-400 text-[10px] font-bold px-3 py-2 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">
          Ask Alpha
        </span>
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-8 right-8 w-[400px] max-w-[95vw] h-[600px] max-h-[90vh] bg-black border border-zinc-800 rounded-xl shadow-2xl flex flex-col transition-all duration-300 z-50 overflow-hidden font-mono ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none'}`}>
        {/* Header */}
        <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-widest">Alpha Advisor</p>
              <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-tighter">Online</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 text-[11px] leading-relaxed rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-yellow-400 text-black font-bold' 
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, sIdx) => (
                        <a 
                          key={sIdx} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-black border border-zinc-800 px-2 py-1 text-[8px] text-zinc-500 hover:text-yellow-400 transition-all uppercase"
                        >
                          <ExternalLink className="w-2 h-2" />
                          {source.title.length > 15 ? source.title.substring(0, 15) + '...' : source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <span className="text-[9px] text-zinc-600 font-bold uppercase">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-900 bg-zinc-950">
          <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-lg p-1">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for advice..."
              className="flex-1 bg-transparent border-none focus:outline-none px-3 py-2 text-xs text-white"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 bg-yellow-400 text-black rounded-md flex items-center justify-center hover:bg-yellow-300 disabled:opacity-20 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-[7px] text-center text-zinc-700 uppercase font-bold tracking-widest">
            Virtual simulation only • No financial advice given
          </p>
        </form>
      </div>
    </>
  );
};

export default AIAssistant;
