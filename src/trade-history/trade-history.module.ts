import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeService } from './trade-history.service';
import { TradeHistoryController } from './trade-history.controller';
import { OwnershipHistory } from 'src/ownership-history/ownership-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OwnershipHistory])],
  providers: [TradeService],
  controllers: [TradeHistoryController],
  exports: [TypeOrmModule, TradeService],
})
export class TradeHistoryModule {}
