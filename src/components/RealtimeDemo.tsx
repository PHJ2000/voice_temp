'use client';

import { useEffect, useState } from 'react';
import {
  RealtimeClientAudioPayload,
  RealtimeClientMessagePayload,
  RealtimeConnectionStatus,
  useRealtimeClient,
} from '../lib/realtimeClient';

const statusLabels: Record<RealtimeConnectionStatus, string> = {
  connected: '연결됨',
  connecting: '연결 중',
  disconnected: '연결 안 됨',
};

export default function RealtimeDemo() {
  const client = useRealtimeClient();
  const [status, setStatus] = useState<RealtimeConnectionStatus>('disconnected');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<RealtimeClientMessagePayload[]>([]);
  const [audioClips, setAudioClips] = useState<RealtimeClientAudioPayload[]>([]);
  const [micEnabled, setMicEnabled] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleStatus = (nextStatus: RealtimeConnectionStatus) => {
      setStatus(nextStatus);
      setMicEnabled(client.getMicState());
    };

    const handleMessage = (message: RealtimeClientMessagePayload) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleAudio = (payload: RealtimeClientAudioPayload) => {
      setAudioClips((prev) => [...prev, payload].slice(-5));
    };

    const handleError = (error: unknown) => {
      const message =
        typeof error === 'string'
          ? error
          : error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';
      setErrorMessage(message);
    };

    client.on('status', handleStatus);
    client.on('message', handleMessage);
    client.on('audio', handleAudio);
    client.on('error', handleError);

    return () => {
      client.off('status', handleStatus);
      client.off('message', handleMessage);
      client.off('audio', handleAudio);
      client.off('error', handleError);
    };
  }, [client]);

  const connect = async () => {
    setErrorMessage(null);
    try {
      await client.connect();
      setMicEnabled(client.getMicState());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Realtime 연결 중 오류가 발생했습니다.';
      setErrorMessage(message);
    }
  };

  const disconnect = () => {
    client.disconnect();
    setStatus('disconnected');
    setMicEnabled(null);
  };

  const send = () => {
    if (!input.trim()) {
      setInput('');
      return;
    }

    try {
      client.sendText(input);
      setInput('');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '텍스트 전송 중 오류가 발생했습니다.';
      setErrorMessage(message);
    }
  };

  const toggleMic = () => {
    if (micEnabled) {
      client.stopMic();
      setMicEnabled(false);
    } else {
      client.startMic();
      setMicEnabled(true);
    }
  };

  const playClip = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(() => {
      setErrorMessage('오디오 재생 중 오류가 발생했습니다.');
    });
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div>
      <div className="panel-heading">
        <div>
          <p>
            상태: <strong>{statusLabels[status]}</strong>
          </p>
          <p>
            마이크: <strong>{micEnabled ? '켜짐' : micEnabled === null ? '알 수 없음' : '꺼짐'}</strong>
          </p>
        </div>
        <div>
          <button type="button" onClick={connect} disabled={status === 'connected'}>
            연결
          </button>
          <button type="button" onClick={disconnect} disabled={status !== 'connected'}>
            연결 끊기
          </button>
          <button type="button" onClick={toggleMic} disabled={status !== 'connected'}>
            {micEnabled ? '마이크 끄기' : '마이크 켜기'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="모델에게 보낼 텍스트를 입력하세요."
          style={{ width: '70%', padding: '0.5rem', marginRight: '0.5rem' }}
        />
        <button type="button" onClick={send} disabled={status !== 'connected' || !input.trim()}>
          전송
        </button>
      </div>

      {errorMessage && (
        <p style={{ color: '#f87171', marginTop: 0 }}>
          오류: <strong>{errorMessage}</strong>
        </p>
      )}

      <section style={{ marginBottom: '1rem' }}>
        <h2>텍스트 응답 ({messages.length})</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {messages.map((message) => (
            <li
              key={message.id}
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.75rem',
                background: message.source === 'assistant' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                border: `1px solid ${message.source === 'assistant' ? 'rgba(59,130,246,0.6)' : 'rgba(16,185,129,0.6)'}`,
              }}
            >
              <p style={{ margin: '0 0 0.35rem' }}>
                <strong>{message.source === 'assistant' ? '모델' : '사용자'}</strong>
              </p>
              <p style={{ margin: 0 }}>{message.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>오디오 응답 ({audioClips.length})</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {audioClips.map((clip) => (
            <li
              key={`${clip.origin}-${clip.id}-${clip.url}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.75rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div>
                <p style={{ margin: '0 0 0.25rem' }}>{clip.origin === 'history' ? '모델 산출' : 'Transport 오디오'}</p>
                {clip.transcript && <p style={{ margin: 0, fontSize: '0.85rem' }}>전사: {clip.transcript}</p>}
              </div>
              <button type="button" onClick={() => playClip(clip.url)}>
                재생
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
