import { Injectable } from '@nestjs/common';
import { Contract, JsonRpcProvider, EventLog } from 'ethers';
import { OwnershipHistory } from './ownership-history.entity';
import vehicleNftAbi from '../../abi/VehicleNFT.json';
import { createBatchRanges, fetchTransferLogsByRange } from './batch-utils';

@Injectable()
export class OwnershipIndexerService {
  // 단일 토큰 인덱싱
  async indexTokenOwnership(tokenId: number): Promise<void> {
    const provider = new JsonRpcProvider(process.env.RPC_URL!);
    const contract = new Contract(
      process.env.VEHICLE_NFT_ADDRESS!,
      vehicleNftAbi,
      provider
    );
    const filter = contract.filters.Transfer(null, null, tokenId);
    const BLOCK_STEP = 4500;
    const deploymentBlock = 190_190_437;
    const latestBlock = await provider.getBlockNumber();

    // 배치 범위 생성 후 로그 수집
    const batchRanges = createBatchRanges(
      deploymentBlock,
      latestBlock,
      BLOCK_STEP * 100
    );
    const logs = await fetchTransferLogsByRange(
      contract,
      filter,
      batchRanges,
      BLOCK_STEP,
      1000,
      `Token ${tokenId}:`
    );

    // 기존 기록 삭제
    await OwnershipHistory.delete({ tokenId });

    // 로그별 블록 타임스탬프 파싱 및 엔티티 생성
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i] as EventLog;
      const block = await provider.getBlock(log.blockNumber);
      const startTimestamp = block!.timestamp;

      let endTimestamp: number | null = null;
      if (i + 1 < logs.length) {
        const nextLog = logs[i + 1] as EventLog;
        const nextBlock = await provider.getBlock(nextLog.blockNumber);
        endTimestamp = nextBlock!.timestamp;
      }

      const entity = OwnershipHistory.create({
        tokenId,
        ownerAddress: log.args.to,
        startTimestamp,
        endTimestamp,
        last_processed_block: log.blockNumber,
      });

      await entity.save();
    }
  }

  // 전체 토큰 인덱싱
  async indexAllTokensOwnership(): Promise<void> {
    const provider = new JsonRpcProvider(process.env.RPC_URL!);
    const contract = new Contract(
      process.env.VEHICLE_NFT_ADDRESS!,
      vehicleNftAbi,
      provider
    );
    const BLOCK_STEP = 4500;
    const deploymentBlock = 191090437;
    const latestBlock = await provider.getBlockNumber();
    const filter = contract.filters.Transfer(null, null, null);

    // 전체 이벤트 수집
    const batchRanges = createBatchRanges(
      deploymentBlock,
      latestBlock,
      BLOCK_STEP * 100
    );
    const logs = await fetchTransferLogsByRange(
      contract,
      filter,
      batchRanges,
      BLOCK_STEP,
      1000,
      'Indexer:'
    );

    // 토큰 ID 추출 및 중복 제거
    const allTokenIds = Array.from(
      new Set(
        logs
          .filter(log => 'args' in log)
          .map(log => Number((log as EventLog).args.tokenId))
      )
    );

    // 이미 인덱싱된 토큰 ID 조회
    const existing = await OwnershipHistory.createQueryBuilder('h')
      .select('DISTINCT h.tokenId', 'tokenId')
      .getRawMany();
    const existingIds = new Set(existing.map(e => Number(e.tokenId)));

    // 신규 토큰만 인덱싱
    const newTokenIds = allTokenIds.filter(id => !existingIds.has(id));
    console.log(`새로 인덱싱할 토큰 수: ${newTokenIds.length}`);

    for (const id of newTokenIds) {
      await this.indexTokenOwnership(id);
    }
  }
}
