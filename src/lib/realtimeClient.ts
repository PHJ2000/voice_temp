'use client';

import { useEffect, useMemo } from 'react';
import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import type { RealtimeItem, TransportLayerAudio } from '@openai/agents-realtime';

export const DEFAULT_REALTIME_MODEL = 'gpt-realtime-mini';
const DEFAULT_ENDPOINT = '/api/session';
const DEFAULT_INSTRUCTIONS =
  '당신은 한국어만 사용하는 실시간 어시스턴트입니다. 모든 응답은 자연스럽고, 정중하며 어휘는 일관되게 한국어로만 제공하세요.';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type RealtimeConnectionStatus = ConnectionStatus;

export type RealtimeClientMessagePayload = {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  source: 'assistant' | 'user';
};

export type RealtimeClientAudioPayload = {
  id: string;
  url: string;
  transcript?: string | null;
  origin: 'history' | 'transport';
};

type RealtimeClientEvents = {
  status: (status: ConnectionStatus) => void;
  message: (message: RealtimeClientMessagePayload) => void;
  audio: (payload: RealtimeClientAudioPayload) => void;
  error: (error: unknown) => void;
};

export interface RealtimeClientOptions {
  endpoint?: string;
  model?: string;
  instructions?: string;
  agentName?: string;
}

export class RealtimeClient {
  private endpoint: string;
  private model: string;
  private instructions: string;
  private agentName: string;

  private session?: RealtimeSession;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private transportListenersSet = false;

  private listeners: {
    [K in keyof RealtimeClientEvents]: Set<RealtimeClientEvents[K]>;
  } = {
    status: new Set(),
    message: new Set(),
    audio: new Set(),
    error: new Set(),
  };

  constructor(options?: RealtimeClientOptions) {
    this.endpoint = options?.endpoint ?? DEFAULT_ENDPOINT;
    this.model = options?.model ?? DEFAULT_REALTIME_MODEL;
    this.instructions = options?.instructions ?? DEFAULT_INSTRUCTIONS;
    this.agentName = options?.agentName ?? 'Realtime Demo Agent';
  }

  public on<K extends keyof RealtimeClientEvents>(
    event: K,
    handler: RealtimeClientEvents[K]
  ) {
    this.listeners[event].add(handler);
  }

  public off<K extends keyof RealtimeClientEvents>(
    event: K,
    handler: RealtimeClientEvents[K]
  ) {
    this.listeners[event].delete(handler);
  }

  public async connect() {
    if (this.session) {
      return;
    }

    this.emit('status', 'connecting');

    const clientSecret = await this.fetchClientSecret();
    const agent = new RealtimeAgent({
      name: this.agentName,
      instructions: this.instructions,
    });

    const session = new RealtimeSession(agent, {
      model: this.model,
      transport: 'webrtc',
      config: {
        instructions: this.instructions,
      },
    });

    this.attachSessionListeners(session);

    try {
      await session.connect({
        apiKey: clientSecret,
        model: this.model,
      });
      this.session = session;
      this.emit('status', 'connected');
    } catch (error) {
      this.detachSessionListeners();
      this.emit('error', error);
      this.emit('status', 'disconnected');
      throw error;
    }
  }

  public disconnect() {
    if (!this.session) {
      this.connectionStatus = 'disconnected';
      this.emit('status', 'disconnected');
      return;
    }

    this.session.close();
    this.detachSessionListeners();
    this.session = undefined;
    this.connectionStatus = 'disconnected';
    this.emit('status', 'disconnected');
  }

  public isConnected() {
    return this.connectionStatus === 'connected';
  }

  public getConnectionStatus() {
    return this.connectionStatus;
  }

  public getMicState(): boolean | null {
    const muted = this.session?.transport?.muted;
    if (muted === null || typeof muted === 'undefined') {
      return null;
    }
    return !muted;
  }

  public startMic() {
    if (!this.session) {
      return;
    }

    this.session.transport.mute(false);
  }

  public stopMic() {
    if (!this.session) {
      return;
    }

    this.session.transport.mute(true);
  }

