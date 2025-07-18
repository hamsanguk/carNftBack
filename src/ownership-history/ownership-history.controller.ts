// back/src/modules/ownership-history/ownership-history.controller.ts
import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { OwnershipHistoryService } from './ownership-history.service';
import { OwnershipIndexerService } from './ownership-indexer.service';

@Controller('ownership-history')
export class OwnershipHistoryController {
  constructor(private readonly service: OwnershipHistoryService, private readonly indexer: OwnershipIndexerService) {}

  @Get(':tokenId')
  async getHistory(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.service.getOwnershipHistory(tokenId);
  }

  @Post('index/:tokenId')
  async indexOwnership(@Param('tokenId', ParseIntPipe) tokenId: number) {
    await this.indexer.indexTokenOwnership(tokenId);
    return { success: true };
  }
}
