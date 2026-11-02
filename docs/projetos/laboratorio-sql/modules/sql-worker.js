importScripts('../vendor/sql-wasm.js');

let database;
const engine=initSqlJs({locateFile:filename=>new URL('../vendor/'+filename,self.location.href).href});

function insertRows(SQL,rows) {
  const db=new SQL.Database();
  db.run('PRAGMA foreign_keys = ON; CREATE TABLE unidades(id INTEGER PRIMARY KEY,nome TEXT NOT NULL UNIQUE); CREATE TABLE categorias(id INTEGER PRIMARY KEY,nome TEXT NOT NULL UNIQUE); CREATE TABLE operacoes(id TEXT PRIMARY KEY,data TEXT NOT NULL,unidade_id INTEGER REFERENCES unidades(id),categoria_id INTEGER REFERENCES categorias(id),status TEXT NOT NULL,valor REAL NOT NULL,duracao_min REAL NOT NULL); CREATE INDEX idx_operacoes_data ON operacoes(data); CREATE INDEX idx_operacoes_unidade ON operacoes(unidade_id); BEGIN TRANSACTION;');
  const units=new Map(),categories=new Map();
  const addUnit=db.prepare('INSERT INTO unidades VALUES (?,?)');
  const addCategory=db.prepare('INSERT INTO categorias VALUES (?,?)');
  const addOperation=db.prepare('INSERT INTO operacoes VALUES (?,?,?,?,?,?,?)');
  try {
    for(const row of rows) {
      if(!units.has(row.unit)){const id=units.size+1;units.set(row.unit,id);addUnit.run([id,row.unit]);}
      if(!categories.has(row.category)){const id=categories.size+1;categories.set(row.category,id);addCategory.run([id,row.category]);}
      addOperation.run([String(row.id),String(row.date),units.get(row.unit),categories.get(row.category),String(row.status),Number(row.amount),Number(row.duration)]);
    }
    db.run('COMMIT; PRAGMA query_only = ON;');
    return db;
  } catch(error){db.close();throw error;}
  finally{try{addUnit.free();addCategory.free();addOperation.free();}catch{}}
}

function readQuery(sql) {
  if(!sql.trim())throw new Error('Escreva uma consulta antes de executar.');
  const results=[];
  database.run('PRAGMA query_only = ON;');
  for(const statement of database.iterateStatements(sql)) {
    const statementSQL=statement.getSQL().replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/,'');
    if(!/^(SELECT|WITH|EXPLAIN)\b/i.test(statementSQL))throw new Error('Este laboratório aceita consultas de leitura: SELECT, WITH e EXPLAIN.');
    const columns=statement.getColumnNames(),values=[];
    let truncated=false;
    while(statement.step()) {
      if(values.length>=500){truncated=true;break;}
      values.push(statement.get().map(value=>value instanceof Uint8Array?'[BLOB]':value));
    }
    if(columns.length)results.push({columns,values,truncated});
    if(results.length>=5)break;
  }
  return results;
}

self.onmessage=async({data})=>{
  const {type,id}=data;
  try {
    if(type==='init') {
      const SQL=await engine;
      if(database)database.close();
      database=insertRows(SQL,data.rows||[]);
      self.postMessage({type:'ready',id,count:data.rows.length});
    } else if(type==='query') {
      if(!database)throw new Error('O banco ainda está sendo preparado.');
      const started=performance.now(),results=readQuery(String(data.sql||''));
      self.postMessage({type:'result',id,results,elapsed:performance.now()-started});
    }
  } catch(error){self.postMessage({type:'error',id,message:error.message||String(error)});}
};
