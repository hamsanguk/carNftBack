// src/trade-history/trade-history.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trade_history')
export class TradeHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tokenId: number;//string 도 시도하기

  @Column()
  from: string;

  @Column()
  to: string;

  @Column()
  txHash: string;

  @CreateDateColumn({type:'timestamp'})
  tradedAt: Date;
}
