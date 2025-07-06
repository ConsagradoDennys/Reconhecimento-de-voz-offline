// app.js

// Referências aos elementos HTML
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDisplay = document.getElementById('status');
const partialResultDisplay = document.getElementById('partialResult');
const transcriptionLog = document.getElementById('transcriptionLog');

// Variáveis para o contexto de áudio e reconhecedor Vosk
let audioContext;
let mediaStreamSource;
let recognizerNode; // Usaremos AudioWorkletNode
let voskModel;
let kaldiRecognizer;
let isListening = false;

// Caminho para o seu modelo Vosk.
// Certifique-se de que a pasta do modelo descompactado esteja em 'models/model.tar.gz'
// ou ajuste o caminho para o nome da pasta descompactada, por exemplo, 'models/vosk-model-small-pt-br-0.2'
const MODEL_PATH = 'models/vosk-model-small-pt-br-0.2'; // Exemplo para português do Brasil

// Função para inicializar o modelo Vosk
async function initializeVosk() {
    statusDisplay.textContent = "Carregando modelo Vosk...";
    startButton.disabled = true;
    stopButton.disabled = true;

    try {
        // Carregar o modelo Vosk
        // Vosk é acessível globalmente via CDN
        voskModel = await Vosk.createModel(MODEL_PATH); // [3]
        statusDisplay.textContent = "Modelo Vosk carregado. Pronto para iniciar.";
        startButton.disabled = false;
    } catch (error) {
        statusDisplay.textContent = `Erro ao carregar o modelo Vosk: ${error.message}. Verifique o caminho do modelo e se está sendo servido por um servidor web.`; // [3]
        console.error('Erro ao carregar o modelo Vosk:', error);
    }
}

// Função para iniciar o reconhecimento
async function startListening() {
    if (isListening) return;

    statusDisplay.textContent = "Solicitando acesso ao microfone...";
    try {
        // Solicitar acesso ao microfone [3]
        const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                channelCount: 1,
                sampleRate: 16000 // Taxa de amostragem comum para reconhecimento de fala [4, 3]
            },
        });

        audioContext = new AudioContext(); // [3]
        mediaStreamSource = audioContext.createMediaStreamSource(mediaStream); // [3]

        // Criar uma nova instância do reconhecedor a partir do modelo carregado [3]
        kaldiRecognizer = new voskModel.KaldiRecognizer(); // [3]

        // Configurar manipuladores de eventos para o reconhecedor [3]
        kaldiRecognizer.on('partialresult', (message) => { // [3]
            partialResultDisplay.textContent = message.result.partial; // [3]
        });

        kaldiRecognizer.on('result', (message) => { // [3]
            const finalTranscript = message.result.text; // [3]
            if (finalTranscript.trim()!== '') { // Evita registrar resultados vazios
                const now = new Date();
                const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                logEntry.innerHTML = `<strong>[${timestamp}]</strong> ${finalTranscript}`;
                transcriptionLog.appendChild(logEntry);
                transcriptionLog.scrollTop = transcriptionLog.scrollHeight; // Rolagem automática para o final
            }
            partialResultDisplay.textContent = ''; // Limpa o resultado parcial após o resultado final
        });

        kaldiRecognizer.on('error', (error) => { // [3]
            statusDisplay.textContent = `Erro no reconhecimento: ${error.message}`;
            console.error('Erro no reconhecimento de fala:', error);
            stopListening(); // Parar a escuta em caso de erro
        });

        // Usar AudioWorkletNode para processamento de áudio em um thread separado (melhor desempenho)
        // Requer um arquivo audio-processor.js separado
        await audioContext.audioWorklet.addModule('audio-processor.js');
        recognizerNode = new AudioWorkletNode(audioContext, 'recognizer-processor');
        recognizerNode.port.onmessage = (event) => {
            // O AudioWorklet envia os dados de áudio para o thread principal
            // e então os passamos para o reconhecedor Vosk
            kaldiRecognizer.acceptWaveform(event.data); // [4, 3]
        };

        mediaStreamSource.connect(recognizerNode);
        recognizerNode.connect(audioContext.destination); // Conecta para ouvir o que está sendo gravado (opcional, pode ser removido)

        isListening = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        statusDisplay.textContent = "Ouvindo...";
        console.log("Pronto para receber comandos de voz.");

    } catch (error) {
        statusDisplay.textContent = `Erro ao iniciar: ${error.message}. Verifique as permissões do microfone.`;
        console.error('Erro ao iniciar o reconhecimento:', error);
        startButton.disabled = false;
        stopButton.disabled = true;
    }
}

// Função para parar o reconhecimento
function stopListening() {
    if (!isListening) return;

    if (mediaStreamSource && mediaStreamSource.mediaStream) {
        mediaStreamSource.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (recognizerNode) {
        recognizerNode.disconnect();
        recognizerNode = null;
    }
    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (kaldiRecognizer) {
        kaldiRecognizer.terminate(); // Libera recursos do reconhecedor [3]
        kaldiRecognizer = null;
    }
    // O modelo Vosk pode ser mantido carregado se a página for usada repetidamente,
    // mas para liberar todos os recursos, você pode chamar voskModel.terminate()
    // if (voskModel) {
    //     voskModel.terminate(); // Libera recursos do modelo [3]
    //     voskModel = null;
    // }

    isListening = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDisplay.textContent = "Parado.";
    partialResultDisplay.textContent = ''; // Limpa o resultado parcial ao parar
    console.log("Reconhecimento de voz parado.");
}

// Adicionar ouvintes de evento aos botões
startButton.addEventListener('click', startListening); // [5, 6]
stopButton.addEventListener('click', stopListening); // [5, 6]

// Inicializar o modelo Vosk quando a página carregar
window.onload = initializeVosk;