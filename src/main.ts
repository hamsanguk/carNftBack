import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {ValidationPipe} from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port  = process.env.PORT;
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // DTO에 없는 필드는 제거 true권장 metaUri 응답X + 권한 프론트 진입x
    forbidNonWhitelisted:false,//제거만, 에러는 않던짐
    transform:true,//자동으로 primitive 에서 class 인스턴스로 변환
    errorHttpStatusCode: 400
  }));

  await app.listen(port ?? 3000);
  console.log(`Server running on http://localhost:${port}`)
}
bootstrap();
