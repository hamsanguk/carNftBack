// ethers v6 기준
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { ethers } from 'ethers';
import VehicleNFTabi from '../../abi/VehicleNFT.json';
import 'dotenv/config';

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ${name} is required`);
  return v;
}

// 불린 환경변수 안전 파서: 따옴표 제거 + 소문자 비교
function parseBoolEnv(raw: string | undefined, fallback = false): boolean {
  if (raw == null) return fallback;
  const t = raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  return t === '1' || t === 'true' || t === 'yes' || t === 'y' || t === 'on';
}

// 이벤트 시그니처 → topic0 (ABI와 정확히 일치해야 합니다)
const VEHICLE_MINTED_SIG = 'VehicleMinted(address,address,uint256,string)';
const VEHICLE_MINTED_TOPIC = ethers.id(VEHICLE_MINTED_SIG);

@Injectable()
export class VehicleEventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VehicleEventListenerService.name);

  private provider!: ethers.JsonRpcProvider; // HTTP 전용
  private iface = new ethers.Interface(VehicleNFTabi);
  private contractAddr!: string;

  // 폴링 제어
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  // 처리 범위 상태
  private lastProcessedBlock = 0;

  // ===== ENV 매핑 =====
  // 활성 플래그: 우선 VEHICLE_EVENT_POLL_ENABLED, 없으면 OWNERSHIP_INDEX_CRON_ENABLED 사용
  private readonly ENABLED =
    parseBoolEnv(process.env.VEHICLE_EVENT_POLL_ENABLED, undefined as any) ??
    parseBoolEnv(process.env.OWNERSHIP_INDEX_CRON_ENABLED, true); // 기본값 true → 기존 동작 유지

  // 확정성 블록 수
  private readonly CONFIRMATIONS = Number(process.env.CONFIRMATIONS ?? 2);

  // 청크 크기: INDEX_BLOCK_STEP > POLL_MAX_BLOCK_RANGE > POLL_CHUNK
  private readonly CHUNK_SIZE = Number(
    process.env.INDEX_BLOCK_STEP ??
      process.env.POLL_MAX_BLOCK_RANGE ??
      process.env.POLL_CHUNK ??
      3000,
  );

  // 폴링 주기: POLL_SLEEP_MS > POLL_INTERVAL_MS
  private readonly INTERVAL_MS = Number(
    process.env.POLL_SLEEP_MS ?? process.env.POLL_INTERVAL_MS ?? 4000,
  );

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  // VehicleMinted 이벤트 로그를 처리하는 실제 로직
  private handleVehicleMinted = async (
    operator: string,
    to: string,
    tokenIdRaw: bigint,
    vin: string,
    meta: { blockNumber?: number; txHash?: string },
  ) => {
    const tokenId = Number(tokenIdRaw);
    this.logger.log(`VehicleMinted: tokenId=${tokenId}, vin=${vin}, to=${to}`);

    // 블록 타임스탬프 → mintedAt
    let mintedAt = new Date();
    try {
      if (meta.blockNumber != null) {
        const blk = await this.provider.getBlock(meta.blockNumber);
        if (blk?.timestamp) mintedAt = new Date(Number(blk.timestamp) * 1000);
      }
    } catch {
      // ignore
    }

    // on-chain manufacturer 조회(실패해도 진행)
    let manufacturer = '';
    try {
      const [, mfr]: [string, string] = await new ethers.Contract(
        this.contractAddr,
        VehicleNFTabi,
        this.provider,
      ).getVehicleInfo(tokenId);
      manufacturer = mfr || '';
    } catch {
      this.logger.warn(`getVehicleInfo(${tokenId}) 실패 → manufacturer 빈값 저장`);
    }

    // 중복 안전: tokenId unique
    await this.vehicleRepository
      .createQueryBuilder()
      .insert()
      .into(Vehicle)
      .values({ tokenId, vin, manufacturer, owner: to, mintedAt })
      .onConflict(`("tokenId") DO NOTHING`)
      .execute();

    this.logger.log(`vehicles upsert 완료 (tokenId=${tokenId})`);
  };

  async onModuleInit() {
    if (!this.ENABLED) {
      this.logger.log('VehicleMinted 폴링 비활성화: VEHICLE_EVENT_POLL_ENABLED/OWNERSHIP_INDEX_CRON_ENABLED=false');
      return;
    }

    const httpUrl = process.env.RPC_URL || 'https://public-en-kairos.node.kaia.io';
    this.contractAddr = mustEnv('VEHICLE_NFT_ADDRESS');

    // HTTP Provider 연결 확인
    this.provider = new ethers.JsonRpcProvider(httpUrl);
    await this.provider.getBlockNumber().catch((e) => {
      this.logger.error(`RPC 연결 실패: ${httpUrl} / ${e?.message}`);
      throw e;
    });
    this.logger.log(`Using JsonRpcProvider(HTTP): ${httpUrl}`);

    // 시작 블록: DEPLOYMENT_BLOCK 또는 VEHICLE_NFT_DEPLOY_BLOCK → 없으면 현재 블록
    const head = await this.provider.getBlockNumber();
    const startBlockEnv =
      process.env.DEPLOYMENT_BLOCK ?? process.env.VEHICLE_NFT_DEPLOY_BLOCK;
    this.lastProcessedBlock = Number(startBlockEnv ?? head);

    // 주기 폴링 시작
    this.timer = setInterval(() => {
      this.pollOnce().catch((err) => {
        this.logger.error(`pollOnce 실패: ${(err as Error).message}`);
      });
    }, this.INTERVAL_MS);

    this.logger.log(
      `VehicleMinted 폴링 시작: from=${this.lastProcessedBlock}, interval=${this.INTERVAL_MS}ms, chunk=${this.CHUNK_SIZE}, conf=${this.CONFIRMATIONS}`,
    );
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  // 한 번의 폴링 사이클: eth_getLogs로만 조회 (eth_newFilter 사용 안함)
  private async pollOnce() {
    if (this.isRunning) return; // 중복 실행 방지
    this.isRunning = true;
    try {
      const head = await this.provider.getBlockNumber();
      const safeHead = head - this.CONFIRMATIONS; // 확정성 고려
      let fromBlock = this.lastProcessedBlock + 1;

      if (safeHead < fromBlock) return; // 처리할 구간 없음 추후 
      while (fromBlock <= safeHead) {
        const toBlock = Math.min(fromBlock + this.CHUNK_SIZE - 1, safeHead);

        const logs = await this.provider.getLogs({
          address: this.contractAddr,
          topics: [VEHICLE_MINTED_TOPIC],
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          try {
            const parsed = this.iface.parseLog(log)!;
            const [operator, to, tokenId, vin] =
              (parsed.args as unknown as [string, string, bigint, string]);

            await this.handleVehicleMinted(operator, to, tokenId, vin, {
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
            });
          } catch (e) {
            this.logger.warn(
              `로그 파싱/처리 실패 (block=${log.blockNumber} tx=${log.transactionHash}): ${(e as Error).message}`,
            );
          }
        }

        this.lastProcessedBlock = toBlock;
        fromBlock = toBlock + 1;
      }
    } finally {
      this.isRunning = false;
    }
  }
}
