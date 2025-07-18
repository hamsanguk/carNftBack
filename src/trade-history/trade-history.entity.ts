// src/trade-history/trade-history.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trade_history')
export class TradeHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tokenId: number;//string 도 시도하기 // backend 진행시 ca + abi 붙여넣기

  @Column()
  from: string;

  @Column()
  to: string;

  @Column()
  txHash: string;

  @CreateDateColumn({type:'timestamp'})
  tradedAt: Date;
}