  public sendText(message: string) {
    if (!this.session) {
      throw new Error('Realtime 세션이 연결되어 있지 않습니다.');
    }

    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    this.emit('message', {
      id: `client-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16)}`}`,
      role: 'user',
      text: trimmed,
      source: 'user',
    });

    this.session.sendMessage(trimmed);
  }

  private attachSessionListeners(session: RealtimeSession) {
    session.on('history_added', this.handleHistoryItem);
    session.on('error', this.handleSessionError);

    session.transport.on('connection_change', this.handleConnectionChange);
    session.transport.on('audio', this.handleTransportAudio);
    this.transportListenersSet = true;
  }

  private detachSessionListeners() {
    if (!this.session) {
      return;
    }

    this.session.off('history_added', this.handleHistoryItem);
    this.session.off('error', this.handleSessionError);

    if (this.transportListenersSet) {
      this.session.transport.off('connection_change', this.handleConnectionChange);
      this.session.transport.off('audio', this.handleTransportAudio);
      this.transportListenersSet = false;
    }
  }

  private handleConnectionChange = (status: ConnectionStatus) => {
    this.connectionStatus = status;
    this.emit('status', status);
  };

  private handleSessionError = ([error]: [unknown]) => {
    this.emit('error', error);
  };

  private handleTransportAudio = (event: TransportLayerAudio) => {
    const url = this.createAudioUrl(event.data);
    this.emit('audio', {
      id: event.responseId,
      url,
      origin: 'transport',
    });
  };

  private handleHistoryItem = (item: RealtimeItem) => {
    if (item.type !== 'message' || item.role !== 'assistant') {
      return;
    }

    const textParts = item.content
      .filter(
        (content): content is { type: 'output_text'; text: string } =>
          content.type === 'output_text'
      )
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join(' ');

    if (textParts) {
      this.emit('message', {
        id: item.itemId,
        role: item.role,
        text: textParts,
        source: 'assistant',
      });
    }

    item.content
      .filter(
        (
          part
        ): part is {
          type: 'output_audio';
          audio?: string | null;
          transcript?: string | null;
        } => part.type === 'output_audio' && !!part.audio
      )
      .forEach((audioPart) => {
        const buffer = this.base64ToArrayBuffer(audioPart.audio!);
        const url = this.createAudioUrl(buffer);
        this.emit('audio', {
          id: item.itemId,
          url,
          origin: 'history',
          transcript: audioPart.transcript ?? null,
        });
      });
  };

  private emit<K extends keyof RealtimeClientEvents>(
    event: K,
    payload: Parameters<RealtimeClientEvents[K]>[0]
  ) {
    this.listeners[event].forEach((handler) => handler(payload));
  }

  private async fetchClientSecret() {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({ model: this.model }),
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Realtime 세션 토큰 요청 실패: ${response.status} ${text}`);
    }

    type ClientSecretPayload = {
      value?: string;
      client_secret?: { value?: string };
      session?: { client_secret?: { value?: string } };
    };

    const payload = (await response.json()) as ClientSecretPayload;
    const value =
      typeof payload.value === 'string'
        ? payload.value
        : typeof payload.client_secret?.value === 'string'
        ? payload.client_secret.value
        : typeof payload.session?.client_secret?.value === 'string'
        ? payload.session.client_secret.value
        : null;

    if (!value) {
      throw new Error('서버가 client_secret을 반환하지 않았습니다.');
    }

    return value;
  }

  private base64ToArrayBuffer(base64: string) {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  }

  private createAudioUrl(buffer: ArrayBuffer) {
    const blob = new Blob([buffer], { type: 'audio/ogg; codecs=opus' });
    return URL.createObjectURL(blob);
  }
}

export function useRealtimeClient(options?: RealtimeClientOptions) {
  const client = useMemo(
    () =>
      new RealtimeClient({
        endpoint: options?.endpoint,
        model: options?.model,
        instructions: options?.instructions,
        agentName: options?.agentName,
      }),
    [options?.endpoint, options?.model, options?.instructions, options?.agentName]
  );

  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  return client;
}
