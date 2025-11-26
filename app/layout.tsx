import './globals.css';

export const metadata = {
  title: 'Realtime GPT Template',
  description: 'gpt-realtime-mini 데모를 위한 최소 Next.js 템플릿',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <main className="app-shell">{children}</main>
      </body>
    </html>
  );
}
