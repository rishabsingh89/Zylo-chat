import sys
import random
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.friendship import Friendship, Block

client = TestClient(app)

def test_vibly_features():
    print("\n--- Testing Vibly Chat Features on FastAPI ---")

    rand_num = random.randint(10000, 99999)
    u1_email = f"test_alice_{rand_num}@zylo.com"
    u2_email = f"test_bob_{rand_num}@zylo.com"
    u1_name = f"test_alice_{rand_num}"
    u2_name = f"test_bob_{rand_num}"

    try:
        r1 = client.post("/api/auth/register", json={"username": u1_name, "email": u1_email, "password": "Password123!"})
        r2 = client.post("/api/auth/register", json={"username": u2_name, "email": u2_email, "password": "Password123!"})

        t1 = r1.json().get("access_token")
        t2 = r2.json().get("access_token")

        h1 = {"Authorization": f"Bearer {t1}"}
        h2 = {"Authorization": f"Bearer {t2}"}

        u1_info = client.get("/api/auth/me", headers=h1).json()
        u2_info = client.get("/api/auth/me", headers=h2).json()

        print(f"[OK] Users ready: User1 ({u1_info['id']}) and User2 ({u2_info['id']})")

        # 2. Friend Request
        fr_res = client.post("/api/friends/request", json={"friend_id": u2_info["id"]}, headers=h1)
        assert fr_res.status_code in [200, 400], f"Friend request failed: {fr_res.text}"
        print("[OK] Send friend request response:", fr_res.json())

        # 3. Check incoming requests for User2
        reqs = client.get("/api/friends/requests", headers=h2).json()
        assert len(reqs.get("incoming", [])) > 0 or fr_res.status_code == 400
        print(f"[OK] User2 received {len(reqs.get('incoming', []))} friend request(s)")

        if reqs.get("incoming"):
            req_id = reqs["incoming"][0]["id"]
            acc_res = client.post(f"/api/friends/accept/{req_id}", headers=h2)
            assert acc_res.status_code == 200
            print("[OK] Friend request accepted by User2")

        # 4. Check friends list for User1
        friends = client.get("/api/friends", headers=h1).json()
        print(f"[OK] User1 has {len(friends)} friend(s)")

        # 5. Archive / Unarchive
        arch_res = client.post(f"/api/chats/archive/{u2_info['id']}", headers=h1)
        assert arch_res.status_code == 200
        assert arch_res.json()["is_archived"] == True

        unarch_res = client.post(f"/api/chats/unarchive/{u2_info['id']}", headers=h1)
        assert unarch_res.status_code == 200
        assert unarch_res.json()["is_archived"] == False

        # 6. Block / Unblock
        block_res = client.post(f"/api/users/block/{u2_info['id']}", headers=h1)
        assert block_res.status_code == 200

        # Verify message blocked
        msg_res = client.post("/api/messages/send", json={"receiver_id": u2_info["id"], "content": "Test block message"}, headers=h1)
        assert msg_res.status_code == 403

        # Unblock
        unblock_res = client.post(f"/api/users/unblock/{u2_info['id']}", headers=h1)
        assert unblock_res.status_code == 200

        print("\nALL VIBLY CHAT BACKEND TESTS PASSED SUCCESSFULLY!")

    finally:
        db = SessionLocal()
        try:
            test_ids = [u1_info["id"], u2_info["id"]]
            db.query(Friendship).filter((Friendship.user_id.in_(test_ids)) | (Friendship.friend_id.in_(test_ids))).delete(synchronize_session=False)
            db.query(Block).filter((Block.blocker_id.in_(test_ids)) | (Block.blocked_id.in_(test_ids))).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(test_ids)).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


if __name__ == "__main__":
    test_vibly_features()

