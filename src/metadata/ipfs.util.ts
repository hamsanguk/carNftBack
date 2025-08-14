export const ipfsToHttp = (uri: string, gateway?: string) => {
    if (!uri) return '';
    if (!uri.startsWith('ipfs://')) return uri;
    const base = (gateway || process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/')
      .replace(/\/+$/, '') + '/';
    const path = uri.replace(/^ipfs:\/\//, '').replace(/^\/+/, '');
    return base + path;
  };
  
  export const extractModel = (meta: any): string | null => {
    if (!meta) return null;
    if (Array.isArray(meta.attributes)) {
      const found = meta.attributes.find(
        (a: any) => typeof a?.trait_type === 'string' && a.trait_type.toLowerCase() === 'model'
      );
      if (found && typeof found.value === 'string' && found.value.trim()) {
        return found.value.trim();
      }
    }
    if (typeof meta.name === 'string' && meta.name.trim()) return meta.name.trim();
    return null;
  };
  