import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.REALTIME_MODEL ?? 'gpt-realtime-mini';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SessionRequestBody {
  model?: string;
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY가 설정되어 있지 않습니다.' },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as SessionRequestBody;
  const model = body.model?.trim() || DEFAULT_MODEL;

  try {
    const clientSecret = await openai.realtime.clientSecrets.create({
      session: {
        type: 'realtime',
        model,
        output_modalities: ['audio'],
        audio: {
          input: {
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
          output: {
            voice: 'marin',
          },
        },
      },
    });

    return NextResponse.json(clientSecret);
  } catch (error) {
    console.error('Realtime 세션 생성 실패', error);
    return NextResponse.json(
      {
        error: 'Realtime 세션 생성 중 오류가 발생했습니다.',
        detail: error?.toString?.() ?? 'unknown',
      },
      { status: 500 }
    );
  }
}
