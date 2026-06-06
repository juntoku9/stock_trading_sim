
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Loader2, 
  ExternalLink,
  Terminal
} from 'lucide-react';
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
      const holdingsSummary = user.holdings.map(h => {
        const stock = stocks.find(s => s.symbol === h.symbol);
        return `${h.shares} shares of ${h.symbol} ($${stock?.price.toFixed(2)})`;
      }).join(', ');

      const marketSummary = stocks.slice(0, 5).map(s => `${s.symbol}: $${s.price.toFixed(2)}`).join(', ');

      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          userContext: {
            realName: user.realName,
            cash: user.cash,
            portfolioValue,
            holdingsSummary,
            marketSummary,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data?.error || 'The AI assistant is unavailable right now. This is a virtual simulation. No real financial advice is given.'
        }]);
        return;
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.text || "I'm sorry, I encountered an error processing your request.",
        sources: data.sources?.length ? data.sources : undefined
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
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20 flex items-center justify-center transition-all duration-200 z-50 group ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <Bot className="w-7 h-7" />
        <span className="absolute right-18 bg-[#161616] border border-white/[0.06] text-white text-xs font-medium px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Ask Alpha
        </span>
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-8 right-8 w-[400px] max-w-[95vw] h-[600px] max-h-[90vh] bg-[#0a0a0a] border border-white/[0.06] rounded-xl shadow-2xl flex flex-col transition-all duration-300 z-50 overflow-hidden ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none'}`}>
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] bg-[#161616] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Alpha Advisor</p>
              <p className="text-xs text-green-500 font-medium">Online</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/[0.04] rounded-full transition-colors text-[#a1a1aa]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3.5 text-sm leading-relaxed rounded-xl ${
                msg.role === 'user'
                  ? 'bg-green-500 text-black font-medium'
                  : 'bg-[#161616] text-[#ededed] border border-white/[0.06]'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                    <p className="text-xs font-medium text-[#a1a1aa]">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, sIdx) => (
                        <a
                          key={sIdx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/[0.06] px-2.5 py-1 text-xs text-[#a1a1aa] hover:text-green-400 transition-all rounded-full"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
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
              <div className="bg-[#161616] border border-white/[0.06] p-3 rounded-xl flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                <span className="text-sm text-[#a1a1aa]">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/[0.06] bg-[#161616]">
          <div className="flex items-center gap-2 bg-[#0a0a0a] border border-white/[0.06] rounded-full p-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for advice..."
              className="flex-1 bg-transparent border-none focus:outline-none px-3 py-2 text-sm text-white placeholder:text-[#52525b]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 bg-green-500 text-black rounded-full flex items-center justify-center hover:bg-green-400 disabled:opacity-20 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-[10px] text-center text-[#52525b]">
            Virtual simulation only - No financial advice given
          </p>
        </form>
      </div>
    </>
  );
};

export default AIAssistant;
