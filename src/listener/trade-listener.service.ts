import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeRequest, TradeStatus } from '../trade/trade.entity';
import { TradeHistory } from 'src/trade-history/trade-history.entity';// 이미 있는 테이블
import VehicleNFTABI from '../../abi/VehicleNFT.json'; // 🔁 ABI JSON 경로는 프로젝트에 맞게 수정

@Injectable()
export class TradeListenerService implements OnModuleInit {
  private readonly logger = new Logger(TradeListenerService.name);
  private contract: ethers.Contract;

  constructor(
    @InjectRepository(TradeRequest)
    private readonly tradeRepo: Repository<TradeRequest>,
    @InjectRepository(TradeHistory)
    private readonly historyRepo: Repository<TradeHistory>,
  ) {}

  async onModuleInit() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL); // ex: Klaytn RPC
    const contractAddress = process.env.VEHICLE_NFT_CA;               // VehicleNFT CA
    if (!contractAddress) {
      throw new Error('VEHICLE_NFT_CA environment variable is not set.');
    }
    this.contract = new ethers.Contract(contractAddress, VehicleNFTABI, provider);

    this.contract.on('Transfer', async (from, to, tokenId, event) => {
      try {
        this.logger.log(`Transfer event: tokenId=${tokenId} from=${from} to=${to}`);

        // 1. 승인된 거래 요청 확인
        const request = await this.tradeRepo.findOne({
          where: {
            token_id: tokenId.toString(),
            status: TradeStatus.APPROVED,
          },
        });

        if (request) {
          request.status = TradeStatus.COMPLETED;
          request.tx_hash = event.transactionHash;
          await this.tradeRepo.save(request);
          this.logger.log(`TradeRequest ${request.id} marked as completed`);
        }

        // 2. trade_history에 기록 (중복 방지)
        const exists = await this.historyRepo.findOne({
          where: { txHash: event.transactionHash },
        });
        if (!exists) {
          const history = this.historyRepo.create({
            tokenId: tokenId.toString(),
            from,
            to,
            txHash: event.transactionHash,
            tradedAt: new Date(),
          });
          await this.historyRepo.save(history);
          this.logger.log(`TradeHistory saved: tx ${event.transactionHash}`);
        }
      } catch (err) {
        this.logger.error(`Error handling Transfer event: ${err.message}`);
      }
    });
  }
}
