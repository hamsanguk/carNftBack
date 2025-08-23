import { Injectable } from '@nestjs/common';
import { Contract, EventLog, JsonRpcProvider } from 'ethers';
import vehicleNftAbi from '../../abi/VehicleNFT.json';
import { OwnershipIndexerService } from './ownership-indexer.service';
import { OwnershipPollerStatus } from './ownership-poller-status.entity';

/**
 * 폴러:
 * - 최신 스캔 블록부터 현재 블록까지를 청크로 스캔
 * - 각 청크 종료 지점마다 latestScannedBlock 저장(재시작 안전)
 * - 청크 간 sleep으로 RPC burst 방지
 * - 모은 로그는 tokenId별로 그룹화 → indexer로 전달(재조회 금지)
 */
@Injectable()
export class OwnershipPollingService {
  private readonly defaultInitBlock = Number(process.env.VEHICLE_NFT_DEPLOY_BLOCK ?? 191090437);
  private readonly statusKey = 'default';

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

  async getLatestBlockFromDB(): Promise<number> {
    const status = await OwnershipPollerStatus.findOne({ where: { id: this.statusKey } });
    return status ? Number(status.latestScannedBlock) : this.defaultInitBlock;
  }

  async saveLatestBlockToDb(block: number) {
    // 단조 증가 보장
    const existing = await OwnershipPollerStatus.findOne({ where: { id: this.statusKey } });
    if (!existing) {
      const created = OwnershipPollerStatus.create({
        id: this.statusKey,
        latestScannedBlock: String(block),
      });
      await created.save();
      return;
    }
    const cur = Number(existing.latestScannedBlock);
    if (block > cur) {
      existing.latestScannedBlock = String(block);
      await existing.save();
    }
  }

  /** 신규 Transfer 이벤트만 폴링하여 인덱싱 (burst 방지) */
  async pollNewTransfers(): Promise<void> {
    const latestScannedBlock = await this.getLatestBlockFromDB();
    const currentBlock = await this.provider.getBlockNumber();

    // 다음 블록부터 스캔
    let fromBlock = latestScannedBlock + 1;
    if (fromBlock > currentBlock) {
      console.log(`No new blocks from ${fromBlock} to ${currentBlock}. Skipping.`);
      return;
    }

    // 전체 수집 로그(필요시 메모리 이슈 고려하여 즉시 처리 방식으로 전환 가능)
    const logs: EventLog[] = [];

    for (let start = fromBlock; start <= currentBlock; start += this.MAX_BLOCK_RANGE + 1) {
      const end = Math.min(start + this.MAX_BLOCK_RANGE, currentBlock);

      // 해당 범위 로그 조회
      const chunkLogs = await this.contract.queryFilter(
        this.contract.filters.Transfer(null, null, null),
        start,
        end
      ) as EventLog[];

      logs.push(...chunkLogs);

      console.log(`Polled from ${start} to ${end}: ${chunkLogs.length} logs`);

      // 진행상황 저장(재시작 안전)
      await this.saveLatestBlockToDb(end);

      // burst 방지 대기
      if (end < currentBlock) {
        await this.sleep(this.SLEEP_MS);
      }
    }

    if (logs.length === 0) {
      console.log(`No new Transfer logs from ${fromBlock} to ${currentBlock}`);
      return;
    }
    // tokenId별 그룹화 로직상의 상충관계
    const tokenLogsMap = new Map<number, EventLog[]>();
    for (const log of logs) {
      const tokenId = Number(log.args.tokenId);
      if (!tokenLogsMap.has(tokenId)) tokenLogsMap.set(tokenId, []);
      tokenLogsMap.get(tokenId)!.push(log);
    }

    // 각 tokenId에 대해, 재조회 없이 바로 인덱싱
    for (const [tokenId, tokenLogs] of tokenLogsMap.entries()) {
      // 정렬은 indexer에서 수행하지만, 여기서도 가볍게 정렬해 전달 가능
      tokenLogs.sort((a, b) => {
        const ab = Number(a.blockNumber) - Number(b.blockNumber);
        return ab !== 0 ? ab : Number((a as any).index ?? (a as any).logIndex ?? 0) - Number((b as any).index ?? (b as any).logIndex ?? 0);
      });

      await this.indexer.indexTokenOwnership(tokenId, tokenLogs);
    }

    // 루프가 끝난 시점에서 최종 블록 한 번 더 저장(보수적) 
    await this.saveLatestBlockToDb(currentBlock);

    console.log(
      `Polled and indexed ${tokenLogsMap.size} token IDs from block ${fromBlock} to ${currentBlock}`
    );
  }

  /** 에러 시 지수적 backoff 없이 간단 재시도(필요시 backoff 추가 가능) */
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
