import React, { useState } from 'react';
import {
  BookOpen, ChevronRight, CheckCircle, Circle, Lock,
  Clock, BarChart2, TrendingUp, Shield, Layers, Award,
  ArrowLeft, ArrowRight, X, Check
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  content: React.ReactNode;
}

interface Module {
  id: string;
  title: string;
  icon: React.ReactNode;
  lessons: Lesson[];
}

interface ExamQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const examQuestions: ExamQuestion[] = [
  {
    question: "What does a stock represent?",
    options: ["A loan to a company", "A share of ownership in a company", "A government bond", "A fixed interest payment"],
    correct: 1,
    explanation: "A stock represents partial ownership (equity) in a company. Shareholders are entitled to a portion of the company's assets and earnings."
  },
  {
    question: "What is Market Capitalization?",
    options: ["The total revenue of a company", "The company's annual profit", "Share Price × Total Shares Outstanding", "The book value of all assets"],
    correct: 2,
    explanation: "Market Cap = Share Price × Total Shares Outstanding. It reflects the total market value investors place on a company."
  },
  {
    question: "Which order type guarantees execution but not price?",
    options: ["Limit Order", "Stop-Limit Order", "Market Order", "Good-Till-Cancelled Order"],
    correct: 2,
    explanation: "A market order executes immediately at the best available price. It guarantees execution but the exact price may vary, especially in fast-moving markets."
  },
  {
    question: "What is the P/E ratio used for?",
    options: ["Measuring a company's debt", "Valuing a stock relative to its earnings", "Calculating dividend yield", "Measuring volatility"],
    correct: 1,
    explanation: "The Price-to-Earnings ratio compares a stock's price to its earnings per share. A high P/E may indicate the stock is expensive or that investors expect high future growth."
  },
  {
    question: "What does diversification primarily help reduce?",
    options: ["Market risk", "Unsystematic (company-specific) risk", "Inflation risk", "Interest rate risk"],
    correct: 1,
    explanation: "Diversification reduces unsystematic risk — risks specific to individual companies. It cannot eliminate systematic (market-wide) risk."
  },
  {
    question: "What is Dollar Cost Averaging (DCA)?",
    options: ["Buying stocks only when prices are low", "Investing a fixed dollar amount at regular intervals", "Selling stocks to average down losses", "Balancing stocks and bonds equally"],
    correct: 1,
    explanation: "DCA means investing a fixed amount regularly regardless of price. This strategy removes emotion, averages your cost basis, and reduces timing risk."
  },
  {
    question: "What does a high beta stock indicate?",
    options: ["Low volatility relative to the market", "High dividend payments", "High volatility relative to the market", "A stock trading below book value"],
    correct: 2,
    explanation: "Beta measures a stock's volatility relative to the market. A beta > 1 means the stock moves more dramatically than the broader market — higher risk, higher potential reward."
  },
  {
    question: "What is an IPO?",
    options: ["A type of derivative contract", "When a private company first sells shares to the public", "An intraday trading strategy", "A government-regulated bond offering"],
    correct: 1,
    explanation: "An Initial Public Offering (IPO) is when a private company sells shares to the public for the first time, listing on a stock exchange to raise capital."
  },
  {
    question: "What does CAGR stand for?",
    options: ["Current Asset Growth Rate", "Compound Annual Growth Rate", "Capital Allocation and Growth Ratio", "Cost-Adjusted Gross Revenue"],
    correct: 1,
    explanation: "CAGR (Compound Annual Growth Rate) represents the steady rate at which an investment would have grown each year to reach its final value — the smoothed annualised return."
  },
  {
    question: "Which asset allocation strategy reduces risk without eliminating growth potential?",
    options: ["100% equities", "100% bonds", "A diversified mix of stocks, bonds, and other asset classes", "Holding only cash"],
    correct: 2,
    explanation: "A diversified portfolio across asset classes balances risk and reward. Different assets often move independently, so losses in one area can be offset by gains in another."
  },
];

