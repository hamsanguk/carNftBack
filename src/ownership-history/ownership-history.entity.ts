import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Index } from 'typeorm';

@Entity('ownership_history')
export class OwnershipHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tokenId: number;

  @Column()
  ownerAddress: string;

  // unix timestamp (초 단위 권장). ms를 저장한다면 string 고려.
  @Column({ type: 'bigint' })
  startTimestamp: number;

  @Column({ type: 'bigint', nullable: true })
  endTimestamp: number | null;

  // 인덱싱 체크포인트용
  @Index()
  @Column({ type: 'bigint', nullable: true })
  last_processed_block: number | null;

  @Column({ type: 'int', nullable: true })
  last_log_index: number | null;

  // 거래 해시(선택) — 파생 거래내역 응답 품질 개선
  @Column({ type: 'varchar', length: 66, nullable: true })
  tx_hash: string | null;
}
