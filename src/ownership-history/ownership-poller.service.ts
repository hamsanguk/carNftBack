// back/src/modules/ownership-history/ownership-poller.service.ts
import { Injectable } from '@nestjs/common';
import { Contract, EventLog, JsonRpcProvider } from 'ethers';
import vehicleNftAbi from '../../abi/VehicleNFT.json';
import { OwnershipIndexerService } from './ownership-indexer.service';
import { OwnershipHistory } from './ownership-history.entity';

/**
 * - latestScannedBlock 저장 테이블 없이 동작
 * - 시작 블록: ownership_history.MAX(last_processed_block) || DEPLOY_BLOCK
 * - 각 "청크"를 즉시 처리(토큰별 그룹화 → indexer 전달)하여 메모리/재처리 부담 감소
 * - 청크 간 sleep으로 RPC burst 방지
 */
@Injectable()
export class OwnershipPollingService {
  private readonly defaultInitBlock = Number(process.env.VEHICLE_NFT_DEPLOY_BLOCK ?? 191090437);
  private readonly MAX_BLOCK_RANGE = Number(process.env.POLL_MAX_BLOCK_RANGE ?? 4999);
  private readonly SLEEP_MS = Number(process.env.POLL_SLEEP_MS ?? 800);

  private provider = new JsonRpcProvider(process.env.RPC_URL!);
  private contract = new Contract(
    process.env.VEHICLE_NFT_ADDRESS!,
    vehicleNftAbi,
    this.provider
  );

  constructor(private readonly indexer: OwnershipIndexerService) {}

  private async sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** 진행 시작점: ownership_history의 last_processed_block 최대값(없으면 배포 블록) */
  private async getLatestBlockFromDB(): Promise<number> {
    const raw = await OwnershipHistory.createQueryBuilder('h')
      .select('MAX(h.last_processed_block)', 'max')
      .getRawOne<{ max: string | null }>();
    const maxStr = raw?.max;
    return maxStr ? Number(maxStr) : this.defaultInitBlock;
  }

  /** 신규 Transfer 이벤트 폴링(청크 즉시 처리) */
  async pollNewTransfers(): Promise<void> {
    const latestScannedBlock = await this.getLatestBlockFromDB();
    const currentBlock = await this.provider.getBlockNumber();

    let fromBlock = latestScannedBlock + 1;
    if (fromBlock > currentBlock) {
      console.log(`No new blocks from ${fromBlock} to ${currentBlock}. Skipping.`);
      return;
    }

    let totalTokens = 0;
    let totalLogs = 0;

    for (let start = fromBlock; start <= currentBlock; start += this.MAX_BLOCK_RANGE + 1) {
      const end = Math.min(start + this.MAX_BLOCK_RANGE, currentBlock);

      // 1) 이 청크 범위만 질의
      const chunkLogs = await this.contract.queryFilter(
        this.contract.filters.Transfer(),
        start,
        end
      ) as EventLog[];

      console.log(`[Poll] ${start} ~ ${end}: ${chunkLogs.length} logs`);

      if (chunkLogs.length > 0) {
        totalLogs += chunkLogs.length;

        // 2) tokenId별 그룹화
        const tokenLogsMap = new Map<number, EventLog[]>();
        for (const log of chunkLogs) {
          const tokenId = Number(log.args.tokenId);
          if (!tokenLogsMap.has(tokenId)) tokenLogsMap.set(tokenId, []);
          tokenLogsMap.get(tokenId)!.push(log);
        }

        // 3) 각 토큰 즉시 처리(재조회 없음)
        for (const [tokenId, tokenLogs] of tokenLogsMap.entries()) {
          // 정렬(블록 → logIndex)
          tokenLogs.sort((a, b) => {
            const byBlock = Number(a.blockNumber) - Number(b.blockNumber);
            if (byBlock !== 0) return byBlock;
            const ai = Number((a as any).index ?? (a as any).logIndex ?? 0);
            const bi = Number((b as any).index ?? (b as any).logIndex ?? 0);
            return ai - bi;
          });

          try {
            await this.indexer.indexTokenOwnership(tokenId, tokenLogs);
            totalTokens += 1;
          } catch (err) {
            // 개별 토큰 실패가 전체 폴링을 막지 않도록 격리
            console.error(`[Poll][Token ${tokenId}] indexing failed:`, err);
          }
        }
      } else {
        // 이 청크에 트랜스퍼가 아예 없으면 여기서 갱신할 워터마크가 없습니다.
        // 현재 구현은 MAX(last_processed_block) 기반이므로, 다음 실행에서 이 구간을 다시 스캔할 수 있습니다.
        // 확실한 워터마크가 필요하면 별도의 status 테이블을 사용하세요.
      }
      if (end < currentBlock) await this.sleep(this.SLEEP_MS);
    }

    console.log(`[Poll] Done. Total logs: ${totalLogs}, affected tokens: ${totalTokens}, scanned up to: ${currentBlock}`);
  }

  /** 간단 재시도 래퍼 */
  async safePoll(): Promise<void> {
    try {
      await this.pollNewTransfers();
    } catch (error: any) {
      console.error('Poll error, retry after delay', error);
      await this.sleep(this.SLEEP_MS * 10);
      await this.pollNewTransfers();
    }
  }
}
