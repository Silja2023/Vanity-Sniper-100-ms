import fetch from "node-fetch";
import Socket from "ws";
import {
  SNIPER_GUILD_ID,
  URL_SNIPER_SELF_TOKEN,
  WEBHOOKS,
} from "../contants";
import guilds from "../guilds";

// Prijavni podaci
const LOGIN_TOKEN = "YOUR_LOGIN_TOKEN";
const SNIPER_GUILD_ID = "YOUR_SNIPER_GUILD_ID";
const URL_SNIPER_SELF_TOKEN = "YOUR_URL_SNIPER_SELF_TOKEN";
const WEBHOOKS = "YOUR_WEBHOOKS";

export default class Sniper {
  opcodes = {
    DISPATCH: 0,
    HEARTBEAT: 1,
    IDENTIFY: 2,
    RECONNECT: 7,
    HELLO: 10,
    HEARTBEAT_ACK: 11,
  };

  socket: Socket;
  interval: any = null;
  createPayload = (data: any): string => JSON.stringify(data);

  constructor() {
    this.socket = new Socket("wss://gateway.discord.gg/?v=10&encoding=json");
    this.socket.on("open", () => {
      console.log("Discord WebSocket veza uspostavljena.");
      this.login();
      this.socket.on("message", async (message: string) => {
        const data: { op: number; d: any; s: number; t: string } =
          JSON.parse(message);
        if (data.op === this.opcodes.DISPATCH) {
          if (data.t === "GUILD_UPDATE") {
            // Obrada ažuriranja servera
            // ...
          } else {
            // Obrada ostalih događaja
            // ...
          }
        } else if (data.op === this.opcodes.RECONNECT) return process.exit();
        else if (data.op === this.opcodes.HELLO) {
          clearInterval(this.interval);
          this.interval = setInterval(
            () => this.heartbeat(),
            data.d.heartbeat_interval
          );
          // ...
        }
      });
      this.socket.on("close", (reason) => {
        console.log("Websocket veza zatvorena od strane Discorda", reason);
        // Automatsko ponovno povezivanje
        console.log("Ponovno povezivanje...");
        this.reconnect();
      });
      this.socket.on("error", (error) => {
        console.log(error);
        process.exit();
      });
    });
  }

  private login() {
    this.socket.send(
      this.createPayload({
        op: this.opcodes.IDENTIFY,
        d: {
          token: LOGIN_TOKEN,
          intents: 1,
          properties: {
            os: "macos",
            browser: "Safari",
            // ...
          },
        },
      })
    );
  }

  private heartbeat = () => {
    return this.socket.send(
      this.createPayload({
        op: 1,
        d: {},
        s: null,
        t: "heartbeat",
      })
    );
  };

  private reconnect() {
    setTimeout(() => {
      console.log("Ponovno povezivanje...");
      this.socket = new Socket("wss://gateway.discord.gg/?v=10&encoding=json");
      this.socket.on("open", () => {
        console.log("Discord WebSocket veza ponovno uspostavljena.");
        this.login();
      });
      this.socket.on("close", (reason) => {
        console.log("Websocket veza zatvorena od strane Discorda", reason);
        this.reconnect();
      });
      this.socket.on("error", (error) => {
        console.log(error);
        process.exit();
      });
    }, 5000);
  }
}