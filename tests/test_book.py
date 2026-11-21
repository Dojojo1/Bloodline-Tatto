"""The public catalogue must never expose an unpublished edit or image."""
import base64
import io
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app import create_app
from backend.storage import create_member

ORIGIN = "https://dojojo1.github.io"


@pytest.fixture
def clients(tmp_path):
    path = tmp_path / "book.sqlite3"
    app = create_app(path, public_origin=ORIGIN)
    create_member(path, "owner", "Owner", "private-test-password", "superadmin")
    create_member(path, "staff", "Staff", "private-test-password", "staff")
    with TestClient(app) as public, TestClient(app) as owner, TestClient(app) as staff:
        for client, username in [(owner, "owner"), (staff, "staff")]:
            login = client.post("/api/login", json={"username": username, "password": "private-test-password"}, headers={"Origin": ORIGIN})
            client.headers.update({"Origin": ORIGIN, "Authorization": f"Bearer {login.json()['token']}"})
        yield public, owner, staff


def test_draft_publication_permissions_and_conflicts(clients):
    public, owner, staff = clients
    initial = public.get("/api/book/public").json()
    assert public.get("/api/book/draft").status_code == 401
    assert staff.get("/api/book/draft").status_code == 403
    draft = owner.get("/api/book/draft").json()
    document = deepcopy(draft["document"])
    document["pages"].append({"id": "new-page", "title": "Ma nouvelle planche", "items": []})
    body = {"document": document, "revision": draft["revision"]}
    assert owner.post("/api/book/draft", json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert staff.post("/api/book/draft", json=body).status_code == 403
    saved = owner.post("/api/book/draft", json=body)
    assert saved.status_code == 200
    assert public.get("/api/book/public").json() == initial
    assert owner.post("/api/book/draft", json=body).status_code == 409
    assert owner.post("/api/book/publish", json={"revision": draft["revision"]}).status_code == 409
    assert owner.post("/api/book/publish", json={"revision": saved.json()["revision"]}).status_code == 200
    published = public.get("/api/book/public").json()
    assert published["pages"] == document["pages"]
    # A later edit stays private until the next deliberate publication.
    document["pages"].pop(0)
    assert owner.post("/api/book/draft", json={"document": document, "revision": saved.json()["revision"]}).status_code == 200
    assert len(public.get("/api/book/public").json()["pages"]) == 5


def test_images_are_validated_private_until_publication_and_backed_by_database(clients):
    public, owner, staff = clients
    data = io.BytesIO()
    Image.new("RGBA", (100, 140), (160, 20, 30, 200)).save(data, format="PNG")
    payload = {"name": "Ma rose.png", "encoded": base64.b64encode(data.getvalue()).decode()}
    assert staff.post("/api/book/assets", json=payload).status_code == 403
    assert owner.post("/api/book/assets", json={"encoded": "PHN2Zz48L3N2Zz4="}).status_code == 422
    upload = owner.post("/api/book/assets", json=payload)
    assert upload.status_code == 201
    image_id = upload.json()["id"]
    assert public.get(f"/api/book/assets/{image_id}").status_code == 401
    assert public.get(f"/api/book/public/media/{image_id}").status_code == 404
    private_image = owner.get(f"/api/book/assets/{image_id}")
    assert private_image.headers["content-type"] == "image/webp"
    draft = owner.get("/api/book/draft").json()
    draft["document"]["pages"][0]["items"][0]["src"] = image_id
    saved = owner.post("/api/book/draft", json={"document": draft["document"], "revision": draft["revision"]}).json()
    assert public.get(f"/api/book/public/media/{image_id}").status_code == 404
    assert owner.post("/api/book/publish", json={"revision": saved["revision"]}).status_code == 200
    assert public.get(f"/api/book/public/media/{image_id}").content == private_image.content


@pytest.mark.parametrize("changes", [{"src": "https://evil.example/pixel"}, {"x": -10}, {"w": 100, "x": 5}, {"h": "100"}])
def test_invalid_layout_never_replaces_saved_draft(clients, changes):
    _, owner, _ = clients
    draft = owner.get("/api/book/draft").json()
    doc = deepcopy(draft["document"])
    doc["pages"][0]["items"][0].update(changes)
    assert owner.post("/api/book/draft", json={"document": doc, "revision": draft["revision"]}).status_code == 422
    assert owner.get("/api/book/draft").json() == draft
