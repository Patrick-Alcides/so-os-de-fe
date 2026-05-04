from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    tipo: str
    jogador_id: int | None = None
    jogador_nome: str | None = None


class LoginInput(BaseModel):
    telefone: str
    senha: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class ConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chave_pix: str
    valor_mensalidade: float
    valor_caixa: float


class ConfigUpdate(BaseModel):
    chave_pix: str
    valor_mensalidade: float = Field(gt=0)
    valor_caixa: float


class PaymentUpdate(BaseModel):
    jogador_id: int
    mes: int = Field(ge=1, le=12)
    ano: int
    valor: float = Field(gt=0)
    status: str


class GoalStatUpdate(BaseModel):
    vitorias: int = Field(default=0, ge=0)
    gols: int = Field(ge=0)
    partidas: int = Field(ge=0)


class VoteItemInput(BaseModel):
    jogador_avaliado_id: int
    nota: int = Field(ge=1, le=10)


class VoteBatchInput(BaseModel):
    votos: list[VoteItemInput]


class VoteSessionCreate(BaseModel):
    data_jogo: date
    aberta: bool = True


class VoteSessionUpdate(BaseModel):
    aberta: bool


class GameGenerateInput(BaseModel):
    data_jogo: date
    jogador_ids: list[int]


class TeamPlayerRead(BaseModel):
    id: int
    nome: str
    posicao: str
    media_geral: float
    pagamento_status: str
    foto: str | None = None


class TeamRead(BaseModel):
    nome_time: str
    media_time: float
    jogadores: list[TeamPlayerRead]


class GameRead(BaseModel):
    id: int
    data_jogo: date
    criado_em: datetime
    times: list[TeamRead]


class DashboardRead(BaseModel):
    config: ConfigRead
    custo_quadra_mes_atual: float
    total_tercas_no_mes: int
    total_jogadores_ativos: int
    total_em_dia: int
    total_devendo: int
    destaque_jogador: dict | None
