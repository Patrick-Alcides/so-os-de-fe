from calendar import monthrange
from collections import defaultdict
from datetime import date

from fastapi import Depends, FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session, joinedload

from .auth import create_access_token, get_current_user, hash_password, require_admin, verify_password
from .database import Base, SessionLocal, engine, get_db
from .models import Config, Game, GamePlayer, GeneratedTeam, GoalStat, Payment, Player, TeamPlayer, User, Vote, VoteSession
from .schemas import ConfigUpdate, DashboardRead, GameGenerateInput, GoalStatUpdate, LoginInput, PaymentUpdate, Token, VoteBatchInput, VoteSessionCreate, VoteSessionUpdate
from .seed import create_seed_data
from .settings import CORS_ORIGINS

app = FastAPI(title="Só os de Fé API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    ensure_goal_stats_schema()
    with SessionLocal() as db:
        create_seed_data(db)


def ensure_goal_stats_schema() -> None:
    columns = {column["name"] for column in inspect(engine).get_columns("gols_jogadores")}
    if "vitorias" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE gols_jogadores ADD COLUMN vitorias INTEGER NOT NULL DEFAULT 0"))


def normalize_photo_url(photo_url: str | None) -> str | None:
    if not photo_url:
        return None
    return photo_url.strip() or None


def count_tuesdays(target_date: date) -> int:
    total_days = monthrange(target_date.year, target_date.month)[1]
    return sum(1 for day in range(1, total_days + 1) if date(target_date.year, target_date.month, day).weekday() == 1)


def get_current_config(db: Session) -> Config:
    config = db.query(Config).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuracao nao encontrada.")
    return config


def normalize_phone(phone: str | None) -> str:
    return "".join(char for char in (phone or "") if char.isdigit())


def find_user_by_phone(db: Session, phone: str) -> User | None:
    normalized_phone = normalize_phone(phone)
    if not normalized_phone:
        return None

    users = db.query(User).options(joinedload(User.jogador)).all()
    for user in users:
        if user.jogador and normalize_phone(user.jogador.telefone) == normalized_phone:
            return user
    return None


def normalize_user_type(user_type: str | None) -> str:
    normalized = (user_type or "jogador").strip().lower()
    if normalized not in {"jogador", "administrador"}:
        raise HTTPException(status_code=400, detail="Tipo de acesso invalido.")
    return normalized


def upsert_player_user(db: Session, player: Player, password: str | None, user_type: str = "jogador") -> None:
    user_type = normalize_user_type(user_type)
    user = db.query(User).filter(User.jogador_id == player.id).first()
    if user:
        user.tipo = user_type
        if password:
            user.senha_hash = hash_password(password)
        return

    if not password:
        return

    login_label = normalize_phone(player.telefone) or f"jogador{player.id}"
    db.add(
        User(
            email=f"{login_label}@telefone.local",
            senha_hash=hash_password(password),
            tipo=user_type,
            jogador_id=player.id,
        )
    )


def build_vote_metrics(db: Session) -> tuple[dict[int, float], dict[int, float]]:
    players = db.query(Player).all()
    sessions = db.query(VoteSession).options(joinedload(VoteSession.votos)).all()

    weekly_by_player: dict[int, list[float]] = defaultdict(list)
    for session in sessions:
        notes_by_player: dict[int, list[int]] = defaultdict(list)
        for vote in session.votos:
            notes_by_player[vote.jogador_avaliado_id].append(vote.nota)
        for player_id, notes in notes_by_player.items():
            weekly_by_player[player_id].append(sum(notes) / len(notes))

    overall = {player.id: round(sum(weekly_by_player[player.id]) / len(weekly_by_player[player.id]), 2) if weekly_by_player[player.id] else 0.0 for player in players}

    weekly_latest: dict[int, float] = {}
    if sessions:
        latest = max(sessions, key=lambda item: item.data_jogo)
        latest_notes: dict[int, list[int]] = defaultdict(list)
        for vote in latest.votos:
            latest_notes[vote.jogador_avaliado_id].append(vote.nota)
        weekly_latest = {player.id: round(sum(latest_notes[player.id]) / len(latest_notes[player.id]), 2) if latest_notes[player.id] else 0.0 for player in players}

    return overall, weekly_latest


def payment_status_summary(db: Session, player_id: int) -> str:
    today = date.today()
    current_payment = (
        db.query(Payment)
        .filter(Payment.jogador_id == player_id, Payment.mes == today.month, Payment.ano == today.year)
        .first()
    )
    if not current_payment or current_payment.status == "OK":
        return "OK"
    if current_payment.status == "DV 2+":
        return "DV 2+"
    return "DV 1"


def serialize_player(db: Session, player: Player, averages: dict[int, float]) -> dict:
    current_month_payment = payment_status_summary(db, player.id)
    return {
        "id": player.id,
        "nome": player.nome,
        "nascimento": player.nascimento.isoformat() if player.nascimento else None,
        "telefone": player.telefone,
        "foto": player.foto,
        "posicao": player.posicao,
        "ativo": player.ativo,
        "tipo_acesso": player.usuario.tipo if player.usuario else "jogador",
        "pagamento_status": current_month_payment,
        "media_geral": averages.get(player.id, 0.0),
    }


def build_goal_ranking(db: Session) -> list[dict]:
    averages, _ = build_vote_metrics(db)
    players = db.query(Player).filter(Player.ativo.is_(True)).order_by(Player.nome.asc()).all()
    stats_by_player = {stat.jogador_id: stat for stat in db.query(GoalStat).all()}
    max_goals = max((stats_by_player.get(player.id).gols for player in players if stats_by_player.get(player.id)), default=0)
    max_wins = max((stats_by_player.get(player.id).vitorias for player in players if stats_by_player.get(player.id)), default=0)

    ranking = []
    for player in players:
        stat = stats_by_player.get(player.id)
        wins = stat.vitorias if stat else 0
        goals = stat.gols if stat else 0
        matches = stat.partidas if stat else 0
        ranking.append(
            {
                "id": player.id,
                "nome": player.nome,
                "foto": player.foto,
                "posicao": player.posicao,
                "vitorias": wins,
                "gols": goals,
                "partidas": matches,
                "gols_por_partida": round(goals / matches, 2) if matches else 0.0,
                "media_geral": averages.get(player.id, 0.0),
                "pagamento_status": payment_status_summary(db, player.id),
                "progresso": round((wins / max_wins) * 100, 1) if max_wins else round((goals / max_goals) * 100, 1) if max_goals else 0,
            }
        )

    ranking.sort(key=lambda item: (-item["vitorias"], -item["gols"], -item["partidas"], item["nome"].lower()))
    for position, item in enumerate(ranking, start=1):
        item["ranking_gols"] = position
    return ranking


def serialize_votation(session: VoteSession) -> dict:
    return {
        "id": session.id,
        "data_jogo": session.data_jogo.isoformat(),
        "semana": session.semana,
        "mes": session.mes,
        "ano": session.ano,
        "aberta": session.aberta,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=Token)
def login(payload: LoginInput, db: Session = Depends(get_db)):
    user = find_user_by_phone(db, payload.telefone)
    if not user or not verify_password(payload.senha, user.senha_hash):
        raise HTTPException(status_code=401, detail="Telefone ou senha invalidos.")

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "tipo": user.tipo,
            "jogador_id": user.jogador_id,
            "jogador_nome": user.jogador.nome if user.jogador else None,
        },
    }


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "tipo": current_user.tipo,
        "jogador_id": current_user.jogador_id,
        "jogador_nome": current_user.jogador.nome if current_user.jogador else None,
    }


