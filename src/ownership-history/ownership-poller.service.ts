import { Injectable } from '@nestjs/common';
import { Contract, EventLog, JsonRpcProvider } from 'ethers';
import vehicleNftAbi from '../../abi/VehicleNFT.json';
import { OwnershipIndexerService } from './ownership-indexer.service';
import { OwnershipHistory } from './ownership-history.entity';

/**
 * 폴러(간소화):
 * - latestScannedBlock 저장 테이블 제거
 * - 시작 블록: ownership_history.MAX(last_processed_block) 또는 DEPLOY_BLOCK
 * - 청크 간 sleep으로 RPC burst 방지
 * - 모은 로그는 tokenId별 그룹화 → indexer로 전달(재조회 금지)
 */
@Injectable()
export class OwnershipPollingService {
  private readonly defaultInitBlock = Number(process.env.VEHICLE_NFT_DEPLOY_BLOCK ?? 191090437);

  // 폴링 파라미터 (환경변수로 조절)
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

  private async getLatestBlockFromDB(): Promise<number> {
    const raw = await OwnershipHistory.createQueryBuilder('h')
      .select('MAX(h.last_processed_block)', 'max')
      .getRawOne<{ max: string | null }>();
    const maxStr = raw?.max;
    return maxStr ? Number(maxStr) : this.defaultInitBlock;
  }

  /** 신규 Transfer 이벤트만 폴링하여 인덱싱 */
  async pollNewTransfers(): Promise<void> {
    const latestScannedBlock = await this.getLatestBlockFromDB();
    const currentBlock = await this.provider.getBlockNumber();

    // 다음 블록부터 스캔
    let fromBlock = latestScannedBlock + 1;
    if (fromBlock > currentBlock) {
      console.log(`No new blocks from ${fromBlock} to ${currentBlock}. Skipping.`);
      return;
    }

    const logs: EventLog[] = [];
    for (let start = fromBlock; start <= currentBlock; start += this.MAX_BLOCK_RANGE + 1) {
      const end = Math.min(start + this.MAX_BLOCK_RANGE, currentBlock);

      const chunkLogs = await this.contract.queryFilter(
        this.contract.filters.Transfer(null, null, null),
        start,
        end
      ) as EventLog[];

      logs.push(...chunkLogs);
      console.log(`Polled from ${start} to ${end}: ${chunkLogs.length} logs`);

      if (end < currentBlock) {
        await this.sleep(this.SLEEP_MS);
      }
    }

    if (logs.length === 0) {
      console.log(`No new Transfer logs from ${fromBlock} to ${currentBlock}`);
      return;
    }

    // tokenId별 그룹화
    const tokenLogsMap = new Map<number, EventLog[]>();
    for (const log of logs) {
      const tokenId = Number(log.args.tokenId);
      if (!tokenLogsMap.has(tokenId)) tokenLogsMap.set(tokenId, []);
      tokenLogsMap.get(tokenId)!.push(log);
    }

    // 각 tokenId에 대해, 재조회 없이 바로 인덱싱
    for (const [tokenId, tokenLogs] of tokenLogsMap.entries()) {
      tokenLogs.sort((a, b) => {
        const ab = Number(a.blockNumber) - Number(b.blockNumber);
        const ai = Number((a as any).index ?? (a as any).logIndex ?? 0);
        const bi = Number((b as any).index ?? (b as any).logIndex ?? 0);
        return ab !== 0 ? ab : ai - bi;
      });
      await this.indexer.indexTokenOwnership(tokenId, tokenLogs);
    }

    console.log(
      `Polled and indexed ${tokenLogsMap.size} token IDs from block ${fromBlock} to ${currentBlock}`
    );
  }

  async safePoll(): Promise<void> {
    try {
      await this.pollNewTransfers();
    } catch (error: any) {
      console.error('Poll error, retry after delay', error);
      await this.sleep(this.SLEEP_MS * 10);
      await this.safePoll();
    }
  }
}
