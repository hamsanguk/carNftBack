// back/src/modules/ownership-history/ownership-history.controller.ts
import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { OwnershipHistoryService } from './ownership-history.service';
import { OwnershipIndexerService } from './ownership-indexer.service';
import { OwnershipPollingService } from './ownership-poller.service';

@Controller('ownership-history')
export class OwnershipHistoryController {
  constructor(private readonly service: OwnershipHistoryService,
     private readonly indexer: OwnershipIndexerService,
      private readonly poller: OwnershipPollingService) {}

  @Get(':tokenId')
  async getHistory(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.service.getOwnershipHistory(tokenId);
  }
  @Post('index-all')
  async indexAllOwnerships() {
    await this.indexer.indexAllTokensOwnership(); 
    return { success: true}
  }

  @Post('index/:tokenId')
  async indexOwnership(@Param('tokenId', ParseIntPipe) tokenId: number) {
    await this.indexer.indexTokenOwnership(tokenId);
    return { success: true };
  }

  @Post('poll')
  async safePoll() {
   await this.poller.safePoll();
   return { success: true}
  }
}
