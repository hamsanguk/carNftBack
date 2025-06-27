import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleEventListenerService } from './vehicle-event-listener.service';
import { Vehicle } from './vehicle.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Vehicle])],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleEventListenerService],
})
export class VehiclesModule {}
