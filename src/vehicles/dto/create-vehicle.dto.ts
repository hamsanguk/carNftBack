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
  ownerAddress?: string; // 테스트용, 실제는 헤더 등에서 받거나 서버 내 별도 관리
}
