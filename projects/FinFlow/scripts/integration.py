#!/usr/bin/env python3
"""Execute opt-in SQL tests against the disposable Compose databases."""
import os
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
values=dict(line.split('=',1) for line in (root/'.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
env=os.environ.copy()
env['FINFLOW_TEST_SQL']=f'Server=localhost,1433;Database=master;User Id=sa;Password={values["SQL_PASSWORD"]};Encrypt=True;TrustServerCertificate=True'
subprocess.run(['dotnet','test','FinFlow.sln','-c','Release','--filter','FullyQualifiedName~SqlIntegrationTests','-m:1'],cwd=root,env=env,check=True)
