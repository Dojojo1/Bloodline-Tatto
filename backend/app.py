"""Private API for the management interface hosted on GitHub Pages."""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from backend import requests, storage


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


class ProjectRequestBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=3, max_length=40)
    project_type: str = Field(min_length=2, max_length=80)
    creation_type: str = Field(min_length=2, max_length=100)
    group_size: int | None = Field(default=None, ge=2, le=50)
    idea: str = Field(default="", max_length=1500)
    placement: str = Field(default="", max_length=120)
    availability: str = Field(default="", max_length=300)
    acknowledged: bool
    website: str = Field(default="", max_length=120)


class StatusBody(BaseModel):
    status: str


class AppointmentBody(BaseModel):
    local_when: str
    artist_name: str = ""


class NoteBody(BaseModel):
    body: str


def create_app(db_path=None, public_origin=None, public_requests_enabled=None):
    db_path = Path(db_path or os.environ.get("BLOODLINE_DB_PATH", ROOT / "data" / "bloodline.sqlite3"))
    public_origin = (public_origin or os.environ.get("BLOODLINE_PUBLIC_ORIGIN") or "https://dojojo1.github.io").rstrip("/")
    public_requests_enabled = (os.environ.get("BLOODLINE_PUBLIC_REQUESTS_ENABLED") == "1"
                               if public_requests_enabled is None else public_requests_enabled)
    storage.init_database(db_path)
    requests.init_database(db_path)
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

    def manager(request):
        member = current_member(request)
        if member["role"] != "superadmin":
            raise HTTPException(403, "Accès réservé à la direction.")
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

    @app.post("/api/requests", status_code=201)
    def submit_project(body: ProjectRequestBody, request: Request):
        require_same_origin(request)
        if not public_requests_enabled:
            raise HTTPException(503, "L'envoi des demandes n'est pas encore disponible.")
        if body.website:
            return {"received": True, "reference": ""}
        try:
            reference = requests.create_request(db_path, body)
        except requests.TooManyRequests as exc:
            raise HTTPException(429, "Trop de demandes ont été envoyées. Réessayez demain.") from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return {"received": True, "reference": reference}

    @app.get("/api/dashboard")
    def dashboard(request: Request):
        manager(request)
        return requests.dashboard(db_path)

    @app.get("/api/requests")
    def project_requests(request: Request):
        manager(request)
        return {"items": requests.list_requests(db_path)}

    @app.get("/api/appointments")
    def appointments(request: Request):
        manager(request)
        return {"items": requests.list_appointments(db_path)}

    @app.get("/api/requests/{request_id}")
    def project_detail(request_id: int, request: Request):
        manager(request)
        detail = requests.get_request(db_path, request_id)
        if not detail:
            raise HTTPException(404, "Demande introuvable.")
        return detail

    @app.post("/api/requests/{request_id}/status")
    def set_project_status(request_id: int, body: StatusBody, request: Request):
        require_same_origin(request)
        member = manager(request)
        try:
            found = requests.update_status(db_path, request_id, member["id"], body.status)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if not found:
            raise HTTPException(404, "Demande introuvable.")
        return requests.get_request(db_path, request_id)

    @app.post("/api/requests/{request_id}/appointment")
    def set_appointment(request_id: int, body: AppointmentBody, request: Request):
        require_same_origin(request)
        member = manager(request)
        try:
            found = requests.save_appointment(db_path, request_id, member["id"], body.local_when, body.artist_name)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if not found:
            raise HTTPException(404, "Demande introuvable.")
        return requests.get_request(db_path, request_id)

    @app.post("/api/requests/{request_id}/notes")
    def add_project_note(request_id: int, body: NoteBody, request: Request):
        require_same_origin(request)
        member = manager(request)
        try:
            found = requests.add_note(db_path, request_id, member["id"], body.body)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if not found:
            raise HTTPException(404, "Demande introuvable.")
        return requests.get_request(db_path, request_id)

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
