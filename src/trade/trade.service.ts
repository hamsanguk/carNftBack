// trade.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
        status: In([TradeStatus.PENDING, TradeStatus.APPROVED]),
      },
    });
    if (exists) throw new ConflictException('이미 요청된 거래입니다.');
    const req = this.tradeRepo.create({ ...dto, status: TradeStatus.PENDING });
    return this.tradeRepo.save(req);
  }

  async getRequestsByStatus(status: string) {
    return this.tradeRepo.find({ where: { status: status as TradeStatus } });
  }

  async getRequestByTokenAndRequester(tokenId: string, requester: string) {
    return this.tradeRepo.find({
      where: { token_id: tokenId, requester },
      order: { created_at: 'DESC' },
      take: 1,
    });
  }

  // 추가: 토큰 기준 최신 승인 요청 (요청자 불문)
  async getLatestApprovedRequestByToken(tokenId: string) {
    return this.tradeRepo.findOne({
      where: { token_id: tokenId, status: TradeStatus.APPROVED },
      order: { approved_at: 'DESC' }, // 승인 시각 기준 최신
    });
  }

  async approveRequest(id: string, approve: boolean) {
    const req = await this.tradeRepo.findOneBy({ id });
    if (!req) throw new NotFoundException('요청 없음');
    req.status = approve ? TradeStatus.APPROVED : TradeStatus.REJECTED;
    req.approved_at = new Date();
    return this.tradeRepo.save(req);
  }

  // 추가: 거래 완료 처리 (tx_hash 저장)
  async completeRequest(id: string, txHash: string) {
    const req = await this.tradeRepo.findOneBy({ id });
    if (!req) throw new NotFoundException('요청 없음');
    req.status = TradeStatus.COMPLETED;
    req.tx_hash = txHash;
    return this.tradeRepo.save(req);
  }
}
