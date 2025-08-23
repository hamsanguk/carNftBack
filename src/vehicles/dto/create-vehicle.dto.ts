import { IsString, IsOptional } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  vin: string;

  @IsString()
  manufacturer: string;

  @IsString()
  @IsOptional()
  metadataUri?: string; // 선택적 메타데이터 URI

  @IsString()
  @IsOptional()
  ownerAddress?: string; 
}
