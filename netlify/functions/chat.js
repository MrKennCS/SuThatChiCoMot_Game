const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async function(event, context) {
    // Xử lý preflight CORS request
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    // Chỉ chấp nhận phương thức POST
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

        const { prompt } = bodyObj;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Chưa cấu hình GEMINI_API_KEY trên biến môi trường (Environment Variables) của Netlify." })
            };
        }

        // Payload gửi đến Gemini với safetySettings mở cho nội dung trinh thám
        const requestPayload = {
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

        // Chỉ gọi tuần tự từng model để TIẾT KIỆM QUOTA (Google Free Tier giới hạn 5 request/phút)
        // 1 tin nhắn = đúng 1 request duy nhất (không bắn song song làm cạn quota)
        const models = [
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash"
        ];

        let aiResponse = "";
        let lastError = "";

        for (const model of models) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestPayload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await res.json();

                if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    aiResponse = data.candidates[0].content.parts[0].text;
                    break;
                }

                // Nếu bị chặn bởi Safety filter
                if (data.candidates && data.candidates[0]?.finishReason === "SAFETY") {
                    aiResponse = "Tôi... tôi không có gì để nói thêm về việc này!";
                    break;
                }

                const errMsg = data.error?.message || `Lỗi HTTP ${res.status}`;
                lastError = errMsg;

                // Nếu gặp lỗi quá giới hạn Quota Free Tier (429 Rate Limit)
                if (res.status === 429 || errMsg.toLowerCase().includes("quota")) {
                    lastError = "Bạn đang gửi câu hỏi quá nhanh! Google Free Tier giới hạn lượt gọi, vui lòng đợi 10-15 giây rồi gửi lại nhé.";
                    break; // Dừng ngay không thử model khác để tránh bị phạt rate limit
                }
            } catch (err) {
                clearTimeout(timeoutId);
                lastError = err.name === "AbortError" ? "Quá thời gian phản hồi từ máy chủ AI." : err.message;
            }
        }

        if (aiResponse) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: aiResponse })
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: lastError || "Không thể kết nối đến máy chủ AI." })
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