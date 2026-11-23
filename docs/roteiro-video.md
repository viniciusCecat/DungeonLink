# Roteiro do Vídeo (3 a 5 minutos) — DungeonLink

**Meta de tempo:** ~4 minutos.  
**Regra do professor:** o vídeo precisa mostrar **a placa na protoboard e o celular funcionando juntos ao vivo**, não só código na tela.

---

## Antes de começar a gravar

- ESP32 ligado na USB (ou power bank) com o código já gravado.
- Celular Android com o app **DungeonLink** aberto e Bluetooth ligado, mas **ainda desconectado** do ESP32.
- Enquadre a protoboard e a tela do celular lado a lado (ou grave a tela do celular e junte com a filmagem da mesa).
- Tenha o dedo ou uma tampinha escura pronta para cobrir o sensor de luz (LDR).

---

## Passo a passo da gravação

### 0:00 – 0:30 | Apresentação rápida
- Diga o nome do grupo (**Vinicius Cecatto e Leonardo Scheffer Nunes**) e o que o projeto faz: um jogo 2D no celular controlado por sensores reais via Bluetooth.
- Mostre na câmera as peças na protoboard: **ESP32**, **sensor LDR** (`D34`), **botão** (`D27`), **LED vermelho** (`D26`) e o **LED azul da placa** piscando esperando conexão.

### 0:30 – 1:10 | Teste sem celular e sem internet (R1 e R2)
- Mostre que o app ainda está **Desconectado** e não há internet envolvida.
- **Tampe o LDR:** mostre o **LED vermelho acendendo sozinho** na protoboard.
- **Destampe o LDR:** mostre o **LED vermelho apagando**.
- Explique em uma frase: o próprio ESP32 decide sozinho quando acender o LED usando média das leituras e histerese para não ficar piscando.

### 1:10 – 1:50 | Conexão Bluetooth e troca claro/escuro ao vivo (R3 e R5)
- Toque em **Conectar ESP32** no celular e escolha **DungeonLink-ESP32**.
- Mostre o LED azul da placa parando de piscar (fica aceso direto) e o app mostrando **BLE Conectado** e a % de luz na barra de cima.
- **Tampe o LDR com o jogo aberto:** mostre a tela do jogo mudando de **Modo Claro** para **Modo Sombrio** (com luz de tocha ao redor do personagem) e o LED vermelho acendendo junto na protoboard. Destampe para voltar ao normal.

### 1:50 – 2:50 | Botão físico, jogo completo e piscadas de confirmação
- **Aperte o botão na protoboard:** mostre uma nova fase carregando no celular e o **LED vermelho piscando 3 vezes** na placa para confirmar.
- Jogue até o fim:
  1. Na **Sala 1**, ande até a porta dourada à direita.
  2. Na **Sala 2**, derrote o inimigo com o botão **ATACAR** para destravar o portal.
  3. Entre no **Portal Final** → mostre a tela de **Vitória** e o **LED vermelho piscando 5 vezes** na protoboard.

### 2:50 – 3:35 | Gráfico, modo manual e bloqueio de ataque (Segurança +10%)
- Abra a aba **Telemetria & Gráfico** e mostre a linha de luz em tempo real com a faixa de histerese e a tabela abaixo.
- Abra a aba **BLE & Segurança**:
  1. Mude para **Modo MANUAL** e ligue/apague o LED pelo botão do app (mostrando o LED físico obedecendo); depois volte para **Modo AUTO**.
  2. Toque em **Testar Segurança (HMAC Invalido)** → mostre no log que o ESP32 rejeitou o comando falso com `AUTH_FAILED` e não mexeu no LED.

### 3:35 – 4:00 | Fechamento
- Feche resumindo que o sistema liga mundo físico e jogo nos dois sentidos, funciona offline quando precisa e protege os comandos com senha/assinatura fora do GitHub.
