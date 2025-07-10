import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository,In } from 'typeorm';
import { TradeRequest, TradeStatus } from './trade.entity';
import { CreateTradeRequestDto } from './dto/create-trade-request.dto';


@Injectable()
export class TradeService {
  constructor(
    @InjectRepository(TradeRequest)
    private readonly tradeRepo: Repository<TradeRequest>,
  ) {}
//거래요청 생성 
  async createTradeRequest(dto: CreateTradeRequestDto) {
    const exists = await this.tradeRepo.findOne({
      where: {
        token_id: dto.token_id,
        requester: dto.requester,
        status: In([TradeStatus.PENDING,TradeStatus.APPROVED]),
      },
    });
    if (exists) {
      throw new ConflictException('이미 요청된 거래입니다.');
    }
    const req = this.tradeRepo.create({
      ...dto,
      status: TradeStatus.PENDING,
    });
    return this.tradeRepo.save(req);
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
  }ß

  async approveRequest(id: string, approve: boolean) {
    const req = await this.tradeRepo.findOneBy({ id });
    if (!req) throw new NotFoundException('요청 없음');
    req.status = approve ? TradeStatus.APPROVED : TradeStatus.REJECTED;
    //req.approver = 'admin'; // NOTE: Should be replaced with actual user from JWT 
    //잼미니가 49번째줄 추가
    req.approved_at = new Date();
    return this.tradeRepo.save(req);
  }

  // async approveRequest(id: string, isApprove: boolean) {
  //   const request = await this.tradeRepo.findOne({ where: { id } });
  //   if (!request) throw new NotFoundException('요청을 찾을 수 없습니다.');

  //   request.status = isApprove ? TradeStatus.APPROVED : TradeStatus.REJECTED;
  //   request.approver = 'admin'; // 실사용 시 JWT에서 유저 정보 추출 임시용 하드코딩jwt에서 실제 사용자 지갑주소나 userid 추출
  //   request.approved_at = new Date();
  //   return this.tradeRepo.save(request);
  // }
}
