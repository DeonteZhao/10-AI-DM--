import sqlite3
import json

db_path = r"e:\04 创作\10 AI DM跑团\dice-tales\backend\storage\modules.db"

with sqlite3.connect(db_path) as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM structured_modules WHERE module_id = 'coc_the_haunting'")
    row = cursor.fetchone()
    
    if row:
        data = json.loads(row[0])
        with open(r"e:\04 创作\10 AI DM跑团\dice-tales\backend\storage\coc_the_haunting.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Exported to coc_the_haunting.json successfully.")
    else:
        print("Module not found in database.")
