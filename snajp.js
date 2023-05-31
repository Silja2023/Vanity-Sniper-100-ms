"use strict";
const fetch = require("node-fetch");
const WebSocket = require("ws");

const guilds = {};

class Sniper {
  constructor(guildId, selfToken, vanityUrlCodes) {
    this.opcodes = {
      DISPATCH: 0,
      HEARTBEAT: 1,
      IDENTIFY: 2,
      RECONNECT: 7,
      HELLO: 10,
      HEARTBEAT_ACK: 11,
    };
    this.interval = null;
    this.createPayload = (data) => JSON.stringify(data);
    this.heartbeat = () => {
      this.socket.send(
        this.createPayload({
          op: 1,
          d: {},
          s: null,
          t: "heartbeat",
        })
      );
    };
    this.processGuildUpdate = async (data) => {
      const find = guilds[data.d.guild_id];
      if (typeof find?.vanity_url_code === "string" && find.vanity_url_code !== data.d.vanity_url_code) {
        const startTime = Date.now(); // Vrijeme početka snajpovanja
        try {
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/vanity-url`, {
            method: "PATCH",
            body: this.createPayload({
              code: find.vanity_url_code,
            }),
            headers: {
              Authorization: selfToken,
              "Content-Type": "application/json",
            },
          });
          const endTime = Date.now(); // Vrijeme završetka snajpovanja
          const elapsedMs = endTime - startTime; // Vrijeme u ms koje je bilo potrebno za snajpovanje
          if (res.ok) {
            console.log(`URL: https://discord.gg/${find.vanity_url_code} successfully received. Snajpovano u ${elapsedMs} ms.`);
          } else {
            const error = await res.json();
            console.log(`Error while sniping url: **\`${find.vanity_url_code}\`**.\nJSON\n${JSON.stringify(error, null, 4)}`);
          }
        } catch (err) {
          console.log(err);
        }
        delete guilds[data.d.guild_id];
      }
    };
    this.socket = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
    this.socket.on("open", () => {
      console.log("Discord WebSocket connection opened.");
    });
    this.socket.on("message", async (message) => {
      const data = JSON.parse(message);
      if (data.op === this.opcodes.DISPATCH) {
        if (data.t === "GUILD_UPDATE") {
          await this.processGuildUpdate(data);
        } else {
          if (data.t === "READY") {
            data.d.guilds
              .filter((e) => typeof e.vanity_url_code === "string")
              .forEach((e) => (guilds[e.id] = { vanity_url_code: e.vanity_url_code }));
            console.log(
              `Client is ready with: ${Object.keys(guilds).length} urls to be sniped.\n${Object.entries(guilds)
                .map(([key, value]) => {
                  return `\`${value.vanity_url_code}\``;
                })
                .join(", ")}`
            );
          } else if (data.t === "GUILD_CREATE") {
            guilds[data.d.id] = { vanity_url_code: data.d.vanity_url_code };
          } else if (data.t === "GUILD_DELETE") {
            const find = guilds[data.d.id];
            setTimeout(async () => {
              if (typeof find?.vanity_url_code === "string") {
                const startTime = Date.now(); // Vrijeme početka snajpovanja
                try {
                  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/vanity-url`, {
                    method: "PATCH",
                    body: this.createPayload({
                      code: find.vanity_url_code,
                    }),
                    headers: {
                      Authorization: selfToken,
                      "Content-Type": "application/json",
                    },
                  });
                  const endTime = Date.now(); // Vrijeme završetka snajpovanja
                  const elapsedMs = endTime - startTime; // Vrijeme u ms koje je bilo potrebno za snajpovanje
                  if (res.ok) {
                    console.log(`URL: \`${find.vanity_url_code}\` is successfully sniped. Snajpovano u ${elapsedMs} ms.`);
                  } else {
                    const error = await res.json();
                    console.log(`Error while sniping url: **\`${find.vanity_url_code}\`**.\nJSON\n${JSON.stringify(error, null, 4)}`);
                  }
                } catch (err) {
                  console.log(err);
                }
                delete guilds[data.d.guild_id];
              }
            }, 25);
          }
        }
      } else if (data.op === this.opcodes.RECONNECT) {
        process.exit();
      } else if (data.op === this.opcodes.HELLO) {
        clearInterval(this.interval);
        this.interval = setInterval(() => this.heartbeat(), data.d.heartbeat_interval);
        this.socket.send(
          this.createPayload({
            op: this.opcodes.IDENTIFY,
            d: {
              token: selfToken,
              intents: 1,
              properties: {
                os: "macos",
                browser: "Safari",
                device: "MacBook Air",
              },
            },
          })
        );
      }
    });
    this.socket.on("close", (reason) => {
      console.log("WebSocket connection closed by Discord.", reason);
      process.exit();
    });
    this.socket.on("error", (error) => {
      console.log(error);
      process.exit();
    });
    
    // Snipe vanity URLs
    this.snipeVanityURLs(vanityUrlCodes);
  }
  
  async snipeVanityURLs(vanityUrlCodes) {
    const startTime = Date.now(); // Start time for sniping
    const patchRequests = vanityUrlCodes.map((code) => {
      return fetch(`https://discord.com/api/v10/guilds/${guildId}/vanity-url`, {
        method: "PATCH",
        body: this.createPayload({
          code: code,
        }),
        headers: {
          Authorization: selfToken,
          "Content-Type": "application/json",
        },
      });
    });

    try {
      const responses = await Promise.all(patchRequests);
      const endTime = Date.now(); // End time for sniping
      const elapsedMs = endTime - startTime; // Time in ms taken for sniping
      
      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const code = vanityUrlCodes[i];
        
        if (res.ok) {
          console.log(`URL: https://discord.gg/${code} successfully received. Snajpovano u ${elapsedMs} ms.`);
        } else {
          const error = await res.json();
          console.log(`Error while sniping url: **\`${code}\`**.\nJSON\n${JSON.stringify(error, null, 4)}`);
        }
      }
    } catch (err) {
      console.log(err);
    }
  }
}

const guildId = "GUILD WHERE YOU WANT TO SNIPE";
const selfToken = "YOUR TOKEN";
const vanityUrlCodes = ["VANITY_URL_1", "VANITY_URL_2", "VANITY_URL_3"]; // Add vanity URL codes to snipe here you must be in these servers to snipe vanity

const sniper = new Sniper(guildId, selfToken, vanityUrlCodes);
