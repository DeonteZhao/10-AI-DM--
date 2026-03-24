import requests
import json
import os
import sys

API_URL = "https://api.dify.ai/v1"
API_KEY = "app-Ktvy4LjgQ61ExXURGJ1Yo8D5"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}"
}

FILE_PATH = r"e:\04 创作\10 AI DM跑团\模组\COC\CHA23131 Call of Cthulhu 7th Edition Quick-Start Rules.docx"

def main():
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        sys.exit(1)

    print("1. Uploading file to Dify...")
    with open(FILE_PATH, "rb") as f:
        files = {
            "file": (os.path.basename(FILE_PATH), f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        }
        data = {
            "user": "local-test-user"
        }
        resp = requests.post(f"{API_URL}/files/upload", headers=HEADERS, files=files, data=data)
        
    if resp.status_code != 201:
        print(f"Failed to upload file: {resp.status_code} - {resp.text}")
        sys.exit(1)
        
    upload_res = resp.json()
    file_id = upload_res.get("id")
    print(f"File uploaded successfully! ID: {file_id}")

    print("2. Triggering workflow...")
    run_headers = HEADERS.copy()
    run_headers["Content-Type"] = "application/json"
    
    payload = {
        "inputs": {
            "file": {
                "transfer_method": "local_file",
                "upload_file_id": file_id,
                "type": "document"
            },
            "module_id": "coc_the_haunting"
        },
        "response_mode": "blocking",
        "user": "local-test-user"
    }
    
    run_resp = requests.post(f"{API_URL}/workflows/run", headers=run_headers, json=payload)
    if run_resp.status_code != 200:
        print(f"Workflow execution failed: {run_resp.status_code} - {run_resp.text}")
        sys.exit(1)
        
    run_result = run_resp.json()
    print("Workflow completed!")
    
    # Save the raw response for debugging
    with open("dify_raw_response.json", "w", encoding="utf-8") as f:
        json.dump(run_result, f, ensure_ascii=False, indent=2)
        
    # Attempt to extract the JSON output from the LLM node
    # The output variable name depends on the node. Let's look at the outputs block.
    outputs = run_result.get("data", {}).get("outputs", {})
    print("Outputs:", json.dumps(outputs, ensure_ascii=False, indent=2)[:500])

if __name__ == "__main__":
    main()
