#!/usr/bin/env python3
"""Generate local development secrets without printing them or overwriting existing values."""
import os
import secrets
from pathlib import Path

path=Path(__file__).resolve().parent.parent/'.env'
if path.exists():
    print('.env já existe. Valores preservados.')
else:
    text=f'SQL_PASSWORD=Ff9!{secrets.token_hex(18)}\nRABBITMQ_PASSWORD={secrets.token_hex(24)}\nJWT_SIGNING_KEY={secrets.token_hex(32)}\n'
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as file:file.write(text)
    print('.env criado para desenvolvimento local. Não adicione este arquivo ao Git.')
