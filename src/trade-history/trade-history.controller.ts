// src/trade-history/trade-history.controller.ts
import { Controller, Get, Post, Body, Param, GoneException, ParseIntPipe } from '@nestjs/common';
import { TradeService } from './trade-history.service';

@Controller('trade-history')
export class TradeHistoryController {
  constructor(private readonly tradeService: TradeService) {}

  // 더 이상 직접 기록하지 않습니다. (호출 시 410)
  @Post()
  async recordTrade(@Body() _dto: { tokenId: number; from: string; to: string; txHash: string }) {
    throw new GoneException('Deprecated: trade history is now derived from ownership_history');
  }

  @Get(':tokenId')
  async getHistory(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.tradeService.getHistoryByTokenId(tokenId);
  }
}