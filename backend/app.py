"""Private API for the management interface hosted on GitHub Pages."""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field

from backend import access, book, requests, storage


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


class RoleBody(BaseModel):
    slug: str = ""
    name: str
    projects: bool = False
    access: bool = False
    content: bool = False
    finance: bool = False


class InviteBody(BaseModel):
    username: str
    display_name: str
    role_slug: str


class MemberBody(BaseModel):
    role_slug: str
    active: bool


class BookBody(BaseModel):
    document: dict
    revision: int = Field(ge=1)


class PublishBookBody(BaseModel):
    revision: int = Field(ge=1)


class BookImageBody(BaseModel):
    encoded: str = Field(max_length=7_000_000)
    name: str = Field(default="Croquis", max_length=160)


def create_app(db_path=None, public_origin=None, public_requests_enabled=None):
    db_path = Path(db_path or os.environ.get("BLOODLINE_DB_PATH", ROOT / "data" / "bloodline.sqlite3"))
    public_origin = (public_origin or os.environ.get("BLOODLINE_PUBLIC_ORIGIN") or "https://dojojo1.github.io").rstrip("/")
    public_requests_enabled = (os.environ.get("BLOODLINE_PUBLIC_REQUESTS_ENABLED") == "1"
                               if public_requests_enabled is None else public_requests_enabled)
    storage.init_database(db_path)
    access.init_database(db_path)
    requests.init_database(db_path)
    book.init_database(db_path)
    app = FastAPI(title="Bloodline Gestion", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[public_origin],
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "ngrok-skip-browser-warning"],
    )

    @app.middleware("http")
    async def api_cache_headers(request: Request, call_next):
        if request.method == "POST" and request.url.path.startswith("/api/book"):
            if len(await request.body()) > 7_100_000:
                return Response(status_code=413)
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
        if not member["projects"]:
            raise HTTPException(403, "Accès réservé à la direction.")
        return member

    def supreme(request):
        member = current_member(request)
        if member["role"] != "superadmin":
            raise HTTPException(403, "Accès réservé aux administrateurs suprêmes.")
        return member

    def content_editor(request):
        member = current_member(request)
        if not member["content"]:
            raise HTTPException(403, "Vous n’avez pas le droit de modifier le contenu du site.")
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

    @app.get("/api/book/public")
    def public_book():
        return book.read(db_path, public=True)

    @app.get("/api/book/public/media/{asset_id}")
    def public_book_media(asset_id: str):
        image = book.asset(db_path, asset_id, public=True)
        if not image:
            raise HTTPException(404, "Image introuvable.")
        return Response(image["body"], media_type=image["media_type"], headers={"X-Content-Type-Options": "nosniff"})

    @app.get("/api/book/draft")
    def book_draft(request: Request):
        content_editor(request)
        return book.read(db_path)

    @app.post("/api/book/draft")
    def save_book_draft(body: BookBody, request: Request):
        require_same_origin(request)
        member = content_editor(request)
        try:
            return book.save(db_path, member["id"], body.document, body.revision)
        except book.Conflict as exc:
            raise HTTPException(409, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/api/book/publish")
    def publish_book(body: PublishBookBody, request: Request):
        require_same_origin(request)
        member = content_editor(request)
        try:
            return book.publish(db_path, member["id"], body.revision)
        except book.Conflict as exc:
            raise HTTPException(409, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/api/book/assets", status_code=201)
    def upload_book_image(body: BookImageBody, request: Request):
        require_same_origin(request)
        content_editor(request)
        try:
            return book.upload(db_path, body.encoded, body.name)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get("/api/book/assets/{asset_id}")
    def private_book_media(asset_id: str, request: Request):
        content_editor(request)
        image = book.asset(db_path, asset_id)
        if not image:
            raise HTTPException(404, "Image introuvable.")
        return Response(image["body"], media_type=image["media_type"], headers={"X-Content-Type-Options": "nosniff"})

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

    @app.get("/api/team-hours")
    def team_hours(request: Request, month: str = ""):
        supreme(request)
        try:
            return storage.team_hours(db_path, month)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get("/api/access")
    def access_overview(request: Request):
        supreme(request)
        return access.overview(db_path)

    @app.post("/api/roles")
    def save_role(body: RoleBody, request: Request):
        require_same_origin(request)
        member = supreme(request)
        try:
            access.save_role(db_path, member["id"], body.slug, body.name, body.model_dump())
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return access.overview(db_path)

    @app.post("/api/roles/{slug}/delete")
    def delete_role(slug: str, request: Request):
        require_same_origin(request)
        member = supreme(request)
        try:
            access.delete_role(db_path, member["id"], slug)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return access.overview(db_path)

    @app.post("/api/members/invite")
    def invite_member(body: InviteBody, request: Request):
        require_same_origin(request)
        member = supreme(request)
        try:
            code = access.invite_member(db_path, member["id"], body.username, body.display_name, body.role_slug)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return {"code": code, **access.overview(db_path)}

    @app.post("/api/members/{member_id}")
    def update_member(member_id: int, body: MemberBody, request: Request):
        require_same_origin(request)
        member = supreme(request)
        try:
            access.update_member(db_path, member["id"], member_id, body.role_slug, body.active)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return access.overview(db_path)

    @app.post("/api/members/{member_id}/reset")
    def reset_member(member_id: int, request: Request):
        require_same_origin(request)
        member = supreme(request)
        try:
            code = access.reset_member(db_path, member["id"], member_id)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return {"code": code, **access.overview(db_path)}

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
