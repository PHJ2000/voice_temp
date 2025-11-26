'use client';

import RealtimeDemo from '../src/components/RealtimeDemo';

export default function HomePage() {
  return (
    <section className="card">
      <header className="panel-heading">
        <h1>gpt-realtime-mini Realtime 데모</h1>
        <small className="status-pill">Next.js + Agents SDK</small>
      </header>
      <RealtimeDemo />
    </section>
  );
}
