// 거래 발생시 저장
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeHistory } from './trade-history.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TradeService {
  constructor(
    @InjectRepository(TradeHistory)
    private readonly tradeHistoryRepo: Repository<TradeHistory>
  ) {}

  async recordTrade(tokenId: number, from: string, to: string, txHash: string) {
    const trade = this.tradeHistoryRepo.create({
      tokenId,
      from,
      to,
      txHash,
    });
    return await this.tradeHistoryRepo.save(trade);
  }

  async getHistoryByTokenId(tokenId:number){
    return this.tradeHistoryRepo.find({
        where: {tokenId},
        order: {tradedAt:'DESC'}
    })
  }//tokenId에 대한 모든 거래내역을 내림차순을 반환
}
