// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  //  고정 프로덕션 도메인 (대표 주소)
  const PROD_VERCEL = 'https://car-nft-front.vercel.app';

  // Vercel 프리뷰/브랜치 도메인들:
  //   예) car-nft-front-git-main-hamsanguks-projects.vercel.app
  //       car-nft-front-6y2966hrj-hamsanguks-projects.vercel.app
  const vercelPreviewRegex = /^https?:\/\/car-nft-front(?:-[a-z0-9-]+)?-hamsanguks-projects\.vercel\.app$/i;

  // 로컬 개발용: localhost:3000 ~ 3009
  const localRegex = /^https?:\/\/localhost:300[0-9]$/;

  // 필요 시 환경변수로 추가 허용 도메인을 넣을 수도 있음(쉼표구분)
  //    e.g. CORS_EXTRA_ORIGINS="https://example.com,https://foo.bar"
  const extraOriginsEnv = (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // 허용 리스트: 문자열(완전일치) + 정규식(패턴일치)을 함께 지원
  const allowListString = new Set<string>([
    PROD_VERCEL,
    ...extraOriginsEnv,
  ]);

  const allowListRegex = [vercelPreviewRegex, localRegex];

  // Origin 검사 함수
  const isAllowedOrigin = (origin: string) => {
    if (allowListString.has(origin)) return true;
    return allowListRegex.some(rx => rx.test(origin));
  };

  app.enableCors({
    // 브라우저 요청만 CORS 체크: 서버-서버/curl은 Origin 헤더가 없어야 정상
    origin: (origin, cb) => {
      // Origin이 없는 경우(curl/서버-서버 호출)는 허용
      if (!origin) return cb(null, true);

      if (typeof origin === 'string' && isAllowedOrigin(origin)) {
        return cb(null, true);
      }

      // 디버깅을 위해 어떤 Origin이 차단됐는지 로그를 남김
      // (민감하면 아래 console.warn을 주석 처리해도 무방)
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization',
      'x-owner', 'x-workshop', 'x-owner-address', 'x-workshop-address',
    ],
    maxAge: 86400, // 프리플라이트 캐시(1일)
    optionsSuccessStatus: 204, // 일부 구형 브라우저용
  });

  //  요청 바디 검증 파이프
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    errorHttpStatusCode: 400,
  }));

  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap();
