import {describe,it,expect,vi} from 'vitest';
import {parseAmount} from './index';import {DemoClient,accountIds} from '../../../apps/shell/src/demo';
const input={sourceId:accountIds[0],targetId:accountIds[1],amountMinor:125000,currency:'BRL' as const};
describe('monetary input',()=>{
 it.each([['1250,50',125050],['0,01',1],['99',9900],['1.20',120]])('parses %s exactly',(v,n)=>expect(parseAmount(v)).toBe(n));
 it.each(['0','-10','1.001','1e4','1.250,00','abc'])('rejects %s',v=>expect(parseAmount(v)).toBeNull());
});
describe('demonstration behavior',()=>{
 it('queues first, conserves money and applies only once',async()=>{vi.useFakeTimers();const c=new DemoClient();c.setAutomatic(false);const before=c.snapshot().accounts.map(a=>a.balanceMinor);const result=await c.submit(input,'key');expect(result.transfer.status).toBe('Queued');expect(c.snapshot().accounts.map(a=>a.balanceMinor)).toEqual(before);c.process();c.process();expect(c.snapshot().transfers[0].status).toBe('Completed');expect(c.snapshot().accounts[0].balanceMinor).toBe(before[0]-input.amountMinor);expect(c.snapshot().accounts.reduce((s,a)=>s+a.balanceMinor,0)).toBe(before[0]+before[1]);vi.useRealTimers();});
 it('returns same ID for same key',async()=>{const c=new DemoClient();c.setAutomatic(false);const a=await c.submit(input,'key');const b=await c.submit(input,'key');expect(b.replayed).toBe(true);expect(a.transfer.id).toBe(b.transfer.id);expect(c.snapshot().transfers).toHaveLength(1);});
 it('rejects a changed payload with same key',async()=>{const c=new DemoClient();c.setAutomatic(false);await c.submit(input,'key');await expect(c.submit({...input,amountMinor:100},'key')).rejects.toThrow('idempotência');});
 it('rejects insufficient funds without changing balances',async()=>{const c=new DemoClient();c.setAutomatic(false);const before=c.snapshot().accounts;await c.submit({...input,amountMinor:99999999},'key');c.process();expect(c.snapshot().transfers[0].status).toBe('Rejected');expect(c.snapshot().accounts).toEqual(before);});
 it('processes FIFO, so two queued requests cannot overspend',async()=>{const c=new DemoClient();c.setAutomatic(false);await c.submit({...input,amountMinor:2000000},'a');await c.submit({...input,amountMinor:2000000},'b');c.process();expect(c.snapshot().transfers.filter(t=>t.status==='Completed')).toHaveLength(1);expect(c.snapshot().transfers.filter(t=>t.status==='Rejected')).toHaveLength(1);expect(c.snapshot().accounts[0].balanceMinor).toBe(450000);});
 it('automatically processes and can reset',async()=>{vi.useFakeTimers();const c=new DemoClient();await c.submit(input,'key');vi.advanceTimersByTime(1800);expect(c.snapshot().transfers[0].status).toBe('Completed');c.reset();expect(c.snapshot().transfers).toHaveLength(0);expect(c.snapshot().accounts[0].balanceMinor).toBe(2450000);vi.useRealTimers();});
});
