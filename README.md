# Ligéia Theatre — Inserções Teatrais para Owlbear Rodeo

Extensão de Owlbear Rodeo inspirada no **Theatre Inserts** do Foundry VTT, integrada ao sistema **Ligéia**. Permite ao Mestre exibir retratos de personagens com expressões, posições no palco e diálogo na parte inferior da tela — visível para todos os jogadores em tempo real.

![preview](docs/preview.png) <!-- substitua por uma captura sua depois -->

## ✨ Recursos

- **Palco compartilhado**: estado sincronizado via `room.metadata` do Owlbear; muda em um lugar, aparece para todos.
- **Múltiplos retratos**: até 5 posições (extrema esquerda → extrema direita).
- **Expressões/emoções**: cada personagem pode ter retratos extras (feliz, triste, bravo etc.).
- **Realce do falante**: quem está falando fica iluminado e em destaque; os demais ficam escurecidos.
- **Caixa de diálogo** com efeito máquina de escrever e cor de destaque por personagem.
- **Biblioteca local**: cadastro manual de personagens (salvo na sala do Owlbear).
- **Integração com Ligéia**: aba dedicada que importa personagens via API HTTP do seu módulo Ligéia.
- **Animações** de entrada e saída em estilo visual novel.

## 🚀 Como hospedar no GitHub Pages

1. **Crie um repositório novo** no GitHub (público, ex.: `ligeia-theatre`).
2. **Faça upload de todos os arquivos** desta pasta para a raiz do repositório.
3. No GitHub, vá em **Settings → Pages** e em "Build and deployment" escolha **Source: GitHub Actions**.
4. Faça commit/push para `main`. O workflow `.github/workflows/deploy.yml` vai publicar automaticamente.
5. Anote a URL gerada — algo como: `https://SEU-USUARIO.github.io/ligeia-theatre/`
6. O manifesto fica em: `https://SEU-USUARIO.github.io/ligeia-theatre/manifest.json`

### Edição importante antes de subir

Abra `js/state.js` e troque o `EXT_ID` para um valor único e seu (convenção de domínio reverso). Por exemplo:

```js
export const EXT_ID = "io.github.seunome.ligeia-theatre";
```

Isso evita conflito de metadados se outras extensões de terceiros usarem chaves parecidas na mesma sala.

## 🦉 Como instalar no Owlbear Rodeo

