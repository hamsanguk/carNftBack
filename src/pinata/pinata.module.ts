// src/pinata/pinata.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { PinataService } from './pinata.service';
import { MetadataController } from './metadata.controller';
import { UploadController } from './image-upload.controller';

@Module({
  imports: [
    ConfigModule,                  // @nestjs/config 전역 사용
    MulterModule.register(),       // 파일 업로드 설정
  ],
  providers: [PinataService],
  controllers: [MetadataController, UploadController],
  exports: [PinataService],
})
export class PinataModule {}
