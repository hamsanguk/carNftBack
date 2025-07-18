import { Injectable } from '@nestjs/common';
import { Contract, JsonRpcProvider, EventLog } from 'ethers';
import { OwnershipHistory } from './ownership-history.entity';
import vehicleNftAbi from '../../abi/VehicleNFT.json';

@Injectable()
export class OwnershipIndexerService {
  async indexTokenOwnership(tokenId: number) {
    const provider = new JsonRpcProvider(process.env.RPC_URL!);
    const contract = new Contract(process.env.VEHICLE_NFT_ADDRESS!, vehicleNftAbi, provider);
    const BLOCK_STEP = 5_000;
    const deploymentBlock = 190902893; // 컨트랙트배포 블록넘버나 세부적으로는 민팅된 블록넘버
    const latestBlock = await provider.getBlockNumber();

    const filter = contract.filters.Transfer(null, null, tokenId);

    let allLogs: any[] = [];
    for (let from = deploymentBlock; from <= latestBlock; from += BLOCK_STEP) {
      const to = Math.min(from + BLOCK_STEP - 1, latestBlock);
      const logs = await contract.queryFilter(filter, from, to);
      allLogs = allLogs.concat(logs);
      console.log(`Fetched logs from block ${from} to ${to}: ${logs.length} logs`);
    }

    // 2. 블록타임스탬프 함께 배열로 변환
    const events = await Promise.all(
      allLogs
        .filter(log => 'args' in log)
        .map(async log => {
          const event = log as EventLog;
          const block = await provider.getBlock(log.blockNumber);
          if (!block) throw new Error(`Block not found for log: ${log.transactionHash}`);
          return {
            from: event.args.from,
            to: event.args.to,
            tokenId: event.args.tokenId,
            blockNumber: event.blockNumber,
            timestamp: block.timestamp,
          };
        })
    );

    // 3. 소유주별 기간 계산해서 DB에 반영
    for (let i = 0; i < events.length; i++) {
      const curr = events[i];
      const next = events[i + 1];
      await OwnershipHistory.create({
        tokenId: Number(curr.tokenId),
        ownerAddress: curr.to,
        startTimestamp: curr.timestamp,
        endTimestamp: next ? next.timestamp : null,
      }).save();
    }
  }
}
