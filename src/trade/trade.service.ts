import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeRequest, TradeStatus } from './trade.entity';
import { CreateTradeRequestDto } from './dto/create-trade-request.dto';

@Injectable()
export class TradeService {
  constructor(
    @InjectRepository(TradeRequest)
    private readonly tradeRepo: Repository<TradeRequest>,
  ) {}

  async createTradeRequest(dto: CreateTradeRequestDto) {
    const exists = await this.tradeRepo.findOne({
      where: {
        token_id: dto.token_id,
        requester: dto.requester,
        status: TradeStatus.PENDING,
      },
    });
    if (exists) {
      throw new ConflictException('이미 요청된 거래입니다.');
    }

    const trade = this.tradeRepo.create({
      ...dto,
      status: TradeStatus.PENDING,
    });
    return this.tradeRepo.save(trade);
  }

  async getRequestsByStatus(status: string) {
    return this.tradeRepo.find({ where: { status: status as TradeStatus} });
  }

  async getRequestByTokenAndRequester(tokenId: string,requester: string){
    return this.tradeRepo.find({
      where:{token_id: tokenId, requester},
      order:{created_at:'DESC'},
      take:1,
    })
  }

  async approveRequest(id: string, isApprove: boolean) {
    const request = await this.tradeRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('요청을 찾을 수 없습니다.');

    request.status = isApprove ? TradeStatus.APPROVED : TradeStatus.REJECTED;
    request.approver = 'admin'; // 실사용 시 JWT에서 유저 정보 추출 임시용 하드코딩jwt에서 실제 사용자 지갑주소나 userid 추출
    request.approved_at = new Date();
    return this.tradeRepo.save(request);
  }
}
