#!/usr/bin/env python3
"""Render environment-specific manifests. Does not connect to Azure or handle secrets."""
import os
import re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
names=['REGISTRY','TAG','AUTH0_DOMAIN','AUTH0_AUDIENCE','FINFLOW_HOSTNAME']
values={name:os.environ.get(name,'') for name in names}
for name,value in values.items():
    if not value or not re.fullmatch(r'[a-zA-Z0-9._:/@-]+',value):raise SystemExit(f'Set a valid {name}.')
out=root/'.deploy';out.mkdir(exist_ok=True)
for name in ['runtime','migrations']:
    text=(root/f'deploy/k8s/{name}.template.yaml').read_text()
    for key,value in values.items():text=text.replace('__'+key+'__',value)
    if re.search(r'__[A-Z_]+__',text):raise SystemExit('Unresolved template field')
    (out/f'{name}.yaml').write_text(text)
print('Manifests rendered in .deploy/. Review before applying.')
