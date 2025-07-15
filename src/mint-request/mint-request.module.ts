import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MintRequest } from './mint-request.entity';
import { MintRequestService } from './mint-request.service';
import { MintRequestController } from './mint-request.controller';

@Module({
  imports: [ TypeOrmModule.forFeature([MintRequest]) ],
  providers: [ MintRequestService ],
  controllers: [ MintRequestController ],
  exports: [ MintRequestService ],
})
export class MintRequestModule {}
