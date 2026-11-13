import type {Account,Client,Snapshot,Transfer,TransferInput} from '../../../packages/contracts/src/index';
export const accountIds=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const initial=():Snapshot=>({demo:true,autoProcess:true,accounts:[{id:accountIds[0],name:'Conta operacional',balanceMinor:2450000,currency:'BRL'},{id:accountIds[1],name:'Reserva de projetos',balanceMinor:815000,currency:'BRL'}],transfers:[]});
interface Saved {state:Snapshot;keys:Record<string,{fingerprint:string;id:string}>}
export class DemoClient implements Client {
 private state:Snapshot=initial();private keys:Saved['keys']={};private listeners=new Set<()=>void>();private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private storage?:Storage) {
  try{const raw=storage?.getItem('finflow-demo-v1');if(raw){const saved=JSON.parse(raw) as Saved;if(saved.state.demo&&saved.state.accounts.length===2&&saved.state.transfers.length<501){this.state=saved.state;this.keys=saved.keys;}}}catch{/* A fresh demo works when browser storage is unavailable. */}
  this.schedule();
 }
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}};
 private emit(){try{this.storage?.setItem('finflow-demo-v1',JSON.stringify({state:this.state,keys:this.keys}));}catch{}this.listeners.forEach(l=>l());}
 async submit(input:TransferInput,key:string){
  if(!Number.isSafeInteger(input.amountMinor)||input.amountMinor<=0||input.amountMinor>100_000_000_000)throw Error('Informe um valor válido com até duas casas decimais.');
  if(input.sourceId===input.targetId)throw Error('Selecione contas diferentes.');
  if(input.currency!=='BRL')throw Error('A demonstração utiliza BRL.');
  if(!this.state.accounts.some(a=>a.id===input.sourceId)||!this.state.accounts.some(a=>a.id===input.targetId))throw Error('Conta indisponível.');
  const fingerprint=JSON.stringify([input.sourceId,input.targetId,input.amountMinor,input.currency]);const old=this.keys[key];
  if(old){if(old.fingerprint!==fingerprint)throw Error('Conflito de idempotência: esta chave já foi usada com outro conteúdo.');return {transfer:this.state.transfers.find(t=>t.id===old.id)!,replayed:true};}
  if(this.state.transfers.length>=500)throw Error('Limite da demonstração atingido. Reinicie os dados para continuar.');
  const transfer:Transfer={...input,id:crypto.randomUUID(),createdAt:new Date().toISOString(),settledAt:null,status:'Queued',reason:null};
  this.keys[key]={fingerprint,id:transfer.id};this.state={...this.state,transfers:[transfer,...this.state.transfers]};this.emit();this.schedule();return {transfer,replayed:false};
 }
 process=()=>{
  const accounts=this.state.accounts.map(a=>({...a}));
  const transfers=[...this.state.transfers];
  // FIFO. A completed or rejected transaction is never applied a second time.
  for(let i=transfers.length-1;i>=0;i--){const t=transfers[i];if(t.status!=='Queued')continue;
   const source=accounts.find(a=>a.id===t.sourceId)!;const target=accounts.find(a=>a.id===t.targetId)!;
   const accepted=source.balanceMinor>=t.amountMinor;
   if(accepted){source.balanceMinor-=t.amountMinor;target.balanceMinor+=t.amountMinor;}
   transfers[i]={...t,status:accepted?'Completed':'Rejected',reason:accepted?null:'insufficient_funds',settledAt:new Date().toISOString()};
  }
  this.state={...this.state,accounts,transfers};this.emit();
 };
 setAutomatic=(value:boolean)=>{this.state={...this.state,autoProcess:value};if(!value)clearTimeout(this.timer);this.emit();this.schedule();};
 reset=()=>{clearTimeout(this.timer);this.state=initial();this.keys={};this.emit();};
 private schedule(){if(this.state.autoProcess&&this.state.transfers.some(t=>t.status==='Queued')){clearTimeout(this.timer);this.timer=setTimeout(this.process,1800);}}
}
