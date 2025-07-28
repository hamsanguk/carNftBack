// back/src/utils/batch-utils.ts

export function createBatchRanges(
    startBlock: number,
    endBlock: number,
    rangeSize: number
  ): [number, number][] {
    const ranges: [number, number][] = [];
    for (let from = startBlock; from <= endBlock; from += rangeSize) {
      const to = Math.min(from + rangeSize - 1, endBlock);
      ranges.push([from, to]);
    }
    return ranges;
  }
  
  import { Contract } from 'ethers';
  
  export async function fetchTransferLogsByRange(
    contract: Contract,
    filter: any,
    batchRanges: [number, number][],
    BLOCK_STEP: number,
    sleepMs: number = 1000,
    label: string = ''
  ): Promise<any[]> {
    let allLogs: any[] = [];
    for (const [start, end] of batchRanges) {
      for (let from = start; from <= end; from += BLOCK_STEP) {
        const to = Math.min(from + BLOCK_STEP - 1, end);
        const logs = await contract.queryFilter(filter, from, to);
        allLogs = allLogs.concat(logs);
        console.log(`${label} Polled query from block ${from} to ${to}: ${logs.length} logs`);
        await new Promise(r => setTimeout(r, sleepMs));
      }
    }
    return allLogs;
  }
  