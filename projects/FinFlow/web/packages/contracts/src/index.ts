export interface Account {id:string;name:string;balanceMinor:number;currency:string}
export interface Transfer {id:string;sourceId:string;targetId:string;amountMinor:number;currency:string;status:'Queued'|'Completed'|'Rejected';reason:string|null;createdAt:string;settledAt:string|null}
export interface TransferInput {sourceId:string;targetId:string;amountMinor:number;currency:'BRL'}
export interface Snapshot {accounts:Account[];transfers:Transfer[];demo:boolean;autoProcess:boolean}
export interface Client {
 snapshot:()=>Snapshot;
 subscribe:(listener:()=>void)=>()=>void;
 submit:(input:TransferInput,key:string)=>Promise<{transfer:Transfer;replayed:boolean}>;
 process:()=>void;setAutomatic:(value:boolean)=>void;reset:()=>void;
}
export interface MountOptions {client:Client}
export interface Microfrontend {mount:(element:HTMLElement,options:MountOptions)=>()=>void}
export const money=(minor:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(minor/100);
export const labels={Queued:'Na fila',Completed:'Concluída',Rejected:'Recusada'};
export const reasons:Record<string,string>={insufficient_funds:'Saldo insuficiente',source_not_available:'Conta de origem indisponível',target_not_available:'Destino indisponível',invalid_amount:'Valor inválido',same_account:'Selecione contas diferentes',unsupported_currency:'Moeda não suportada',balance_limit:'Limite de saldo excedido'};
export function parseAmount(value:string):number|null {
 const normalized=value.trim().replace(',','.');
 if(!/^\d{1,10}(\.\d{1,2})?$/.test(normalized))return null;
 const [whole,fraction='']=normalized.split('.');const minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(minor)&&minor>0&&minor<=100_000_000_000?minor:null;
}
