//main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {ValidationPipe} from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port  = process.env.PORT ? Number(process.env.PORT) : 3000; //render에서 주는 환경변수port

  //아직 프론트 배포 않한상테의 allow
  const allowList = [/^https?:\/\/localhost:(300.)$/,]
  app.enableCors({
    origin: (origin:string, cb) => {
      if (!origin) return cb(null, true); // 서버-서버, curl 등
      if (allowList.some(r => r.test(origin))) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization',
    'x-owner','x-workshop','x-owner-address','x-workshop-address'],
    credentials: true,        
    maxAge: 86400,              
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // DTO에 없는 필드는 제거 true권장 metaUri 응답X + 권한 프론트 진입x
    forbidNonWhitelisted:false,//제거만, 에러는 않던짐
    transform:true,//자동으로 primitive 에서 class 인스턴스로 변환
    errorHttpStatusCode: 400
  }));

  await app.listen(port, '0.0.0.0');//원래 3000
  console.log(`Server running on http://localhost:${port}`)
}
bootstrap();
