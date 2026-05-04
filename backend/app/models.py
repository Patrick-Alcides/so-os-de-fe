from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="jogador")
    jogador_id: Mapped[int | None] = mapped_column(ForeignKey("jogadores.id"), nullable=True)

    jogador: Mapped["Player | None"] = relationship("Player", back_populates="usuario", uselist=False)


class Player(Base):
    __tablename__ = "jogadores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    foto: Mapped[str | None] = mapped_column(Text, nullable=True)
    posicao: Mapped[str] = mapped_column(String(20), nullable=False, default="linha")
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    usuario: Mapped["User | None"] = relationship("User", back_populates="jogador", uselist=False)
    pagamentos: Mapped[list["Payment"]] = relationship("Payment", back_populates="jogador", cascade="all, delete-orphan")
    estatistica_gols: Mapped["GoalStat | None"] = relationship(
        "GoalStat",
        back_populates="jogador",
        cascade="all, delete-orphan",
        single_parent=True,
        uselist=False,
    )
    votos_recebidos: Mapped[list["Vote"]] = relationship(
        "Vote",
        back_populates="jogador_avaliado",
        foreign_keys="Vote.jogador_avaliado_id",
    )
    votos_emitidos: Mapped[list["Vote"]] = relationship(
        "Vote",
        back_populates="jogador_votante",
        foreign_keys="Vote.jogador_votante_id",
    )


class GoalStat(Base):
    __tablename__ = "gols_jogadores"
    __table_args__ = (UniqueConstraint("jogador_id", name="uq_gols_jogador"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey("jogadores.id"), nullable=False)
    vitorias: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gols: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    partidas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    jogador: Mapped["Player"] = relationship("Player", back_populates="estatistica_gols")


class Payment(Base):
    __tablename__ = "pagamentos"
    __table_args__ = (UniqueConstraint("jogador_id", "mes", "ano", name="uq_pagamento_jogador_mes_ano"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey("jogadores.id"), nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=30)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OK")

    jogador: Mapped["Player"] = relationship("Player", back_populates="pagamentos")


class VoteSession(Base):
    __tablename__ = "votacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data_jogo: Mapped[date] = mapped_column(Date, nullable=False)
    semana: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    aberta: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    votos: Mapped[list["Vote"]] = relationship("Vote", back_populates="votacao", cascade="all, delete-orphan")


class Vote(Base):
    __tablename__ = "votos"
    __table_args__ = (
        UniqueConstraint("votacao_id", "jogador_votante_id", "jogador_avaliado_id", name="uq_voto_unico"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    votacao_id: Mapped[int] = mapped_column(ForeignKey("votacoes.id"), nullable=False)
    jogador_votante_id: Mapped[int] = mapped_column(ForeignKey("jogadores.id"), nullable=False)
    jogador_avaliado_id: Mapped[int] = mapped_column(ForeignKey("jogadores.id"), nullable=False)
    nota: Mapped[int] = mapped_column(Integer, nullable=False)

    votacao: Mapped["VoteSession"] = relationship("VoteSession", back_populates="votos")
    jogador_votante: Mapped["Player"] = relationship("Player", foreign_keys=[jogador_votante_id], back_populates="votos_emitidos")
    jogador_avaliado: Mapped["Player"] = relationship("Player", foreign_keys=[jogador_avaliado_id], back_populates="votos_recebidos")


class Config(Base):
    __tablename__ = "configuracoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chave_pix: Mapped[str] = mapped_column(String(255), nullable=False)
    valor_mensalidade: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=30)
    valor_caixa: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)


class Game(Base):
    __tablename__ = "jogos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data_jogo: Mapped[date] = mapped_column(Date, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    jogadores: Mapped[list["GamePlayer"]] = relationship("GamePlayer", back_populates="jogo", cascade="all, delete-orphan")
    times: Mapped[list["GeneratedTeam"]] = relationship("GeneratedTeam", back_populates="jogo", cascade="all, delete-orphan")


class GamePlayer(Base):
    __tablename__ = "jogo_jogadores"
    __table_args__ = (UniqueConstraint("jogo_id", "jogador_id", name="uq_jogo_jogador"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jogo_id: Mapped[int] = mapped_column(ForeignKey("jogos.id"), nullable=False)
    jogador_id: Mapped[int] = mapped_column(ForeignKey("jogadores.id"), nullable=False)
    ordem_lista: Mapped[int] = mapped_column(Integer, nullable=False)

    jogo: Mapped["Game"] = relationship("Game", back_populates="jogadores")
    jogador: Mapped["Player"] = relationship("Player")


class GeneratedTeam(Base):
    __tablename__ = "times_gerados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jogo_id: Mapped[int] = mapped_column(ForeignKey("jogos.id"), nullable=False)
    nome_time: Mapped[str] = mapped_column(String(50), nullable=False)
    media_time: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    jogo: Mapped["Game"] = relationship("Game", back_populates="times")
    jogadores: Mapped[list["TeamPlayer"]] = relationship("TeamPlayer", back_populates="time", cascade="all, delete-orphan")


class TeamPlayer(Base):
    __tablename__ = "time_jogadores"
    __table_args__ = (UniqueConstraint("time_id", "jogador_id", name="uq_time_jogador"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    time_id: Mapped[int] = mapped_column(ForeignKey("times_gerados.id"), nullable=False)
    jogador_id: Mapped[int] = mapped_column(ForeignKey("jogadores.id"), nullable=False)

    time: Mapped["GeneratedTeam"] = relationship("GeneratedTeam", back_populates="jogadores")
    jogador: Mapped["Player"] = relationship("Player")
