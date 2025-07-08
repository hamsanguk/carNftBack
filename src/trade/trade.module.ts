import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeRequest } from './trade.entity';
import { TradeService } from './trade.service';
import { TradeController } from './trade.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TradeRequest])],
  controllers: [TradeController],
  providers: [TradeService],
})
export class TradeModule {}
