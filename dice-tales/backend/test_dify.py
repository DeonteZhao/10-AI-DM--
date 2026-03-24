import httpx
import json

API_URL = "http://localhost:8000"

def create_test_data():
    output = []
    try:
        # 1. Create Character
        char_payload = {
            "name": "Test Player",
            "rule_set": "DND",
            "race": "Human",
            "role_class": "Fighter",
            "background": "Soldier"
        }
        resp = httpx.post(f"{API_URL}/characters", json=char_payload)
        if resp.status_code != 200:
            output.append(f"Error creating character: {resp.text}")
            # Write partial output
            with open("backend/test_output.txt", "w", encoding="utf-8") as f:
                f.write("\n".join(output))
            return
        char_id = resp.json()["character"]["id"]
        output.append(f"Character Created: {char_id}")

        # 2. Create Session
        session_payload = {
            "module_id": "lost_mine",
            "character_id": char_id,
            "user_id": "test_user"
        }
        resp = httpx.post(f"{API_URL}/sessions", json=session_payload)
        if resp.status_code != 200:
            output.append(f"Error creating session: {resp.text}")
            with open("backend/test_output.txt", "w", encoding="utf-8") as f:
                f.write("\n".join(output))
            return
        session_id = resp.json()["session"]["id"]
        output.append(f"Session Created: {session_id}")
        output.append(f"Module ID: lost_mine")
        
        # 3. Test External Action (Simulate Dify)
        output.append("\nSimulating Dify Request (JSON String result)...")
        dify_payload = {
            "session_id": session_id,
            "player_action": "Look around",
            "result": '{"narration": "You look around and see a dark cave.", "choices": ["Enter", "Leave"]}'
        }
        resp = httpx.post(f"{API_URL}/gm/action/external", json=dify_payload)
        if resp.status_code == 200:
            output.append("Dify Simulation (String): Success")
            output.append(str(resp.json()))
        else:
            output.append(f"Dify Simulation (String): Failed ({resp.status_code})")
            output.append(resp.text)

        # 4. Test External Action (Dict result)
        output.append("\nSimulating Dify Request (Dict result)...")
        dify_payload_dict = {
            "session_id": session_id,
            "player_action": "Enter cave",
            "result": {"narration": "You enter the cave.", "choices": ["Go deeper", "Go back"]}
        }
        resp = httpx.post(f"{API_URL}/gm/action/external", json=dify_payload_dict)
        if resp.status_code == 200:
            output.append("Dify Simulation (Dict): Success")
            output.append(str(resp.json()))
        else:
            output.append(f"Dify Simulation (Dict): Failed ({resp.status_code})")
            output.append(resp.text)
            
    except Exception as e:
        output.append(f"Error: {e}")
    
    with open("backend/test_output.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output))
    print("Test finished, output written to backend/test_output.txt")

if __name__ == "__main__":
    create_test_data()
