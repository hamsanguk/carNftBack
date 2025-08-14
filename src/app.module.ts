import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { FakeAdminMiddleware } from './common/middleware/fake-admin.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './vehicles/vehicle.entity';
import { MintRequest } from './mint-request/mint-request.entity';
import { TradeHistory } from './trade-history/trade-history.entity';
import { TradeRequest } from './trade/trade.entity';
import { OwnershipHistory } from './ownership-history/ownership-history.entity'; 
import { TradeModule } from './trade/trade.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PinataModule } from './pinata/pinata.module';
import { ConfigModule } from '@nestjs/config';
import { MintRequestModule } from './mint-request/mint-request.module';
import { OwnershipHistoryModule } from './ownership-history/ownership-history.module'; 
import { MetadataModule } from './metadata/metadata.module';
import { TokenMetadata } from './metadata/token-metadata.entity';
import { OwnershipPollerStatus} from './ownership-history/ownership-poller-status.entity';
import { ScheduleModule} from '@nestjs/schedule';


@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'hamsang-ug',
      password: '1q2w3e4r',
      database: 'vehicle_db',
      entities: [
        Vehicle, TradeHistory, TradeRequest, MintRequest,
        OwnershipHistory, OwnershipPollerStatus,TokenMetadata // ⬅ 추가
      ],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Vehicle, TradeHistory, TradeRequest, OwnershipHistory, OwnershipPollerStatus
    ]),

    MetadataModule,
    TradeModule,
    VehiclesModule,
    MintRequestModule,
    PinataModule,
    OwnershipHistoryModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(FakeAdminMiddleware).forRoutes('*');
  }
}