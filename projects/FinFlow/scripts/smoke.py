#!/usr/bin/env python3
"""End-to-end HTTP test. Requires Docker Compose, its development identity and demo seed."""
import json
import time
import urllib.request
import urllib.error
import uuid

base='http://localhost:8080'
def request(path,method='GET',body=None,token=None,key=None):
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    if key:headers['Idempotency-Key']=key
    req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),method=method,headers=headers)
    with urllib.request.urlopen(req,timeout=10) as r:return r.status,json.load(r)

for attempt in range(60):
    try:
        _,session=request('/dev/token','POST',{})
        token=session['accessToken']
        _,accounts=request('/api/accounts/',token=token)
        if len(accounts)>=2:break
    except (OSError,ValueError):pass
    time.sleep(2)
else:raise RuntimeError('Compose APIs did not become ready.')

try:
    request('/api/accounts/')
    raise AssertionError('Anonymous access was allowed')
except urllib.error.HTTPError as e:assert e.code==401
source=next(a for a in accounts if a['id'].startswith('1111'))
target=next(a for a in accounts if a['id'].startswith('2222'))
before={a['id']:a['balanceMinor'] for a in accounts}
payload={'sourceId':source['id'],'targetId':target['id'],'amountMinor':100,'currency':'BRL'}
key=str(uuid.uuid4())
status,transfer=request('/api/transfers/','POST',payload,token,key)
assert status==202
_,replay=request('/api/transfers/','POST',payload,token,key)
assert replay['id']==transfer['id']
def settled(transfer_id):
    for _ in range(60):
        _,t=request('/api/transfers/'+transfer_id,token=token)
        if t['status']!='Queued':return t
        time.sleep(.5)
    raise AssertionError('Transfer remained queued')
assert settled(transfer['id'])['status']=='Completed'
_,after=request('/api/accounts/',token=token)
balances={a['id']:a['balanceMinor'] for a in after}
assert balances[source['id']]==before[source['id']]-100
assert balances[target['id']]==before[target['id']]+100
assert sum(balances.values())==sum(before.values())
_,reject=request('/api/transfers/','POST',{**payload,'amountMinor':balances[source['id']]+100},token,str(uuid.uuid4()))
assert settled(reject['id'])['reason']=='insufficient_funds'
_,unchanged=request('/api/accounts/',token=token)
assert {a['id']:a['balanceMinor'] for a in unchanged}==balances
try:
    request('/api/transfers/','POST',{**payload,'amountMinor':101},token,key)
    raise AssertionError('Changed idempotency payload was allowed')
except urllib.error.HTTPError as e:assert e.code==409
print('HTTP smoke passed: JWT, async settlement, replay, balance conservation, rejection, conflict.')
