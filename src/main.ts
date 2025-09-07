// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // 허용할 출처들: 로컬(3000~3009), Vercel 프론트 도메인(정확히 하나)
  const FRONT_URL = 'https://car-nft-front-6y2966hrj-hamsanguks-projects.vercel.app';
  const localRegex = /^https?:\/\/localhost:300[0-9]$/;

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/서버-서버 호출 허용
      if (typeof origin === 'string' && (origin === FRONT_URL || localRegex.test(origin))) {
        return cb(null, true);
      }
      return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
    methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
    allowedHeaders: [
      'Content-Type','Authorization',
      'x-owner','x-workshop','x-owner-address','x-workshop-address'
    ],
    maxAge: 86400,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    errorHttpStatusCode: 400
  }));

  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
