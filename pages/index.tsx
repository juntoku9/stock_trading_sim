import dynamic from 'next/dynamic';

const PaperTradeApp = dynamic(() => import('../App'), {
  ssr: false,
});

export default function HomePage() {
  return <PaperTradeApp />;
}
