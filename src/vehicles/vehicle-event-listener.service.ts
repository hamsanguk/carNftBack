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

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {
    const wsUrl = process.env.RPC_WS_URL!;
    this.provider = new ethers.WebSocketProvider(wsUrl);
    this.contract = new ethers.Contract(
      process.env.VEHICLE_NFT_ADDRESS!,
      VehicleNFTabi.abi,
      this.provider,
    );
  }

  onModuleInit() {
    // 앱 시작 시 WebSocket으로 이벤트 구독
    this.contract.on('VehicleMinted', this.handleMinted.bind(this));
    this.logger.log('⚡️ VehicleMinted 이벤트 리스너 등록 완료 via WS');
  }

  async handleMinted(
    operator: string,
    to: string,
    tokenIdRaw: bigint,
    vin: string,
  ) {
    const tokenIdNumber = Number(tokenIdRaw);
    this.logger.log(`🔔 VehicleMinted 감지: tokenId=${tokenIdNumber}, vin=${vin}, to=${to}`);

    // 이미 DB에 저장된 적이 있는지 확인
    const exists = await this.vehicleRepository.findOneBy({ tokenId: tokenIdNumber });
    if (exists) {
      this.logger.log(`→ tokenId=${tokenIdNumber}는 이미 DB에 존재함, 스킵`);
      return;
    }

    // on-chain에서 manufacturer 정보 조회
    let manufacturer = '';
    try {
      const [, manufacturerOnChain]: [string, string] = await this.contract.getVehicleInfo(tokenIdNumber);
      manufacturer = manufacturerOnChain;
    } catch (error) {
      this.logger.warn('→ on-chain getVehicleInfo 호출 실패, manufacturer 빈 문자열로 저장');
    }

    // DB에 저장
    const vehicle = this.vehicleRepository.create({
      tokenId: tokenIdNumber,
      vin,
      manufacturer,
      owner: to,
      mintedAt: new Date(),
    });
    await this.vehicleRepository.save(vehicle);
    this.logger.log(`→ DB에 tokenId=${tokenIdNumber} 저장 완료`);
  }

  onModuleDestroy() {
    this.contract.removeAllListeners('VehicleMinted');
    this.provider.destroy(); // WebSocket 연결 종료
  }
}