@app.get("/api/dashboard", response_model=DashboardRead)
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    config = get_current_config(db)
    today = date.today()
    total_tuesdays = count_tuesdays(today)
    court_cost = 500 if total_tuesdays == 5 else 400
    averages, _ = build_vote_metrics(db)
    active_players = db.query(Player).filter(Player.ativo.is_(True)).all()
    best_player = None
    if active_players:
        highlighted = max(active_players, key=lambda item: averages.get(item.id, 0))
        best_player = {"nome": highlighted.nome, "media_geral": averages.get(highlighted.id, 0.0)}

    statuses = [payment_status_summary(db, player.id) for player in active_players]
    return {
        "config": config,
        "custo_quadra_mes_atual": court_cost,
        "total_tercas_no_mes": total_tuesdays,
        "total_jogadores_ativos": len(active_players),
        "total_em_dia": sum(1 for status in statuses if status == "OK"),
        "total_devendo": sum(1 for status in statuses if status != "OK"),
        "destaque_jogador": best_player,
    }


@app.get("/api/config")
def get_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    return get_current_config(db)


@app.put("/api/config")
def update_config(payload: ConfigUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    config = get_current_config(db)
    config.chave_pix = payload.chave_pix
    config.valor_mensalidade = payload.valor_mensalidade
    config.valor_caixa = payload.valor_caixa
    db.commit()
    db.refresh(config)
    return config


@app.get("/api/players")
def list_players(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    players = db.query(Player).order_by(Player.ativo.desc(), Player.nome.asc()).all()
    averages, _ = build_vote_metrics(db)
    return [serialize_player(db, player, averages) for player in players]


@app.get("/api/goals/ranking")
def list_goal_ranking(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    return build_goal_ranking(db)


@app.get("/api/goals/players/{player_id}")
def goal_player_profile(player_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    player = db.get(Player, player_id)
    if not player or not player.ativo:
        raise HTTPException(status_code=404, detail="Jogador nao encontrado.")

    ranking = build_goal_ranking(db)
    profile = next((item for item in ranking if item["id"] == player_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Jogador nao encontrado no ranking.")

    by_average = sorted(ranking, key=lambda item: (-item["media_geral"], item["nome"].lower()))
    average_position = next((index for index, item in enumerate(by_average, start=1) if item["id"] == player_id), len(by_average))
    total_matches = max((item["partidas"] for item in ranking), default=0)
    frequency = round((profile["partidas"] / total_matches) * 100) if total_matches else 0

    return {
        **profile,
        "ranking_media": average_position,
        "total_jogadores": len(ranking),
        "frequencia": frequency,
        "total_partidas_referencia": total_matches,
    }


@app.put("/api/goals/players/{player_id}")
def update_goal_stats(player_id: int, payload: GoalStatUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Jogador nao encontrado.")
    if not player.ativo:
        raise HTTPException(status_code=400, detail="Jogador inativo nao aparece no ranking.")

    stat = db.query(GoalStat).filter(GoalStat.jogador_id == player_id).first()
    if not stat:
        stat = GoalStat(jogador_id=player_id)
        db.add(stat)

    stat.vitorias = payload.vitorias
    stat.gols = payload.gols
    stat.partidas = payload.partidas
    db.commit()
    return next(item for item in build_goal_ranking(db) if item["id"] == player_id)


@app.post("/api/players")
def create_player(
    nome: str = Form(...),
    nascimento: str | None = Form(None),
    telefone: str | None = Form(None),
    posicao: str = Form(...),
    ativo: bool = Form(True),
    tipo_acesso: str = Form("jogador"),
    senha: str | None = Form(None),
    foto_url: str | None = Form(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    player = Player(
        nome=nome,
        nascimento=date.fromisoformat(nascimento) if nascimento else None,
        telefone=telefone,
        posicao=posicao,
        ativo=ativo,
        foto=normalize_photo_url(foto_url),
    )
    db.add(player)
    db.flush()
    upsert_player_user(db, player, senha, tipo_acesso)
    db.commit()
    db.refresh(player)
    averages, _ = build_vote_metrics(db)
    return serialize_player(db, player, averages)


@app.put("/api/players/me")
def update_my_player(
    nome: str = Form(...),
    nascimento: str | None = Form(None),
    telefone: str | None = Form(None),
    senha: str | None = Form(None),
    foto_url: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.jogador_id:
        raise HTTPException(status_code=403, detail="Usuario sem jogador vinculado.")

    player = db.get(Player, current_user.jogador_id)
    if not player:
        raise HTTPException(status_code=404, detail="Jogador nao encontrado.")

    player.nome = nome
    player.nascimento = date.fromisoformat(nascimento) if nascimento else None
    player.telefone = telefone
    player.foto = normalize_photo_url(foto_url)
    upsert_player_user(db, player, senha, current_user.tipo)
    db.commit()
    db.refresh(player)
    averages, _ = build_vote_metrics(db)
    return serialize_player(db, player, averages)


@app.put("/api/players/{player_id}")
def update_player(
    player_id: int,
    nome: str = Form(...),
    nascimento: str | None = Form(None),
    telefone: str | None = Form(None),
    posicao: str = Form(...),
    ativo: bool = Form(True),
    tipo_acesso: str = Form("jogador"),
    senha: str | None = Form(None),
    foto_url: str | None = Form(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Jogador nao encontrado.")
    player.nome = nome
    player.nascimento = date.fromisoformat(nascimento) if nascimento else None
    player.telefone = telefone
    player.posicao = posicao
    player.ativo = ativo
    player.foto = normalize_photo_url(foto_url)
    upsert_player_user(db, player, senha, tipo_acesso)
    db.commit()
    db.refresh(player)
    averages, _ = build_vote_metrics(db)
    return serialize_player(db, player, averages)


@app.delete("/api/players/{player_id}")
def delete_player(player_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Jogador nao encontrado.")

    db.query(User).filter(User.jogador_id == player_id).delete(synchronize_session=False)
    db.query(Payment).filter(Payment.jogador_id == player_id).delete(synchronize_session=False)
    db.query(GoalStat).filter(GoalStat.jogador_id == player_id).delete(synchronize_session=False)
    db.query(Vote).filter(Vote.jogador_votante_id == player_id).delete(synchronize_session=False)
    db.query(Vote).filter(Vote.jogador_avaliado_id == player_id).delete(synchronize_session=False)
    db.query(GamePlayer).filter(GamePlayer.jogador_id == player_id).delete(synchronize_session=False)
    db.query(TeamPlayer).filter(TeamPlayer.jogador_id == player_id).delete(synchronize_session=False)
    db.delete(player)
    db.commit()
    return {"message": "Jogador excluido com sucesso."}


@app.get("/api/payments")
def list_payments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    payments = db.query(Payment).order_by(Payment.ano.desc(), Payment.mes.desc()).all()
    return [
        {
            "id": payment.id,
            "jogador_id": payment.jogador_id,
            "jogador_nome": payment.jogador.nome,
            "mes": payment.mes,
            "ano": payment.ano,
            "valor": float(payment.valor),
            "status": payment.status,
        }
        for payment in payments
    ]


@app.post("/api/payments")
def upsert_payment(payload: PaymentUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    payment = (
        db.query(Payment)
        .filter(Payment.jogador_id == payload.jogador_id, Payment.mes == payload.mes, Payment.ano == payload.ano)
        .first()
    )
    if payment:
        payment.valor = payload.valor
        payment.status = payload.status
    else:
        payment = Payment(**payload.model_dump())
        db.add(payment)
    db.commit()
    db.refresh(payment)
    return {
        "id": payment.id,
        "status": payment.status,
    }


@app.get("/api/votations")
def list_votations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    sessions = db.query(VoteSession).order_by(VoteSession.data_jogo.desc()).all()
    return [serialize_votation(session) for session in sessions]


@app.get("/api/votations/active")
def active_votation(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    session = db.query(VoteSession).filter(VoteSession.aberta.is_(True)).order_by(VoteSession.data_jogo.desc()).first()
    if not session:
        return {"votacao": None}
    averages, weekly = build_vote_metrics(db)
    players = db.query(Player).filter(Player.ativo.is_(True)).order_by(Player.nome.asc()).all()
    return {
        "votacao": serialize_votation(session),
        "jogadores": [
            {
                "id": player.id,
                "nome": player.nome,
                "posicao": player.posicao,
                "media_geral": averages.get(player.id, 0.0),
                "media_semana": weekly.get(player.id, 0.0),
            }
            for player in players
        ],
    }


@app.post("/api/votations")
def create_votation(payload: VoteSessionCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    if payload.aberta:
        open_session = db.query(VoteSession).filter(VoteSession.aberta.is_(True)).first()
        if open_session:
            raise HTTPException(status_code=400, detail="Ja existe uma votacao aberta. Feche ou exclua a votacao atual antes de criar outra.")

    week_number = ((payload.data_jogo.day - 1) // 7) + 1
    session = VoteSession(
        data_jogo=payload.data_jogo,
        semana=week_number,
        mes=payload.data_jogo.month,
        ano=payload.data_jogo.year,
        aberta=payload.aberta,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return serialize_votation(session)


@app.put("/api/votations/{session_id}")
def update_votation(session_id: int, payload: VoteSessionUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    session = db.get(VoteSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Votacao nao encontrada.")

    if payload.aberta:
        open_session = (
            db.query(VoteSession)
            .filter(VoteSession.aberta.is_(True), VoteSession.id != session_id)
            .first()
        )
        if open_session:
            raise HTTPException(status_code=400, detail="Ja existe outra votacao aberta. Feche a atual antes de reabrir esta.")

    session.aberta = payload.aberta
    db.commit()
    db.refresh(session)
    return serialize_votation(session)


@app.delete("/api/votations/{session_id}")
def delete_votation(session_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    session = db.get(VoteSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Votacao nao encontrada.")
    db.query(Vote).filter(Vote.votacao_id == session_id).delete(synchronize_session=False)
    db.delete(session)
    db.commit()
    return {"message": "Votacao excluida com sucesso."}


@app.get("/api/votations/{session_id}/results")
def votation_results(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    session = db.query(VoteSession).options(joinedload(VoteSession.votos)).filter(VoteSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Votacao nao encontrada.")
    averages, _ = build_vote_metrics(db)
    scores: dict[int, list[int]] = defaultdict(list)
    for vote in session.votos:
        scores[vote.jogador_avaliado_id].append(vote.nota)
    players = db.query(Player).order_by(Player.nome.asc()).all()
    results = [
        {
            "jogador_id": player.id,
            "nome": player.nome,
            "media_semana": round(sum(scores[player.id]) / len(scores[player.id]), 2) if scores[player.id] else 0.0,
            "media_geral": averages.get(player.id, 0.0),
        }
        for player in players
        if scores[player.id] or averages.get(player.id, 0.0)
    ]
    return sorted(results, key=lambda item: (-item["media_semana"], -item["media_geral"], item["nome"]))


@app.get("/api/votations/{session_id}/voters")
def votation_voters(session_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    session = db.get(VoteSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Votacao nao encontrada.")

    vote_counts = (
        db.query(Vote.jogador_votante_id, func.count(Vote.id))
        .filter(Vote.votacao_id == session_id)
        .group_by(Vote.jogador_votante_id)
        .all()
    )
    count_by_player = {player_id: vote_count for player_id, vote_count in vote_counts}
    voter_ids = list(count_by_player.keys())
    voters = db.query(Player).filter(Player.id.in_(voter_ids)).order_by(Player.nome.asc()).all() if voter_ids else []
    users_by_player = {
        user.jogador_id: user.email
        for user in db.query(User).filter(User.jogador_id.in_(voter_ids)).all()
        if user.jogador_id
    }

    player_user_ids = [
        jogador_id
        for (jogador_id,) in db.query(User.jogador_id).filter(User.tipo == "jogador", User.jogador_id.isnot(None)).all()
    ]
    active_players = (
        db.query(Player)
        .filter(Player.ativo.is_(True), Player.id.in_(player_user_ids))
        .order_by(Player.nome.asc())
        .all()
        if player_user_ids
        else []
    )
    not_voted = [player for player in active_players if player.id not in count_by_player]

    return {
        "votacao_id": session_id,
        "total_votantes": len(voters),
        "votantes": [
            {
                "jogador_id": player.id,
                "nome": player.nome,
                "email": users_by_player.get(player.id),
                "total_votos": count_by_player.get(player.id, 0),
            }
            for player in voters
        ],
        "faltantes": [
            {
                "jogador_id": player.id,
                "nome": player.nome,
            }
            for player in not_voted
        ],
    }


@app.post("/api/votations/{session_id}/votes")
def vote(session_id: int, payload: VoteBatchInput, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.jogador_id:
        raise HTTPException(status_code=403, detail="Usuario sem jogador vinculado.")
    session = db.get(VoteSession, session_id)
    if not session or not session.aberta:
        raise HTTPException(status_code=400, detail="Votacao nao esta aberta.")

    seen_targets: set[int] = set()
    for vote_input in payload.votos:
        if vote_input.jogador_avaliado_id == current_user.jogador_id:
            raise HTTPException(status_code=400, detail="Voce nao pode votar em si mesmo.")
        if vote_input.jogador_avaliado_id in seen_targets:
            raise HTTPException(status_code=400, detail="Jogador duplicado na mesma votacao.")
        seen_targets.add(vote_input.jogador_avaliado_id)

        existing = (
            db.query(Vote)
            .filter(
                Vote.votacao_id == session_id,
                Vote.jogador_votante_id == current_user.jogador_id,
                Vote.jogador_avaliado_id == vote_input.jogador_avaliado_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Voce ja votou nesse jogador nesta votacao.")

        db.add(
            Vote(
                votacao_id=session_id,
                jogador_votante_id=current_user.jogador_id,
                jogador_avaliado_id=vote_input.jogador_avaliado_id,
                nota=vote_input.nota,
            )
        )

    db.commit()
    return {"message": "Votos registrados com sucesso."}


def snake_distribute_with_limits(players: list[dict], teams: list[list[dict]], target_sizes: list[int]) -> list[list[dict]]:
    order = list(range(len(teams))) + list(reversed(range(len(teams))))
    cursor = 0

    for player in players:
        for offset in range(len(order)):
            team_index = order[(cursor + offset) % len(order)]
            if len(teams[team_index]) < target_sizes[team_index]:
                teams[team_index].append(player)
                cursor = (cursor + offset + 1) % len(order)
                break

    return teams


def serialize_team_player(db: Session, player: Player, averages: dict[int, float]) -> dict:
    return {
        "id": player.id,
        "nome": player.nome,
        "posicao": player.posicao,
        "media_geral": averages.get(player.id, 0.0),
        "pagamento_status": payment_status_summary(db, player.id),
        "foto": player.foto,
    }


@app.post("/api/games/generate")
def generate_game(payload: GameGenerateInput, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    unique_ids = list(dict.fromkeys(payload.jogador_ids))
    if len(unique_ids) < 10 or len(unique_ids) > 15:
        raise HTTPException(status_code=400, detail="Selecione de 10 a 15 jogadores cadastrados.")

    players = db.query(Player).filter(Player.id.in_(unique_ids)).all()
    if len(players) != len(unique_ids):
        raise HTTPException(status_code=400, detail="Um ou mais jogadores nao foram encontrados.")

    averages, _ = build_vote_metrics(db)
    goalkeepers = sorted(
        [player for player in players if player.posicao == "goleiro"],
        key=lambda item: averages.get(item.id, 0),
        reverse=True,
    )
    line_players = sorted(
        [player for player in players if player.posicao == "linha"],
        key=lambda item: averages.get(item.id, 0),
        reverse=True,
    )

    if len(goalkeepers) > 3:
        raise HTTPException(status_code=400, detail="A montagem permite no maximo 3 goleiros.")

    game = Game(data_jogo=payload.data_jogo)
    db.add(game)
    db.flush()

    for order, player_id in enumerate(unique_ids, start=1):
        db.add(GamePlayer(jogo_id=game.id, jogador_id=player_id, ordem_lista=order))

    total_players = len(players)
    is_waiting_rotation = total_players > 10
    target_sizes = [5, 5, total_players - 10] if is_waiting_rotation else [5, 5]
    team_buckets: list[list[dict]] = [[] for _ in target_sizes]

    for team_number, keeper in enumerate(goalkeepers):
        available_teams = [
            index
            for index, team in enumerate(team_buckets)
            if len(team) < target_sizes[index]
        ]
        if not available_teams:
            raise HTTPException(status_code=400, detail="Nao foi possivel distribuir os goleiros.")

        preferred_team = team_number if team_number < len(team_buckets) and team_number in available_teams else min(
            available_teams,
            key=lambda index: len(team_buckets[index]),
        )
        team_buckets[preferred_team].append(serialize_team_player(db, keeper, averages))

    line_members = [
        serialize_team_player(db, player, averages)
        for player in line_players
    ]
    team_buckets = snake_distribute_with_limits(line_members, team_buckets, target_sizes)

    teams_response = []
    for team_number, members in enumerate(team_buckets):
        members = team_buckets[team_number]

        team_average = round(sum(member["media_geral"] for member in members) / len(members), 2)
        team_name = f"Time {team_number + 1}"
        if is_waiting_rotation and team_number == 2:
            team_name = "Time 3 - Espera"
        db_team = GeneratedTeam(jogo_id=game.id, nome_time=team_name, media_time=team_average)
        db.add(db_team)
        db.flush()
        for member in members:
            db.add(TeamPlayer(time_id=db_team.id, jogador_id=member["id"]))

        teams_response.append(
            {
                "nome_time": db_team.nome_time,
                "media_time": team_average,
                "jogadores": members,
                "observacao": "Recebe o goleiro do time perdedor." if is_waiting_rotation and team_number == 2 else None,
            }
        )

    db.commit()
    db.refresh(game)
    return {
        "id": game.id,
        "data_jogo": game.data_jogo.isoformat(),
        "criado_em": game.criado_em.isoformat(),
        "times": teams_response,
    }


def delete_game_records(db: Session, game_id: int) -> None:
    team_ids = [team_id for (team_id,) in db.query(GeneratedTeam.id).filter(GeneratedTeam.jogo_id == game_id).all()]
    if team_ids:
        db.query(TeamPlayer).filter(TeamPlayer.time_id.in_(team_ids)).delete(synchronize_session=False)
        db.query(GeneratedTeam).filter(GeneratedTeam.id.in_(team_ids)).delete(synchronize_session=False)
    db.query(GamePlayer).filter(GamePlayer.jogo_id == game_id).delete(synchronize_session=False)
    db.query(Game).filter(Game.id == game_id).delete(synchronize_session=False)


@app.delete("/api/games/{game_id}")
def delete_game(game_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    game = db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Jogo nao encontrado.")
    delete_game_records(db, game_id)
    db.commit()
    return {"message": "Jogo excluido com sucesso."}


@app.delete("/api/games")
def delete_all_games(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    del admin
    game_ids = [game_id for (game_id,) in db.query(Game.id).all()]
    for game_id in game_ids:
        delete_game_records(db, game_id)
    db.commit()
    return {"message": "Todos os jogos foram excluidos com sucesso.", "total": len(game_ids)}
@app.get("/api/games")
def list_games(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    del current_user
    games = db.query(Game).options(joinedload(Game.times).joinedload(GeneratedTeam.jogadores).joinedload(TeamPlayer.jogador)).order_by(Game.data_jogo.desc()).all()
    averages, _ = build_vote_metrics(db)
    response = []
    for game in games:
        times = []
        for team in game.times:
            times.append(
                {
                    "nome_time": team.nome_time,
                    "media_time": team.media_time,
                    "jogadores": [
                        {
                            "id": team_player.jogador.id,
                            "nome": team_player.jogador.nome,
                            "posicao": team_player.jogador.posicao,
                            "media_geral": averages.get(team_player.jogador.id, 0.0),
                            "pagamento_status": payment_status_summary(db, team_player.jogador.id),
                            "foto": team_player.jogador.foto,
                        }
                        for team_player in team.jogadores
                    ],
                }
            )
        response.append(
            {
                "id": game.id,
                "data_jogo": game.data_jogo.isoformat(),
                "criado_em": game.criado_em.isoformat(),
                "times": times,
            }
        )
    return response
