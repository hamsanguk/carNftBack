import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { FakeAdminMiddleware } from './common/middleware/fake-admin.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './vehicles/vehicle.entity';
import { MintRequest } from './mint-request/mint-request.entity';

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
        Vehicle,  TradeRequest, MintRequest,
        OwnershipHistory,TokenMetadata 
      ],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Vehicle, TradeRequest, OwnershipHistory, 
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