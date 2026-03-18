
#!/bin/bash

# Source DB1 environment variables
source /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/db1_env.sh

# Stop current connections to DB1
pg_ctl stop -m immediate -D /var/lib/postgresql/data/

# Promote DB2 as primary database
pg_ctl start -D /var/lib/postgresql/data/
