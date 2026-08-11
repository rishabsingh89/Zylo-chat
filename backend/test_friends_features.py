import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_vibly_features():
    print("\n--- Testing Vibly Chat Features on FastAPI ---")

    # 1. Register 2 users
    u1_email = "alice_test@vibly.com"
    u2_email = "bob_test@vibly.com"

    r1 = client.post("/api/auth/register", json={"username": "AliceVibly", "email": u1_email, "password": "Password123!"})
    r2 = client.post("/api/auth/register", json={"username": "BobVibly", "email": u2_email, "password": "Password123!"})

    t1 = r1.json().get("access_token") or client.post("/api/auth/login", json={"email": u1_email, "password": "Password123!"}).json()["access_token"]
    t2 = r2.json().get("access_token") or client.post("/api/auth/login", json={"email": u2_email, "password": "Password123!"}).json()["access_token"]

    h1 = {"Authorization": f"Bearer {t1}"}
    h2 = {"Authorization": f"Bearer {t2}"}

    u1_info = client.get("/api/auth/me", headers=h1).json()
    u2_info = client.get("/api/auth/me", headers=h2).json()

    print(f"[OK] Users ready: Alice ({u1_info['id']}) and Bob ({u2_info['id']})")

    # 2. Friend Request
    fr_res = client.post("/api/friends/request", json={"friend_id": u2_info["id"]}, headers=h1)
    assert fr_res.status_code in [200, 400], f"Friend request failed: {fr_res.text}"
    print("[OK] Send friend request response:", fr_res.json())

    # 3. Check incoming requests for Bob
    reqs = client.get("/api/friends/requests", headers=h2).json()
    assert len(reqs.get("incoming", [])) > 0 or fr_res.status_code == 400
    print(f"[OK] Bob received {len(reqs.get('incoming', []))} friend request(s)")

    if reqs.get("incoming"):
        req_id = reqs["incoming"][0]["id"]
        acc_res = client.post(f"/api/friends/accept/{req_id}", headers=h2)
        assert acc_res.status_code == 200
        print("[OK] Friend request accepted by Bob")

    # 4. Check friends list for Alice
    friends = client.get("/api/friends", headers=h1).json()
    print(f"[OK] Alice has {len(friends)} friend(s)")

    # 5. Archive / Unarchive
    arch_res = client.post(f"/api/chats/archive/{u2_info['id']}", headers=h1)
    assert arch_res.status_code == 200
    assert arch_res.json()["is_archived"] == True
    print("[OK] Alice archived chat with Bob")

    unarch_res = client.post(f"/api/chats/unarchive/{u2_info['id']}", headers=h1)
    assert unarch_res.status_code == 200
    assert unarch_res.json()["is_archived"] == False
    print("[OK] Alice unarchived chat with Bob")

    # 6. Block / Unblock
    block_res = client.post(f"/api/users/block/{u2_info['id']}", headers=h1)
    assert block_res.status_code == 200
    print("[OK] Alice blocked Bob")

    # Verify message blocked
    msg_res = client.post("/api/messages/send", json={"receiver_id": u2_info["id"], "content": "Hello Bob"}, headers=h1)
    assert msg_res.status_code == 403
    print("[OK] Blocked message prevented with 403 Forbidden")

    # Unblock
    unblock_res = client.post(f"/api/users/unblock/{u2_info['id']}", headers=h1)
    assert unblock_res.status_code == 200
    print("[OK] Alice unblocked Bob")

    print("\nALL VIBLY CHAT BACKEND TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    test_vibly_features()