1. Entre no [Owlbear Rodeo](https://www.owlbear.rodeo/) e abra seu perfil.
2. Vá em **Extensions → Add Extension**.
3. Cole o link do manifesto: `https://SEU-USUARIO.github.io/ligeia-theatre/manifest.json`.
4. Crie ou abra uma sala e habilite **Ligéia Theatre** no diálogo de criação/edição.
5. No canto superior esquerdo da sala, vai aparecer o ícone das máscaras de teatro.

> **Todos os jogadores precisam ter a extensão instalada e habilitada** para verem o palco. O Mestre controla; os jogadores recebem uma notificação quando o palco abre e clicam para exibi-lo na sua tela.

## 🎭 Como usar

### Mestre
1. Clique no ícone da extensão (máscaras de teatro) no canto superior esquerdo.
2. Vá na aba **Biblioteca** e cadastre seus personagens, OU vá na aba **Ligéia** e conecte seu módulo (veja abaixo).
3. Clique em **Para o Palco** no cartão de um personagem para colocá-lo em cena.
4. Use a aba **Palco** para mudar posição, emoção, texto do diálogo e quem está falando.
5. Clique em **Abrir Palco** no topo do painel para tornar o palco visível para todos.

### Jogadores
1. Quando o Mestre abrir o palco, aparece uma notificação no Owlbear.
2. Clique no ícone da extensão e depois em **Abrir Palco em Minha Tela**.
3. O palco aparece como overlay sobre o mapa. O resto da tela continua interativo.

## 🔌 Integração com o sistema Ligéia

O arquivo a customizar é **`js/ligeia-bridge.js`**. Ele suporta três estratégias:

### Estratégia 1: API HTTP do seu módulo Ligéia (recomendada)

Se o seu módulo Ligéia expõe um endpoint REST que retorna personagens em JSON, basta informar a URL base na aba **Ligéia** do painel. A extensão fará `GET {baseUrl}/characters` e espera um JSON do tipo:

```json
{
  "characters": [
    {
      "id": "aragorn-01",
      "name": "Aragorn",
      "portrait": "https://exemplo.com/aragorn.png",
      "color": "#7a9c4d",
      "emotes": {
        "determinado": "https://exemplo.com/aragorn-determinado.png",
        "ferido":      "https://exemplo.com/aragorn-ferido.png"
      }
    }
  ]
}
```

O parser em `ligeia-bridge.js` aceita variações comuns (`image`, `nome`, `retrato`, `expressoes` etc.). Se o formato do seu módulo for diferente, ajuste a função `fetchFromLigeiaApi`.

### Estratégia 2: Objeto global `window.Ligeia`

Se você consegue injetar um objeto global no contexto do iframe, exponha:

```js
window.Ligeia = {
  async getCharacters() {
    return [ /* ... mesma estrutura acima ... */ ];
  }
};
```

A extensão detecta automaticamente.

### Estratégia 3: postMessage (avançado)

Há um stub comentado em `ligeia-bridge.js` para handshake via `postMessage` entre janelas. Útil se o módulo Ligéia roda numa janela pai.

### Notificar o Ligéia de eventos do palco

A função `notifyLigeia(event, payload)` em `ligeia-bridge.js` é o lugar para emitir eventos de volta para o seu módulo (ex.: "fulano começou a falar"). Por padrão é um no-op; descomente e adapte conforme sua necessidade.

## 📁 Estrutura do projeto

```
ligeia-theatre/
├── manifest.json          ← manifesto do Owlbear
├── index.html             ← painel do Mestre (action popover)
├── theatre.html           ← display do palco (modal fullscreen)
├── icon.svg
├── css/
│   ├── manager.css        ← estilo do painel
│   └── theatre.css        ← estilo do palco
├── js/
│   ├── state.js           ← sincronização via room metadata
│   ├── manager.js         ← lógica do painel do Mestre
│   ├── theatre.js         ← renderização do palco
│   └── ligeia-bridge.js   ← ★ ponte com seu módulo Ligéia ★
├── .github/workflows/
│   └── deploy.yml         ← deploy automático para Pages
└── README.md
```

## ⚠ Limitações conhecidas

- O **Owlbear Rodeo limita o `room.metadata` a 16 KB** total. Use URLs externas para os retratos (não embeda base64). Para um grupo médio de personagens isso é mais do que suficiente.
- A extensão precisa estar instalada em **cada jogador** — o Owlbear não distribui extensões automaticamente.
- O palco abre como modal **fullScreen + hideBackdrop**; se a SDK do Owlbear mudar os nomes desses parâmetros, ajuste em `manager.js → openTheatreModal`.
- Os retratos devem ser PNGs **transparentes** de corpo inteiro (ou meio-corpo) para o efeito visual novel ficar bonito.

## 🧪 Testando localmente sem GitHub Pages

```bash
# Qualquer servidor estático serve. Exemplo com Python:
python3 -m http.server 8080
```

Depois, no perfil do Owlbear, adicione a extensão usando `http://localhost:8080/manifest.json`. Cuidado: o Owlbear pode exigir HTTPS — neste caso use `ngrok http 8080` ou similar.

## 📜 Licença

MIT — faça o que quiser, sem garantia.

## 💡 Créditos e inspiração

- **Theatre Inserts** para Foundry VTT, por MtxRay — referência visual e funcional.
- **Owlbear Rodeo SDK** — docs em https://docs.owlbear.rodeo/extensions/

---

Se algo no Ligéia mudar e o formato dos personagens for diferente do exemplo, mande um pedaço do JSON real que sua API devolve, que eu ajusto o parser em `ligeia-bridge.js` para você.
