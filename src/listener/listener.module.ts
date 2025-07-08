import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeRequest } from '../trade/trade.entity';
import { TradeHistory } from '../trade-history/trade-history.entity';
import { TradeListenerService } from './trade-listener.service';

@Module({
  imports: [TypeOrmModule.forFeature([TradeRequest, TradeHistory])],
  providers: [TradeListenerService],
})
export class ListenerModule {}
