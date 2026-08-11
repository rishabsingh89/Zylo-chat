import random
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("--- 1. Testing Health Check ---")
    res = client.get("/")
    assert res.status_code == 200, f"Health check failed: {res.json()}"
    print("[OK] Health Check Passed:", res.json())

    print("\n--- 2. Testing Registration ---")
    rand_num = random.randint(1000, 9999)
    user1_email = f"user1_{rand_num}@zylo.com"
    r1 = client.post("/api/auth/register", json={
        "username": f"user1_{rand_num}",
        "email": user1_email,
        "password": "password123"
    })
    assert r1.status_code == 200, f"Register user1 failed: {r1.text}"
    token1 = r1.json()["access_token"]
    user1_id = r1.json()["user"]["id"]
    print("[OK] User 1 Registered Successfully. ID:", user1_id)

    print("\n--- 3. Testing Duplicate Email Validation ---")
    r_dup = client.post("/api/auth/register", json={
        "username": f"diff_user_{rand_num}",
        "email": user1_email,
        "password": "password123"
    })
    assert r_dup.status_code == 400, f"Duplicate email check failed: {r_dup.text}"
    assert "already registered" in r_dup.json()["detail"].lower(), f"Unexpected error detail: {r_dup.json()}"
    print("[OK] Duplicate Email Rejection Passed:", r_dup.json()["detail"])

    print("\n--- 4. Testing User Login ---")
    r_login = client.post("/api/auth/login", json={
        "email": user1_email,
        "password": "password123"
    })
    assert r_login.status_code == 200, f"Login failed: {r_login.text}"
    print("[OK] User Login Passed.")

    print("\n--- 5. Registering User 2 ---")
    user2_email = f"user2_{rand_num}@zylo.com"
    r2 = client.post("/api/auth/register", json={
        "username": f"user2_{rand_num}",
        "email": user2_email,
        "password": "password123"
    })
    assert r2.status_code == 200, f"Register user2 failed: {r2.text}"
    token2 = r2.json()["access_token"]
    user2_id = r2.json()["user"]["id"]
    print("[OK] User 2 Registered Successfully. ID:", user2_id)

    print("\n--- 6. Testing Search Users ---")
    r_search = client.get("/api/users/search?q=", headers={"Authorization": f"Bearer {token1}"})
    assert r_search.status_code == 200, f"Search users failed: {r_search.text}"
    print(f"[OK] Found {len(r_search.json())} users in search.")

    print("\n--- 7. Testing Send Message ---")
    r_send = client.post("/api/messages/send", json={
        "receiver_id": user2_id,
        "content": "Hello from User 1!"
    }, headers={"Authorization": f"Bearer {token1}"})
    assert r_send.status_code == 200, f"Send message failed: {r_send.text}"
    msg_id = r_send.json()["id"]
    print("[OK] Message Sent Successfully. Msg ID:", msg_id)

    print("\n--- 8. Testing Fetch Messages ---")
    r_msgs = client.get(f"/api/messages/{user1_id}", headers={"Authorization": f"Bearer {token2}"})
    assert r_msgs.status_code == 200, f"Fetch history failed: {r_msgs.text}"
    assert len(r_msgs.json()) > 0, "No messages in history!"
    print("[OK] Messages Fetched Successfully. Count:", len(r_msgs.json()))

    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
