// src/vehicles/mint-request.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mint_requests')
export class MintRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  workshop: string; // 요청 워크샵 address

  @Column()
  vin: string;

  @Column()
  manufacturer: string;

  @Column()
  model: string;

  @Column({ default: 'pending' }) // pending | approved | rejected
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
