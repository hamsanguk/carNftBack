import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeRequest } from '../trade/trade.entity';


@Module({
  imports: [TypeOrmModule.forFeature([TradeRequest])],
  providers: [],
})
export class ListenerModule {}
