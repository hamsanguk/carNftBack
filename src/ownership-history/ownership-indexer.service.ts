import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeRequest, TradeStatus } from '../trade/trade.entity';
import { Contract, EventLog, JsonRpcProvider, Log } from 'ethers';
import { OwnershipHistory } from './ownership-history.entity';
import vehicleNftAbi from '../../abi/VehicleNFT.json';
// 경로 보정: utils 아래 파일을 사용합니다.
import { createBatchRanges, fetchTransferLogsByRange } from './batch-utils';

@Injectable()
export class OwnershipIndexerService {
  constructor(
    @InjectRepository(TradeRequest)
    private readonly tradeRepo: Repository<TradeRequest>,
  ) {}

  private provider = new JsonRpcProvider(process.env.RPC_URL!);
  private contract = new Contract(
    process.env.VEHICLE_NFT_ADDRESS!,
    vehicleNftAbi,
    this.provider
  );

  private DEPLOY_BLOCK = Number(process.env.VEHICLE_NFT_DEPLOY_BLOCK ?? 191090437);
  private BLOCK_STEP = Number(process.env.INDEX_BLOCK_STEP ?? 4500);
  private BATCH_MULTIPLIER = Number(process.env.INDEX_BATCH_MULTIPLIER ?? 100);
  private PAGE_SIZE = Number(process.env.INDEX_PAGE_SIZE ?? 1000);

  private async buildTsCache(blockNumbers: number[]): Promise<Map<number, number>> {
    const uniq = Array.from(new Set(blockNumbers));
    const cache = new Map<number, number>();
    for (const bn of uniq) {
      const blk = await this.provider.getBlock(bn);
      cache.set(bn, blk!.timestamp);
    }
    return cache;
  }

  private getLogIdx(ev: any): number {
    return Number(ev.index ?? ev.logIndex ?? 0);
  }

  async indexTokenOwnership(tokenId: number, logsFromPoller?: (EventLog | Log)[]): Promise<void> {
    // 1) 로그 확보
    let logs: EventLog[];
    if (logsFromPoller && logsFromPoller.length > 0) {
      logs = (logsFromPoller.filter(l => 'args' in l) as EventLog[])
        .filter(l => Number(l.args.tokenId) === Number(tokenId));
    } else {
      const latestBlock = await this.provider.getBlockNumber();
      const filter = this.contract.filters.Transfer(null, null, tokenId);
      const batchRanges = createBatchRanges(
        this.DEPLOY_BLOCK,
        latestBlock,
        this.BLOCK_STEP * this.BATCH_MULTIPLIER
      );
      const fetched = await fetchTransferLogsByRange(
        this.contract,
        filter,
        batchRanges,
        this.BLOCK_STEP,
        this.PAGE_SIZE,
        `Token ${tokenId}:`
      );
      logs = fetched as EventLog[];
    }

    // 정렬(블록 → logIndex)
    logs.sort((a, b) => {
      const byBlock = Number(a.blockNumber) - Number(b.blockNumber);
      if (byBlock !== 0) return byBlock;
      return this.getLogIdx(a) - this.getLogIdx(b);
    });

    // 2) 분기
    const isIncremental = !!logsFromPoller && logs.length > 0;

    if (!isIncremental) {
      // ===== 전체 재색인: 기존 기록 삭제 후 전체 재구축 =====
      await OwnershipHistory.delete({ tokenId });
      if (logs.length === 0) return;

      const tsCache = await this.buildTsCache(logs.map(l => Number(l.blockNumber)));
      for (let i = 0; i < logs.length; i++) {
        const cur = logs[i];
        const curBn = Number(cur.blockNumber);
        const startTs = tsCache.get(curBn)!;
        let endTs: number | null = null;
        if (i + 1 < logs.length) {
          const next = logs[i + 1];
          endTs = tsCache.get(Number(next.blockNumber))!;
        }

        await OwnershipHistory.create({
          tokenId,
          ownerAddress: String(cur.args.to),
          startTimestamp: startTs,
          endTimestamp: endTs,
          last_processed_block: curBn,
          last_log_index: this.getLogIdx(cur),
          tx_hash: (cur as any).transactionHash ?? null,
        }).save();
      }
      return;
    }

    // ===== 증분 모드: 기존 이력 유지 + 신규 로그만 추가 =====
    const existing = await OwnershipHistory.find({
      where: { tokenId },
      order: { startTimestamp: 'ASC' },
    });
    const lastRec   = existing[existing.length - 1];
    const lastBlock = lastRec ? Number(lastRec.last_processed_block ?? 0) : 0;
    const lastIndex = lastRec ? Number((lastRec as any).last_log_index ?? -1) : -1;

    const newLogs = logs.filter(l => {
      const bn  = Number(l.blockNumber);
      const idx = this.getLogIdx(l);
      return (bn > lastBlock) || (bn === lastBlock && idx > lastIndex);
    });
    if (newLogs.length === 0) return;

    // 타임스탬프 캐시(증분용)
    const tsCache = await this.buildTsCache(newLogs.map(l => Number(l.blockNumber)));

    // 열린 구간 닫기: endTimestamp만 갱신
    if (lastRec && lastRec.endTimestamp == null) {
      const firstNew = newLogs[0];
      const firstNewTs = tsCache.get(Number(firstNew.blockNumber))!;
      if (firstNewTs >= Number(lastRec.startTimestamp)) {
        lastRec.endTimestamp = firstNewTs;
        await lastRec.save();
      }
    }

    // 신규 구간 추가 + TradeRequest 상태 갱신(리스너 역할 이관)
    for (let i = 0; i < newLogs.length; i++) {
      const cur   = newLogs[i];
      const bn    = Number(cur.blockNumber);
      const idx   = this.getLogIdx(cur);
      const start = tsCache.get(bn)!;
      let end: number | null = null;
      if (i + 1 < newLogs.length) {
        end = tsCache.get(Number(newLogs[i + 1].blockNumber))!;
      }

      await OwnershipHistory.create({
        tokenId,
        ownerAddress: String(cur.args.to),
        startTimestamp: start,
        endTimestamp: end,
        last_processed_block: bn,
        last_log_index: idx,
        tx_hash: (cur as any).transactionHash ?? null,
      }).save();

      // 최신 APPROVED → COMPLETED 전환
      const approved = await this.tradeRepo.findOne({
        where: { token_id: String(tokenId), status: TradeStatus.APPROVED },
        order: { created_at: 'DESC' },
      });
      if (approved) {
        approved.status = TradeStatus.COMPLETED;
        (approved as any).tx_hash = (cur as any).transactionHash ?? null;
        await this.tradeRepo.save(approved);
      }
    }
  }

  async indexAllTokensOwnership(): Promise<void> {
    const latestBlock = await this.provider.getBlockNumber();
    const filter = this.contract.filters.Transfer(null, null, null);
    const batchRanges = createBatchRanges(
      this.DEPLOY_BLOCK,
      latestBlock,
      this.BLOCK_STEP * this.BATCH_MULTIPLIER
    );
    const logs = await fetchTransferLogsByRange(
      this.contract,
      filter,
      batchRanges,
      this.BLOCK_STEP,
      this.PAGE_SIZE,
      'Indexer:'
    );
    const tokenIds = Array.from(
      new Set(
        logs
          .filter(l => 'args' in l)
          .map(l => Number((l as EventLog).args.tokenId))
      )
    );
    for (const id of tokenIds) {
      await this.indexTokenOwnership(id);
    }
  }
}
