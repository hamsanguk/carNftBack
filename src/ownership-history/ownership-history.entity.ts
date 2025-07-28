// back/src/modules/ownership-history/ownership-history.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from 'typeorm';

@Entity('ownership_history')
export class OwnershipHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tokenId: number;

  @Column()
  ownerAddress: string;

  @Column({type:'bigint'})//unix timestamp(초 단위, 혹은 ms 단위라면 string 고려)
  startTimestamp: number;

  @Column({ type:'bigint', nullable: true })
  endTimestamp: number | null;

  @Column({type:'bigint', nullable:true})
  last_processed_block:number | null; //마지막으로 처리된 블록
}
