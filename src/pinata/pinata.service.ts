import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PinataSDK from '@pinata/sdk';
import { Readable } from 'stream';

@Injectable()
export class PinataService {
  private readonly pinata;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('PINATA_API_KEY');
    const secret = this.config.get<string>('PINATA_API_SECRET');
    this.pinata = new PinataSDK(key, secret);
  }

  /**
   * 이미지 파일을 IPFS에 업로드하고 CID URL을 반환
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    try { 
      const stream = Readable.from(file.buffer);
      const result = await this.pinata.pinFileToIPFS(stream, {
        pinataMetadata: { name: file.originalname }
      });
      return `ipfs://${result.IpfsHash}`;
    } catch (error) {
      console.log('pinata upload중 오류',error)
      throw new InternalServerErrorException('이미지 업로드 실패');
    }
  }

 
async uploadMetadata(metadata: Record<string, any>): Promise<string> {
    console.log('▶︎ Pinata uploadMetadata 호출, metadata=', metadata);
    try {
      const result = await this.pinata.pinJSONToIPFS(metadata, {
        pinataMetadata: { name: metadata.name || 'metadata' },
      });
      console.log('▶︎ Pinata 응답:', result);
      return `ipfs://${result.IpfsHash}`;
    } catch (error) {
      console.error('▶︎ Pinata 업로드 오류 상세:', error);
      throw new InternalServerErrorException('메타데이터 업로드 실패');
    }
  }
  
}
