class OpenAIHandler {
    constructor(env) {
        this.env = env;
        this.instruction = "You are an helpful agent about Đồi LLum"
        this.DEFAULT_ERROR_RESPONSE = {
            text: "Bạn vui lòng chờ để nhân viên trực tiếp hỗ trợ",
        };
    }

    waitTillRunComplete = async (thread_id, run_id) => {
        const OPEN_API_TOKEN = await this.env.LARK_QUERIER_KV.get("OPEN_API_TOKEN");
        const statusResponse = await fetch("https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}", {
            method: "get",
            headers: {
                "OpenAI-Beta": "assistants=v1",
                "Authorization": `Bearer ${OPEN_API_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        const data = await statusResponse.json()
        if (["queued", "in_progress"].includes(data.status) === false) {
            console.log("the status is:", data.status);
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
        await this.waitTillRunComplete(thread_id, run_id);
    };

    handle_user_chat = async (chat_id, chat_messeage, thread_id) => {
        const OPEN_API_TOKEN = await this.env.LARK_KV.get("OPEN_API_TOKEN");
        const ASSISTANT_ID = await this.env.LARK_KV.get("ASSISTANT_ID");

        const messages = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
            method: "post",
            headers: {
                "OpenAI-Beta": "assistants=v1",
                "Authorization": `Bearer ${OPEN_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                role: "user",
                content: chat_messeage,
            })
        })
        try {
            const msgObj = await messages.json()
            const runObj = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs`, {
                method: "get",
                headers: {
                    "OpenAI-Beta": "assistants=v1",
                    "Authorization": `Bearer ${OPEN_API_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    assistant_id: ASSISTANT_ID,
                    instructions: this.instruction,
                })
            })
            const run = await runObj.json()
            const runId = run.id;
            await this.waitTillRunComplete(thread_id, runId)
            try {
                const answerObj = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
                    method: "get",
                    headers: {
                        "OpenAI-Beta": "assistants=v1",
                        "Authorization": `Bearer ${OPEN_API_TOKEN}`,
                        "Content-Type": "application/json",
                    }
                })
                const answer = await answerObj.json()
                let x = answer.data[0].content[0].text.value;
                console.log("Raw response: ", x);
                var count = 0;
                while (x.indexOf("【") > -1 && count <= 20) {
                    var len = x.length;
                    var start = x.indexOf("【");
                    var end = x.indexOf("】");
                    count++;
                    x = x.substring(0, start) + x.substring(end + 1, len);
                }
                x = x.replace(/\s\s+/g, " ");
                x = x.replace(" .", ".");

                console.log("Final response: ", x);
                const responseObj = {
                    text: x,
                };
                await this.response_chat(chat_id, JSON.stringify(responseObj));
            } catch (error) {
                console.log(error)
                this.response_chat(chat_id, JSON.stringify(this.DEFAULT_ERROR_RESPONSE));
            }
        } catch (err) {
            console.log(err);
            await this.response_chat(chat_id, JSON.stringify(this.DEFAULT_ERROR_RESPONSE));
        }
    };

    response_chat = async (chat_id, content) => {
        const TENANT_TOKEN = await this.env.LARK_KV.get("TENANT_TOKEN");
        let data = JSON.stringify({
            content: content,
            msg_type: "text",
            receive_id: chat_id,
        });
        const sent = await fetch(`https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id`, {
            method: "post",
            headers: {
                "Authorization": "Bearer " + TENANT_TOKEN,
                "Content-Type": "application/json",
            },
            body: data,
        })
    };

    response_default = async (chat_id) => {
        this.response_chat(chat_id, JSON.stringify(this.DEFAULT_ERROR_RESPONSE))
    }
}

export default OpenAIHandler;
