import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnershipHistory } from './ownership-history.entity';
import { OwnershipHistoryService } from './ownership-history.service';
import { OwnershipHistoryController } from './ownership-history.controller';
import { OwnershipIndexerService } from './ownership-indexer.service';
import { OwnershipPollingService } from './ownership-poller.service';
import { OwnershipSchedulerService } from './ownership-scheduler.service';
import { TradeRequest } from '../trade/trade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OwnershipHistory, TradeRequest])],
  providers: [
    OwnershipHistoryService,
    OwnershipIndexerService,
    OwnershipPollingService,
    OwnershipSchedulerService,
  ],
  controllers: [OwnershipHistoryController],
  exports: [OwnershipHistoryService, OwnershipIndexerService],
})
export class OwnershipHistoryModule {}
