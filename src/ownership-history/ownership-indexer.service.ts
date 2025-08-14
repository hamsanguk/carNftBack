import { Injectable } from '@nestjs/common';
import { Contract, EventLog, JsonRpcProvider, Log } from 'ethers';
import { OwnershipHistory } from './ownership-history.entity';
import vehicleNftAbi from '../../abi/VehicleNFT.json';
import { createBatchRanges, fetchTransferLogsByRange } from './batch-utils';

/**
 * 인덱서:
 * - logsFromPoller가 있으면 재조회 없이 해당 로그로 바로 OwnershipHistory 갱신
 * - 없으면(수동/재빌드 시) 배치 조회로 인덱싱
 */
@Injectable()
export class OwnershipIndexerService {
  private provider = new JsonRpcProvider(process.env.RPC_URL!);
  private contract = new Contract(
    process.env.VEHICLE_NFT_ADDRESS!,
    vehicleNftAbi,
    this.provider
  );

  // 환경변수 기반 파라미터 (없으면 기본값)
  private DEPLOY_BLOCK = Number(process.env.VEHICLE_NFT_DEPLOY_BLOCK ?? 191090437);
  private BLOCK_STEP = Number(process.env.INDEX_BLOCK_STEP ?? 4500);
  private BATCH_MULTIPLIER = Number(process.env.INDEX_BATCH_MULTIPLIER ?? 100); // createBatchRanges size
  private PAGE_SIZE = Number(process.env.INDEX_PAGE_SIZE ?? 1000);

  /**
   * tokenId 단위 인덱싱
   * @param tokenId
   * @param logsFromPoller poller에서 이미 수집한 Transfer 로그(중복 조회 방지)
   */
  async indexTokenOwnership(tokenId: number, logsFromPoller?: (EventLog | Log)[]): Promise<void> {
    // 1) 로그 확보
    let logs: (EventLog | Log)[];

    if (logsFromPoller && logsFromPoller.length > 0) {
      // poller로부터 받은 로그만 사용(재조회 없음)
      logs = logsFromPoller
        .filter(l => 'args' in l) // EventLog만 남김
        .filter(l => Number((l as EventLog).args.tokenId) === Number(tokenId));
    } else {
      // 직접 조회(재빌드 등에서 사용)
      const latestBlock = await this.provider.getBlockNumber();
      const filter = this.contract.filters.Transfer(null, null, tokenId);

      const batchRanges = createBatchRanges(
        this.DEPLOY_BLOCK,
        latestBlock,
        this.BLOCK_STEP * this.BATCH_MULTIPLIER
      );

      logs = await fetchTransferLogsByRange(
        this.contract,
        filter,
        batchRanges,
        this.BLOCK_STEP,
        this.PAGE_SIZE,
        `Token ${tokenId}:`
      );
    }

    // 정렬(블록번호, logIndex 순) — 순서 보장
    logs.sort((a, b) => {
      const ab = Number(a.blockNumber) - Number(b.blockNumber);
      return ab !== 0 ? ab : Number((a as any).index ?? (a as any).logIndex ?? 0) - Number((b as any).index ?? (b as any).logIndex ?? 0);
    });

    // 2) 해당 tokenId 기존 기록 제거
    await OwnershipHistory.delete({ tokenId });

    if (logs.length === 0) {
      // 기록이 없으면 끝
      return;
    }

    // 3) 블록 타임스탬프 캐시 (해당 tokenId 처리 범위 내)
    const uniqueBlocks = Array.from(new Set(logs.map(l => Number(l.blockNumber))));
    const tsCache = new Map<number, number>();
    // 병렬 과도 방지: 간단히 순차 fetch (필요시 p-limit로 동시성 제한 가능)
    for (const bn of uniqueBlocks) {
      const blk = await this.provider.getBlock(bn);
      tsCache.set(bn, blk!.timestamp);
    }

    // 4) 로그를 OwnershipHistory로 저장
    for (let i = 0; i < logs.length; i++) {
      const cur = logs[i] as EventLog;
      const curBn = Number(cur.blockNumber);
      const startTimestamp = tsCache.get(curBn)!;

      let endTimestamp: number | null = null;
      if (i + 1 < logs.length) {
        const next = logs[i + 1] as EventLog;
        const nextBn = Number(next.blockNumber);
        endTimestamp = tsCache.get(nextBn)!;
      }

      const entity = OwnershipHistory.create({
        tokenId,
        ownerAddress: (cur.args.to as string),
        startTimestamp,
        endTimestamp,
        last_processed_block: curBn,
      });

      await entity.save();
    }
  }

  /**
   * 전체 토큰 인덱싱(재빌드)
   * - 전체 Transfer를 긁어서 tokenId만 추출 → tokenId별로 indexTokenOwnership 호출(이 경우 재조회)
   * - 대량 재빌드 시 오래 걸릴 수 있음
   */
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
