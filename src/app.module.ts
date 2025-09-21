import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { FakeAdminMiddleware } from './common/middleware/fake-admin.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Vehicle } from './vehicles/vehicle.entity';
import { MintRequest } from './mint-request/mint-request.entity';
import { TradeRequest } from './trade/trade.entity';
import { OwnershipHistory } from './ownership-history/ownership-history.entity';
import { TokenMetadata } from './metadata/token-metadata.entity';

import { TradeModule } from './trade/trade.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { PinataModule } from './pinata/pinata.module';
import { MintRequestModule } from './mint-request/mint-request.module';
import { OwnershipHistoryModule } from './ownership-history/ownership-history.module';
import { MetadataModule } from './metadata/metadata.module';

import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // .env 로딩 (전역)
    ConfigModule.forRoot({ isGlobal: true }),

    // DB 설정: DATABASE_URL 있으면 Neon, 없으면 로컬 개발 DB
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => {
        const url = cs.get<string>('DATABASE_URL');

        // 공통 엔티티 목록 (forRoot에서 명시적으로 등록)
        const common = {
          type: 'postgres' as const,
          entities: [Vehicle, TradeRequest, MintRequest, OwnershipHistory, TokenMetadata],
        };

        if (url) {
          // 운영/배포: Neon 접속
          return {
            ...common,
            url,
            ssl: { rejectUnauthorized: false }, // Neon은 SSL 필요
            synchronize: false,                 // 운영에서는 false 권장
          };
        }

        // 로컬 개발: 기존 설정 유지
        return {
          ...common,
          host: 'localhost',
          port: 5432,
          username: 'hamsang-ug',
          password: '1q2w3e4r',
          database: 'vehicle_db',
          synchronize: true, // 개발 편의용
        };
      },
    }),

    ScheduleModule.forRoot(),

    // 레포지토리 주입용
    TypeOrmModule.forFeature([Vehicle, TradeRequest, OwnershipHistory]),

    // 나머지 모듈들
    MetadataModule,
    TradeModule,
    VehiclesModule,
    MintRequestModule,
    PinataModule,
    OwnershipHistoryModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(FakeAdminMiddleware).forRoutes('*');
  }
}
