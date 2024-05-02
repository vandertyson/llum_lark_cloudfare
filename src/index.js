/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import OpenAIHandler from "openai.js"
import AESCipher from "cipher.js"
// import AESCipher from "aes.js"
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      console.log(`Receive request at path ${url.pathname} from ${navigator.userAgent}`);
      if (url.pathname === "/verify") {
        const LARK_BOT_KEY = await env.LARK_KV.get("LARK_BOT_KEY");
        let req = await request.json()
        console.log(`Encoded request`, req);
        const cipher = new AESCipher(LARK_BOT_KEY);        
        let encoded = req.encrypt
        let decoded = await cipher.decrypt(encoded);
        console.log("Decode request ", decoded)
        const decript = JSON.parse(decoded);
        console.log("decript object ", decript)
        if (decript.challenge) {
          const data = {
            challenge: decript.challenge,
          };
          return new Response(JSON.stringify(data))
        }
        let handler = new OpenAIHandler(env)
        if (decript.event) {
          const chat_id = decript.event.message.chat_id;
          const chat_messeage = JSON.parse(decript.event.message.content).text;
          console.log("Receive chat message. chat_id: ", chat_id, " ,chat_message: ", chat_messeage)
          let thread_id = await env.OPENAI_THREAD_KV.get(chat_id);          
          try {
            if (thread_id) {
              console.log("get cached thread from KV. chat_id: ", chat_id, ", thread_id: ", thread_id);
              handler.handle_user_chat(chat_id, chat_messeage, thread_id);
            } else {
              const OPEN_API_TOKEN = await env.LARK_KV.get("OPEN_API_TOKEN");
              const answerObj = await fetch(`https://api.openai.com/v1/threads`, {
                method: "post",
                headers: {
                  "OpenAI-Beta": "assistants=v1",
                  "Authorization": `Bearer ${OPEN_API_TOKEN}`,
                  "Content-Type": "application/json",
                }
              })
              const answer = await answerObj.json()
              thread_id = answer.data.id;
              console.log("create new thread. chat_id: ", chat_id, ", thread_id: ", thread_id);
              await env.OPENAI_THREAD_KV.put(chat_id, thread_id);
              await handler.handle_user_chat(chat_id, chat_messeage, thread_id)
            }
          } catch (error) {
            console.log(error)
            await handler.response_default(chat_id);
          }
        }
        return new Response(LARK_BOT_KEY, {
          status: 2000
        })
      }
    } catch (error) {
      console.log(error)
      return new Response(error, {
        status: 500
      })
    }
  }
};