// src/vehicles/vehicle-mint-request.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MintRequest } from './mint-request.entity';

@Injectable()
export class MintRequestService {
  constructor(
    @InjectRepository(MintRequest)
    private repo: Repository<MintRequest>
  ) {}

  async create(req: Partial<MintRequest>) {
    return this.repo.save(this.repo.create(req));
  }

  async approve(id: number) {
    await this.repo.update(id, { status: 'approved' });
  }

  async reject(id: number) {
    await this.repo.update(id, { status: 'rejected' });
  }

  async findApprovedByWorkshop(workshop: string) {
    return this.repo.find({ where: { workshop, status: 'approved' } });
  }

  async findByStatusAndWorkshop(status: string, workshop?: string) {
    if (workshop) {
      return this.repo.find({ where: { workshop, status } });
    }
    return this.repo.find({ where: { status } });
  }

  async findPending() {
    return this.repo.find({ where: { status: 'pending' } });
  }
}
