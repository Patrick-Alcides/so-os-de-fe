from datetime import date

from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Config, Payment, Player, User, Vote, VoteSession

ADMIN_EMAIL = "admin@soosdefe.com"
ADMIN_NAME = "Patrick Alcides"
ADMIN_PHONE = "(51) 99208-6770"
ADMIN_PASSWORD = "34831366"


def normalize_phone(phone: str | None) -> str:
    return "".join(char for char in (phone or "") if char.isdigit())


def find_player_by_phone(db: Session, phone: str) -> Player | None:
    normalized_phone = normalize_phone(phone)
    players = db.query(Player).all()
    return next((player for player in players if normalize_phone(player.telefone) == normalized_phone), None)


def ensure_admin_user(db: Session) -> None:
    admin_player = find_player_by_phone(db, ADMIN_PHONE)
    if not admin_player:
        admin_player = Player(nome=ADMIN_NAME, telefone=ADMIN_PHONE, posicao="linha", ativo=True)
        db.add(admin_player)
        db.flush()
    else:
        admin_player.nome = ADMIN_NAME
        admin_player.telefone = ADMIN_PHONE
        admin_player.ativo = True

    admin_user = db.query(User).filter(User.tipo == "administrador").first()
    if not admin_user:
        admin_user = db.query(User).filter(User.email == ADMIN_EMAIL).first()

    if admin_user:
        admin_user.email = ADMIN_EMAIL
        admin_user.senha_hash = hash_password(ADMIN_PASSWORD)
        admin_user.tipo = "administrador"
        admin_user.jogador_id = admin_player.id
    else:
        db.add(
            User(
                email=ADMIN_EMAIL,
                senha_hash=hash_password(ADMIN_PASSWORD),
                tipo="administrador",
                jogador_id=admin_player.id,
            )
        )


def create_seed_data(db: Session) -> None:
    if not db.query(Config).first():
        db.add(
            Config(
                chave_pix="5199208-6770",
                valor_mensalidade=30,
                valor_caixa=420,
            )
        )

    if not db.query(Player).first():
        players = [
            Player(nome="Carlos Goleiro", nascimento=date(1990, 5, 12), telefone="(51) 99999-1001", posicao="goleiro", ativo=True),
            Player(nome="Marcos Goleiro", nascimento=date(1992, 7, 21), telefone="(51) 99999-1002", posicao="goleiro", ativo=True),
            Player(nome="Rafael Goleiro", nascimento=date(1989, 11, 2), telefone="(51) 99999-1003", posicao="goleiro", ativo=True),
            Player(nome="Joao Silva", nascimento=date(1994, 2, 15), telefone="(51) 99999-1004", posicao="linha", ativo=True),
            Player(nome="Bruno Lima", nascimento=date(1993, 1, 20), telefone="(51) 99999-1005", posicao="linha", ativo=True),
            Player(nome="Felipe Costa", nascimento=date(1996, 9, 30), telefone="(51) 99999-1006", posicao="linha", ativo=True),
            Player(nome="Tiago Souza", nascimento=date(1991, 6, 17), telefone="(51) 99999-1007", posicao="linha", ativo=True),
            Player(nome="Anderson Rocha", nascimento=date(1988, 8, 3), telefone="(51) 99999-1008", posicao="linha", ativo=True),
            Player(nome="Diego Alves", nascimento=date(1995, 3, 18), telefone="(51) 99999-1009", posicao="linha", ativo=True),
            Player(nome="Gustavo Pinto", nascimento=date(1997, 4, 8), telefone="(51) 99999-1010", posicao="linha", ativo=True),
            Player(nome="Leonardo Prado", nascimento=date(1990, 10, 25), telefone="(51) 99999-1011", posicao="linha", ativo=True),
            Player(nome="Eduardo Reis", nascimento=date(1992, 12, 11), telefone="(51) 99999-1012", posicao="linha", ativo=True),
            Player(nome="Mateus Vieira", nascimento=date(1998, 5, 5), telefone="(51) 99999-1013", posicao="linha", ativo=True),
            Player(nome="Pedro Nunes", nascimento=date(1999, 8, 9), telefone="(51) 99999-1014", posicao="linha", ativo=True),
            Player(nome="Vinicius Melo", nascimento=date(1993, 11, 19), telefone="(51) 99999-1015", posicao="linha", ativo=True),
            Player(nome="Jogador Inativo", nascimento=date(1987, 1, 1), telefone="(51) 99999-1016", posicao="linha", ativo=False),
        ]
        db.add_all(players)
        db.flush()

        current_year = date.today().year
        current_month = date.today().month

        for index, player in enumerate(players[:15], start=1):
            db.add(
                Payment(
                    jogador_id=player.id,
                    mes=current_month,
                    ano=current_year,
                    valor=30,
                    status="OK" if index <= 10 else "DV",
                )
            )

        previous_month = current_month - 1 or 12
        previous_year = current_year if current_month > 1 else current_year - 1
        for player in players[13:15]:
            db.add(
                Payment(
                    jogador_id=player.id,
                    mes=previous_month,
                    ano=previous_year,
                    valor=30,
                    status="DV",
                )
            )

        admin_player = players[0]
        db.add(
            User(
                email=ADMIN_EMAIL,
                senha_hash=hash_password(ADMIN_PASSWORD),
                tipo="administrador",
                jogador_id=admin_player.id,
            )
        )

        for idx, player in enumerate(players[1:6], start=1):
            db.add(
                User(
                    email=f"jogador{idx}@soosdefe.com",
                    senha_hash=hash_password("123456"),
                    tipo="jogador",
                    jogador_id=player.id,
                )
            )

    if not db.query(VoteSession).first():
        sessions = [
            VoteSession(data_jogo=date(2026, 4, 7), semana=2, mes=4, ano=2026, aberta=False),
            VoteSession(data_jogo=date(2026, 4, 14), semana=3, mes=4, ano=2026, aberta=False),
        ]
        db.add_all(sessions)
        db.flush()

        sample_votes = [
            Vote(votacao_id=sessions[0].id, jogador_votante_id=2, jogador_avaliado_id=4, nota=10),
            Vote(votacao_id=sessions[0].id, jogador_votante_id=3, jogador_avaliado_id=4, nota=10),
            Vote(votacao_id=sessions[0].id, jogador_votante_id=4, jogador_avaliado_id=5, nota=8),
            Vote(votacao_id=sessions[0].id, jogador_votante_id=5, jogador_avaliado_id=6, nota=7),
            Vote(votacao_id=sessions[1].id, jogador_votante_id=2, jogador_avaliado_id=4, nota=5),
            Vote(votacao_id=sessions[1].id, jogador_votante_id=3, jogador_avaliado_id=4, nota=5),
            Vote(votacao_id=sessions[1].id, jogador_votante_id=4, jogador_avaliado_id=5, nota=9),
            Vote(votacao_id=sessions[1].id, jogador_votante_id=5, jogador_avaliado_id=6, nota=8),
        ]
        db.add_all(sample_votes)

    ensure_admin_user(db)
    db.commit()
