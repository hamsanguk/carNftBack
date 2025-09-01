import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// 프로젝트 구조에 맞게 import 경로를 조정하세요.
import { OwnershipHistory } from 'src/ownership-history/ownership-history.entity';
import { ZeroAddress } from 'ethers';

export interface TradeItem {
  tokenId: number;
  from: string;
  to: string;
  txHash: string | null;
  tradedAt: Date;
}

@Injectable()
export class TradeService {
  constructor(
    @InjectRepository(OwnershipHistory)
    private readonly histRepo: Repository<OwnershipHistory>,
  ) {}

  // 직접 기록은 더 이상 사용하지 않습니다.
  async recordTrade(): Promise<never> {
    throw new Error('Deprecated: trade history is derived from ownership_history');
  }

  async getHistoryByTokenId(tokenId: number): Promise<TradeItem[]> {
    const rows = await this.histRepo.find({
      where: { tokenId },
      order: { startTimestamp: 'ASC' },
    });

    const trades: TradeItem[] = [];
    for (let i = 0; i < rows.length; i++) {
      const cur = rows[i];
      const prev = rows[i - 1];
      const ts = Number(cur.startTimestamp);
      const date = new Date(ts > 1e12 ? ts : ts * 1000);
      trades.push({
        tokenId,
        from: prev ? prev.ownerAddress : ZeroAddress,
        to: cur.ownerAddress,
        txHash: (cur as any).tx_hash ?? null, // 엔티티에 tx_hash 컬럼이 있다면 string | null 타입으로 선언 권장
        tradedAt: date,
      });
    }
    // 최신순으로 반환
    trades.sort((a, b) => b.tradedAt.getTime() - a.tradedAt.getTime());
    return trades;
  }
}
