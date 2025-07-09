import { Module,  MiddlewareConsumer, NestModule } from '@nestjs/common';
import { FakeAdminMiddleware } from './common/middleware/fake-admin.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import {Vehicle} from './vehicles/vehicle.entity'
import { TradeHistory } from './trade-history/trade-history.entity';
import { TradeModule } from './trade/trade.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PinataModule } from './pinata/pinata.module';
import { ConfigModule } from '@nestjs/config';
import { TradeRequest } from './trade/trade.entity';



@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'hamsang-ug',
      password: '1q2w3e4r',
      database: 'vehicle_db',
      entities: [Vehicle, TradeHistory, TradeRequest],
      synchronize: true,  // 개발 단계에서만 true, 운영 시 false로 변경
    }),
    TypeOrmModule.forFeature([Vehicle, TradeHistory, TradeRequest]),
    TradeModule,
    VehiclesModule,
    ConfigModule.forRoot({isGlobal:true}),
    PinataModule,
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
