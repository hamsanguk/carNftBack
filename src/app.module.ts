import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {Vehicle} from './vehicles/vehicle.entity'
import { TradeHistory } from './trade-history/trade-history.entity';
import { TradeModule } from './trade/trade.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PinataModule } from './pinata/pinata.module';
import { ConfigModule } from '@nestjs/config';



@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'hamsang-ug',
      password: '1q2w3e4r',
      database: 'vehicle_db',
      entities: [Vehicle, TradeHistory],
      synchronize: true,  // 개발 단계에서만 true, 운영 시 false로 변경
    }),
    TypeOrmModule.forFeature([Vehicle, TradeHistory]),
    VehiclesModule,
    TradeModule,
    ConfigModule.forRoot({isGlobal:true}),
    PinataModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
