// src/pinata/metadata.controller.ts
import {
  Controller, Post, Body, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PinataService } from './pinata.service';
import { ConfigService } from '@nestjs/config';
import {
  IsString, IsOptional, IsUrl, ValidateNested, IsArray, Matches,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

class AttributeDto {
  @IsString() trait_type: string;
  @IsString() value: string | number;
}

class CreateMetadataDto {
  @IsString() name: string;
  @IsString() description: string;

  @Transform(({ value }) => (value === '' ? undefined : value), { toClassOnly: true })
  @IsOptional()
  @IsUrl()
  external_url?: string;

  @Transform(({ value }) => (value === '' ? undefined : value), { toClassOnly: true })
  @IsOptional()
  @Matches(/^(ipfs:\/\/.+|https?:\/\/.+)$/i, { message: 'image must be ipfs:// or http(s) URL' })
  image?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  attributes: AttributeDto[];
}

@Controller('vehicle/metadata')
export class MetadataController {
  constructor(
    private readonly pinataService: PinataService,
    private readonly config: ConfigService,
  ) {}

  private toGatewayUrl(imageUri?: string): string | undefined {
    if (!imageUri) return undefined;
    let gw = (this.config.get<string>('IPFS_GATEWAY') || 'https://gateway.pinata.cloud/ipfs/').trim();
    if (!gw.endsWith('/')) gw += '/';
    if (!/\/ipfs\/$/.test(gw)) {
      if (gw.endsWith('/ipfs')) gw += '/';
      else if (!gw.includes('/ipfs/')) gw += 'ipfs/';
    }
    if (imageUri.startsWith('ipfs://')) {
      const cid = imageUri.replace('ipfs://', '').replace(/^\/+/, '');
      return gw + cid;
    }
    return imageUri; // 이미 http(s)
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createMetadata(
    @UploadedFile() image: Express.Multer.File,
    @Body() body: any,
  ) {
    if (typeof body.attributes === 'string') {
      try {
        body.attributes = JSON.parse(body.attributes);
      } catch {
        throw new BadRequestException('Invalid JSON in attributes');
      }
    }

    const dto = plainToInstance(CreateMetadataDto, body, { enableImplicitConversion: true });

    // 업로드 파일 우선, 없으면 dto.image 사용
    let imageUri: string | undefined;
    if (image && image.buffer?.length) {
      imageUri = await this.pinataService.uploadImage(image); // ipfs://<CID>
    } else if (dto.image) {
      imageUri = dto.image.trim(); // ipfs:// 또는 http(s)
    }

    const imageHttpUrl = this.toGatewayUrl(imageUri);

    // 메타데이터: image = http(s), image_ipfs = ipfs://(있으면)
    const metadata: Record<string, any> = {
      name: dto.name,
      description: dto.description,
      ...(dto.external_url ? { external_url: dto.external_url } : {}),
      ...(imageHttpUrl ? { image: imageHttpUrl } : {}),
      ...(imageUri?.startsWith('ipfs://') ? { image_ipfs: imageUri } : {}),
      attributes: Array.isArray(dto.attributes) ? dto.attributes : [],
    };

    const metadataUri = await this.pinataService.uploadMetadata(metadata);
    return {
      metadataUri,
      image: metadata.image ?? null,          // http(s)
      image_ipfs: metadata.image_ipfs ?? null // ipfs://
    };
  }
}
