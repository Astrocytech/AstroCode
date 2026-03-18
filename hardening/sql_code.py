import sqlite3
conn = sqlite3.connect('database.db')
cur = conn.cursor()
cur.execute('SELECT COUNT(*), AVG(price) FROM products')
result = cur.fetchone()
with open('/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/query_output.txt', 'a') as f:
    f.write(str(result[0]) + ', ' + str(result[1]) + '\n')
conn.close()
