import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TradeService } from './trade-history.service';


@Controller('trade-history')
export class TradeHistoryController {
  constructor(private readonly tradeService: TradeService) {}

  @Post()
  async recordTrade(@Body() dto: { tokenId: number, from: string, to: string, txHash: string }) {
    return this.tradeService.recordTrade(dto.tokenId, dto.from, dto.to, dto.txHash);
  }

  @Get(':tokenId')
  async getHistory(@Param('tokenId') tokenId: number) {
    return this.tradeService.getHistoryByTokenId(tokenId);
  }
}
