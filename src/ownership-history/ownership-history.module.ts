// back/src/modules/ownership-history/ownership-history.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnershipHistory } from './ownership-history.entity';
import { OwnershipHistoryService } from './ownership-history.service';
import { OwnershipHistoryController } from './ownership-history.controller';
import { OwnershipIndexerService } from './ownership-indexer.service';
import { OwnershipPollingService } from './ownership-poller.service';

@Module({
  imports: [TypeOrmModule.forFeature([OwnershipHistory])],
  providers: [
    OwnershipHistoryService,
    OwnershipIndexerService,
    OwnershipPollingService,
  ],
  controllers: [OwnershipHistoryController],
  exports: [OwnershipHistoryService, OwnershipIndexerService],
})
export class OwnershipHistoryModule {}
