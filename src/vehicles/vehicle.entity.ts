import {Entity, Column, PrimaryGeneratedColumn, PrimaryColumn} from 'typeorm';

@Entity('vehicles')
export class Vehicle{
    @PrimaryColumn({type: 'bigint'})
    tokenId:number;

    @Column({unique:true})
    vin:string;

    @Column()
    manufacturer: string;

    @Column()
    owner: string;

    @Column({type:'timestamp', default: ()=> 'CURRENT_TIMESTAMP'})
    mintedAt: Date;
}