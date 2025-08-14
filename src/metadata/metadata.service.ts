import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { TokenMetadata } from './token-metadata.entity';
import { ipfsToHttp, extractModel } from './ipfs.util';

type GetParams = {
  tokenId: string;            // 문자열 권장 (번호여도 String(tokenId))
  tokenUri?: string | null;   // 없으면 내부에서 조회(필요 시 vehicles 서비스 연동)
  forceRefresh?: boolean;
};

@Injectable()
export class MetadataService {
  constructor(
    @InjectRepository(TokenMetadata)
    private readonly repo: Repository<TokenMetadata>,
  ) {}

  private ttlMs() {
    return Number(process.env.METADATA_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 기본 6시간
  }

  private async resolveTokenUri(tokenId: string, provided?: string | null): Promise<string | null> {
    if (provided) return provided;
  
    return null;
  }

  async getOrRefresh(params: GetParams) {
    const { tokenId, tokenUri, forceRefresh } = params;
    const existing = await this.repo.findOne({ where: { token_id: tokenId } });

    const now = Date.now();
    const shouldRefresh =
      forceRefresh ||
      !existing ||
      !existing.updated_at ||
      now - new Date(existing.updated_at).getTime() > this.ttlMs();

    if (!shouldRefresh && existing) return existing;

    const uri = await this.resolveTokenUri(tokenId, tokenUri);
    if (!uri) {
      if (existing) return existing;
      const created = this.repo.create({
        token_id: tokenId,
        token_uri: null,
        model: null,
        name: null,
        image: null,
        raw: null,
        last_error_at: new Date(),
        last_error: 'tokenUri missing',
      });
      return this.repo.save(created);
    }

    try {
      const url = ipfsToHttp(uri);
      const res = await axios.get(url, { timeout: Number(process.env.METADATA_HTTP_TIMEOUT_MS || 8000) });
      const meta = res.data;

      const model = extractModel(meta);
      const name = typeof meta?.name === 'string' ? meta.name : null;
      const image = typeof meta?.image === 'string' ? ipfsToHttp(meta.image) : null;

      const upsert = this.repo.create({
        token_id: tokenId,
        token_uri: uri,
        model: model,
        name: name,
        image: image,
        raw: meta,
        last_error: null,
        last_error_at: null,
      });
      return await this.repo.save(upsert);
    } catch (e: any) {
      const upsert = this.repo.create({
        token_id: tokenId,
        token_uri: tokenUri || null,
        last_error: e?.message || String(e),
        last_error_at: new Date(),
      });
      return await this.repo.save(upsert);
    }
  }

  async refreshMany(tokenIds: string[]) {
    const out: Record<string, TokenMetadata> = {};
    for (const id of tokenIds) {
      out[id] = await this.getOrRefresh({ tokenId: id, forceRefresh: true });
    }
    return out;
  }
}
