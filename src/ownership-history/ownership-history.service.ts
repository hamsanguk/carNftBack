// back/src/modules/ownership-history/ownership-history.service.ts
import { Injectable } from '@nestjs/common';
import { OwnershipHistory } from './ownership-history.entity';

@Injectable()
export class OwnershipHistoryService {
  async getOwnershipHistory(tokenId: number): Promise<OwnershipHistory[]> {
    return OwnershipHistory.find({ where: { tokenId }, order: { startTimestamp: 'ASC' } });
  }
}
