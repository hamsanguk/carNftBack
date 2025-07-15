import { Module,  MiddlewareConsumer, NestModule } from '@nestjs/common';
import { FakeAdminMiddleware } from './common/middleware/fake-admin.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import {Vehicle} from './vehicles/vehicle.entity'
import { MintRequest } from './mint-request/mint-request.entity';
import { TradeHistory } from './trade-history/trade-history.entity';
import { TradeModule } from './trade/trade.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PinataModule } from './pinata/pinata.module';
import { ConfigModule } from '@nestjs/config';
import { TradeRequest } from './trade/trade.entity';
import { MintRequestModule } from './mint-request/mint-request.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'hamsang-ug',
      password: '1q2w3e4r',
      database: 'vehicle_db',
      entities: [Vehicle, TradeHistory, TradeRequest, MintRequest],
      synchronize: true,  // 개발 단계에서만 true, 운영 시 false로 변경
    }),
    TypeOrmModule.forFeature([Vehicle, TradeHistory, TradeRequest,]),
    TradeModule,
    VehiclesModule,
    MintRequestModule,
    PinataModule,
    ConfigModule.forRoot({isGlobal:true}),
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule{
  configure(consummer: MiddlewareConsumer){
    consummer.apply(FakeAdminMiddleware).forRoutes('*')
  }
}


// export class AppModule  {} //fakeadmin부여전 원래
