import { Controller, Post, Body, Req } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('nft')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post('mint')
  async mint(@Body() createVehicleDto: CreateVehicleDto, @Req() req: any) {
    console.log('mint API 호출됨')
    // 예시: owner 주소를 헤더나 토큰 등에서 받아야 함
    const ownerAddress = req.headers['x-owner-address'] || '0x0'; // 임시 처리
    try {
        const vehicle = await this.vehiclesService.mintVehicle(createVehicleDto, ownerAddress);
        return { message: 'Mint success', vehicle };
      } catch (error) {
        console.error('mint 중 에러:', error);
        throw error;
      }

    // const vehicle = await this.vehiclesService.mintVehicle(createVehicleDto, ownerAddress);
    // return { message: 'Mint success', vehicle };
  }
}
