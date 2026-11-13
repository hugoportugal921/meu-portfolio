import type {Client,Snapshot,Transfer,TransferInput} from '../../../packages/contracts/src/index';
export class ApiClient implements Client {
 private state:Snapshot={accounts:[],transfers:[],demo:false,autoProcess:true};private listeners=new Set<()=>void>();
 constructor(private token:()=>Promise<string>){}
 snapshot=()=>this.state;subscribe=(l:()=>void)=>{this.listeners.add(l);return()=>{this.listeners.delete(l)}};
 private async request(path:string,init:RequestInit={}){const r=await fetch(path,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${await this.token()}`,...init.headers}});if(!r.ok)throw Error(r.status===409?'Conflito de idempotência.':r.status===401?'Sua sessão expirou. Entre novamente.':`Falha na API (${r.status}).`);return r;}
 async refresh(){const [accounts,transfers]=await Promise.all([this.request('/api/accounts/').then(r=>r.json()),this.request('/api/transfers/').then(r=>r.json())]);this.state={...this.state,accounts,transfers};this.listeners.forEach(l=>l());}
 async submit(input:TransferInput,key:string){const r=await this.request('/api/transfers/',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(input)});const transfer=await r.json() as Transfer;await this.refresh();return{transfer,replayed:r.headers.get('Idempotency-Replayed')==='true'};}
 process=()=>{};setAutomatic=()=>{};reset=()=>{};
}
