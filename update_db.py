import requests
import json

with open(r"e:\04 创作\10 AI DM跑团\dice-tales\backend\storage\coc_the_haunting.json", "r", encoding="utf-8") as f:
    data = json.load(f)

res = requests.post("http://localhost:8000/modules/coc_the_haunting/structured", json=data)
if res.status_code == 200:
    print("Successfully updated database with translated JSON!")
else:
    print(f"Failed: {res.status_code} - {res.text}")
