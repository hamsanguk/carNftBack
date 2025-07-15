import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleEventListenerService } from './vehicle-event-listener.service';
import { Vehicle } from './vehicle.entity';
import { MintRequestModule } from 'src/mint-request/mint-request.module';
import { TradeHistory } from 'src/trade-history/trade-history.entity';
import { TradeRequest } from 'src/trade/trade.entity';
import { MintRequest } from 'src/mint-request/mint-request.entity';



@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle,TradeHistory,TradeRequest]),//원래 tradehistory,traderequest 없었음
    TypeOrmModule.forFeature([MintRequest]),
    MintRequestModule,
],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleEventListenerService],
})
export class VehiclesModule {}
