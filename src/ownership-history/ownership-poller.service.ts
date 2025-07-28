import { Injectable } from '@nestjs/common';
import { Contract, JsonRpcProvider } from 'ethers';
import vehicleNftAbi from '../../abi/VehicleNFT.json';
import { OwnershipIndexerService } from './ownership-indexer.service';
import { OwnershipPollerStatus} from './ownership-poller-status.entity'

@Injectable()
export class OwnershipPollingService {
  private defaultInitBlock = 191090437; // DB 등으로 변경 가능
  private statusKey = 'default';

  constructor(private readonly indexer: OwnershipIndexerService) {}

  async getLatestBlockFromDB(): Promise<number> {
    const status = await OwnershipPollerStatus.findOne({where:{id: this.statusKey}});
    return status ? Number(status.latestScannedBlock) :this.defaultInitBlock;
  }

  async saveLatestBlockToDb(block: number) {
    let status = await OwnershipPollerStatus.findOne({ where: { id: this.statusKey } });
    if (!status) {
      status = OwnershipPollerStatus.create({
        id: this.statusKey,
        latestScannedBlock: String(block),
      });
    } else {
      status.latestScannedBlock = String(block);
    }
    await status.save();
  }

  /** 신규 Transfer 이벤트만 폴링하여 인덱싱 */
  async pollNewTransfers(): Promise<void> {

    const latestScannedBlock = await this.getLatestBlockFromDB()

    const provider = new JsonRpcProvider(process.env.RPC_URL!);
    const contract = new Contract(
      process.env.VEHICLE_NFT_ADDRESS!,
      vehicleNftAbi,
      provider
    );
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = latestScannedBlock + 1;
    if (fromBlock > currentBlock) {
      console.log(`No new blocks from ${fromBlock} to ${currentBlock}. Skipping.`);
      return;
    }
    const MAX_BLOCK_RANGE = 4999; // 5,000 블록 미만
    let logs: any[] = [];
    for (let start = fromBlock; start <= currentBlock; start += MAX_BLOCK_RANGE + 1) {
      const end = Math.min(start + MAX_BLOCK_RANGE, currentBlock);
      const chunkLogs = await contract.queryFilter(
        contract.filters.Transfer(null, null, null),
        start,
        end
      );
      logs = logs.concat(chunkLogs);
      console.log(`Polled from ${start} to ${end}: ${chunkLogs.length} logs`);
      await new Promise((r) => setTimeout(r, 800));

      // **각 batch 끝마다 저장!**
      await this.saveLatestBlockToDb(end);
    }
    // 새로 감지된 tokenId만 인덱싱
    const tokenIds = Array.from(new Set(logs.map((log: any) => Number(log.args.tokenId))));
    for (const tokenId of tokenIds) {
      // **여기서만 호출! 전체 인덱싱에서는 절대 호출하지 않음**
      await this.indexer.indexTokenOwnership(tokenId);
    }
   await this.saveLatestBlockToDb(currentBlock);
    console.log(`Polled and indexed ${tokenIds.length} token IDs from block ${fromBlock} to ${currentBlock}`);
  }

  /** 에러 시 8초 후 재시도 */
  async safePoll(): Promise<void> {
    try {
      await this.pollNewTransfers();
    } catch (error: any) {
      console.error('Poll error, retry after 8s', error);
      await new Promise((resolve) => setTimeout(resolve, 8000));
      await this.safePoll();
    }
  }
}
//여기 에서 burst현상 방지가 되는 방법 찾기
//"폴링"과 "토큰별 인덱싱"이 서로 다른 방식으로 블록을 스캔하기 때문입니다.
// 왜 이런 현상이 발생할까요?
// pollNewTransfers()
// → 전체 Transfer 이벤트를 batch로 쿼리하여,
// → "새로 발견된 tokenId"만 추출
// → 각 tokenId마다 다시 indexTokenOwnership(tokenId) 호출
// indexTokenOwnership(tokenId)
// → 이 함수 내부에서도 또다시
// → deploymentBlock~latestBlock까지 tokenId 하나에 대한 Transfer를 "batch로" 쿼리
// 전체 블록 범위를 한 번 batch로 쿼리
// 그 결과에서 tokenId를 뽑아서,
// 뽑힌 각 tokenId마다 같은 범위를 또다시 batch로 쿼리
// ➔ 결국 같은 block range가 두 번쿼리됩니다.
// (한 번은 전체 이벤트로, 한 번은 tokenId별로)
// 실질적 비효율 예시
// 예를 들어
// 전체 Transfer 이벤트가 적을 때는 크게 문제가 없지만,
// 여러 토큰의 Transfer가 분산되어 있을 경우,
// 같은 구간을 여러 번 중복 쿼리합니다.
// 속도 느려지고, RPC 트래픽 과다 발생
// 근본적으로 효율화하려면?
// 1) pollNewTransfers에서 이미 "tokenId별" 로그를 모두 쿼리/분해해서,
// 각 tokenId의 인덱싱을 바로 만들고,
// indexTokenOwnership(tokenId)를 별도로 부르지 않고,
// 직접 OwnershipHistory를 저장하는 방식으로 리팩토링
// 2) 간단 개선(추천):
// pollNewTransfers에서 tokenId별로 logs를 미리 분류/배열화
// indexTokenOwnership(tokenId, logs?) 처럼
// 이미 구한 logs 파라미터로 넘기면
// 다시 블록 범위 재조회 없이 바로 이력 저장 가능
// 3) 최적화 코드 예시
// (a) pollNewTransfers에서 전체 logs를 tokenId별로 묶어서 전달
// typescript/ 복사 / 편집
// const tokenLogsMap = new Map<number, any[]>();
// for (const log of logs) {
//   const tokenId = Number(log.args.tokenId);
//   if (!tokenLogsMap.has(tokenId)) tokenLogsMap.set(tokenId, []);
//   tokenLogsMap.get(tokenId)!.push(log);
// }
// for (const [tokenId, tokenLogs] of tokenLogsMap.entries()) {
//   await this.indexer.indexTokenOwnership(tokenId, tokenLogs);
// }
// (b) indexTokenOwnership에서 logs 파라미터가 있으면 재조회 생략
// typescript/ 복사/ 편집
// async indexTokenOwnership(tokenId: number, logsFromPoller?: any[]) {
//   let logs = logsFromPoller;
//   if (!logs) {
//     // 기존대로 직접 쿼리
//     // ...
//   }
//   // 이하 OwnershipHistory 저장 코드 동일
// }
// 최종 결론 / 지금 방식은 "폴링 쿼리" + "tokenId별 쿼리"로 두 번 반복됨 (필연적으로 비효율)
// 폴링 단계에서 logs를 tokenId별로 분류, 바로 OwnershipHistory로 넘기는 구조로 리팩토링하면 중복 쿼리 없이, 단 한 번의 스캔만으로 모든 이력이 갱신됨
// 속도/트래픽/비용 모두 대폭 절감