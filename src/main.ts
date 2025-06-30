import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {ValidationPipe} from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port  = process.env.PORT;
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: false, // 원래는 true인데 에러찾느라 일시적으로 false
    forbidNonWhitelisted:true,
    transform:true,
  }));

  await app.listen(port ?? 3000);
  console.log(`Server running on http://localhost:${port}`)
}
bootstrap();
