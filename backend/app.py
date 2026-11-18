"""Private API for the management interface hosted on GitHub Pages."""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from backend import storage


ROOT = Path(__file__).resolve().parents[1]
MANAGEMENT_PAGE = "https://dojojo1.github.io/Bloodline-Tatto/gestion.html"


class LoginBody(BaseModel):
    username: str
    password: str


class PasswordBody(BaseModel):
    current_password: str
    new_password: str


class ActivationBody(BaseModel):
    username: str
    code: str
    new_password: str


def create_app(db_path=None, public_origin=None):
    db_path = Path(db_path or os.environ.get("BLOODLINE_DB_PATH", ROOT / "data" / "bloodline.sqlite3"))
    public_origin = (public_origin or os.environ.get("BLOODLINE_PUBLIC_ORIGIN") or "https://dojojo1.github.io").rstrip("/")
    storage.init_database(db_path)
    app = FastAPI(title="Bloodline Gestion", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[public_origin],
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "ngrok-skip-browser-warning"],
    )

    @app.middleware("http")
    async def api_cache_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    def require_same_origin(request):
        if request.headers.get("origin", "").rstrip("/") != public_origin:
            raise HTTPException(403, "Origine non autorisée")

    def current_member(request):
        member = storage.session_member(db_path, bearer_token(request))
        if not member:
            raise HTTPException(401, "Session absente ou expirée")
        return member

    def bearer_token(request):
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        return token.strip() if scheme.lower() == "bearer" else None

    @app.get("/")
    @app.get("/gestion.html")
    def index():
        return RedirectResponse(MANAGEMENT_PAGE, status_code=307)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/login")
    def login(body: LoginBody, request: Request):
        require_same_origin(request)
        username = body.username.strip().lower()
        remote_address = request.client.host if request.client else "unknown"
        if storage.login_blocked(db_path, username, remote_address):
            raise HTTPException(429, "Trop de tentatives. Réessayez dans 15 minutes.")
        member = storage.authenticate(db_path, username, body.password)
        if not member:
            storage.record_login_failure(db_path, username, remote_address)
            raise HTTPException(401, "Identifiants incorrects")
        storage.clear_login_failures(db_path, username, remote_address)
        if member["activation_required"]:
            return {"setup_required": True}
        token = storage.create_session(db_path, member["id"])
        return {"ok": True, "token": token}

    @app.post("/api/activate")
    def activate(body: ActivationBody, request: Request):
        require_same_origin(request)
        username = body.username.strip().lower()
        remote_address = request.client.host if request.client else "unknown"
        if storage.login_blocked(db_path, username, remote_address):
            raise HTTPException(429, "Trop de tentatives. Réessayez dans 15 minutes.")
        try:
            member_id = storage.activate_member(db_path, username, body.code, body.new_password)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        if not member_id:
            storage.record_login_failure(db_path, username, remote_address)
            raise HTTPException(401, "Code d’activation incorrect ou déjà utilisé.")
        storage.clear_login_failures(db_path, username, remote_address)
        token = storage.create_session(db_path, member_id)
        return {"ok": True, "token": token}

    @app.post("/api/logout")
    def logout(request: Request):
        require_same_origin(request)
        storage.delete_session(db_path, bearer_token(request))
        return {"ok": True}

    @app.post("/api/password")
    def password(body: PasswordBody, request: Request):
        require_same_origin(request)
        member = current_member(request)
        try:
            storage.change_password(db_path, member["id"], body.current_password, body.new_password)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {"ok": True}

    @app.get("/api/me")
    def me(request: Request):
        member = current_member(request)
        return {"member": member, "sessions": storage.list_shifts(db_path, member["id"])}

    @app.post("/api/shifts/start")
    def start(request: Request):
        require_same_origin(request)
        member = current_member(request)
        try:
            storage.start_shift(db_path, member["id"])
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc
        return {"ok": True}

    @app.post("/api/shifts/end")
    def end(request: Request):
        require_same_origin(request)
        member = current_member(request)
        try:
            storage.end_shift(db_path, member["id"])
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc
        return {"ok": True}

    return app
