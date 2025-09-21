import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { MintRequestService } from 'src/mint-request/mint-request.service';
import { ethers, LogDescription } from 'ethers';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import 'dotenv/config';
import VehicleNFTabi from '../../abi/VehicleNFT.json';

@Injectable()
export class VehiclesService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    private readonly mintRequestService: MintRequestService,
  ) {
    const rpcUrl = process.env.RPC_URL!;
    const privateKey = process.env.PRIVATE_KEY!;
    const contractAddress = process.env.VEHICLE_NFT_ADDRESS!;
    const contractAbi = VehicleNFTabi;

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, contractAbi, this.wallet);
  }

  async mintVehicle(createVehicleDto: CreateVehicleDto, ownerAddressFromHeader: string, workshopAddress:string): Promise<Vehicle> {
    const to = createVehicleDto.ownerAddress || ownerAddressFromHeader;
    const { vin, manufacturer, metadataUri = '' } = createVehicleDto;
    // const approvedList = await this.mintRequestService.findApprovedByWorkshop(workshopAddress);
    // const found = approvedList.find(r => r.vin === createVehicleDto.vin)
    // if(!found){ throw new BadRequestException('이 차량(vin)은 아직 관리자 승인되지 않았습니다.')} workshop은 동작하지만, admin도 동작하게 하는 코드
  
    const normWorkshop = workshopAddress.toLowerCase().trim();
    const normVin      = createVehicleDto.vin.trim();
    //온체인 admin여부 확인(컨트랙트상의 admin이라면 db승인 검증 skip)
    if(!metadataUri || !metadataUri.startsWith('ipfs://'))throw new BadRequestException('metadataUri가 올바르지 않습니다.');{};
    
    let isAdmin = false;
        try {
          isAdmin = await this.contract.admins(normWorkshop);
       } catch {
          isAdmin = false;
        }
    //관리자가 아니라면 db승인기록을 확인
    if (!isAdmin) {
            const approvedList = await this.mintRequestService.findByStatusAndWorkshop('approved', normWorkshop);
            const found = approvedList.some(r => r.vin.trim() === normVin);
            if (!found) {
              throw new BadRequestException('이 차량(VIN)은 아직 관리자 승인되지 않았습니다.');
            }
          }

    const tx = await this.contract.mintVehicle(to, vin, manufacturer, metadataUri);
    console.log('tx hash', tx.hash);

    const receipt = await tx.wait();
    console.log('트랜잭션 리시트:', receipt);

    let event: LogDescription | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (parsed?.name === 'VehicleMinted') {
          event = parsed;
          break;
        }
      } catch {}
    }
    if (!event) {
      throw new Error('VehicleMinted 이벤트를 찾을 수 없습니다.');
    }

    const tokenIdRaw = event.args.tokenId;
    const tokenId = Number(tokenIdRaw);

    let vehicle: Vehicle;
    try {
      vehicle = this.vehicleRepository.create({
        tokenId,
        vin,
        manufacturer,
        owner: to,
        mintedAt: new Date(),
      });
      vehicle = await this.vehicleRepository.save(vehicle);
    } catch (e: any) {
      if (e.code === '23505') {
        console.warn(`중복 VIN(${vin}) 감지, 기존 레코드 조회`);
        vehicle = await this.vehicleRepository.findOneByOrFail({ vin });
      } else {
        throw e;
      }
    }

    return vehicle;
  }

  async updateSaleStatus(tokenId: number, status: boolean) {
    const vehicle = await this.vehicleRepository.findOneBy({ tokenId });
    if (!vehicle) throw new NotFoundException('차량이 존재하지 않습니다.');
    vehicle.for_sale = status;
    return this.vehicleRepository.save(vehicle);
  }
  
  async getAllVehicles(){//리스트용
    const vehicles = await this.vehicleRepository.find();//db에서 vehicle가져와서
    //vehicle마다 온체인 정보(owner, taaokenUri) 병렬로 조회
    const enriched = await Promise.all(vehicles.map(async(vehicle)=>{
      let ownerOnChain: string | null = null;
    let tokenUri: string | null = null;
    try {
      ownerOnChain = await this.contract.ownerOf(vehicle.tokenId);
    } catch {
      ownerOnChain = null;
    }
    try {
      tokenUri = await this.contract.tokenURI(vehicle.tokenId);
    } catch {
      tokenUri = null;
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
    }));
    return enriched;
  }

  async getVehicle(tokenId: number) {
    const vehicle = await this.vehicleRepository.findOneBy({ tokenId });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${tokenId} not found in DB`);
    }

    let ownerOnChain: string | null;
    try {
      ownerOnChain = await this.contract.ownerOf(tokenId);
    } catch {
      ownerOnChain = null;
    }

    let tokenUri: string | null = null;
    try {
      tokenUri = await this.contract.tokenURI(tokenId);
    } catch {
      // 무시
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

  async getOwnerOnChain(tokenId:number): Promise<string | null>{
    try{
      return await this.contract.ownerOf(tokenId);
    }catch{
      return null;
    }
  }
}
