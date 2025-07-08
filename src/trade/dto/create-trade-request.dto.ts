import { IsString } from 'class-validator';

export class CreateTradeRequestDto {
  @IsString()
  token_id: string;

  @IsString()
  requester: string;
}
