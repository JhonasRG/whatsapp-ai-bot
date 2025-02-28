require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const geminikey = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(geminikey);

const client = new Client({
    authStrategy: new LocalAuth({ clientId: process.env.WHATSAPP_CLIENT_ID }),
    puppeteer: { 
        headless: true, 
        args: [
            '--start-maximized',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-web-security',
            '--disable-site-isolation-trials',
            '--no-experiments',
            '--ignore-gpu-blacklist',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-default-apps',
            '--enable-features=NetworkService',
            '--disable-setuid-sandbox',
            '--no-sandbox'
        ], 
    }
});

const HISTORICO_FILE = process.env.HISTORICO_FILE;
const chatsIgnorados = new Set();

function carregarHistorico() {
    if (fs.existsSync(HISTORICO_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf8'));
    }
    return {};
}

function salvarHistorico() {
    try {
        fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historicoMensagens, null, 2));
    } catch (error) {
        console.log('Erro ao salvar os dados:', error);
    }
}

let historicoMensagens = carregarHistorico();

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente WhatsApp pronto!');
});

client.on('message', async (message) => {
    if (message.from.endsWith('@c.us')) {
        const numero = message.from;
        const mensagem = message.body;

        if (!historicoMensagens[numero]) {
            client.sendMessage(numero, 'Como você gostaria de ser tratado(a)?\nEscreva: Preferência de Tratamento: <Tratamento>');
        }

        if (mensagem.toLowerCase().includes('preferência de tratamento:')) {
            const preferencia_de_tratamento = mensagem.split(':')[1].trim();
            historicoMensagens[numero] = {
                tratamento: preferencia_de_tratamento,
                historico: []
            };
            salvarHistorico();
            client.sendMessage(numero, `Agora sei como te tratar! Seu tratamento preferido é: ${preferencia_de_tratamento}`);
        }

        if (!historicoMensagens[numero]) {
            historicoMensagens[numero] = { tratamento: '', historico: [] };
        }
        historicoMensagens[numero].historico.push(mensagem);
        salvarHistorico();

        const mensagemUsuario = message.body.trim();
        
        let contexto = '';
        let preferencia_de_tratamento = '';
        
        if (historicoMensagens[numero]) {
            contexto = historicoMensagens[numero].historico.join(" ");
            preferencia_de_tratamento = historicoMensagens[numero].tratamento;
        }

        const prompt = ` SEU PROMPT AQUI:
${preferencia_de_tratamento}
${contexto}
${mensagemUsuario}
`;

        try {
            const model = genAI.getGenerativeModel({ model: "MODELO DE LINGUAGEM DE SUA PREFERÊNCIA" });
            const result = await model.generateContent(prompt);
            let resposta = result.response.text().trim();
            await client.sendMessage(numero, resposta);

        } catch (error) {
            console.error('Erro ao gerar resposta:', error);
            await client.sendMessage(numero, 'Não consegui gerar uma resposta.');
        }
    }
});

client.initialize();
