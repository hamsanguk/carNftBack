import { Injectable,NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { ethers, LogDescription } from 'ethers'  //타입을 임시로 피하는 LogDescription
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import 'dotenv/config';
import VehicleNFTabi from "../../abi/VehicleNFT.json"


@Injectable()
export class VehiclesService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
    
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {
    // 환경변수에서 RPC URL, 프라이빗 키, 컨트랙트 주소 불러오기
    const rpcUrl = process.env.RPC_URL!;
    const privateKey = process.env.PRIVATE_KEY!;
    const contractAddress = process.env.VEHICLE_NFT_ADDRESS!;
    const contractAbi = VehicleNFTabi;

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, contractAbi.abi, this.wallet);
  }

  
  async mintVehicle(createVehicleDto: CreateVehicleDto, ownerAddress: string): Promise<Vehicle> {
    const { vin, manufacturer } = createVehicleDto;
  
    // 1) 스마트컨트랙트 호출
    const tx = await this.contract.mintVehicle(vin, manufacturer);
    console.log('tx hash', tx.hash);
  
    // 2) 트랜잭션 완료 대기
    const receipt = await tx.wait();
    console.log('트랜잭션 리시트:', receipt);
  
    // 3) 이벤트 파싱
    let event: LogDescription | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log)!;//parsed === null 면 에러
        if (parsed.name === 'VehicleMinted') {
          event = parsed;
          break;
        }
        console.log('null일수 있는 parsed',parsed)
      } catch {
        // 다른 로그는 무시
      }
    }
    if (!event) {
      throw new Error('VehicleMinted 이벤트를 찾을 수 없습니다.');
    }
  
    // 4) tokenId 추출 및 변환
    const tokenIdRaw = event.args.tokenId as bigint;
    const tokenId = Number(tokenIdRaw);
    console.log('민팅된 tokenId:', tokenId);
  
    // 5) DB 저장 (중복 시 기존 레코드 반환)
    let vehicle: Vehicle;
  try {
    vehicle = this.vehicleRepository.create({
      tokenId,
      vin,
      manufacturer,
      owner: ownerAddress,
      mintedAt: new Date(),
    });
    vehicle = await this.vehicleRepository.save(vehicle);
  } catch (e: any) {
    if (e.code === '23505') {
      console.warn(`중복 VIN(${vin}) 감지, 기존 레코드 조회`);
      // findOneByOrFail 사용하면 항상 Vehicle을 반환합니다.
      vehicle = await this.vehicleRepository.findOneByOrFail({ vin });
    } else {
      throw e;
    }
  }

  return vehicle;
}

async getVehicle(tokenId: number) {
    // 1) DB에서 캐시된 메타데이터 조회
    const vehicle = await this.vehicleRepository.findOneBy({ tokenId });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${tokenId} not found in DB`);
    }
  
    // 2) on-chain으로 소유자 주소 조회
    //const ownerOnChain = await this.contract.ownerOf(tokenId);
    let ownerOnChain: string | null;
    try {
        ownerOnChain = await this.contract.ownerOf(tokenId);
    } catch {
        ownerOnChain= null;
    }
  
    // 3) (선택) tokenURI 또는 추가 속성 가져오기
    let tokenUri: string | null = null;
    try {
      tokenUri = await this.contract.tokenURI(tokenId);
    } catch {
      // tokenURI 구현 안 돼 있으면 무시
    }
  
    return {
      tokenId: vehicle.tokenId,
      vin: vehicle.vin,
      manufacturer: vehicle.manufacturer,
      ownerDb: vehicle.owner,
      ownerOnChain,
      mintedAt: vehicle.mintedAt,
      tokenUri,
    };
  }
  
}
