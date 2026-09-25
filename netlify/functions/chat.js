const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Gemini-Key",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async function(event, context) {
    // 1. Xử lý preflight CORS request
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    // 2. Chỉ chấp nhận phương thức POST
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: "Method Not Allowed" })
        };
    }

    try {
        let bodyObj = {};
        try {
            bodyObj = JSON.parse(event.body || "{}");
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Dữ liệu gửi lên không đúng định dạng JSON." })
            };
        }

        const { prompt, customApiKey } = bodyObj;
        if (!prompt || typeof prompt !== "string") {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Thiếu nội dung prompt." })
            };
        }

        // ==========================================
        // 3. THU THẬP VÀ XOAY VÒNG API KEYS (KEY POOL)
        // ==========================================
        let geminiKeys = [];

        // Nếu người chơi tự cung cấp Custom Key trong Settings
        if (customApiKey && typeof customApiKey === "string" && customApiKey.trim().length > 10) {
            geminiKeys.push(customApiKey.trim());
        } else {
            // Lấy từ danh sách đa Key GEMINI_API_KEYS hoặc GEMINI_API_KEY
            const envKeysRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
            const parsedKeys = envKeysRaw
                .split(/[\n,;]+/)
                .map(k => k.trim())
                .filter(k => k.length > 10);

            geminiKeys = parsedKeys;
        }

        // Xáo trộn ngẫu nhiên thứ tự Key để cân bằng tải (Load Balancing)
        if (geminiKeys.length > 1) {
            geminiKeys = geminiKeys.sort(() => Math.random() - 0.5);
        }

        const groqKey = (process.env.GROQ_API_KEY || "").trim();
        const openRouterKey = (process.env.OPENROUTER_API_KEY || "").trim();

        if (geminiKeys.length === 0 && !groqKey && !openRouterKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: "Chưa cấu hình GEMINI_API_KEY hoặc GEMINI_API_KEYS trên Netlify. Bạn cũng có thể vào Cài đặt để nhập Key cá nhân."
                })
            };
        }

        // Cấu hình payload chuẩn cho Google Gemini
        const geminiPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 250
            }
        };

        // Danh sách các model Gemini chính thức của Google (sắp xếp theo độ ưu tiên)
        const geminiModels = [
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro"
        ];

        let aiReply = "";
        let lastError = "";

        // ==========================================
        // 4. THỬ GỌI GOOGLE GEMINI (VỚI KEY POOL + MODEL FALLBACK)
        // ==========================================
        for (const apiKey of geminiKeys) {
            if (aiReply) break;

            for (const model of geminiModels) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout cho mỗi request

                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(geminiPayload),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    const data = await res.json();

                    if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                        const rawText = data.candidates[0].content.parts[0].text.trim();
                        // Nếu bị ngắt cụt giữa chừng do Safety filter (chỉ ra vài ký tự đầu)
                        if (data.candidates[0]?.finishReason === "SAFETY" && rawText.length < 25) {
                            aiReply = "Tôi không muốn đôi co với những lời lẽ như vậy. Xin thám tử hãy giữ lịch sự và tập trung vào vụ án!";
                        } else {
                            aiReply = rawText;
                        }
                        break;
                    }

                    if (data.candidates && data.candidates[0]?.finishReason === "SAFETY") {
                        aiReply = "Tôi không muốn đôi co với những lời lẽ như vậy. Xin thám tử hãy giữ lịch sự và tập trung vào vụ án!";
                        break;
                    }

                    const errMsg = data.error?.message || `Lỗi HTTP ${res.status}`;
                    lastError = errMsg;

                    // Nếu key này bị 429 Quota Exceeded -> thoát vòng lặp model để thử ngay Key tiếp theo trong Pool
                    if (res.status === 429 || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("resourceexhausted")) {
                        break;
                    }
                } catch (err) {
                    clearTimeout(timeoutId);
                    lastError = err.name === "AbortError" ? "Quá thời gian phản hồi từ máy chủ AI." : err.message;
                }
            }
        }

        // ==========================================
        // 5. CỨU CÁNH DỰ PHÒNG: GROQ AI (NẾU GEMINI NGHẼN HOÀN TOÀN)
        // ==========================================
        if (!aiReply && groqKey) {
            const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
            for (const gModel of groqModels) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);

                try {
                    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${groqKey}`
                        },
                        body: JSON.stringify({
                            model: gModel,
                            messages: [{ role: "user", content: prompt }],
                            temperature: 0.7,
                            max_tokens: 250
                        }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    const data = await res.json();
                    if (res.ok && data.choices && data.choices[0]?.message?.content) {
                        aiReply = data.choices[0].message.content;
                        break;
                    }
                } catch (err) {
                    clearTimeout(timeoutId);
                    lastError = "Groq fallback: " + err.message;
                }
            }
        }

        // ==========================================
        // 6. CỨU CÁNH DỰ PHÒNG 2: OPENROUTER
        // ==========================================
        if (!aiReply && openRouterKey) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            try {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openRouterKey}`
                    },
                    body: JSON.stringify({
                        model: "google/gemini-2.0-flash-exp:free",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.7,
                        max_tokens: 250
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await res.json();
                if (res.ok && data.choices && data.choices[0]?.message?.content) {
                    aiReply = data.choices[0].message.content;
                }
            } catch (err) {
                clearTimeout(timeoutId);
                lastError = "OpenRouter fallback: " + err.message;
            }
        }

        // ==========================================
        // 7. TRẢ VỀ KẾT QUẢ CHO CLIENT
        // ==========================================
        if (aiReply) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: aiReply })
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: "Hệ thống AI đang tạm thời quá tải hoặc đang xoay vòng hạn ngạch. Vui lòng thử lại sau vài giây hoặc vào Cài đặt để thêm API Key cá nhân!"
                })
            };
        }
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};