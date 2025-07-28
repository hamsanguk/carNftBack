// src/trade-history/trade-history.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeHistory } from './trade-history.entity';
import { TradeService } from './trade-history.service';
import { TradeHistoryController } from './trade-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TradeHistory])],
  providers:[TradeService],
  controllers:[TradeHistoryController],
  exports: [TypeOrmModule,TradeService],
})
export class TradeHistoryModule {}
