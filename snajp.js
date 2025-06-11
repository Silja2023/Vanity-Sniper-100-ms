const tls = require("tls");
const WebSocket = require('ws');
const { GatewayIntentBits } = require('discord.js');
const http2 = require('http2');
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
const guilds = new Map();
const claimerToken = 'MTEzNTE1ODIzNTI4NDkxNDE4Ng.GBPNJE.P3oTeCDR6gPAShGI8bFvNckuQQj7qHrGMVh_Uk';
const listToken = 'MTEzNTE1ODIzNTI4NDkxNDE4Ng.GBPNJE.P3oTeCDR6gPAShGI8bFvNckuQQj7qHrGMVh_Uk';
const guildId = "1377288305003073617";
const password = "BRAT2233x";
let mfaToken = null;
let savedTicket = null;
let lastSequence = null;
const BASE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Authorization': claimerToken,
    'Content-Type': 'application/json',
    'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRmlyZWZveCIsImRldmljZSI6IiIsInN5c3RlbV9sb2NhbGUiOiJ0ci1UUiIsImJyb3dzZXJfdXNlcl9hZ2VudCI6Ik1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQ7IHJ2OjEzMy4wKSBHZWNrby8yMDEwMDEwMSBGaXJlZm94LzEzMy4wIiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTMzLjAiLCJvc192ZXJzaW9uIjoiMTAiLCJyZWZlcnJlciI6Imh0dHBzOi8vd3d3Lmdvb2dsZS5jb20vIiwicmVmZXJyaW5nX2RvbWFpbiI6Ind3dy5nb29nbGUuY29tIiwic2VhcmNoX2VuZ2luZSI6Imdvb2dsZSIsInJlZmVycmVyX2N1cnJlbnQiOiIiLCJyZWZlcnJpbmdfZG9tYWluX2N1cnJlbnQiOiIiLCJyZWxlYXNlX2NoYW5uZWwiOiJjYW5hcnkiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjozNTYxNDAsImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGwsImhhc19jbGllbnRfbW9kcyI6ZmFsc2V9'
};
const sessions = new Map();
const MAX_SESSIONS = 200;
const SESSION_SETTINGS = {
    settings: {
        enablePush: false,
        initialWindowSize: 1073741824,
        headerTableSize: 65536,
        maxConcurrentStreams: 1000,
        enableConnectProtocol: false
    },
    maxSessionMemory: 64000
};
const TLS_OPTIONS = {
    rejectUnauthorized: false,
    secureContext: tls.createSecureContext({
        secureProtocol: 'TLSv1_2_method'
    }),
    ALPNProtocols: ['h2']
};
function createSession(index) {
    const session = http2.connect("https://canary.discord.com", {
        ...SESSION_SETTINGS,
        createConnection: () => tls.connect(443, 'canary.discord.com', TLS_OPTIONS)
    });
    session.on('error', () => {
        sessions.delete(index);
        setTimeout(() => createSession(index), 100);
    });
    sessions.set(index, session);
    return session;
}
for (let i = 0; i < MAX_SESSIONS; i++) {
    createSession(i);
}
let sessionIndex = 0;
async function fastHttp2Request(method, path, customHeaders = {}, body = null) {
    return new Promise((resolve, reject) => {
        const session = sessions.get(sessionIndex);
        sessionIndex = (sessionIndex + 1) % MAX_SESSIONS;
        if (!session) {
            reject();
            return;
        }
        const requestHeaders = {
            ...BASE_HEADERS,
            ...customHeaders,
            ":method": method,
            ":path": path,
            ":authority": "canary.discord.com",
            ":scheme": "https"
        };
        const stream = session.request(requestHeaders, { endStream: !body });
        const chunks = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString()));
        stream.on("error", () => {
            stream.destroy();
            reject();
        });

        if (body) stream.end(Buffer.from(body));
    });
}
async function refreshMfaToken() {
    try {
        const response = await fastHttp2Request("PATCH", `/api/v9/guilds/0/vanity-url`);
        const data = JSON.parse(response);
        if (data.code === 60003) {
            savedTicket = data.mfa.ticket;
            const mfaResponse = await fastHttp2Request(
                "POST",
                "/api/v9/mfa/finish",
                { "Content-Type": "application/json" },
                JSON.stringify({
                    ticket: savedTicket,
                    mfa_type: "password",
                    data: password,
                })
            );
            
            const mfaData = JSON.parse(mfaResponse);
            if (mfaData.token) {
                mfaToken = mfaData.token;
                console.log('MFA token refreshed successfully:', mfaToken);
            }
        }
    } catch (error) {
        console.log('Failed to refresh MFA token');
    }
}
setInterval(refreshMfaToken, 300000);
const sockets = new Set();
const MAX_SOCKETS = 15; 
function createWebSocket() {
    const socket = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
    socket.binaryType = 'arraybuffer';
    socket.on('open', () => {
        socket.send(Buffer.from(JSON.stringify({
            op: 2,
            d: {
                token: listToken,
                intents: GatewayIntentBits.Guilds,
                properties: { $os: "linux", $browser: "discord.js", $device: "mobile" }
            }
        })));
    });

    socket.on('message', async (rawData) => {
    try {
        const payload = JSON.parse(rawData);
        if (payload.s) lastSequence = payload.s;
        if (payload.op === 10) {
            setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(Buffer.from(JSON.stringify({ op: 1, d: lastSequence })));
                }
            }, payload.d.heartbeat_interval);
            return;
        }
        if (payload.op === 0 && payload.t === "GUILD_UPDATE") {        
            const find = guilds.get(payload.d.guild_id);
            if (find && find !== payload.d.vanity_url_code) {
                const guildUpdateTime = Date.now(); 
                const promises = [];
                const headers = {
                    "Cookie": `__Secure-recent_mfa=${mfaToken}`,
                    "Content-Type": "application/json"
                };
                
                for (let i = 0; i < 1; i++) {
                    promises.push(fastHttp2Request(
                        "PATCH",
                        `/api/v10/guilds/${guildId}/vanity-url`,
                        headers,
                        JSON.stringify({ code: find })
                    ));
                }
                Promise.race(promises)
                    .then(() => {
                        console.log(`req succes`);
                    })
                    .catch((error) => {
                    });
            }
        } else if (payload.op === 0 && payload.t === "READY") {
            guilds.clear();
            for (const guild of payload.d.guilds) {
                if (guild.vanity_url_code) {
                    guilds.set(guild.id, guild.vanity_url_code);
                    console.log(`Server ID: ${guild.id} | Vanity URL: ${guild.vanity_url_code}`);
                }
            }
        }
    } catch (error) {
    }
});

    socket.on('close', () => {
        sockets.delete(socket);
        if (sockets.size < MAX_SOCKETS) {
            setTimeout(() => {
                const newSocket = createWebSocket();
                sockets.add(newSocket);
            }, 1000);
        }
    });

    return socket;
}
async function initialize() {
    try {
        const response = await fastHttp2Request("PATCH", `/api/v9/guilds/0/vanity-url`);
        const data = JSON.parse(response);
        
        if (data.code === 60003) {
            savedTicket = data.mfa.ticket;
            const mfaResponse = await fastHttp2Request(
                "POST",
                "/api/v9/mfa/finish",
                { "Content-Type": "application/json" },
                JSON.stringify({
                    ticket: savedTicket,
                    mfa_type: "password",
                    data: password,
                })
            );
            
            const mfaData = JSON.parse(mfaResponse);
            if (mfaData.token) mfaToken = mfaData.token;
            console.log('mfasucces', mfaToken);
        }
    } catch {
        setTimeout(initialize, 1000);
    }
}
initialize();
for (let i = 0; i < MAX_SOCKETS; i++) {
    const socket = createWebSocket();
    if (socket) sockets.add(socket);
}
setInterval(async () => {
    try {
        await fastHttp2Request("HEAD", "/");
    } catch {}
}, 30000 + Math.random() * 1000);
