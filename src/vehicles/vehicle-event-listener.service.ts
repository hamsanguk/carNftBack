// back/src/vehicles/vehicle-event-listener.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { ethers } from 'ethers';
import VehicleNFTabi from '../../abi/VehicleNFT.json';
import 'dotenv/config';

@Injectable()
export class VehicleEventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VehicleEventListenerService.name);
  private provider: ethers.WebSocketProvider;
  private contract: ethers.Contract;

  // bind 대신 화살표 함수로 핸들러 레퍼런스를 고정해 중복/제거를 명확히 합니다.
  private handleVehicleMinted = async (
    operator: string,
    to: string,
    tokenIdRaw: bigint,
    vin: string,
    event?: ethers.EventLog // v6 이벤트 객체
  ) => {
    const tokenId = Number(tokenIdRaw);
    this.logger.log(`🔔 VehicleMinted: tokenId=${tokenId}, vin=${vin}, to=${to}`);

    // 블록 타임스탬프 기준 mintedAt (fallback: 현재 시각)
    let mintedAt = new Date();
    try {
      if (event?.blockNumber != null) {
        const blk = await this.provider.getBlock(event.blockNumber);
        if (blk?.timestamp) mintedAt = new Date(Number(blk.timestamp) * 1000);
      }
    } catch {
      // ignore, fallback 유지
    }

    // on-chain manufacturer 조회(실패해도 진행)
    let manufacturer = '';
    try {
      const [, manufacturerOnChain]: [string, string] = await this.contract.getVehicleInfo(tokenId);
      manufacturer = manufacturerOnChain || '';
    } catch {
      this.logger.warn(`getVehicleInfo(${tokenId}) 실패 → manufacturer 빈값으로 저장`);
    }

    // INSERT IGNORE (Postgres): tokenId 충돌 시 무시 → 중복 이벤트/중복 리스너에도 안전
    await this.vehicleRepository
      .createQueryBuilder()
      .insert()
      .into(Vehicle)
      .values({
        tokenId,
        vin,
        manufacturer,
        owner: to,
        mintedAt,
        // for_sale 는 엔티티 기본값/DB DEFAULT를 사용 (필요시 명시)
      })
      .onConflict(`("tokenId") DO NOTHING`)
      .execute();

    this.logger.log(`→ vehicles upsert 완료 (tokenId=${tokenId})`);
  };

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {
    const wsUrl = process.env.RPC_WS_URL!;
    this.provider = new ethers.WebSocketProvider(wsUrl);
    this.contract = new ethers.Contract(
      process.env.VEHICLE_NFT_ADDRESS!,
      VehicleNFTabi,
      this.provider
    );
  }

  onModuleInit() {
    // 중복 구독 방지: 기존 리스너 제거 후 등록
    this.contract.removeAllListeners('VehicleMinted');
    this.contract.on('VehicleMinted', this.handleVehicleMinted);
    this.logger.log('⚡️ VehicleMinted 이벤트 리스너 등록 완료 (WS)');
  }

  onModuleDestroy() {
    this.contract.removeAllListeners('VehicleMinted');
    // ethers v6 WebSocketProvider 종료
    try {
      this.provider.destroy();
    } catch {
      // ignore
    }
  }
}
