import {Entity,PrimaryColumn,Column,BaseEntity} from 'typeorm';

@Entity('ownership_poller_status')
    export class OwnershipPollerStatus extends BaseEntity {
        @PrimaryColumn()
        id: string;// default 
        @Column('bigint')
        latestScannedBlock: string; // string for bigint
}