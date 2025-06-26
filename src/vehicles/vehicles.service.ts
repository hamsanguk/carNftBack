import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { ethers } from 'ethers'
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import 'dotenv/config';
import VehicleNFTabi from "../../abi/VehicleNFT.json"
import { LogDescription } from 'ethers'; //타입을 임시로 피함 지울거

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


    // 스마트컨트랙트 호출
    const tx = await this.contract.mintVehicle(vin, manufacturer);
    console.log('tx hash', tx.hash)
    const receipt = await tx.wait();
    console.log('트랜잭션 리시트:', receipt);


    let event:LogDescription |null = null;
    for (const log of receipt.logs) {
        try {
          const parsedLog = this.contract.interface.parseLog(log)!;
          if (parsedLog.name === 'VehicleMinted') {
            event = parsedLog;
            break;
          }
        } catch {
          // 무시
        }
      }

if (!event) {
  throw new Error('VehicleMinted 이벤트를 찾을 수 없습니다.');
}

    const tokenId = event.args.tokenId.toString();
    console.log('민팅된 tokenId:', tokenId);
    
    // DB 저장
    const vehicle = this.vehicleRepository.create({
      tokenId,
      vin,
      manufacturer,
      owner: ownerAddress,
      mintedAt: new Date(),
    });
    return this.vehicleRepository.save(vehicle);
  }
}
