import { Entity, PrimaryColumn, Column, UpdateDateColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('token_metadata')
export class TokenMetadata {
  @PrimaryColumn({ type: 'varchar' })
  token_id: string;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @Column({ type: 'text', nullable: true })
  token_uri: string | null;

  @Column({ type: 'jsonb', nullable: true })
  raw: any | null;

  @Index()
  @UpdateDateColumn()
  updated_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_error_at: Date | null;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;
}
