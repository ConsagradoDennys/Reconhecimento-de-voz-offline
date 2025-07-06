// audio-processor.js
// Este script é executado em um AudioWorklet, um thread separado para processamento de áudio.

class RecognizerProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        // inputs contém os dados de áudio do microfone
        const input = inputs;

        // Se houver dados de áudio, envie-os para o thread principal
        if (input && input.length > 0) {
            // Assumimos um único canal de áudio (mono)
            const audioData = input;
            this.port.postMessage(audioData);
        }

        // Retorne true para continuar o processamento
        return true;
    }
}

// Registre o processador com um nome único
registerProcessor('recognizer-processor', RecognizerProcessor);