const modules: Module[] = [
  {
    id: 'foundations',
    title: 'Foundations of Stock Markets',
    icon: <BookOpen className="w-4 h-4" />,
    lessons: [
      {
        id: 'what-are-stocks',
        title: 'What Are Stocks?',
        duration: '5 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed text-base">A <span className="text-green-300 font-semibold">stock</span> represents a unit of ownership in a company. When a business wants to raise money, it can divide itself into millions of equal pieces — called shares — and sell them to the public. Buying a share makes you a part-owner, or <span className="text-green-300 font-semibold">shareholder</span>, of that company.</p>
            <div className="bg-[#141414] border border-green-500/20 rounded-xl p-5">
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">What shareholders receive</h4>
              <ul className="space-y-3">
                {['A proportional claim on company profits (dividends)', 'Voting rights on major company decisions', 'A share of assets if the company is sold or wound down', 'Potential capital gains if the stock price rises'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[#d4d4d8] text-sm">
                    <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-white font-semibold">Why do stock prices move?</h4>
              <p className="text-[#d4d4d8] leading-relaxed text-sm">Prices are driven by <span className="text-white font-medium">supply and demand</span>. If more people want to buy a stock than sell it, the price rises. If more want to sell, it falls. This reflects collective market sentiment about the company's future prospects.</p>
              <p className="text-[#d4d4d8] leading-relaxed text-sm">Key drivers include earnings reports, economic data, industry news, interest rates, and investor psychology. Even rumours and tweets can move prices in the short term.</p>
            </div>
            <div className="bg-[#141414] border-l-4 border-green-500 rounded-r-xl p-5">
              <p className="text-sm text-[#ededed] italic leading-relaxed">"In the short run, the market is a voting machine. In the long run, it is a weighing machine."</p>
              <p className="text-green-400 text-xs font-semibold mt-2">— Benjamin Graham</p>
            </div>
          </div>
        )
      },
      {
        id: 'how-exchanges-work',
        title: 'How Stock Exchanges Work',
        duration: '6 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed">A <span className="text-green-300 font-semibold">stock exchange</span> is an organised marketplace where buyers and sellers come together to trade shares. The two largest in the world are the <span className="text-white font-medium">NYSE</span> (New York Stock Exchange) and <span className="text-white font-medium">NASDAQ</span>.</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'NYSE', desc: 'Founded 1792. Home to blue-chip giants like JPMorgan, Walmart, and Berkshire Hathaway. Uses physical trading floor and electronic systems.', color: 'from-blue-600/20 to-blue-800/10' },
                { name: 'NASDAQ', desc: 'Fully electronic exchange launched 1971. Favoured by tech companies — Apple, Microsoft, Google, and Meta all list here.', color: 'from-green-600/20 to-green-800/10' },
              ].map(ex => (
                <div key={ex.name} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <h4 className="text-white font-bold text-lg mb-2">{ex.name}</h4>
                  <p className="text-[#d4d4d8] text-sm leading-relaxed">{ex.desc}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-white font-semibold">The role of market makers</h4>
              <p className="text-[#d4d4d8] text-sm leading-relaxed">Market makers are firms that continuously quote both a buy (bid) and sell (ask) price for a stock, ensuring there is always liquidity. The difference between the two prices is the <span className="text-green-300">spread</span> — this is how market makers earn their profit.</p>
            </div>
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <h4 className="text-white font-semibold mb-3 text-sm">Trading Hours</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#d4d4d8]"><span>Pre-market trading</span><span className="text-green-300">4:00 AM – 9:30 AM ET</span></div>
                <div className="flex justify-between text-white font-medium"><span>Regular market hours</span><span className="text-green-400">9:30 AM – 4:00 PM ET</span></div>
                <div className="flex justify-between text-[#d4d4d8]"><span>After-hours trading</span><span className="text-green-300">4:00 PM – 8:00 PM ET</span></div>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'order-types',
        title: 'Order Types Explained',
        duration: '7 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed">When you place a trade, you choose an <span className="text-green-300 font-semibold">order type</span> that determines how and when your trade executes. Choosing the right type can significantly impact the price you get.</p>
            <div className="space-y-4">
              {[
                { name: 'Market Order', tag: 'Most Common', desc: 'Executes immediately at the best available price. Fast and reliable for liquid stocks, but you have no price control. Best for large-cap stocks with tight spreads.', pro: 'Always fills', con: 'Price not guaranteed', color: 'green' },
                { name: 'Limit Order', tag: 'Most Precise', desc: "You set a specific price. A buy limit only executes at or below your price; a sell limit at or above. You control price, but there's no guarantee of execution.", pro: 'Price guaranteed', con: 'May not fill', color: 'green' },
                { name: 'Stop-Loss Order', tag: 'Risk Management', desc: 'Triggers a market order when the stock hits a specified price. Used to cap downside risk. Once triggered, it becomes a market order and fills at the next available price.', pro: 'Limits losses automatically', con: 'Can trigger on temporary dips', color: 'amber' },
                { name: 'Stop-Limit Order', tag: 'Advanced', desc: 'Combines stop and limit orders. When the stop price is hit, a limit order is placed — giving you more control but risking no fill if price moves fast.', pro: 'Controls execution price', con: 'May not execute in fast markets', color: 'blue' },
              ].map(order => (
                <div key={order.name} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-white font-semibold">{order.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-${order.color}-500/10 text-${order.color}-400 border border-${order.color}-500/20`}>{order.tag}</span>
                  </div>
                  <p className="text-[#d4d4d8] text-sm leading-relaxed mb-3">{order.desc}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-400">✓ {order.pro}</span>
                    <span className="text-red-400">✗ {order.con}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }
    ]
  },
  {
    id: 'valuation',
    title: 'Equity & Valuation',
    icon: <BarChart2 className="w-4 h-4" />,
    lessons: [
      {
        id: 'market-cap',
        title: 'Market Capitalisation',
        duration: '5 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed">Market capitalisation — or <span className="text-green-300 font-semibold">market cap</span> — is the total market value of a company's outstanding shares. It is one of the most important metrics for sizing up a company.</p>
            <div className="bg-[#141414] border border-green-500/30 rounded-xl p-5 text-center">
              <p className="text-[#a1a1aa] text-sm mb-2">Formula</p>
              <p className="text-2xl font-bold text-white">Market Cap = Share Price × Shares Outstanding</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { tier: 'Large Cap', range: '$10B+', risk: 'Lower Risk', desc: 'Established companies with stable earnings. Examples: Apple ($3T), Microsoft, Google.', color: 'green' },
                { tier: 'Mid Cap', range: '$2B – $10B', risk: 'Moderate Risk', desc: 'Growing companies with expansion potential. Often overlooked — a sweet spot for many investors.', color: 'green' },
                { tier: 'Small Cap', range: 'Under $2B', risk: 'Higher Risk', desc: 'Younger, faster-growing companies. Higher potential returns but also higher volatility and failure risk.', color: 'amber' },
              ].map(t => (
                <div key={t.tier} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <p className={`text-${t.color}-400 font-bold text-lg`}>{t.tier}</p>
                  <p className="text-white text-sm font-medium mt-1">{t.range}</p>
                  <p className={`text-xs text-${t.color}-400/70 mb-2`}>{t.risk}</p>
                  <p className="text-[#a1a1aa] text-xs leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )
      },
      {
        id: 'pe-ratio',
        title: 'P/E Ratio & Stock Valuation',
        duration: '8 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed">The <span className="text-green-300 font-semibold">Price-to-Earnings (P/E) ratio</span> tells you how much investors are willing to pay for every £1 of a company's earnings. It is the most widely used valuation metric in investing.</p>
            <div className="bg-[#141414] border border-green-500/30 rounded-xl p-5 text-center">
              <p className="text-[#a1a1aa] text-sm mb-2">Formula</p>
              <p className="text-xl font-bold text-white">P/E = Share Price ÷ Earnings Per Share (EPS)</p>
            </div>
            <div className="space-y-4">
              <h4 className="text-white font-semibold">How to interpret P/E</h4>
              <div className="space-y-3">
                {[
                  { range: 'P/E under 15', label: 'Potentially undervalued', desc: 'May indicate a bargain, or that the market expects slow growth or has concerns about the company.', color: 'green' },
                  { range: 'P/E 15–25', label: 'Fairly valued', desc: 'Typical for established, profitable companies growing at a moderate pace.', color: 'green' },
                  { range: 'P/E above 25', label: 'Growth premium', desc: 'Investors are paying up for expected future growth. Common in tech. High P/E stocks fall harder when growth disappoints.', color: 'amber' },
                ].map(item => (
                  <div key={item.range} className={`flex gap-4 bg-[#141414] border border-white/[0.06] rounded-xl p-4`}>
                    <div className={`w-2 rounded-full bg-${item.color}-500 flex-shrink-0`} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{item.range}</span>
                        <span className={`text-xs text-${item.color}-400`}>{item.label}</span>
                      </div>
                      <p className="text-[#d4d4d8] text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <h4 className="text-white font-semibold mb-2 text-sm">Other key valuation ratios</h4>
              <div className="space-y-2 text-sm">
                {[
                  ['P/B Ratio', 'Price ÷ Book Value. Useful for banks and asset-heavy companies.'],
                  ['P/S Ratio', 'Price ÷ Revenue. Good for high-growth companies with little or no profit.'],
                  ['EV/EBITDA', 'Enterprise Value ÷ EBITDA. Strips out debt and taxes for cleaner comparison.'],
                ].map(([name, desc]) => (
                  <div key={name} className="flex gap-2">
                    <span className="text-green-400 font-semibold w-24 flex-shrink-0">{name}</span>
                    <span className="text-[#d4d4d8]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'reading-earnings',
        title: 'Reading Earnings Reports',
        duration: '9 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed">Every public company must report its financial results <span className="text-green-300 font-semibold">quarterly</span>. Earnings season (four times a year) is one of the most important periods for stock prices — a single report can move a stock 10–20% in either direction.</p>
            <div className="space-y-4">
              <h4 className="text-white font-semibold">The three key financial statements</h4>
              {[
                { name: 'Income Statement', desc: 'Shows revenue, expenses, and profit over a period. Key lines: Revenue, Gross Profit, Operating Income, Net Income, EPS.' },
                { name: 'Balance Sheet', desc: 'A snapshot of what the company owns (assets) and owes (liabilities) at a point in time. Assets = Liabilities + Equity.' },
                { name: 'Cash Flow Statement', desc: 'Tracks actual cash movement — operations, investing, and financing. Free Cash Flow = Operating CF – Capital Expenditures.' },
              ].map(stmt => (
                <div key={stmt.name} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <h5 className="text-green-300 font-semibold mb-2">{stmt.name}</h5>
                  <p className="text-[#d4d4d8] text-sm leading-relaxed">{stmt.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#141414] border-l-4 border-green-500 rounded-r-xl p-5">
              <p className="text-white font-semibold mb-2 text-sm">Analyst Estimates: Beat vs Miss</p>
              <p className="text-[#d4d4d8] text-sm leading-relaxed">Wall Street analysts publish revenue and EPS estimates before each report. A stock that <span className="text-green-400">beats estimates</span> often rallies sharply. A stock that <span className="text-red-400">misses estimates</span> often drops — even if the company is still profitable. It's all about expectations.</p>
            </div>
          </div>
        )
      }
    ]
  },
  {
    id: 'compounding',
    title: 'Mathematics of Compounding',
    icon: <TrendingUp className="w-4 h-4" />,
    lessons: [
      {
        id: 'compound-growth',
        title: 'The Power of Compounding',
        duration: '6 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed">Compounding is the process where your returns generate their own returns. Albert Einstein reportedly called it the <span className="text-green-300 font-semibold">"eighth wonder of the world"</span>. Over long periods, even modest annual returns produce extraordinary results.</p>
            <div className="bg-[#141414] border border-green-500/30 rounded-xl p-5 text-center">
              <p className="text-[#a1a1aa] text-sm mb-2">Compound Growth Formula</p>
              <p className="text-xl font-bold text-white">A = P(1 + r/n)^(nt)</p>
              <div className="grid grid-cols-4 gap-2 mt-4 text-xs text-[#a1a1aa]">
                {[['A', 'Final amount'], ['P', 'Principal'], ['r', 'Annual rate'], ['n', 'Compounds/year']].map(([v, d]) => (
                  <div key={v}><span className="text-green-400 font-bold">{v}</span> = {d}</div>
                ))}
              </div>
            </div>
            <h4 className="text-white font-semibold">$10,000 invested at 10% annual return</h4>
            <div className="space-y-2">
              {[['10 years', '$25,937', '159%'], ['20 years', '$67,275', '573%'], ['30 years', '$174,494', '1,645%'], ['40 years', '$452,593', '4,426%']].map(([yr, val, pct]) => (
                <div key={yr} className="flex items-center gap-4">
                  <span className="text-[#a1a1aa] text-sm w-20">{yr}</span>
                  <div className="flex-1 bg-[#0a0a0a] rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, parseInt(pct) / 50)}%` }} />
                  </div>
                  <span className="text-white font-semibold text-sm w-24 text-right">{val}</span>
                  <span className="text-green-400 text-xs w-16 text-right">+{pct}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <p className="text-white font-semibold mb-2 text-sm">The Rule of 72</p>
              <p className="text-[#d4d4d8] text-sm leading-relaxed">Divide 72 by your annual return rate to estimate how long it takes to double your money. At 8% returns: 72 ÷ 8 = <span className="text-green-300 font-semibold">9 years to double</span>. At 12%: just 6 years.</p>
            </div>
          </div>
        )
      },
      {
        id: 'dca',
        title: 'Dollar Cost Averaging',
        duration: '5 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed"><span className="text-green-300 font-semibold">Dollar Cost Averaging (DCA)</span> is a strategy where you invest a fixed dollar amount at regular intervals — weekly, monthly, or quarterly — regardless of the market price. It is one of the most effective and psychologically sound investment strategies.</p>
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <h4 className="text-white font-semibold mb-4 text-sm">Example: Investing $500/month in AAPL</h4>
              <div className="space-y-2 text-sm">
                {[['January', '$150', '3.33 shares'], ['February', '$120', '4.17 shares'], ['March', '$180', '2.78 shares'], ['April', '$140', '3.57 shares']].map(([month, price, shares]) => (
                  <div key={month} className="grid grid-cols-3 gap-2 py-2 border-b border-white/[0.04]">
                    <span className="text-[#a1a1aa]">{month}</span>
                    <span className="text-white font-medium">{price}/share</span>
                    <span className="text-green-400">{shares}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-[#a1a1aa] text-xs">Avg: ~$147/share</span>
                  <span className="text-green-400 font-semibold">13.85 shares</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: 'Benefits', items: ['Removes emotion from investing', 'No need to time the market', 'Automatically buys more when cheap', 'Builds disciplined habits'], color: 'green' },
                { title: 'Limitations', items: ['Underperforms lump-sum in bull markets', 'Requires consistent income', 'Transaction fees can add up', 'Still exposed to market risk'], color: 'red' },
              ].map(col => (
                <div key={col.title} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <h5 className={`text-${col.color}-400 font-semibold mb-3 text-sm`}>{col.title}</h5>
                  <ul className="space-y-2">
                    {col.items.map(item => (
                      <li key={item} className={`flex items-start gap-2 text-xs text-[#d4d4d8]`}>
                        <span className={`text-${col.color}-400 mt-0.5`}>{col.color === 'green' ? '✓' : '✗'}</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      }
    ]
  },
  {
    id: 'risk',
    title: 'Risk & Diversification',
    icon: <Shield className="w-4 h-4" />,
    lessons: [
      {
        id: 'types-of-risk',
        title: 'Types of Investment Risk',
        duration: '7 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed">Every investment carries risk. Understanding the different types of risk is essential to managing your portfolio effectively. Not all risk can be eliminated — but much of it can be managed.</p>
            <div className="space-y-3">
              {[
                { name: 'Systematic Risk', aka: 'Market Risk', desc: 'Affects the entire market. Cannot be diversified away. Examples: recessions, interest rate changes, geopolitical events, pandemics.', icon: '🌐' },
                { name: 'Unsystematic Risk', aka: 'Company/Industry Risk', desc: 'Specific to a single company or sector. Can be reduced through diversification. Examples: CEO scandal, product recall, regulatory fine.', icon: '🏢' },
                { name: 'Liquidity Risk', aka: 'Exit Risk', desc: 'The risk of not being able to sell an investment quickly at a fair price. Small-cap stocks and private investments carry high liquidity risk.', icon: '💧' },
                { name: 'Inflation Risk', aka: 'Purchasing Power Risk', desc: 'The risk that returns do not keep up with inflation. Cash and low-yield bonds are most exposed. Equities historically outpace inflation.', icon: '📈' },
                { name: 'Concentration Risk', aka: 'Overexposure Risk', desc: 'Too much of your portfolio in one stock, sector, or geography. If that one bet fails, the damage is severe.', icon: '⚠️' },
              ].map(risk => (
                <div key={risk.name} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5 flex gap-4">
                  <span className="text-2xl">{risk.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-white font-semibold text-sm">{risk.name}</h5>
                      <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">{risk.aka}</span>
                    </div>
                    <p className="text-[#d4d4d8] text-sm leading-relaxed">{risk.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      },
      {
        id: 'diversification',
        title: 'Building a Diversified Portfolio',
        duration: '8 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed"><span className="text-green-300 font-semibold">Diversification</span> means spreading your investments across different assets so that a single loss doesn't cripple your portfolio. It is the only "free lunch" in investing — reducing risk without necessarily sacrificing returns.</p>
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <h4 className="text-white font-semibold mb-4 text-sm">Sample balanced portfolio allocation</h4>
              {[
                { label: 'US Large Cap Stocks', pct: 40, color: 'bg-green-500' },
                { label: 'International Stocks', pct: 20, color: 'bg-blue-500' },
                { label: 'Bonds', pct: 20, color: 'bg-green-500' },
                { label: 'Small & Mid Cap', pct: 10, color: 'bg-amber-500' },
                { label: 'Cash / Alternatives', pct: 10, color: 'bg-red-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 mb-3">
                  <span className="text-[#a1a1aa] text-xs w-40 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 bg-[#0a0a0a] rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-white text-xs font-semibold w-8 text-right">{item.pct}%</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-white font-semibold">Correlation: The key to true diversification</h4>
              <p className="text-[#d4d4d8] text-sm leading-relaxed">Assets that move <span className="text-red-400">together</span> (high correlation) don't truly diversify. Assets that move <span className="text-green-400">independently or oppositely</span> (low or negative correlation) do. This is why bonds often rise when stocks fall — and why combining them reduces portfolio volatility.</p>
            </div>
            <div className="bg-[#141414] border-l-4 border-amber-500 rounded-r-xl p-5">
              <p className="text-amber-300 font-semibold text-sm mb-1">Common diversification mistakes</p>
              <ul className="space-y-1 text-sm text-[#d4d4d8]">
                <li>• Owning 10 tech stocks and thinking you're diversified</li>
                <li>• Holding only domestic stocks — global diversification matters</li>
                <li>• Ignoring time diversification — investing all at once near a peak</li>
              </ul>
            </div>
          </div>
        )
      }
    ]
  },
  {
    id: 'portfolio',
    title: 'Portfolio Construction',
    icon: <Layers className="w-4 h-4" />,
    lessons: [
      {
        id: 'asset-allocation',
        title: 'Asset Allocation Strategies',
        duration: '8 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed"><span className="text-green-300 font-semibold">Asset allocation</span> is the process of dividing your portfolio among different asset categories — stocks, bonds, cash, real estate, and alternatives. It is the single most important decision an investor makes, accounting for over 90% of long-term portfolio performance.</p>
            <div className="space-y-4">
              {[
                { name: 'Aggressive Growth', stocks: 90, bonds: 5, cash: 5, desc: 'For young investors with long time horizons and high risk tolerance. Maximum growth potential, maximum volatility.', time: '20+ years' },
                { name: 'Balanced', stocks: 60, bonds: 30, cash: 10, desc: 'Classic 60/40 portfolio. Moderate growth with meaningful downside protection. The most widely recommended all-weather approach.', time: '10–20 years' },
                { name: 'Conservative', stocks: 30, bonds: 60, cash: 10, desc: 'Capital preservation with modest growth. Suitable for investors near or in retirement who cannot afford large drawdowns.', time: 'Under 10 years' },
              ].map(strat => (
                <div key={strat.name} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="text-white font-semibold">{strat.name}</h5>
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">{strat.time}</span>
                  </div>
                  <p className="text-[#d4d4d8] text-sm leading-relaxed mb-4">{strat.desc}</p>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    <div className="bg-green-500 h-full rounded-l-full" style={{ width: `${strat.stocks}%` }} title={`Stocks ${strat.stocks}%`} />
                    <div className="bg-blue-400 h-full" style={{ width: `${strat.bonds}%` }} title={`Bonds ${strat.bonds}%`} />
                    <div className="bg-zinc-600 h-full rounded-r-full" style={{ width: `${strat.cash}%` }} title={`Cash ${strat.cash}%`} />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-[#a1a1aa]">
                    <span><span className="text-green-400">■</span> Stocks {strat.stocks}%</span>
                    <span><span className="text-blue-400">■</span> Bonds {strat.bonds}%</span>
                    <span><span className="text-zinc-400">■</span> Cash {strat.cash}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      },
      {
        id: 'rebalancing',
        title: 'Rebalancing & Tax Efficiency',
        duration: '7 min',
        completed: false,
        content: (
          <div className="space-y-6">
            <p className="text-[#d4d4d8] leading-relaxed"><span className="text-green-300 font-semibold">Rebalancing</span> is the process of realigning your portfolio back to its target allocation after market movements have shifted the weightings. Without rebalancing, a 60/40 portfolio in a bull market can drift to 80/20 — taking on far more risk than intended.</p>
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <h4 className="text-white font-semibold mb-3 text-sm">When to rebalance</h4>
              <div className="space-y-3">
                {[
                  { method: 'Calendar Rebalancing', desc: 'Rebalance on a set schedule — quarterly or annually. Simple and consistent, avoids over-trading.' },
                  { method: 'Threshold Rebalancing', desc: 'Rebalance when any asset class drifts more than 5% from target. More precise, responds to large market moves.' },
                  { method: 'Hybrid Approach', desc: 'Check on a schedule but only rebalance if thresholds are breached. Best of both worlds for most investors.' },
                ].map(item => (
                  <div key={item.method} className="border-l-2 border-green-500/50 pl-4">
                    <p className="text-white font-medium text-sm">{item.method}</p>
                    <p className="text-[#d4d4d8] text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-white font-semibold">Tax-efficient investing</h4>
              <div className="space-y-2 text-sm text-[#d4d4d8]">
                <p><span className="text-green-300 font-medium">Tax-advantaged accounts first:</span> Max out ISAs, 401(k)s, or pension contributions before taxable accounts. Growth compounds tax-free.</p>
                <p><span className="text-green-300 font-medium">Hold period matters:</span> Long-term capital gains (assets held 1+ year) are taxed at lower rates than short-term gains.</p>
                <p><span className="text-green-300 font-medium">Tax-loss harvesting:</span> Deliberately selling losing positions to offset gains and reduce your tax bill for the year.</p>
              </div>
            </div>
          </div>
        )
      }
    ]
  }
];

const Tutorials: React.FC = () => {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [showExam, setShowExam] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);

  const allLessons = modules.flatMap(m => m.lessons);
  const totalLessons = allLessons.length;
  const completedCount = completedLessons.size;
  const progressPct = Math.round((completedCount / totalLessons) * 100);
  const allDone = completedCount === totalLessons;

  const activeModule = modules.find(m => m.id === activeModuleId) ?? null;
  const activeLesson = activeModule?.lessons.find(l => l.id === activeLessonId) ?? null;

  const markComplete = (lessonId: string) => {
    setCompletedLessons(prev => new Set([...prev, lessonId]));
  };

  const goToLesson = (moduleId: string, lessonId: string) => {
    setActiveModuleId(moduleId);
    setActiveLessonId(lessonId);
    setShowExam(false);
  };

  const goNext = () => {
    if (!activeModule || !activeLesson) return;
    markComplete(activeLesson.id);
    const lessonIdx = activeModule.lessons.findIndex(l => l.id === activeLessonId);
    if (lessonIdx < activeModule.lessons.length - 1) {
      setActiveLessonId(activeModule.lessons[lessonIdx + 1].id);
    } else {
      const modIdx = modules.findIndex(m => m.id === activeModuleId);
      if (modIdx < modules.length - 1) {
        const nextMod = modules[modIdx + 1];
        setActiveModuleId(nextMod.id);
        setActiveLessonId(nextMod.lessons[0].id);
      } else {
        setActiveLessonId(null);
        setActiveModuleId(null);
      }
    }
  };

  const examScore = Object.entries(examAnswers).filter(([i, a]) => examQuestions[parseInt(i)].correct === a).length;

  if (showExam) {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto pb-20">
        <button onClick={() => setShowExam(false)} className="flex items-center gap-2 text-[#a1a1aa] hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Course
        </button>
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center">
            <Award className="text-amber-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Final Exam</h1>
            <p className="text-sm text-[#a1a1aa] mt-1">10 questions · Pass mark: 70%</p>
          </div>
        </div>

        {examSubmitted ? (
          <div className="space-y-6">
            <div className={`p-8 rounded-xl border text-center ${examScore >= 7 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <p className="text-6xl font-bold text-white mb-2">{examScore}/10</p>
              <p className={`text-xl font-semibold ${examScore >= 7 ? 'text-green-400' : 'text-red-400'}`}>{examScore >= 7 ? '🎉 Passed!' : '📚 Keep studying'}</p>
              <p className="text-[#a1a1aa] text-sm mt-2">{examScore >= 7 ? 'Excellent work. You have a solid grasp of investing fundamentals.' : 'Review the lessons and try again. You need 7/10 to pass.'}</p>
              {examScore < 7 && (
                <button onClick={() => { setExamAnswers({}); setExamSubmitted(false); }} className="mt-4 px-6 py-2 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-500 transition-colors">Retake Exam</button>
              )}
            </div>
            <div className="space-y-4">
              {examQuestions.map((q, i) => {
                const answered = examAnswers[i];
                const correct = q.correct === answered;
                return (
                  <div key={i} className={`bg-[#161616] border rounded-xl p-5 ${correct ? 'border-green-500/30' : 'border-red-500/30'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      {correct ? <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" /> : <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                      <p className="text-white font-medium text-sm">{q.question}</p>
                    </div>
                    <p className="text-[#a1a1aa] text-xs ml-8">✓ {q.options[q.correct]}</p>
                    {!correct && <p className="text-red-400 text-xs ml-8">Your answer: {q.options[answered]}</p>}
                    <p className="text-[#d4d4d8] text-xs ml-8 mt-2 italic">{q.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {examQuestions.map((q, i) => (
              <div key={i} className="bg-[#161616] border border-white/[0.06] rounded-xl p-6">
                <p className="text-white font-semibold mb-4"><span className="text-green-400 mr-2">Q{i + 1}.</span>{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <button key={oi} onClick={() => setExamAnswers(prev => ({ ...prev, [i]: oi }))}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${examAnswers[i] === oi ? 'border-green-500 bg-green-500/15 text-white' : 'border-white/[0.06] text-[#d4d4d8] hover:border-white/[0.15] hover:bg-white/[0.02]'}`}>
                      <span className="text-green-400 font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => setExamSubmitted(true)}
              disabled={Object.keys(examAnswers).length < examQuestions.length}
              className="w-full py-4 bg-green-500 text-black font-semibold rounded-xl hover:bg-green-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Submit Exam ({Object.keys(examAnswers).length}/{examQuestions.length} answered)
            </button>
          </div>
        )}
      </div>
    );
  }

  if (activeLesson && activeModule) {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto pb-20">
        <button onClick={() => { setActiveLessonId(null); setActiveModuleId(null); }} className="flex items-center gap-2 text-[#a1a1aa] hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Course
        </button>
        <div className="mb-2 text-xs text-green-400 font-semibold uppercase tracking-wider">{activeModule.title}</div>
        <h1 className="text-3xl font-bold text-white mb-2">{activeLesson.title}</h1>
        <div className="flex items-center gap-3 mb-10">
          <Clock className="w-3.5 h-3.5 text-[#a1a1aa]" />
          <span className="text-[#a1a1aa] text-sm">{activeLesson.duration} read</span>
          {completedLessons.has(activeLesson.id) && <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Completed</span>}
        </div>
        <div className="prose prose-invert max-w-none">
          {activeLesson.content}
        </div>
        <div className="flex justify-between items-center mt-12 pt-8 border-t border-white/[0.06]">
          <button onClick={() => { setActiveLessonId(null); setActiveModuleId(null); }} className="flex items-center gap-2 text-[#a1a1aa] hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> All Lessons
          </button>
          <button onClick={goNext} className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-full transition-colors">
            {completedLessons.has(activeLesson.id) ? 'Next Lesson' : 'Mark Complete & Continue'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <BookOpen className="text-black w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Stock Market Mastery</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">{totalLessons} lessons · Beginner to Advanced · Final Exam included</p>
        </div>
      </div>

      <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-6 mb-10">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-white">Your Progress</span>
          <span className="text-sm font-bold text-green-400">{completedCount}/{totalLessons} lessons</span>
        </div>
        <div className="w-full bg-[#0a0a0a] rounded-full h-2.5 mb-3">
          <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-[#a1a1aa]">{progressPct}% complete{allDone ? ' — You can now take the final exam!' : ''}</p>
      </div>

      <div className="space-y-4 mb-10">
        {modules.map((mod, modIdx) => {
          const modCompleted = mod.lessons.filter(l => completedLessons.has(l.id)).length;
          const modTotal = mod.lessons.length;
          const isUnlocked = modIdx === 0 || modules.slice(0, modIdx).every(m => m.lessons.every(l => completedLessons.has(l.id)));
          return (
            <div key={mod.id} className="bg-[#161616] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${modCompleted === modTotal ? 'bg-green-500/20 text-green-400' : 'bg-green-500/10 text-green-400'}`}>
                    {modCompleted === modTotal ? <CheckCircle className="w-4 h-4" /> : mod.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{mod.title}</h3>
                    <p className="text-xs text-[#a1a1aa]">{modCompleted}/{modTotal} lessons complete</p>
                  </div>
                </div>
                {!isUnlocked && <Lock className="w-4 h-4 text-[#52525b]" />}
              </div>
              <div className="divide-y divide-white/[0.04]">
                {mod.lessons.map((lesson, li) => {
                  const done = completedLessons.has(lesson.id);
                  const locked = !isUnlocked;
                  return (
                    <button key={lesson.id} disabled={locked} onClick={() => goToLesson(mod.id, lesson.id)}
                      className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-all ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.02] cursor-pointer'}`}>
                      <div className="flex-shrink-0">
                        {done ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Circle className="w-5 h-5 text-[#52525b]" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${done ? 'text-[#a1a1aa]' : 'text-white'}`}>{lesson.title}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#52525b] flex items-center gap-1"><Clock className="w-3 h-3" />{lesson.duration}</span>
                        <ChevronRight className={`w-4 h-4 ${locked ? 'text-[#27272a]' : 'text-[#52525b]'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border ${allDone ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#161616] border-white/[0.06]'}`}>
        <div className="flex items-center gap-5">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${allDone ? 'bg-amber-500/20' : 'bg-[#0a0a0a]'}`}>
            <Award className={`w-7 h-7 ${allDone ? 'text-amber-400' : 'text-[#52525b]'}`} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Final Exam</h3>
            <p className="text-[#a1a1aa] text-sm mt-0.5">{allDone ? '10 questions · Pass with 70% to earn your certificate' : `Complete all ${totalLessons} lessons to unlock the final exam`}</p>
          </div>
        </div>
        <button onClick={() => setShowExam(true)} disabled={!allDone}
          className={`flex-shrink-0 flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm transition-all ${allDone ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-[#0a0a0a] text-[#52525b] cursor-not-allowed border border-white/[0.04]'}`}>
          {allDone ? 'Take Exam' : <><Lock className="w-4 h-4" /> Locked</>} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Tutorials;
