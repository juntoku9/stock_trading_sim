import React, { useState } from 'react';
import {
  BookOpen, ChevronRight, TrendingUp, HelpCircle, Globe, Scale, Zap, Cpu
} from 'lucide-react';

const Tutorials: React.FC = () => {
  const [activeLesson, setActiveLesson] = useState<number | null>(null);

  const lessons = [
    {
      id: 1,
      icon: <Cpu className="w-6 h-6 text-violet-400" />,
      title: "What Are Stocks?",
      description: "Learn the basics of company equity and ownership.",
      content: (
        <div className="space-y-4 text-[#8b8b9e] text-sm">
          <p>A stock represents a share of ownership in a company. When you buy a stock, you own a small piece of that business and have a claim on its assets and earnings.</p>
          <div className="bg-[#0d0d12] p-4 border border-white/[0.06] rounded-xl">
            <h4 className="text-violet-300 font-semibold mb-2 flex items-center gap-2 text-sm">
              <HelpCircle className="w-4 h-4" /> What makes prices move?
            </h4>
            <p className="text-sm leading-relaxed">Stock prices change based on supply and demand. Market sentiment, earnings reports, and economic indicators all influence how much people are willing to pay.</p>
          </div>
          <p>Companies go public to raise money for growth. The classic strategy: buy low, sell high.</p>
        </div>
      )
    },
    {
      id: 5,
      icon: <Globe className="w-6 h-6 text-violet-400" />,
      title: "IPOs and Public Markets",
      description: "How companies go from private to publicly traded.",
      content: (
        <div className="space-y-4 text-[#8b8b9e] text-sm">
          <p>Publicly traded companies list shares on exchanges through Initial Public Offerings (IPOs).</p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2"><span className="text-violet-300 font-semibold">Quarterly Reports:</span> Companies must share their financials publicly.</li>
            <li className="flex items-start gap-2"><span className="text-violet-300 font-semibold">Regulation:</span> They must comply with securities exchange laws.</li>
            <li className="flex items-start gap-2"><span className="text-violet-300 font-semibold">Capital:</span> IPOs bring in large amounts of funding for R&D and growth.</li>
          </ul>
        </div>
      )
    },
    {
      id: 6,
      icon: <Scale className="w-6 h-6 text-violet-400" />,
      title: "Understanding Market Cap",
      description: "How to evaluate a company's size and risk profile.",
      content: (
        <div className="space-y-4 text-[#8b8b9e] text-sm">
          <p>Market Cap = Share Price x Total Shares Outstanding. It tells you how much the market thinks a company is worth.</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'Large Cap', desc: '$10B+' },
              { name: 'Mid Cap', desc: '$2B-$10B' },
              { name: 'Small Cap', desc: 'Under $2B' },
            ].map(size => (
              <div key={size.name} className="p-4 bg-[#0d0d12] border border-white/[0.06] text-center rounded-xl">
                <p className="text-sm font-semibold text-white">{size.name}</p>
                <p className="text-xs text-violet-400 mt-1">{size.desc}</p>
              </div>
            ))}
          </div>
          <p>Large-caps are more stable. Small-caps have higher growth potential but come with more risk.</p>
        </div>
      )
    },
    {
      id: 10,
      icon: <Zap className="w-6 h-6 text-violet-400" />,
      title: "The Power of Compounding",
      description: "How reinvesting returns accelerates wealth growth.",
      content: (
        <div className="space-y-4 text-[#8b8b9e] text-sm">
          <p>When you reinvest your returns, you earn gains on your previous gains. Over time, this creates exponential growth.</p>
          <div className="border-l-4 border-violet-500 bg-[#0d0d12] p-4 rounded-r-xl">
            <p className="text-sm font-semibold text-white">Growth = P(1 + r/n)^(nt)</p>
          </div>
          <p className="text-violet-400/70 italic">Time in the market beats timing the market.</p>
        </div>
      )
    }
  ];

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-5 mb-12">
        <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center">
          <BookOpen className="text-white w-7 h-7" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Learn to Trade</h1>
          <p className="text-sm text-[#8b8b9e] mt-1">Build your investing knowledge, one lesson at a time.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lessons.map((lesson) => (
          <div key={lesson.id}
            className={`bg-[#16161e] border transition-all duration-200 rounded-2xl ${
              activeLesson === lesson.id ? 'border-violet-500/40 col-span-1 md:col-span-2' : 'border-white/[0.06] hover:border-white/[0.12] cursor-pointer'
            }`}
            onClick={() => activeLesson === lesson.id ? setActiveLesson(null) : setActiveLesson(lesson.id)}>
            <div className="p-6 flex items-start gap-5">
              <div className="p-3 bg-violet-500/10 rounded-xl">{lesson.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-lg font-semibold text-white">{lesson.title}</h3>
                  <ChevronRight className={`w-5 h-5 text-[#4a4a5c] transition-transform ${activeLesson === lesson.id ? 'rotate-90 text-violet-400' : ''}`} />
                </div>
                <p className="text-sm text-[#8b8b9e] leading-relaxed">{lesson.description}</p>
                {activeLesson === lesson.id && (
                  <div className="mt-6 pt-6 border-t border-white/[0.06] animate-fade-in">
                    {lesson.content}
                    <button onClick={(e) => { e.stopPropagation(); setActiveLesson(null); }}
                      className="mt-6 text-sm font-medium text-violet-400 hover:text-white transition-colors">
                      Close Lesson
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-[#16161e] border border-white/[0.06] p-8 rounded-2xl flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-violet-400" /> Put It Into Practice
          </h2>
          <p className="text-[#8b8b9e] text-sm leading-relaxed">
            You start with $100,000 in virtual cash. Try buying your first position in a large-cap stock like AAPL to see how the market works.
          </p>
        </div>
        <div className="flex-shrink-0">
          <div className="bg-[#0d0d12] border-l-4 border-violet-500 p-6 rounded-r-xl">
            <p className="text-sm text-[#e8e8ed] font-medium italic leading-relaxed">"The stock market is a device for transferring money from the impatient to the patient."</p>
            <p className="text-right text-sm text-violet-400 font-semibold mt-3">-- Warren Buffett</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tutorials;
