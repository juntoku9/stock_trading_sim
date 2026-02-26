import React, { useState } from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  Lightbulb, 
  ShieldCheck, 
  TrendingUp, 
  PieChart, 
  ArrowRightCircle,
  HelpCircle,
  Globe,
  Scale,
  Zap,
  BarChart3,
  Layers,
  Coins,
  Cpu
} from 'lucide-react';

const Tutorials: React.FC = () => {
  const [activeLesson, setActiveLesson] = useState<number | null>(null);

  const lessons = [
    {
      id: 1,
      icon: <Cpu className="w-6 h-6 text-yellow-400" />,
      title: "CORE_CONCEPT: STOCKS",
      description: "Fundamental unit of company equity acquisition.",
      content: (
        <div className="space-y-4 text-zinc-400 text-sm">
          <p>A stock represents a discrete share in the ownership of a legal business entity. Acquisition grants proportional rights to assets and earnings.</p>
          <div className="bg-zinc-950 p-4 border border-zinc-900">
            <h4 className="text-yellow-400 font-black mb-2 flex items-center gap-2 uppercase text-xs">
              <HelpCircle className="w-4 h-4" /> VOLATILITY_FACTORS?
            </h4>
            <p className="text-xs leading-relaxed">Price shifts occur as a direct result of supply-demand dynamics. Market sentiment, earnings reports, and macro-indicators drive execution intent.</p>
          </div>
          <p className="italic">Public issuance enables capital raising for operational expansion. Strategy: Execute low, Terminate high.</p>
        </div>
      )
    },
    {
      id: 5,
      icon: <Globe className="w-6 h-6 text-yellow-400" />,
      title: "PUBLIC_ENTITIES_&_IPO",
      description: "Transition vectors from private to public markets.",
      content: (
        <div className="space-y-4 text-zinc-400 text-sm">
          <p>Publicly traded companies list shares on global exchanges via Initial Public Offerings (IPOs).</p>
          <ul className="space-y-2 text-xs uppercase font-bold tracking-tighter">
            <li><span className="text-yellow-400">STATUS_QUARTERLY_REPORTS:</span> Mandatory financial transparency.</li>
            <li><span className="text-yellow-400">STATUS_REGULATION:</span> Compliance with security exchange laws.</li>
            <li><span className="text-yellow-400">STATUS_CAPITAL:</span> Massive liquid influx for R&D.</li>
          </ul>
        </div>
      )
    },
    {
      id: 6,
      icon: <Scale className="w-6 h-6 text-yellow-400" />,
      title: "MARKET_CAP_ANALYSIS",
      description: "Evaluating entity scale via total equity valuation.",
      content: (
        <div className="space-y-4 text-zinc-400 text-sm">
          <p>Market Cap = [Unit Price] x [Total Shares Outstanding]. Size determines risk profile.</p>
          <div className="grid grid-cols-3 gap-2">
            {['LARGE_CAP', 'MID_CAP', 'SMALL_CAP'].map(size => (
              <div key={size} className="p-3 bg-zinc-950 border border-zinc-900 text-center">
                <p className="text-[10px] font-black text-white">{size}</p>
                <p className="text-[8px] text-yellow-400 uppercase mt-1">Tier_Status</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] uppercase font-bold italic">Large-caps offer stability. Small-caps offer growth potential at high risk variance.</p>
        </div>
      )
    },
    {
      id: 10,
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: "COMPOUND_INTELLIGENCE",
      description: "The exponential growth algorithm for long-term wealth.",
      content: (
        <div className="space-y-4 text-zinc-400 text-sm">
          <p>Reinvesting returns generates a positive feedback loop where future growth is calculated on previous gains.</p>
          <div className="border-l-4 border-yellow-400 bg-zinc-950 p-4">
             <p className="text-xs leading-loose uppercase font-black">Growth(t) = P(1 + r/n)^(nt)</p>
          </div>
          <p className="text-xs italic text-yellow-400/50 uppercase font-bold tracking-widest">Time in system &gt; System timing.</p>
        </div>
      )
    }
  ];

  return (
    <div className="animate-fade-in font-mono max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-6 mb-16">
        <div className="w-16 h-16 bg-yellow-400 rounded-sm flex items-center justify-center shadow-[5px_5px_0px_#111]">
          <BookOpen className="text-black w-8 h-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">LEARNING_CORE</h1>
          <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mt-1">Knowledge base for trading optimization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {lessons.map((lesson) => (
          <div 
            key={lesson.id}
            className={`bg-black border-2 transition-all duration-150 ${
              activeLesson === lesson.id 
                ? 'border-yellow-400 col-span-1 md:col-span-2' 
                : 'border-zinc-900 hover:border-zinc-700 cursor-pointer'
            }`}
            onClick={() => activeLesson === lesson.id ? setActiveLesson(null) : setActiveLesson(lesson.id)}
          >
            <div className="p-8 flex items-start gap-6">
              <div className="p-4 bg-zinc-950 border border-zinc-900">
                {lesson.icon}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter">{lesson.title}</h3>
                  <ChevronRight className={`w-5 h-5 text-zinc-800 transition-transform ${activeLesson === lesson.id ? 'rotate-90 text-yellow-400' : ''}`} />
                </div>
                <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">{lesson.description}</p>
                
                {activeLesson === lesson.id && (
                  <div className="mt-10 pt-10 border-t border-zinc-900 animate-fade-in">
                    {lesson.content}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLesson(null);
                      }}
                      className="mt-10 text-[10px] font-black text-yellow-400 uppercase tracking-[0.3em] hover:text-white transition-colors"
                    >
                      CLOSE_LESSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 bg-zinc-950 border border-zinc-900 p-10 flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1">
          <h2 className="text-xl font-black text-white mb-4 flex items-center gap-3 uppercase tracking-tighter">
            <TrendingUp className="w-6 h-6 text-yellow-400" />
            FIELD_APPLICATION
          </h2>
          <p className="text-zinc-600 text-xs leading-relaxed uppercase font-bold tracking-widest">
            Simulation provides $100,000 liquid capital for testing hypotheses. recommended action: execute initial position in high-cap assets (e.g. AAPL) to observe market mechanics.
          </p>
        </div>
        <div className="flex-shrink-0">
          <div className="bg-black border-l-4 border-yellow-400 p-6 shadow-[10px_10px_0px_#111]">
             <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-3">SYSTEM_QUOTE</p>
             <p className="text-sm text-zinc-300 font-bold italic leading-relaxed">"The stock market is a device for transferring money from the impatient to the patient."</p>
             <p className="text-right text-[10px] text-yellow-400 font-black mt-3 uppercase tracking-widest">— BUFFETT_W</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tutorials;