import { useState } from "react";

const initialState = {
  nome: "",
  nascimento: "",
  telefone: "",
  posicao: "linha",
  ativo: true,
  senha: "",
  foto_url: "",
};

export default function PlayerForm({ onSubmit, editingPlayer, onCancel, mode = "admin" }) {
  const isSelfEdit = mode === "self";
  const [form, setForm] = useState(
    editingPlayer
      ? {
          nome: editingPlayer.nome,
          nascimento: editingPlayer.nascimento || "",
          telefone: editingPlayer.telefone || "",
          posicao: editingPlayer.posicao,
          ativo: editingPlayer.ativo,
          senha: "",
          foto_url: editingPlayer.foto || "",
        }
      : initialState
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === "senha" && !value) {
        return;
      }
      payload.append(key, String(value));
    });
    await onSubmit(payload);
    setForm(initialState);
  }

  return (
    <form onSubmit={handleSubmit} className="panel grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
      <input className="field" placeholder="Nome" value={form.nome} onChange={(e) => update("nome", e.target.value)} required />
      <input className="field" type="date" value={form.nascimento} onChange={(e) => update("nascimento", e.target.value)} />
      <input className="field" placeholder="Telefone" value={form.telefone} onChange={(e) => update("telefone", e.target.value)} />
      {!isSelfEdit ? (
        <select className="field" value={form.posicao} onChange={(e) => update("posicao", e.target.value)}>
          <option value="linha">Linha</option>
          <option value="goleiro">Goleiro</option>
        </select>
      ) : null}
      {!isSelfEdit ? (
        <select className="field" value={String(form.ativo)} onChange={(e) => update("ativo", e.target.value === "true")}>
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </select>
      ) : null}
      <input
        className="field"
        type="password"
        placeholder={editingPlayer ? "Nova senha de acesso (opcional)" : "Senha de acesso"}
        value={form.senha}
        onChange={(e) => update("senha", e.target.value)}
      />
      <div className="flex items-center gap-4">
        {form.foto_url && (
            <img src={form.foto_url} alt="Preview" className="h-12 w-12 rounded-xl object-cover" />
        )}
        <label className="flex-1 cursor-pointer">
          <span className="button-secondary flex w-full justify-center">
            {form.foto_url ? "Mudar Foto" : "Escolher Foto do PC/Celular"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  const MAX_WIDTH = 400;
                  const MAX_HEIGHT = 400;
                  let width = img.width;
                  let height = img.height;
                  
                  if (width > height) {
                    if (width > MAX_WIDTH) {
                      height *= MAX_WIDTH / width;
                      width = MAX_WIDTH;
                    }
                  } else {
                    if (height > MAX_HEIGHT) {
                      width *= MAX_HEIGHT / height;
                      height = MAX_HEIGHT;
                    }
                  }
                  
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(img, 0, 0, width, height);
                  
                  // Compress to JPEG with 80% quality
                  const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
                  update("foto_url", compressedBase64);
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>
      <div className="flex gap-3 md:col-span-2 xl:col-span-3">
        <button className="button-primary" type="submit">
          {editingPlayer ? (isSelfEdit ? "Salvar meus dados" : "Salvar jogador") : "Cadastrar jogador"}
        </button>
        {editingPlayer ? (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancelar edição
          </button>
        ) : null}
      </div>
    </form>
  );
}
